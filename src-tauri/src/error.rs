//! Error type shared by the backend and sent to the frontend over IPC.

use serde::Serialize;
use specta::Type;

/// An error returned by a Tauri command.
///
/// Serialized as `{ kind, message }` so the frontend can match on `kind`.
/// Exported as `AppError` to avoid shadowing the JavaScript `Error` class.
#[derive(Debug, thiserror::Error, Serialize, Type)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
#[serde(rename = "AppError")]
pub enum Error {
    #[error("I/O error: {0}")]
    Io(String),
    #[error("serialization error: {0}")]
    Serialization(String),
    #[error("no config directory is available on this system")]
    NoConfigDir,
    #[error("not a directory: {0}")]
    NotADirectory(String),
    #[error("project is not open: {0}")]
    UnknownProject(String),
    #[error("path is outside of the project: {0}")]
    PathOutsideProject(String),
    #[error("invalid search: {0}")]
    InvalidSearch(String),
    #[error("terminal error: {0}")]
    Pty(String),
    #[error("unknown session: {0}")]
    UnknownSession(u32),
    #[error("session has exited: {0}")]
    SessionExited(u32),
    #[error("unknown agent profile: {0}")]
    UnknownProfile(String),
    #[error("git is not installed")]
    GitMissing,
    #[error("git: {0}")]
    Git(String),
}

impl From<std::io::Error> for Error {
    fn from(err: std::io::Error) -> Self {
        Self::Io(err.to_string())
    }
}

impl From<serde_json::Error> for Error {
    fn from(err: serde_json::Error) -> Self {
        Self::Serialization(err.to_string())
    }
}

pub type Result<T, E = Error> = std::result::Result<T, E>;
