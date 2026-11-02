//! Open projects, their grouping and their restorable layout.
//!
//! Persisted as `workspace.json` in the config directory.

use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use serde::{Deserialize, Serialize};
use specta::Type;

use super::storage;
use crate::error::{Error, Result};

pub const WORKSPACE_FILE: &str = "workspace.json";

/// Current schema version of `workspace.json`.
pub const WORKSPACE_VERSION: u32 = 1;

/// Default width of the side panel (file tree, search) in pixels.
pub const DEFAULT_SIDE_PANEL_WIDTH: u32 = 260;
/// Default height of the terminal panel in pixels.
pub const DEFAULT_TERMINAL_HEIGHT: u32 = 300;

/// An open project folder.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    /// Absolute path of the project folder. Also identifies the project.
    pub path: String,
    /// Display name, the folder name by default.
    pub name: String,
    /// Optional group, e.g. "Client A".
    pub group: Option<String>,
    /// Pinned projects are listed first.
    pub pinned: bool,
    /// No OS notifications for the agents of this project.
    #[serde(default)]
    pub muted: bool,
    /// UI layout restored when the project is shown again.
    #[serde(default)]
    pub layout: ProjectLayout,
}

/// The part of the UI state of a project that survives a restart.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct ProjectLayout {
    /// Open editor tabs as project-relative paths with `/` separators.
    pub open_files: Vec<String>,
    pub active_file: Option<String>,
    /// Expanded directories in the file tree (project-relative).
    pub expanded_dirs: Vec<String>,
    pub side_panel: SidePanel,
    pub side_panel_width: u32,
    /// Whether the terminal panel below the editor is shown.
    pub terminal_open: bool,
    pub terminal_height: u32,
    /// Terminal sessions that were open, offered to resume after a restart.
    pub sessions: Vec<SavedSession>,
    /// Index in `sessions` of the session that was shown last, so the
    /// terminal panel comes back to it.
    pub active_session: Option<u32>,
    /// Follow mode: files an agent changes open in the editor as a diff.
    pub follow: bool,
}

/// A terminal session remembered across restarts.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SavedSession {
    /// Id of the agent profile.
    pub profile: String,
    pub title: String,
    /// Other project folders the agent was given (group sessions).
    #[serde(default)]
    pub dirs: Vec<String>,
}

impl Default for ProjectLayout {
    fn default() -> Self {
        Self {
            open_files: Vec::new(),
            active_file: None,
            expanded_dirs: Vec::new(),
            side_panel: SidePanel::default(),
            side_panel_width: DEFAULT_SIDE_PANEL_WIDTH,
            terminal_open: false,
            terminal_height: DEFAULT_TERMINAL_HEIGHT,
            sessions: Vec::new(),
            active_session: None,
            follow: false,
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum SidePanel {
    #[default]
    Files,
    Search,
    /// Git changes; only offered in git repositories.
    Changes,
    /// `package.json` / `composer.json` scripts; only offered when there are some.
    Scripts,
}

/// Snapshot of the open projects sent to the frontend.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct WorkspaceState {
    pub version: u32,
    /// Projects in the order they were opened.
    pub projects: Vec<Project>,
    /// Path of the project shown in the main area.
    pub active: Option<String>,
}

/// Loads and saves the open projects. Managed as Tauri state.
#[derive(Debug)]
pub struct WorkspaceStore {
    path: PathBuf,
    state: Mutex<WorkspaceState>,
}

impl WorkspaceStore {
    pub fn load(config_dir: &Path) -> Self {
        let path = config_dir.join(WORKSPACE_FILE);
        let mut state: WorkspaceState = storage::read_json(&path);
        state.version = WORKSPACE_VERSION;
        Self {
            path,
            state: Mutex::new(state),
        }
    }

    pub fn snapshot(&self) -> WorkspaceState {
        self.lock().clone()
    }

    /// Returns the root folder of an open project.
    pub fn root(&self, project: &str) -> Result<PathBuf> {
        self.lock()
            .projects
            .iter()
            .find(|p| p.path == project)
            .map(|p| PathBuf::from(&p.path))
            .ok_or_else(|| Error::UnknownProject(project.to_owned()))
    }

    /// Opens a folder as a project and makes it active. Opening a folder
    /// that is already open just activates it.
    pub fn add(&self, folder: &Path) -> Result<WorkspaceState> {
        let canonical = dunce::canonicalize(folder)
            .map_err(|_| Error::NotADirectory(folder.display().to_string()))?;
        if !canonical.is_dir() {
            return Err(Error::NotADirectory(canonical.display().to_string()));
        }
        let path = canonical.display().to_string();
        self.mutate(|state| {
            if !state.projects.iter().any(|p| p.path == path) {
                let name = canonical
                    .file_name()
                    .map(|name| name.to_string_lossy().into_owned())
                    .unwrap_or_else(|| path.clone());
                state.projects.push(Project {
                    path: path.clone(),
                    name,
                    group: None,
                    pinned: false,
                    muted: false,
                    layout: ProjectLayout::default(),
                });
            }
            state.active = Some(path);
            Ok(())
        })
    }

    /// Closes a project. The next project becomes active if needed.
    pub fn remove(&self, project: &str) -> Result<WorkspaceState> {
        self.mutate(|state| {
            let index = position(state, project)?;
            state.projects.remove(index);
            if state.active.as_deref() == Some(project) {
                state.active = state
                    .projects
                    .get(index)
                    .or_else(|| state.projects.last())
                    .map(|p| p.path.clone());
            }
            Ok(())
        })
    }

    pub fn set_active(&self, project: &str) -> Result<WorkspaceState> {
        self.mutate(|state| {
            position(state, project)?;
            state.active = Some(project.to_owned());
            Ok(())
        })
    }

    pub fn set_pinned(&self, project: &str, pinned: bool) -> Result<WorkspaceState> {
        self.update_project(project, |p| p.pinned = pinned)
    }

    pub fn set_muted(&self, project: &str, muted: bool) -> Result<WorkspaceState> {
        self.update_project(project, |p| p.muted = muted)
    }

    /// Sets or clears the group. Blank names clear it.
    pub fn set_group(&self, project: &str, group: Option<String>) -> Result<WorkspaceState> {
        let group = group
            .map(|name| name.trim().to_owned())
            .filter(|name| !name.is_empty());
        self.update_project(project, |p| p.group = group)
    }

    pub fn set_layout(&self, project: &str, layout: ProjectLayout) -> Result<WorkspaceState> {
        self.update_project(project, |p| p.layout = layout)
    }

    fn update_project(
        &self,
        project: &str,
        change: impl FnOnce(&mut Project),
    ) -> Result<WorkspaceState> {
        self.mutate(|state| {
            let index = position(state, project)?;
            change(&mut state.projects[index]);
            Ok(())
        })
    }

    /// Applies a change, persists it and returns the new snapshot. The change
    /// is discarded if saving fails.
    fn mutate(
        &self,
        change: impl FnOnce(&mut WorkspaceState) -> Result<()>,
    ) -> Result<WorkspaceState> {
        let mut state = self.lock();
        let mut next = state.clone();
        change(&mut next)?;
        storage::write_json(&self.path, &next)?;
        *state = next;
        Ok(state.clone())
    }

    fn lock(&self) -> MutexGuard<'_, WorkspaceState> {
        // See `SettingsStore::lock` for why a poisoned lock is fine.
        self.state
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

fn position(state: &WorkspaceState, project: &str) -> Result<usize> {
    state
        .projects
        .iter()
        .position(|p| p.path == project)
        .ok_or_else(|| Error::UnknownProject(project.to_owned()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    struct Fixture {
        config: TempDir,
        projects: TempDir,
    }

    impl Fixture {
        fn new() -> Self {
            Self {
                config: TempDir::new().unwrap(),
                projects: TempDir::new().unwrap(),
            }
        }

        fn store(&self) -> WorkspaceStore {
            WorkspaceStore::load(self.config.path())
        }

        fn folder(&self, name: &str) -> PathBuf {
            let path = self.projects.path().join(name);
            fs::create_dir_all(&path).unwrap();
            path
        }
    }

    fn canonical(path: &Path) -> String {
        dunce::canonicalize(path).unwrap().display().to_string()
    }

    #[test]
    fn add_opens_and_activates_a_folder() {
        let fx = Fixture::new();
        let state = fx.store().add(&fx.folder("alpha")).unwrap();
        assert_eq!(state.projects.len(), 1);
        assert_eq!(state.projects[0].name, "alpha");
        assert_eq!(
            state.active.as_deref(),
            Some(state.projects[0].path.as_str())
        );
    }

    #[test]
    fn adding_the_same_folder_twice_keeps_one_project() {
        let fx = Fixture::new();
        let store = fx.store();
        let folder = fx.folder("alpha");
        store.add(&folder).unwrap();
        store.add(&fx.folder("beta")).unwrap();
        let state = store.add(&folder.join(".")).unwrap();
        assert_eq!(state.projects.len(), 2);
        assert_eq!(state.active, Some(canonical(&folder)));
    }

    #[test]
    fn add_rejects_files_and_missing_paths() {
        let fx = Fixture::new();
        let file = fx.projects.path().join("file.txt");
        fs::write(&file, "").unwrap();
        assert!(matches!(
            fx.store().add(&file),
            Err(Error::NotADirectory(_))
        ));
        assert!(matches!(
            fx.store().add(&fx.projects.path().join("missing")),
            Err(Error::NotADirectory(_))
        ));
    }

    #[test]
    fn state_survives_a_restart() {
        let fx = Fixture::new();
        let store = fx.store();
        let alpha = canonical(&fx.folder("alpha"));
        store.add(Path::new(&alpha)).unwrap();
        store.set_pinned(&alpha, true).unwrap();
        store.set_group(&alpha, Some("  Client A ".into())).unwrap();
        let layout = ProjectLayout {
            open_files: vec!["src/main.rs".into()],
            active_file: Some("src/main.rs".into()),
            ..ProjectLayout::default()
        };
        store.set_layout(&alpha, layout.clone()).unwrap();

        let reloaded = fx.store().snapshot();
        let project = &reloaded.projects[0];
        assert!(project.pinned);
        assert_eq!(project.group.as_deref(), Some("Client A"));
        assert_eq!(project.layout, layout);
        assert_eq!(reloaded.active, Some(alpha));
    }

    #[test]
    fn blank_group_clears_it() {
        let fx = Fixture::new();
        let store = fx.store();
        let alpha = canonical(&fx.folder("alpha"));
        store.add(Path::new(&alpha)).unwrap();
        store.set_group(&alpha, Some("A".into())).unwrap();
        let state = store.set_group(&alpha, Some("   ".into())).unwrap();
        assert_eq!(state.projects[0].group, None);
    }

    #[test]
    fn removing_the_active_project_activates_a_neighbor() {
        let fx = Fixture::new();
        let store = fx.store();
        let alpha = canonical(&fx.folder("alpha"));
        let beta = canonical(&fx.folder("beta"));
        store.add(Path::new(&alpha)).unwrap();
        store.add(Path::new(&beta)).unwrap();
        store.set_active(&alpha).unwrap();

        let state = store.remove(&alpha).unwrap();
        assert_eq!(state.active, Some(beta.clone()));
        let state = store.remove(&beta).unwrap();
        assert_eq!(state.active, None);
        assert!(state.projects.is_empty());
    }

    #[test]
    fn unknown_projects_are_rejected() {
        let fx = Fixture::new();
        assert!(matches!(
            fx.store().set_active("/nope"),
            Err(Error::UnknownProject(_))
        ));
    }

    #[test]
    fn missing_layout_fields_use_defaults() {
        let fx = Fixture::new();
        fs::write(
            fx.config.path().join(WORKSPACE_FILE),
            r#"{ "projects": [{ "path": "/p", "name": "p", "group": null, "pinned": false }] }"#,
        )
        .unwrap();
        let state = fx.store().snapshot();
        assert_eq!(state.projects[0].layout, ProjectLayout::default());
    }
}
