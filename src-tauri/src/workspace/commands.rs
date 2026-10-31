//! Tauri commands for settings and app information.

use serde::Serialize;
use specta::Type;
use tauri::{AppHandle, State};

use super::paths::AppPaths;
use super::settings::{Settings, SettingsStore};
use crate::error::Result;

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
