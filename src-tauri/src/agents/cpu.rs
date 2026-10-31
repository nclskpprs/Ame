//! CPU and memory use of process trees (an agent and everything it started).

use std::collections::HashMap;

use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};

/// Usage of one process tree.
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct TreeUsage {
    /// Percent of one core (can exceed 100 on several cores).
    pub cpu: f32,
    /// Resident memory in bytes.
    pub memory: u64,
}

/// Upper bound of processes visited per tree, against cycles from reused pids.
const MAX_TREE_SIZE: usize = 10_000;

pub struct CpuMonitor {
    system: System,
}

impl Default for CpuMonitor {
    fn default() -> Self {
        Self {
            system: System::new(),
        }
    }
}

impl CpuMonitor {
    /// Refreshes all processes and sums CPU and memory per root process and
    /// its descendants. CPU values need two refreshes to be meaningful.
    pub fn tree_usage(&mut self, roots: &[u32]) -> HashMap<u32, TreeUsage> {
        self.system.refresh_processes_specifics(
            ProcessesToUpdate::All,
            true,
            ProcessRefreshKind::nothing().with_cpu().with_memory(),
        );
        let processes = self.system.processes();
        let mut children: HashMap<Pid, Vec<Pid>> = HashMap::new();
        for (pid, process) in processes {
            if let Some(parent) = process.parent() {
                children.entry(parent).or_default().push(*pid);
            }
        }
        roots
            .iter()
            .map(|&root| {
                let mut usage = TreeUsage::default();
                let mut stack = vec![Pid::from_u32(root)];
                let mut visited = 0;
                while let Some(pid) = stack.pop() {
                    visited += 1;
                    if visited > MAX_TREE_SIZE {
                        break;
                    }
                    if let Some(process) = processes.get(&pid) {
                        usage.cpu += process.cpu_usage();
                        usage.memory += process.memory();
                    }
                    if let Some(kids) = children.get(&pid) {
                        stack.extend(kids.iter().copied());
                    }
                }
                (root, usage)
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn measures_the_own_process() {
        let mut monitor = CpuMonitor::default();
        let pid = std::process::id();
        let usage = monitor.tree_usage(&[pid]);
        assert!(usage[&pid].memory > 0);
        assert_eq!(
            monitor.tree_usage(&[u32::MAX])[&u32::MAX],
            TreeUsage::default()
        );
    }
}
