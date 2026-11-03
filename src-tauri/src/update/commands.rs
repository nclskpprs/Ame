//! Tauri commands for in-app updates.

use std::time::{Duration, Instant};

use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_updater::UpdaterExt;

use super::{PendingUpdate, UpdateInfo, UpdateProgress, UpdateSupport, support_for};
use crate::error::{Error, Result};
use crate::pty::PtyManager;
use crate::workspace::paths::AppPaths;

/// Progress is reported at most this often.
const PROGRESS_INTERVAL: Duration = Duration::from_millis(100);

/// Whether this build can install updates itself.
#[tauri::command]
#[specta::specta]
pub fn update_support(app: AppHandle, paths: State<'_, AppPaths>) -> UpdateSupport {
    #[cfg(target_os = "linux")]
    let appimage = app.env().appimage.is_some();
    #[cfg(not(target_os = "linux"))]
    let appimage = {
        let _ = &app;
        false
    };
    support_for(
        cfg!(debug_assertions),
        paths.is_portable(),
        cfg!(target_os = "linux"),
        appimage,
    )
}

/// Asks the release server for a newer version and remembers it for
/// `install_update`. `None` means Ame is up to date.
#[tauri::command]
#[specta::specta]
pub async fn check_update(
    app: AppHandle,
    pending: State<'_, PendingUpdate>,
) -> Result<Option<UpdateInfo>> {
    let pty = app.state::<PtyManager>().inner().clone();
    let updater = app
        .updater_builder()
        // On Windows the installer quits Ame; end the agents cleanly first.
        .on_before_exit(move || pty.shutdown())
        .build()
        .map_err(update_error)?;
    let update = updater.check().await.map_err(update_error)?;
    let info = update.as_ref().map(|update| UpdateInfo {
        version: update.version.clone(),
        current_version: update.current_version.clone(),
        notes: update.body.clone().filter(|body| !body.trim().is_empty()),
    });
    *lock(&pending) = update;
    Ok(info)
}

/// Downloads and installs the update found by the last check, then
/// restarts Ame. Running sessions end with the restart.
#[tauri::command]
#[specta::specta]
pub async fn install_update(
    app: AppHandle,
    pending: State<'_, PendingUpdate>,
    progress: Channel<UpdateProgress>,
) -> Result<()> {
    let update = lock(&pending).take().ok_or(Error::NoPendingUpdate)?;
    let mut downloaded = 0usize;
    let mut last = Instant::now() - PROGRESS_INTERVAL;
    let bytes = update
        .download(
            |chunk, total| {
                downloaded += chunk;
                if last.elapsed() >= PROGRESS_INTERVAL {
                    last = Instant::now();
                    let _ = progress.send(UpdateProgress {
                        downloaded: downloaded as f64,
                        total: total.map(|total| total as f64),
                    });
                }
            },
            || {},
        )
        .await
        .map_err(update_error)?;
    update.install(bytes).map_err(update_error)?;
    app.state::<PtyManager>().shutdown();
    app.restart()
}

fn update_error(err: tauri_plugin_updater::Error) -> Error {
    Error::Update(err.to_string())
}

fn lock(
    pending: &PendingUpdate,
) -> std::sync::MutexGuard<'_, Option<tauri_plugin_updater::Update>> {
    // A poisoned lock only means a check panicked; the slot is still valid.
    pending
        .0
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}
