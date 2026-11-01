//! Startup time and memory measurement (ADR 0022).
//!
//! The frontend reports its first painted frame with [`app_ready`]. The
//! backend logs the startup time from the start of the process. With the
//! environment variable `AME_BENCH` set to a file path, the app waits until
//! it settled, measures the memory of its whole process tree (the web view
//! runs in child processes on Linux and Windows), writes the result as JSON
//! to that file and quits. `scripts/bench.mjs` drives this in CI.
//!
//! On Linux the memory is the proportional set size (PSS): shared libraries
//! such as GTK and WebKit count once across the tree instead of once per
//! process. Elsewhere it is the resident set size (RSS).

use std::path::PathBuf;
use std::sync::OnceLock;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use serde::Serialize;
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};
use tauri::AppHandle;

use crate::pty::tree;

/// Environment variable with the path of the result file.
pub const BENCH_ENV: &str = "AME_BENCH";
/// Time to let the app settle before measuring memory (lazy loading,
/// the web view's first garbage collection).
const SETTLE: Duration = Duration::from_secs(5);

static START: OnceLock<Instant> = OnceLock::new();
static READY: AtomicBool = AtomicBool::new(false);

/// Remembers when the process started. Called first thing in `main`.
pub fn mark_start() {
    START.get_or_init(Instant::now);
}

/// One process of the app's tree.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessMemory {
    pub pid: u32,
    pub name: String,
    pub memory_mb: f64,
}

/// What a benchmark run writes.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BenchResult {
    /// From the start of the process to the first painted frame.
    pub startup_ms: f64,
    /// Memory of the whole process tree after settling, see `memory_kind`.
    pub memory_mb: f64,
    /// `pss` (Linux) or `rss`.
    pub memory_kind: String,
    pub processes: Vec<ProcessMemory>,
    pub os: String,
}

/// The frontend painted its first frame. Logs the startup time and, in
/// benchmark mode, measures and quits. Later calls (web view reloads) are
/// ignored.
#[tauri::command]
#[specta::specta]
pub fn app_ready(app: AppHandle) {
    if READY.swap(true, Ordering::Relaxed) {
        return;
    }
    let startup = START.get().map_or(Duration::ZERO, Instant::elapsed);
    log::info!("ready after {} ms", startup.as_millis());
    let Some(output) = std::env::var_os(BENCH_ENV).map(PathBuf::from) else {
        return;
    };
    let spawned = std::thread::Builder::new()
        .name("bench".into())
        .spawn(move || {
            std::thread::sleep(SETTLE);
            let result = measure(startup);
            let code = match write(&output, &result) {
                Ok(()) => 0,
                Err(err) => {
                    eprintln!("could not write the benchmark result: {err}");
                    1
                }
            };
            app.exit(code);
        });
    if let Err(err) = spawned {
        eprintln!("could not start the benchmark thread: {err}");
    }
}

fn measure(startup: Duration) -> BenchResult {
    let mut system = System::new();
    system.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing().with_memory(),
    );
    let children = tree::children(&system);
    let root = Pid::from_u32(std::process::id());
    let processes: Vec<_> = tree::tree(&children, root)
        .into_iter()
        .filter_map(|pid| system.process(pid))
        .map(|process| {
            let pid = process.pid().as_u32();
            ProcessMemory {
                pid,
                name: process.name().to_string_lossy().into_owned(),
                memory_mb: megabytes(proportional(pid).unwrap_or(process.memory())),
            }
        })
        .collect();
    BenchResult {
        startup_ms: startup.as_secs_f64() * 1000.0,
        memory_mb: processes.iter().map(|p| p.memory_mb).sum(),
        memory_kind: if cfg!(target_os = "linux") {
            "pss"
        } else {
            "rss"
        }
        .to_owned(),
        processes,
        os: std::env::consts::OS.to_owned(),
    }
}

/// The proportional set size in bytes from `/proc/<pid>/smaps_rollup`.
#[cfg(target_os = "linux")]
fn proportional(pid: u32) -> Option<u64> {
    let text = std::fs::read_to_string(format!("/proc/{pid}/smaps_rollup")).ok()?;
    parse_pss(&text)
}

#[cfg(not(target_os = "linux"))]
fn proportional(_pid: u32) -> Option<u64> {
    None
}

/// Reads the `Pss:` line (in kB) of an `smaps_rollup` file.
#[cfg_attr(not(target_os = "linux"), allow(dead_code))]
fn parse_pss(text: &str) -> Option<u64> {
    let line = text.lines().find(|line| line.starts_with("Pss:"))?;
    let kb: u64 = line.split_whitespace().nth(1)?.parse().ok()?;
    Some(kb * 1024)
}

fn megabytes(bytes: u64) -> f64 {
    // Exact for any realistic memory size.
    bytes as f64 / (1024.0 * 1024.0)
}

fn write(path: &std::path::Path, result: &BenchResult) -> std::io::Result<()> {
    let json = serde_json::to_string_pretty(result).map_err(std::io::Error::other)?;
    std::fs::write(path, json)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn measures_the_own_process_tree() {
        let result = measure(Duration::from_millis(1234));
        assert!((result.startup_ms - 1234.0).abs() < 0.001);
        assert!(result.memory_mb > 0.0);
        assert!(!result.processes.is_empty());
    }

    #[test]
    fn parses_the_proportional_set_size() {
        let text = "55d0-7ff0 ---p 00000000 00:00 0 [rollup]\nRss: 1000 kB\nPss: 600 kB\nPss_Anon: 10 kB\n";
        assert_eq!(parse_pss(text), Some(600 * 1024));
        assert_eq!(parse_pss("Rss: 1 kB"), None);
    }

    #[test]
    fn writes_camel_case_json() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("bench.json");
        let result = BenchResult {
            startup_ms: 1.0,
            memory_mb: 2.0,
            memory_kind: "pss".into(),
            processes: vec![ProcessMemory {
                pid: 1,
                name: "ame".into(),
                memory_mb: 2.0,
            }],
            os: "linux".into(),
        };
        write(&path, &result).unwrap();
        let text = std::fs::read_to_string(&path).unwrap();
        assert!(text.contains("\"startupMs\""), "{text}");
        assert!(text.contains("\"memoryMb\""), "{text}");
    }
}
