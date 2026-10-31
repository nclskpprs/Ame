//! Watches the directories the UI shows (expanded folders and the folders of
//! open files), non-recursively, and emits debounced [`FsChanged`] events.
//!
//! Watching only what is visible keeps the number of OS watches small, even
//! in repositories with huge ignored folders such as `node_modules`.
//!
//! Reads are not changes: inotify also reports opening and closing files and
//! directories, and the UI reads a folder again after every change, so these
//! events would feed back into an endless loop. Only writes, creations,
//! deletions, renames and attribute changes are reported.

use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant};

use notify::event::{AccessKind, AccessMode, MetadataKind, ModifyKind};
use notify::{Event as NotifyEvent, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::AppHandle;
use tauri_specta::Event;

use super::path::relative;
use crate::error::{Error, Result};

/// Changes are reported once no new change came in for this long…
const DEBOUNCE: Duration = Duration::from_millis(150);
/// …but at least this often while changes keep coming (e.g. a build).
const MAX_DELAY: Duration = Duration::from_secs(1);

/// Files or directories that changed on disk.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct FsChanged {
    pub project: String,
    /// Project-relative paths of the changed entries.
    pub paths: Vec<String>,
}

/// Watched directories per project (project path → absolute directories).
type Watched = HashMap<String, HashSet<PathBuf>>;

pub struct FsWatcher {
    watched: Arc<Mutex<Watched>>,
    watcher: Mutex<RecommendedWatcher>,
}

impl FsWatcher {
    pub fn new(app: AppHandle) -> Result<Self> {
        let watched = Arc::new(Mutex::new(Watched::new()));
        let (paths_tx, paths_rx) = mpsc::channel::<PathBuf>();
        let watcher = notify::recommended_watcher(move |result: notify::Result<NotifyEvent>| {
            let Ok(event) = result else { return };
            if is_change(&event.kind) {
                for path in event.paths {
                    // The receiver only stops when the app quits.
                    let _ = paths_tx.send(path);
                }
            }
        })
        .map_err(|err| Error::Io(err.to_string()))?;

        let handler_watched = Arc::clone(&watched);
        std::thread::Builder::new()
            .name("fs-watcher".into())
            .spawn(move || {
                debounce(&paths_rx, |paths| {
                    let projects: Vec<String> = lock(&handler_watched).keys().cloned().collect();
                    for event in group_by_project(&projects, paths.iter().map(PathBuf::as_path)) {
                        if let Err(err) = event.emit(&app) {
                            log::warn!("could not emit file change event: {err}");
                        }
                    }
                });
            })?;

        Ok(Self {
            watched,
            watcher: Mutex::new(watcher),
        })
    }

    /// Replaces the watched directories of a project. An empty set stops
    /// watching the project.
    pub fn set_watched(&self, project: &str, dirs: HashSet<PathBuf>) {
        let mut watched = lock(&self.watched);
        let previous = watched.remove(project).unwrap_or_default();
        let watched_elsewhere = |dir: &PathBuf| watched.values().any(|other| other.contains(dir));

        let mut watcher = lock(&self.watcher);
        for dir in previous.difference(&dirs) {
            if !watched_elsewhere(dir) {
                // The directory may already be gone; nothing to do then.
                let _ = watcher.unwatch(dir);
            }
        }
        for dir in dirs.difference(&previous) {
            if !watched_elsewhere(dir)
                && let Err(err) = watcher.watch(dir, RecursiveMode::NonRecursive)
            {
                log::debug!("could not watch {}: {err}", dir.display());
            }
        }
        drop(watcher);

        if !dirs.is_empty() {
            watched.insert(project.to_owned(), dirs);
        }
    }
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

/// Whether an event changes something on disk. Opening, reading and closing
/// without writing are not changes (see the module docs).
fn is_change(kind: &EventKind) -> bool {
    match kind {
        EventKind::Access(AccessKind::Close(AccessMode::Write)) => true,
        EventKind::Access(_) => false,
        EventKind::Modify(ModifyKind::Metadata(MetadataKind::AccessTime)) => false,
        _ => true,
    }
}

/// Collects paths until no new one arrived for [`DEBOUNCE`] (or [`MAX_DELAY`]
/// passed), then hands the batch to `flush`. Ends when the sender is gone.
fn debounce(paths: &Receiver<PathBuf>, mut flush: impl FnMut(BTreeSet<PathBuf>)) {
    while let Ok(first) = paths.recv() {
        let started = Instant::now();
        let mut batch = BTreeSet::from([first]);
        let mut disconnected = false;
        while started.elapsed() < MAX_DELAY {
            match paths.recv_timeout(DEBOUNCE) {
                Ok(path) => {
                    batch.insert(path);
                }
                Err(RecvTimeoutError::Timeout) => break,
                Err(RecvTimeoutError::Disconnected) => {
                    disconnected = true;
                    break;
                }
            }
        }
        flush(batch);
        if disconnected {
            break;
        }
    }
}

/// Maps changed absolute paths to project-relative paths per project.
fn group_by_project<'a>(
    projects: &[String],
    paths: impl Iterator<Item = &'a Path>,
) -> Vec<FsChanged> {
    let mut grouped: BTreeMap<&str, BTreeSet<String>> = BTreeMap::new();
    for path in paths {
        for project in projects {
            if let Some(rel) = relative(Path::new(project), path) {
                grouped.entry(project).or_default().insert(rel);
            }
        }
    }
    grouped
        .into_iter()
        .map(|(project, paths)| FsChanged {
            project: project.to_owned(),
            paths: paths.into_iter().collect(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_are_not_changes() {
        use notify::event::{CreateKind, DataChange, RemoveKind};
        assert!(!is_change(&EventKind::Access(AccessKind::Open(
            AccessMode::Any
        ))));
        assert!(!is_change(&EventKind::Access(AccessKind::Close(
            AccessMode::Read
        ))));
        assert!(!is_change(&EventKind::Modify(ModifyKind::Metadata(
            MetadataKind::AccessTime
        ))));
        assert!(is_change(&EventKind::Access(AccessKind::Close(
            AccessMode::Write
        ))));
        assert!(is_change(&EventKind::Create(CreateKind::File)));
        assert!(is_change(&EventKind::Modify(ModifyKind::Data(
            DataChange::Any
        ))));
        assert!(is_change(&EventKind::Remove(RemoveKind::Any)));
    }

    #[test]
    fn debounces_bursts_into_one_batch() {
        let (tx, rx) = mpsc::channel();
        for name in ["a", "b", "a"] {
            tx.send(PathBuf::from(name)).unwrap();
        }
        drop(tx);
        let mut batches = Vec::new();
        debounce(&rx, |batch| batches.push(batch));
        assert_eq!(
            batches,
            vec![BTreeSet::from([PathBuf::from("a"), PathBuf::from("b")])]
        );
    }

    #[test]
    fn reports_writes_but_not_reads() {
        let dir = tempfile::TempDir::new().unwrap();
        let (tx, rx) = mpsc::channel();
        let mut watcher =
            notify::recommended_watcher(move |result: notify::Result<NotifyEvent>| {
                if let Ok(event) = result
                    && is_change(&event.kind)
                {
                    let _ = tx.send(event.paths);
                }
            })
            .unwrap();
        let file = dir.path().join("a.txt");
        std::fs::write(&file, "x").unwrap();
        watcher
            .watch(dir.path(), RecursiveMode::NonRecursive)
            .unwrap();
        // Reading the folder and the file must not produce events.
        let _ = std::fs::read_dir(dir.path()).unwrap().count();
        let _ = std::fs::read_to_string(&file).unwrap();
        assert!(rx.recv_timeout(Duration::from_millis(300)).is_err());
        std::fs::write(&file, "y").unwrap();
        let paths = rx.recv_timeout(Duration::from_secs(5)).unwrap();
        assert!(paths.iter().any(|path| path.ends_with("a.txt")));
    }

    #[test]
    fn groups_changes_by_project() {
        let projects = vec!["/a".to_owned(), "/b".to_owned()];
        let paths = [
            PathBuf::from("/a/src/main.rs"),
            PathBuf::from("/a/src/main.rs"),
            PathBuf::from("/b/README.md"),
            PathBuf::from("/c/other.txt"),
        ];
        let changed = group_by_project(&projects, paths.iter().map(PathBuf::as_path));
        assert_eq!(
            changed,
            vec![
                FsChanged {
                    project: "/a".into(),
                    paths: vec!["src/main.rs".into()]
                },
                FsChanged {
                    project: "/b".into(),
                    paths: vec!["README.md".into()]
                },
            ]
        );
    }
}
