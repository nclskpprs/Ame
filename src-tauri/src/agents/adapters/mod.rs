//! Optional precise status adapters (layer 3 of the status detection).
//!
//! Agents with a hook system report their state directly: a hook runs the
//! Ame executable as a helper (`ame hook <agent>`, see [`cli`]), which sends
//! one line to the local [`endpoint`] of the running app. The session is
//! found by `AME_SESSION_ID`. See ADR 0019 and *Agent status detection* in
//! `docs/ARCHITECTURE.md`.

pub mod claude;
pub mod cli;
pub mod endpoint;

use std::path::{Path, PathBuf};

use endpoint::{HookEndpoint, HookMessage};

/// `AgentProfile::adapter` value of the Claude Code hooks adapter.
pub const CLAUDE_HOOKS: &str = "claude-hooks";

/// Environment variable with the endpoint address (`127.0.0.1:port`).
pub const HOOK_ADDR_ENV: &str = "AME_HOOK";
/// Environment variable with the secret the endpoint expects.
pub const HOOK_TOKEN_ENV: &str = "AME_HOOK_TOKEN";
/// Environment variable with the id of the session (set for every session).
pub const SESSION_ID_ENV: &str = "AME_SESSION_ID";

/// What an adapter says the agent is doing. Takes precedence over the
/// heuristics until the next signal (see `StatusTracker`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AdapterState {
    Working,
    NeedsInput,
    Idle,
}

/// A state change reported by an adapter.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AdapterSignal {
    Working,
    /// The agent waits for the user, with the agent's own message.
    NeedsInput(Option<String>),
    Idle,
}

impl AdapterSignal {
    pub fn state(&self) -> AdapterState {
        match self {
            Self::Working => AdapterState::Working,
            Self::NeedsInput(_) => AdapterState::NeedsInput,
            Self::Idle => AdapterState::Idle,
        }
    }
}

/// Turns a hook message into a signal, `None` for events that do not change
/// the state. `current` is the state the adapter reported last.
pub fn signal(message: &HookMessage, current: Option<AdapterState>) -> Option<AdapterSignal> {
    match message.agent.as_str() {
        claude::AGENT => claude::signal(message, current),
        _ => None,
    }
}

/// Extra arguments and environment for a session of a profile with an
/// adapter.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct Launch {
    pub args: Vec<String>,
    pub env: Vec<(String, String)>,
}

/// The running endpoint and the files the adapters need. Managed as Tauri
/// state; every part is optional, so a failure only disables the adapters.
#[derive(Debug, Default)]
pub struct Adapters {
    endpoint: Option<HookEndpoint>,
    claude_settings: Option<PathBuf>,
}

impl Adapters {
    /// Starts the endpoint and writes the Claude Code settings file into
    /// `<config_dir>/adapters/`. Failures are logged; sessions then use the
    /// heuristics only.
    pub fn start(config_dir: &Path, on_message: impl Fn(HookMessage) + Send + 'static) -> Self {
        let endpoint = match HookEndpoint::start(on_message) {
            Ok(endpoint) => endpoint,
            Err(err) => {
                log::warn!("could not start the hook endpoint: {err}");
                return Self::default();
            }
        };
        let claude_settings = std::env::current_exe()
            .and_then(|exe| claude::write_settings(&config_dir.join("adapters"), &exe))
            .inspect_err(|err| log::warn!("could not write the Claude Code hooks: {err}"))
            .ok();
        Self {
            endpoint: Some(endpoint),
            claude_settings,
        }
    }

    /// What a session of a profile with this adapter needs on top of the
    /// profile's own command line. Empty for unknown adapters or when the
    /// endpoint is not running.
    pub fn launch(&self, adapter: Option<&str>) -> Launch {
        let Some(endpoint) = &self.endpoint else {
            return Launch::default();
        };
        match adapter {
            Some(CLAUDE_HOOKS) => {
                self.claude_settings
                    .as_ref()
                    .map_or_else(Launch::default, |path| Launch {
                        args: vec!["--settings".to_owned(), path.display().to_string()],
                        env: endpoint.env(),
                    })
            }
            _ => Launch::default(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn launch_needs_a_known_adapter_and_a_running_endpoint() {
        let none = Adapters::default();
        assert_eq!(none.launch(Some(CLAUDE_HOOKS)), Launch::default());

        let dir = tempfile::tempdir().unwrap();
        let adapters = Adapters::start(dir.path(), |_| {});
        assert_eq!(adapters.launch(None), Launch::default());
        assert_eq!(adapters.launch(Some("other")), Launch::default());
        let launch = adapters.launch(Some(CLAUDE_HOOKS));
        assert_eq!(launch.args[0], "--settings");
        assert!(Path::new(&launch.args[1]).is_file());
        let keys: Vec<_> = launch.env.iter().map(|(key, _)| key.as_str()).collect();
        assert_eq!(keys, [HOOK_ADDR_ENV, HOOK_TOKEN_ENV]);
    }
}
