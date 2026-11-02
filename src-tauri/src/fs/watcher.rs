//! Watches projects for changes on disk and emits debounced [`FsChanged`]
//! events with project-relative paths (ADR 0024, which replaces ADR 0015).
//!
//! - **macOS and Windows** watch each project root recursively. FSEvents and
//!   `ReadDirectoryChangesW` do this with a single OS handle, so changes in
//!   collapsed folders reach the file tree and the git status too. Changes
//!   in paths excluded by the root `.gitignore` (e.g. `node_modules`,
//!   `target`) are dropped unless their folder is shown, so builds do not
//!   flood the UI.
//! - **Linux** (inotify needs one watch per directory) watches only the
//!   directories the UI shows, non-recursively, as before.
//! - Everywhere, `.git` is watched for commits, checkouts and staging:
//!   `HEAD`, `index`, `packed-refs` and `refs/heads/…` are reported, other
//!   paths inside `.git` are not.
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

use ignore::gitignore::{Gitignore, GitignoreBuilder};
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

/// Whether project roots are watched recursively (see the module docs).
const RECURSIVE: bool = cfg!(any(target_os = "macos", windows));

/// Files or directories that changed on disk.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct FsChanged {
    pub project: String,
    /// Project-relative paths of the changed entries. Paths inside `.git`
    /// only signal a change of the git state.
    pub paths: Vec<String>,
}

/// What is watched for one project.
struct ProjectWatch {
    root: PathBuf,
    /// The root with symlinks resolved: FSEvents reports real paths.
    canonical: PathBuf,
    /// Directories the UI shows (absolute).
    visible: HashSet<PathBuf>,
    /// OS watches held for this project, with their mode.
    watches: HashSet<PathBuf>,
    /// Ignore rules of the root, built on the first change; `None` until
    /// then and after `.gitignore` changed.
    ignore: Option<Gitignore>,
}

impl ProjectWatch {
    /// The project-relative path of a reported path, if it is in the project.
    fn relative(&self, path: &Path) -> Option<String> {
        relative(&self.root, path).or_else(|| relative(&self.canonical, path))
    }

    /// Whether a change at `rel` (absolute `path`) is worth reporting.
    fn wants(&mut self, rel: &str, path: &Path) -> bool {
        if rel.is_empty() {
            return false;
        }
        if rel == ".git" || rel.starts_with(".git/") {
            return is_git_signal(rel);
        }
        if !RECURSIVE {
            return true;
        }
        if rel == ".gitignore" {
            self.ignore = None;
            return true;
        }
        let shown = path
            .parent()
            .is_some_and(|parent| self.visible.contains(parent) || self.canonical_visible(parent));
        shown || !self.ignored(rel, path)
    }

    fn canonical_visible(&self, parent: &Path) -> bool {
        parent
            .strip_prefix(&self.canonical)
            .is_ok_and(|rest| self.visible.contains(&self.root.join(rest)))
    }

    fn ignored(&mut self, rel: &str, path: &Path) -> bool {
        let root = &self.root;
        let ignore = self.ignore.get_or_insert_with(|| root_ignore(root));
        ignore
            .matched_path_or_any_parents(rel, path.is_dir())
            .is_ignore()
    }
}

/// The ignore rules of a project root: `.gitignore` and `.git/info/exclude`.
/// Nested `.gitignore` files are not read; their paths are reported, which
/// costs a little and is never wrong.
fn root_ignore(root: &Path) -> Gitignore {
    let mut builder = GitignoreBuilder::new(root);
    // Missing files are fine; broken lines are skipped by the builder.
    let _ = builder.add(root.join(".gitignore"));
    let _ = builder.add(root.join(".git").join("info").join("exclude"));
    builder.build().unwrap_or_else(|_| Gitignore::empty())
}

/// Paths inside `.git` that mean the git state changed.
fn is_git_signal(rel: &str) -> bool {
    matches!(rel, ".git/HEAD" | ".git/index" | ".git/packed-refs")
        || rel.starts_with(".git/refs/heads/")
}

type Watched = HashMap<String, ProjectWatch>;

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
                    let events = group_by_project(
                        &mut lock(&handler_watched),
                        paths.iter().map(PathBuf::as_path),
                    );
                    for event in events {
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

    /// Sets the directories of a project the UI shows (absolute, the root
    /// included) and starts watching the project if needed.
    pub fn set_watched(&self, project: &str, root: &Path, visible: HashSet<PathBuf>) {
        let mut watched = lock(&self.watched);
        let wanted = wanted_watches(root, &visible);
        let previous = watched
            .remove(project)
            .map(|watch| (watch.watches, watch.ignore))
            .unwrap_or_default();
        self.apply(&watched, &previous.0, &wanted);
        watched.insert(
            project.to_owned(),
            ProjectWatch {
                root: root.to_path_buf(),
                canonical: root.canonicalize().unwrap_or_else(|_| root.to_path_buf()),
                visible,
                watches: wanted,
                ignore: previous.1,
            },
        );
    }

    /// Stops watching a project.
    pub fn unwatch_project(&self, project: &str) {
        let mut watched = lock(&self.watched);
        if let Some(watch) = watched.remove(project) {
            self.apply(&watched, &watch.watches, &HashSet::new());
        }
    }

    /// Adds and removes OS watches; ones another project holds stay.
    fn apply(&self, others: &Watched, previous: &HashSet<PathBuf>, wanted: &HashSet<PathBuf>) {
        let held_elsewhere =
            |dir: &PathBuf| others.values().any(|other| other.watches.contains(dir));
        let mode = if RECURSIVE {
            RecursiveMode::Recursive
        } else {
            RecursiveMode::NonRecursive
        };
        let mut watcher = lock(&self.watcher);
        for dir in previous.difference(wanted) {
            if !held_elsewhere(dir) {
                // The directory may already be gone; nothing to do then.
                let _ = watcher.unwatch(dir);
            }
        }
        for dir in wanted.difference(previous) {
            if !held_elsewhere(dir)
                && let Err(err) = watcher.watch(dir, mode)
            {
                log::debug!("could not watch {}: {err}", dir.display());
            }
        }
    }
}

/// The OS watches a project needs: its root (recursive platforms), or the
/// shown directories and `.git` (Linux).
fn wanted_watches(root: &Path, visible: &HashSet<PathBuf>) -> HashSet<PathBuf> {
    if RECURSIVE {
        return HashSet::from([root.to_path_buf()]);
    }
    let mut dirs = visible.clone();
    let git = root.join(".git");
    if git.is_dir() {
        dirs.insert(git.join("refs").join("heads"));
        dirs.insert(git);
    }
    dirs
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

/// Maps changed absolute paths to the project-relative paths each project
/// wants (see [`ProjectWatch::wants`]).
fn group_by_project<'a>(
    projects: &mut Watched,
    paths: impl Iterator<Item = &'a Path>,
) -> Vec<FsChanged> {
    let mut grouped: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    for path in paths {
        for (project, watch) in projects.iter_mut() {
            if let Some(rel) = watch.relative(path)
                && watch.wants(&rel, path)
            {
                grouped.entry(project.clone()).or_default().insert(rel);
            }
        }
    }
    grouped
        .into_iter()
        .map(|(project, paths)| FsChanged {
            project,
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

    fn watch(root: &str, visible: &[&str]) -> ProjectWatch {
        ProjectWatch {
            root: PathBuf::from(root),
            canonical: PathBuf::from(format!("/private{root}")),
            visible: visible.iter().map(PathBuf::from).collect(),
            watches: HashSet::new(),
            ignore: Some(Gitignore::empty()),
        }
    }

    #[test]
    fn groups_changes_by_project() {
        let mut projects = Watched::from([
            ("/a".to_owned(), watch("/a", &["/a"])),
            ("/b".to_owned(), watch("/b", &["/b"])),
        ]);
        let paths = [
            PathBuf::from("/a/src/main.rs"),
            PathBuf::from("/private/a/src/main.rs"),
            PathBuf::from("/b/README.md"),
            PathBuf::from("/c/other.txt"),
        ];
        let changed = group_by_project(&mut projects, paths.iter().map(PathBuf::as_path));
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

    #[test]
    fn reports_only_git_state_changes_inside_git() {
        assert!(is_git_signal(".git/HEAD"));
        assert!(is_git_signal(".git/index"));
        assert!(is_git_signal(".git/refs/heads/feat/x"));
        assert!(!is_git_signal(".git/objects/ab/cdef"));
        assert!(!is_git_signal(".git/index.lock"));
        assert!(!is_git_signal(".git/refs/ame/checkpoints/1"));
    }

    #[cfg(any(target_os = "macos", windows))]
    #[test]
    fn drops_ignored_paths_unless_their_folder_is_shown() {
        let dir = tempfile::TempDir::new().unwrap();
        let root = dir.path();
        std::fs::write(root.join(".gitignore"), "node_modules/\n*.log\n").unwrap();
        std::fs::create_dir_all(root.join("node_modules/pkg")).unwrap();
        let mut project = ProjectWatch {
            root: root.to_path_buf(),
            canonical: root.canonicalize().unwrap(),
            visible: HashSet::from([root.to_path_buf()]),
            watches: HashSet::new(),
            ignore: None,
        };
        let mut wants = |rel: &str| project.wants(rel, &root.join(rel));
        assert!(wants("src/main.rs"));
        assert!(!wants("node_modules/pkg/index.js"));
        assert!(!wants("src/debug.log"));
        // Shown in the tree (the root is visible): reported.
        assert!(wants("app.log"));
        assert!(wants(".gitignore"));
        assert!(!wants(".git/objects/ab"));
    }

    #[test]
    fn watches_whole_projects_where_it_is_cheap() {
        let dir = tempfile::TempDir::new().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join(".git/refs/heads")).unwrap();
        let visible = HashSet::from([root.to_path_buf(), root.join("src")]);
        let wanted = wanted_watches(root, &visible);
        if RECURSIVE {
            assert_eq!(wanted, HashSet::from([root.to_path_buf()]));
        } else {
            assert!(wanted.contains(&root.join("src")));
            assert!(wanted.contains(&root.join(".git")));
        }
    }
}
