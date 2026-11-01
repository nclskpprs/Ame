//! Process trees: a session's program and everything it started.

use std::collections::HashMap;

use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, Signal, System};

/// Upper bound of processes visited per tree, against cycles from reused pids.
const MAX_TREE_SIZE: usize = 10_000;

/// Parent → children of every process of a refreshed [`System`]. Threads
/// are left out: sysinfo lists them as processes on Linux, and each one
/// reports the memory of its whole process.
pub fn children(system: &System) -> HashMap<Pid, Vec<Pid>> {
    let mut children: HashMap<Pid, Vec<Pid>> = HashMap::new();
    for (pid, process) in system.processes() {
        if process.thread_kind().is_some() {
            continue;
        }
        if let Some(parent) = process.parent() {
            children.entry(parent).or_default().push(*pid);
        }
    }
    children
}

/// `root` and all its descendants, root first.
pub fn tree(children: &HashMap<Pid, Vec<Pid>>, root: Pid) -> Vec<Pid> {
    let mut tree = Vec::new();
    let mut stack = vec![root];
    while let Some(pid) = stack.pop() {
        if tree.len() >= MAX_TREE_SIZE {
            break;
        }
        tree.push(pid);
        if let Some(kids) = children.get(&pid) {
            stack.extend(kids.iter().copied());
        }
    }
    tree
}

/// Asks every descendant of the `roots` to end (SIGTERM on Unix, terminate
/// on Windows). The roots themselves are left to the PTY session, which
/// ends them in its own way. Without this, programs an agent started in the
/// background (dev servers, watchers) would outlive the session.
pub fn end_descendants(roots: &[u32]) {
    if roots.is_empty() {
        return;
    }
    let mut system = System::new();
    system.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::nothing());
    let children = children(&system);
    for &root in roots {
        for pid in tree(&children, Pid::from_u32(root)).into_iter().skip(1) {
            if let Some(process) = system.process(pid) {
                // Windows only knows "kill".
                if process.kill_with(Signal::Term).is_none() {
                    process.kill();
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn walks_a_tree_from_the_root() {
        let pid = Pid::from_u32;
        let children = HashMap::from([
            (pid(1), vec![pid(2), pid(3)]),
            (pid(3), vec![pid(4)]),
            (pid(9), vec![pid(10)]),
        ]);
        let mut tree = tree(&children, pid(1));
        assert_eq!(tree[0], pid(1));
        tree.sort();
        assert_eq!(tree, [pid(1), pid(2), pid(3), pid(4)]);
    }

    #[test]
    fn threads_are_not_part_of_the_tree() {
        // The test binary runs several threads.
        let _worker = std::thread::spawn(|| std::thread::sleep(std::time::Duration::from_secs(2)));
        let mut system = System::new();
        system.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing(),
        );
        let root = Pid::from_u32(std::process::id());
        for pid in tree(&children(&system), root) {
            let process = system.process(pid);
            assert!(
                process.is_none_or(|process| process.thread_kind().is_none()),
                "{pid} is a thread"
            );
        }
    }

    #[test]
    fn cycles_from_reused_pids_end() {
        let pid = Pid::from_u32;
        let children = HashMap::from([(pid(1), vec![pid(2)]), (pid(2), vec![pid(1)])]);
        assert_eq!(tree(&children, pid(1)).len(), MAX_TREE_SIZE);
    }
}
