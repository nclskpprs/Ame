//! Tauri commands for the window, the tray and quitting.

use tauri::{AppHandle, Manager, State};

use super::{Tray, TrayModel};
use crate::MAIN_WINDOW;
use crate::error::{Error, Result};

/// Hides the main window; the app keeps running with its sessions.
#[tauri::command]
#[specta::specta]
pub fn hide_window(app: AppHandle) -> Result<()> {
    let window = app
        .get_webview_window(MAIN_WINDOW)
        .ok_or_else(|| Error::Io("the main window is missing".into()))?;
    window.hide().map_err(|err| Error::Io(err.to_string()))
}

/// Shows and focuses the main window.
#[tauri::command]
#[specta::specta]
pub fn show_window(app: AppHandle) {
    super::show_main_window(&app);
}

/// Ends the app and every session. The frontend asks about unsaved files
/// and running agents first.
#[tauri::command]
#[specta::specta]
pub fn quit_app(app: AppHandle) {
    app.exit(0);
}

/// Creates or updates the tray icon and its menu.
#[tauri::command]
#[specta::specta]
pub fn set_tray(app: AppHandle, tray: State<'_, Tray>, model: TrayModel) -> Result<()> {
    tray.update(&app, model)
}
