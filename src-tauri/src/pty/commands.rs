//! Tauri commands for terminal sessions.

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;
use tauri::ipc::Channel;
use tauri_specta::Event;

use super::env;
use super::manager::{PtyManager, SpawnSpec};
use super::session::{OutputSink, SessionId, SessionInfo};
use crate::agents::adapters::Adapters;
use crate::agents::detect;
use crate::agents::profiles::merged_profiles;
use crate::agents::status::StatusConfig;
use crate::error::{Error, Result};
use crate::workspace::projects::WorkspaceStore;
use crate::workspace::settings::SettingsStore;

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

/// Starts an agent profile (or the shell) in the project folder. With
/// `resume`, the profile's resume arguments continue the last conversation.
#[tauri::command]
#[specta::specta]
#[allow(clippy::too_many_arguments)] // Tauri passes every argument separately.
pub async fn start_session(
    store: State<'_, WorkspaceStore>,
    settings: State<'_, SettingsStore>,
    pty: State<'_, PtyManager>,
    adapters: State<'_, Adapters>,
    project: String,
    profile: String,
    resume: bool,
    cols: u16,
    rows: u16,
) -> Result<SessionInfo> {
    let cwd = store.root(&project)?;
    let profile = merged_profiles(&settings.get().agents)
        .into_iter()
        .find(|p| p.id == profile)
        .ok_or(Error::UnknownProfile(profile))?;
    let pty = pty.inner().clone();
    let launch = adapters.launch(profile.adapter.as_deref());
    blocking(move || {
        let (program, mut args) = detect::program(&profile);
        if resume {
            args.extend(profile.resume_args.iter().cloned());
        }
        args.extend(launch.args);
        let mut env = env::session_env();
        env.extend(profile.env.clone());
        env.extend(launch.env);
        let status = StatusConfig::new(profile.idle_after_ms, &profile.needs_input_patterns);
        pty.spawn(SpawnSpec {
            project,
            profile: profile.id,
            title: profile.name,
            program,
            args,
            cwd,
            env,
            cols,
            rows,
            status,
        })
    })
    .await
}

/// A glimpse of what a session printed last, for the dashboard.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SessionPreview {
    pub id: SessionId,
    pub last_line: String,
}

/// The last output line of every session. Polled while the dashboard is
/// visible instead of being pushed on every change.
#[tauri::command]
#[specta::specta]
pub fn session_previews(pty: State<'_, PtyManager>) -> Vec<SessionPreview> {
    pty.list()
        .into_iter()
        .filter_map(|info| {
            pty.get(info.id).ok().map(|session| SessionPreview {
                id: info.id,
                last_line: session.last_line(),
            })
        })
        .collect()
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

/// Sends text as a paste (e.g. code sent from the editor to an agent).
#[tauri::command]
#[specta::specta]
pub async fn paste_session(pty: State<'_, PtyManager>, id: SessionId, text: String) -> Result<()> {
    let session = pty.get(id)?;
    blocking(move || session.paste(&text)).await
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
