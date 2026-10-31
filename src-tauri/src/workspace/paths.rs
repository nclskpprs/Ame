//! Resolution of the config directory, including the portable mode.
//!
//! Precedence (first match wins):
//!
//! 1. The `AME_CONFIG_DIR` environment variable.
//! 2. Portable mode: a file named `portable` (or `portable.txt`) next to the
//!    executable. The config then lives in a `data` folder next to it.
//! 3. The OS app config directory provided by Tauri.

use std::ffi::OsString;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager, Runtime};

use crate::error::{Error, Result};

/// Environment variable that overrides the config directory.
pub const CONFIG_DIR_ENV: &str = "AME_CONFIG_DIR";

/// File names that enable portable mode when placed next to the executable.
/// `portable.txt` is accepted because Windows Explorer hides extensions and
/// "New → Text Document" creates a `.txt` file.
pub const PORTABLE_MARKERS: [&str; 2] = ["portable", "portable.txt"];

/// Folder next to the executable that holds all data in portable mode.
pub const PORTABLE_DATA_DIR: &str = "data";

/// Where the config directory came from.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConfigSource {
    /// Set by the `AME_CONFIG_DIR` environment variable.
    Env,
    /// Next to the executable because a portable marker file exists.
    Portable,
    /// The OS app config directory.
    System,
}

/// Resolved application paths. Managed as Tauri state.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppPaths {
    pub config_dir: PathBuf,
    pub source: ConfigSource,
}

impl AppPaths {
    /// Resolves the paths for the running app.
    pub fn resolve<R: Runtime>(app: &AppHandle<R>) -> Result<Self> {
        let exe_dir = std::env::current_exe()
            .ok()
            .and_then(|exe| exe.parent().map(Path::to_path_buf));
        resolve_from(std::env::var_os(CONFIG_DIR_ENV), exe_dir.as_deref(), || {
            app.path().app_config_dir().ok()
        })
    }

    pub fn is_portable(&self) -> bool {
        self.source == ConfigSource::Portable
    }
}

/// Pure resolution logic, separated from the environment for testing.
pub fn resolve_from(
    env_override: Option<OsString>,
    exe_dir: Option<&Path>,
    system_dir: impl FnOnce() -> Option<PathBuf>,
) -> Result<AppPaths> {
    if let Some(dir) = env_override.filter(|value| !value.is_empty()) {
        return Ok(AppPaths {
            config_dir: PathBuf::from(dir),
            source: ConfigSource::Env,
        });
    }

    if let Some(exe_dir) = exe_dir
        && has_portable_marker(exe_dir)
    {
        return Ok(AppPaths {
            config_dir: exe_dir.join(PORTABLE_DATA_DIR),
            source: ConfigSource::Portable,
        });
    }

    system_dir()
        .map(|config_dir| AppPaths {
            config_dir,
            source: ConfigSource::System,
        })
        .ok_or(Error::NoConfigDir)
}

fn has_portable_marker(dir: &Path) -> bool {
    PORTABLE_MARKERS
        .iter()
        .any(|marker| dir.join(marker).is_file())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn system() -> Option<PathBuf> {
        Some(PathBuf::from("/system/config"))
    }

    #[test]
    fn uses_system_dir_without_marker() {
        let exe = TempDir::new().unwrap();
        let paths = resolve_from(None, Some(exe.path()), system).unwrap();
        assert_eq!(paths.source, ConfigSource::System);
        assert_eq!(paths.config_dir, PathBuf::from("/system/config"));
        assert!(!paths.is_portable());
    }

    #[test]
    fn portable_marker_moves_config_next_to_exe() {
        for marker in PORTABLE_MARKERS {
            let exe = TempDir::new().unwrap();
            fs::write(exe.path().join(marker), "").unwrap();
            let paths = resolve_from(None, Some(exe.path()), system).unwrap();
            assert_eq!(paths.source, ConfigSource::Portable, "marker {marker}");
            assert_eq!(paths.config_dir, exe.path().join(PORTABLE_DATA_DIR));
            assert!(paths.is_portable());
        }
    }

    #[test]
    fn directory_named_portable_is_not_a_marker() {
        let exe = TempDir::new().unwrap();
        fs::create_dir(exe.path().join("portable")).unwrap();
        let paths = resolve_from(None, Some(exe.path()), system).unwrap();
        assert_eq!(paths.source, ConfigSource::System);
    }

    #[test]
    fn env_override_wins_over_portable_marker() {
        let exe = TempDir::new().unwrap();
        fs::write(exe.path().join("portable"), "").unwrap();
        let paths = resolve_from(Some("/custom".into()), Some(exe.path()), system).unwrap();
        assert_eq!(paths.source, ConfigSource::Env);
        assert_eq!(paths.config_dir, PathBuf::from("/custom"));
    }

    #[test]
    fn empty_env_override_is_ignored() {
        let paths = resolve_from(Some(OsString::new()), None, system).unwrap();
        assert_eq!(paths.source, ConfigSource::System);
    }

    #[test]
    fn fails_without_any_config_dir() {
        let err = resolve_from(None, None, || None).unwrap_err();
        assert!(matches!(err, Error::NoConfigDir));
    }
}
