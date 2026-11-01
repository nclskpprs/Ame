//! Tauri commands for project scripts.

use tauri::State;

use super::SCRIPT_PROFILE_PREFIX;
use super::detect::{self, Script};
use crate::agents::detect::resolve;
use crate::agents::status::StatusConfig;
use crate::error::{Error, Result};
use crate::pty::env;
use crate::pty::manager::{PtyManager, SpawnSpec};
use crate::pty::session::SessionInfo;
use crate::workspace::projects::WorkspaceStore;

/// The scripts of a project (`package.json`, `composer.json` at its root).
#[tauri::command]
#[specta::specta]
pub async fn list_scripts(
    store: State<'_, WorkspaceStore>,
    project: String,
) -> Result<Vec<Script>> {
    let root = store.root(&project)?;
    tauri::async_runtime::spawn_blocking(move || detect::scripts(&root))
        .await
        .map_err(|err| Error::Io(err.to_string()))
}

/// Runs a script in a new terminal session of the project.
#[tauri::command]
#[specta::specta]
pub async fn run_script(
    store: State<'_, WorkspaceStore>,
    pty: State<'_, PtyManager>,
    project: String,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<SessionInfo> {
    let root = store.root(&project)?;
    let pty = pty.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let script = detect::scripts(&root)
            .into_iter()
            .find(|script| script.id == id)
            .ok_or_else(|| Error::UnknownScript(id.clone()))?;
        let command = script.runner.command();
        let program =
            resolve(command).map_or_else(|| command.to_owned(), |p| p.display().to_string());
        pty.spawn(SpawnSpec {
            project,
            profile: format!("{SCRIPT_PROFILE_PREFIX}{}", script.id),
            title: script.name.clone(),
            program,
            args: script.runner.args(&script.name),
            cwd: root,
            env: env::session_env(),
            cols,
            rows,
            status: StatusConfig::default(),
            dirs: Vec::new(),
        })
    })
    .await
    .map_err(|err| Error::Io(err.to_string()))?
}
