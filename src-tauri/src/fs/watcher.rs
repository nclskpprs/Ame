//! Watches the directories the UI shows (expanded folders and the folders of
//! open files), non-recursively, and emits debounced [`FsChanged`] events.
//!
//! Watching only what is visible keeps the number of OS watches small, even
//! in repositories with huge ignored folders such as `node_modules`.

use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;

use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{DebounceEventResult, Debouncer, new_debouncer};
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::AppHandle;
use tauri_specta::Event;

use super::path::relative;
use crate::error::{Error, Result};

const DEBOUNCE: Duration = Duration::from_millis(150);

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
    debouncer: Mutex<Debouncer<RecommendedWatcher>>,
}

impl FsWatcher {
    pub fn new(app: AppHandle) -> Result<Self> {
        let watched = Arc::new(Mutex::new(Watched::new()));
        let handler_watched = Arc::clone(&watched);
        let debouncer = new_debouncer(DEBOUNCE, move |result: DebounceEventResult| {
            let Ok(events) = result else { return };
            let projects: Vec<String> = lock(&handler_watched).keys().cloned().collect();
            let changed =
                group_by_project(&projects, events.iter().map(|event| event.path.as_path()));
            for event in changed {
                if let Err(err) = event.emit(&app) {
                    log::warn!("could not emit file change event: {err}");
                }
            }
        })
        .map_err(|err| Error::Io(err.to_string()))?;

        Ok(Self {
            watched,
            debouncer: Mutex::new(debouncer),
        })
    }

    /// Replaces the watched directories of a project. An empty set stops
    /// watching the project.
    pub fn set_watched(&self, project: &str, dirs: HashSet<PathBuf>) {
        let mut watched = lock(&self.watched);
        let previous = watched.remove(project).unwrap_or_default();
        let watched_elsewhere = |dir: &PathBuf| watched.values().any(|other| other.contains(dir));

        let mut debouncer = lock(&self.debouncer);
        let watcher = debouncer.watcher();
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
        drop(debouncer);

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
