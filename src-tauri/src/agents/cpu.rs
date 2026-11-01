//! CPU and memory use of process trees (an agent and everything it started).

use std::collections::HashMap;

use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};

use crate::pty::tree;

/// Usage of one process tree.
#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct TreeUsage {
    /// Percent of one core (can exceed 100 on several cores).
    pub cpu: f32,
    /// Resident memory in bytes.
    pub memory: u64,
}

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
        let children = tree::children(&self.system);
        roots
            .iter()
            .map(|&root| {
                let mut usage = TreeUsage::default();
                for pid in tree::tree(&children, Pid::from_u32(root)) {
                    if let Some(process) = processes.get(&pid) {
                        usage.cpu += process.cpu_usage();
                        usage.memory += process.memory();
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
