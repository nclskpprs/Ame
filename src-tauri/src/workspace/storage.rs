//! Robust JSON persistence for small state files in the config directory.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde::de::DeserializeOwned;

use crate::error::Result;

/// Name of the backup for a file that could not be parsed, e.g.
/// `settings.json` → `settings.corrupt.json`.
pub fn corrupt_backup_path(path: &Path) -> PathBuf {
    path.with_extension("corrupt.json")
}

/// Reads a JSON file. A missing file yields the default value. A file that
/// cannot be read or parsed is logged, an unparsable file is moved aside
/// (see [`corrupt_backup_path`]) and the default value is used, so the app
/// always starts.
pub fn read_json<T: DeserializeOwned + Default>(path: &Path) -> T {
    let text = match fs::read_to_string(path) {
        Ok(text) => text,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return T::default(),
        Err(err) => {
            log::warn!("could not read {}: {err}; using defaults", path.display());
            return T::default();
        }
    };

    match serde_json::from_str(&text) {
        Ok(value) => value,
        Err(err) => {
            let backup = corrupt_backup_path(path);
            log::warn!(
                "could not parse {}: {err}; moving it to {} and using defaults",
                path.display(),
                backup.display()
            );
            if let Err(err) = fs::rename(path, &backup) {
                log::warn!("could not move corrupt file: {err}");
            }
            T::default()
        }
    }
}

/// Writes `value` as pretty-printed JSON, atomically.
pub fn write_json<T: Serialize>(path: &Path, value: &T) -> Result<()> {
    let json = serde_json::to_string_pretty(value)?;
    write_atomic(path, format!("{json}\n").as_bytes())?;
    Ok(())
}

/// Writes `bytes` to a temporary file next to `path` and renames it over
/// `path`, so a crash never leaves a half-written file behind.
pub fn write_atomic(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let mut tmp_name = path.file_name().unwrap_or_default().to_os_string();
    tmp_name.push(".ame-tmp");
    let tmp = path.with_file_name(tmp_name);
    {
        let mut file = fs::File::create(&tmp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
    }
    fs::rename(&tmp, path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn corrupt_backup_name() {
        assert_eq!(
            corrupt_backup_path(Path::new("/a/workspace.json")),
            PathBuf::from("/a/workspace.corrupt.json")
        );
    }

    #[test]
    fn atomic_write_replaces_existing_file() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("file.txt");
        write_atomic(&path, b"one").unwrap();
        write_atomic(&path, b"two").unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "two");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }
}
