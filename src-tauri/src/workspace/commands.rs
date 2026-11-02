//! Tauri commands for projects, settings and app information.

use std::path::PathBuf;

use serde::Serialize;
use specta::Type;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use super::paths::AppPaths;
use super::projects::{ProjectLayout, WorkspaceState, WorkspaceStore};
use super::settings::{Settings, SettingsStore};
use crate::error::Result;
use crate::fs::watcher::FsWatcher;
use crate::pty::PtyManager;

/// Static information about the running app.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
    /// `true` when running in portable mode (config next to the executable).
    pub portable: bool,
    pub config_dir: String,
}

#[tauri::command]
#[specta::specta]
pub fn get_settings(store: State<'_, SettingsStore>) -> Settings {
    store.get()
}

/// Replaces all settings. Async so the file write does not block the main
/// thread.
#[tauri::command]
#[specta::specta]
pub async fn set_settings(store: State<'_, SettingsStore>, settings: Settings) -> Result<()> {
    store.set(settings)
}

#[tauri::command]
#[specta::specta]
pub fn get_app_info(app: AppHandle, paths: State<'_, AppPaths>) -> AppInfo {
    AppInfo {
        version: app.package_info().version.to_string(),
        portable: paths.is_portable(),
        config_dir: paths.config_dir.display().to_string(),
    }
}

#[tauri::command]
#[specta::specta]
pub fn get_workspace(store: State<'_, WorkspaceStore>) -> WorkspaceState {
    store.snapshot()
}

/// Shows the native folder picker. Returns `None` when it was cancelled.
#[tauri::command]
#[specta::specta]
pub async fn pick_folder(app: AppHandle) -> Option<String> {
    let folder =
        tauri::async_runtime::spawn_blocking(move || app.dialog().file().blocking_pick_folder())
            .await
            .ok()
            .flatten()?;
    folder
        .into_path()
        .ok()
        .map(|path| path.display().to_string())
}

#[tauri::command]
#[specta::specta]
pub async fn add_project(store: State<'_, WorkspaceStore>, path: String) -> Result<WorkspaceState> {
    store.add(&PathBuf::from(path))
}

#[tauri::command]
#[specta::specta]
pub async fn remove_project(
    store: State<'_, WorkspaceStore>,
    watcher: State<'_, FsWatcher>,
    pty: State<'_, PtyManager>,
    project: String,
) -> Result<WorkspaceState> {
    watcher.unwatch_project(&project);
    pty.close_project(&project);
    store.remove(&project)
}

#[tauri::command]
#[specta::specta]
pub async fn set_active_project(
    store: State<'_, WorkspaceStore>,
    project: String,
) -> Result<WorkspaceState> {
    store.set_active(&project)
}

#[tauri::command]
#[specta::specta]
pub async fn set_project_pinned(
    store: State<'_, WorkspaceStore>,
    project: String,
    pinned: bool,
) -> Result<WorkspaceState> {
    store.set_pinned(&project, pinned)
}

/// Turns the OS notifications for the agents of a project off or on.
#[tauri::command]
#[specta::specta]
pub async fn set_project_muted(
    store: State<'_, WorkspaceStore>,
    project: String,
    muted: bool,
) -> Result<WorkspaceState> {
    store.set_muted(&project, muted)
}

/// Sets the group of a project; `null` or a blank name removes it.
#[tauri::command]
#[specta::specta]
pub async fn set_project_group(
    store: State<'_, WorkspaceStore>,
    project: String,
    group: Option<String>,
) -> Result<WorkspaceState> {
    store.set_group(&project, group)
}

#[tauri::command]
#[specta::specta]
pub async fn set_project_layout(
    store: State<'_, WorkspaceStore>,
    project: String,
    layout: ProjectLayout,
) -> Result<WorkspaceState> {
    store.set_layout(&project, layout)
}
