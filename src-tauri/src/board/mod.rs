//! The board: work packages the user prepares for agents (ADR 0025). Each
//! package is a prompt prepared once and sent to an agent picked by hand.
//!
//! Packages are private to the user: they live in `board.json` in the
//! config directory, never in the project folder.

pub mod commands;

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::error::Result;
use crate::workspace::storage;

pub const BOARD_FILE: &str = "board.json";

/// Current schema version of `board.json`.
pub const BOARD_VERSION: u32 = 1;

/// Where a package is on the board.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum PackageState {
    /// Prepared, not sent yet.
    #[default]
    Open,
    /// Sent to an agent.
    Started,
    /// Marked as done by the user.
    Done,
}

/// A work package: a prompt prepared from a template.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct Package {
    /// Stable id, unique on the board.
    pub id: String,
    /// Path of the project the package belongs to.
    pub project: String,
    /// Id of the template it was made from (see `settings.templates`).
    pub template: String,
    pub title: String,
    /// Values of the template fields by field id.
    pub fields: BTreeMap<String, String>,
    pub state: PackageState,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: f64,
    /// When it was sent to an agent.
    pub started_at: Option<f64>,
    /// Name of the agent it was sent to.
    pub agent: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct BoardFile {
    version: u32,
    packages: Vec<Package>,
}

impl Default for BoardFile {
    fn default() -> Self {
        Self {
            version: BOARD_VERSION,
            packages: Vec::new(),
        }
    }
}

/// Loads and saves the packages of all projects. Managed as Tauri state.
#[derive(Debug)]
pub struct BoardStore {
    path: PathBuf,
    current: Mutex<BoardFile>,
}

impl BoardStore {
    /// Loads `board.json` from `dir`. Never fails: a broken file is set
    /// aside and the board starts empty.
    pub fn load(dir: &Path) -> Self {
        let path = dir.join(BOARD_FILE);
        let current = storage::read_json(&path);
        Self {
            path,
            current: Mutex::new(current),
        }
    }

    /// The packages of a project, in the order they were created.
    pub fn list(&self, project: &str) -> Vec<Package> {
        self.lock()
            .packages
            .iter()
            .filter(|package| package.project == project)
            .cloned()
            .collect()
    }

    /// Adds a package, or replaces the one with the same id.
    pub fn save(&self, package: Package) -> Result<()> {
        self.change(
            |board| match board.packages.iter_mut().find(|p| p.id == package.id) {
                Some(existing) => *existing = package,
                None => board.packages.push(package),
            },
        )
    }

    /// Removes a package; unknown ids are ignored.
    pub fn delete(&self, id: &str) -> Result<()> {
        self.change(|board| board.packages.retain(|p| p.id != id))
    }

    fn change(&self, apply: impl FnOnce(&mut BoardFile)) -> Result<()> {
        let mut current = self.lock();
        let mut next = current.clone();
        apply(&mut next);
        storage::write_json(&self.path, &next)?;
        *current = next;
        Ok(())
    }

    fn lock(&self) -> MutexGuard<'_, BoardFile> {
        // A poisoned lock only means another thread panicked while holding
        // it; the board itself is always in a valid state.
        self.current
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn package(id: &str, project: &str) -> Package {
        Package {
            id: id.to_owned(),
            project: project.to_owned(),
            title: format!("Task {id}"),
            ..Package::default()
        }
    }

    #[test]
    fn saves_lists_and_deletes_per_project() {
        let dir = TempDir::new().unwrap();
        let store = BoardStore::load(dir.path());
        store.save(package("a", "/p")).unwrap();
        store.save(package("b", "/q")).unwrap();
        store.save(package("c", "/p")).unwrap();

        let ids =
            |project| -> Vec<String> { store.list(project).into_iter().map(|p| p.id).collect() };
        assert_eq!(ids("/p"), ["a", "c"]);

        let mut started = package("a", "/p");
        started.state = PackageState::Started;
        store.save(started).unwrap();
        store.delete("c").unwrap();

        let reloaded = BoardStore::load(dir.path());
        let list = reloaded.list("/p");
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].state, PackageState::Started);
        assert_eq!(reloaded.list("/q").len(), 1);
    }
}
