//! Tauri commands for terminal sessions.

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;
use tauri::ipc::Channel;
use tauri_specta::Event;

use super::env;
use super::manager::{PtyManager, SpawnSpec};
use super::session::{OutputSink, SessionId, SessionInfo};
use crate::error::{Error, Result};
use crate::workspace::projects::WorkspaceStore;

/// All sessions, sent whenever one starts, exits or is closed.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct SessionsChanged {
    pub sessions: Vec<SessionInfo>,
}

impl OutputSink for Channel<String> {
    fn send(&self, text: String) -> bool {
        Channel::send(self, text).is_ok()
    }
}

/// Starts the user's default shell in the project folder.
#[tauri::command]
#[specta::specta]
pub async fn start_session(
    store: State<'_, WorkspaceStore>,
    pty: State<'_, PtyManager>,
    project: String,
    cols: u16,
    rows: u16,
) -> Result<SessionInfo> {
    let cwd = store.root(&project)?;
    let pty = pty.inner().clone();
    blocking(move || {
        let (program, args) = env::default_shell();
        pty.spawn(SpawnSpec {
            project,
            profile: "shell".to_owned(),
            title: env::program_name(&program),
            program,
            args,
            cwd,
            env: env::session_env(),
            cols,
            rows,
        })
    })
    .await
}

#[tauri::command]
#[specta::specta]
pub fn list_sessions(pty: State<'_, PtyManager>) -> Vec<SessionInfo> {
    pty.list()
}

/// Connects a terminal view: the buffered output and then live output are
/// sent through `on_output`. Returns a token for [`detach_session`].
#[tauri::command]
#[specta::specta]
pub async fn attach_session(
    pty: State<'_, PtyManager>,
    id: SessionId,
    on_output: Channel<String>,
) -> Result<u32> {
    Ok(pty.get(id)?.attach(Box::new(on_output)))
}

#[tauri::command]
#[specta::specta]
pub async fn detach_session(pty: State<'_, PtyManager>, id: SessionId, token: u32) -> Result<()> {
    pty.get(id)?.detach(token);
    Ok(())
}

/// Sends input (typed keys, pasted text) to the program. The frontend sends
/// one write at a time, so the order of keystrokes is kept.
#[tauri::command]
#[specta::specta]
pub async fn write_session(pty: State<'_, PtyManager>, id: SessionId, data: String) -> Result<()> {
    let session = pty.get(id)?;
    // Blocks while the program does not read its input.
    blocking(move || session.write(data.as_bytes())).await
}

#[tauri::command]
#[specta::specta]
pub async fn resize_session(
    pty: State<'_, PtyManager>,
    id: SessionId,
    cols: u16,
    rows: u16,
) -> Result<()> {
    pty.get(id)?.resize(cols, rows)
}

/// Ends the program; the session and its output stay until it is closed.
#[tauri::command]
#[specta::specta]
pub async fn stop_session(pty: State<'_, PtyManager>, id: SessionId) -> Result<()> {
    pty.stop(id)
}

/// Ends the program if needed and removes the session.
#[tauri::command]
#[specta::specta]
pub async fn close_session(pty: State<'_, PtyManager>, id: SessionId) -> Result<()> {
    pty.close(id)
}

async fn blocking<T: Send + 'static>(
    run: impl FnOnce() -> Result<T> + Send + 'static,
) -> Result<T> {
    tauri::async_runtime::spawn_blocking(run)
        .await
        .map_err(|err| Error::Io(err.to_string()))?
}
