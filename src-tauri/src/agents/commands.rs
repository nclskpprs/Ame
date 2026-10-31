//! Tauri commands for agent profiles.

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::State;

use super::detect;
use super::profiles::{AgentProfile, merged_profiles};
use crate::error::{Error, Result};
use crate::workspace::settings::SettingsStore;

/// A profile together with where its program was found.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct AgentInfo {
    pub profile: AgentProfile,
    /// Full path of the program, `None` if it is not installed.
    pub path: Option<String>,
    /// Built-in profile (possibly changed in the settings).
    pub builtin: bool,
}

/// All profiles with their detected programs. Looks at the `PATH` every
/// time, so newly installed agents show up without a restart.
#[tauri::command]
#[specta::specta]
pub async fn list_agents(settings: State<'_, SettingsStore>) -> Result<Vec<AgentInfo>> {
    let custom = settings.get().agents;
    tauri::async_runtime::spawn_blocking(move || {
        let builtin_ids: Vec<_> = super::profiles::builtin_profiles()
            .into_iter()
            .map(|p| p.id)
            .collect();
        merged_profiles(&custom)
            .into_iter()
            .map(|profile| AgentInfo {
                path: if profile.command.trim().is_empty() {
                    Some(detect::program(&profile).0)
                } else {
                    detect::resolve(&profile.command).map(|path| path.display().to_string())
                },
                builtin: builtin_ids.contains(&profile.id),
                profile,
            })
            .collect()
    })
    .await
    .map_err(|err| Error::Io(err.to_string()))
}
