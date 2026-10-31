//! Persistent user settings stored as `settings.json` in the config directory.

use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use serde::{Deserialize, Serialize};
use specta::Type;

use super::storage;
use crate::error::Result;

pub const SETTINGS_FILE: &str = "settings.json";

/// A settings file that could not be parsed is renamed to this name so the
/// user does not lose it, and defaults are used instead.
pub const CORRUPT_SETTINGS_FILE: &str = "settings.corrupt.json";

/// Current schema version of the settings file. Bump it and add a migration
/// when a change cannot be handled by `#[serde(default)]`.
pub const SETTINGS_VERSION: u32 = 1;

/// User settings. Missing fields fall back to their defaults so that older
/// settings files keep working.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// Schema version of the settings file.
    pub version: u32,
    /// Color theme.
    pub theme: ThemePreference,
    /// UI language as a locale code, e.g. `en`.
    pub locale: String,
    /// Intensity of the rain status animations.
    pub rain_effects: RainEffects,
    /// Spacing of the UI.
    pub density: Density,
    /// How a click in the file tree opens a file.
    pub file_open: FileOpen,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            version: SETTINGS_VERSION,
            theme: ThemePreference::default(),
            locale: "en".to_owned(),
            rain_effects: RainEffects::default(),
            density: Density::default(),
            file_open: FileOpen::default(),
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum ThemePreference {
    /// Follow the operating system.
    #[default]
    System,
    Dark,
    Light,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum RainEffects {
    #[default]
    On,
    Subtle,
    Off,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum Density {
    #[default]
    Comfortable,
    Compact,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum FileOpen {
    /// A single click selects, a double click opens.
    #[default]
    DoubleClick,
    /// A single click opens.
    SingleClick,
}

/// Loads and saves [`Settings`]. Managed as Tauri state.
#[derive(Debug)]
pub struct SettingsStore {
    path: PathBuf,
    current: Mutex<Settings>,
}

impl SettingsStore {
    /// Loads the settings from `dir`. Never fails: problems are logged and
    /// defaults are used, so the app always starts.
    pub fn load(dir: &Path) -> Self {
        let path = dir.join(SETTINGS_FILE);
        let current = storage::read_json(&path);
        Self {
            path,
            current: Mutex::new(current),
        }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn get(&self) -> Settings {
        self.lock().clone()
    }

    /// Replaces the settings and writes them to disk atomically.
    pub fn set(&self, settings: Settings) -> Result<()> {
        let mut current = self.lock();
        storage::write_json(&self.path, &settings)?;
        *current = settings;
        Ok(())
    }

    fn lock(&self) -> MutexGuard<'_, Settings> {
        // A poisoned lock only means another thread panicked while holding
        // it; the settings value itself is always in a valid state.
        self.current
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn missing_file_yields_defaults_without_writing() {
        let dir = TempDir::new().unwrap();
        let store = SettingsStore::load(dir.path());
        assert_eq!(store.get(), Settings::default());
        assert!(!store.path().exists());
    }

    #[test]
    fn set_persists_and_reloads() {
        let dir = TempDir::new().unwrap();
        let store = SettingsStore::load(dir.path());
        let settings = Settings {
            theme: ThemePreference::Light,
            rain_effects: RainEffects::Subtle,
            density: Density::Compact,
            file_open: FileOpen::SingleClick,
            ..Settings::default()
        };
        store.set(settings.clone()).unwrap();
        assert_eq!(store.get(), settings);
        assert_eq!(SettingsStore::load(dir.path()).get(), settings);
    }

    #[test]
    fn creates_missing_config_dir() {
        let dir = TempDir::new().unwrap();
        let nested = dir.path().join("a").join("b");
        let store = SettingsStore::load(&nested);
        store.set(Settings::default()).unwrap();
        assert!(nested.join(SETTINGS_FILE).is_file());
    }

    #[test]
    fn writes_camel_case_json_without_leftover_temp_file() {
        let dir = TempDir::new().unwrap();
        let store = SettingsStore::load(dir.path());
        store.set(Settings::default()).unwrap();
        let text = fs::read_to_string(store.path()).unwrap();
        assert!(text.contains("\"rainEffects\": \"on\""), "{text}");
        assert!(text.contains("\"theme\": \"system\""), "{text}");
        let entries: Vec<_> = fs::read_dir(dir.path()).unwrap().collect();
        assert_eq!(entries.len(), 1);
    }

    #[test]
    fn missing_fields_fall_back_to_defaults() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join(SETTINGS_FILE), r#"{ "theme": "dark" }"#).unwrap();
        let settings = SettingsStore::load(dir.path()).get();
        assert_eq!(settings.theme, ThemePreference::Dark);
        assert_eq!(settings.locale, "en");
        assert_eq!(settings.version, SETTINGS_VERSION);
        assert_eq!(settings.file_open, FileOpen::DoubleClick);
    }

    #[test]
    fn unknown_fields_are_ignored() {
        let dir = TempDir::new().unwrap();
        fs::write(
            dir.path().join(SETTINGS_FILE),
            r#"{ "density": "compact", "fromTheFuture": true }"#,
        )
        .unwrap();
        assert_eq!(
            SettingsStore::load(dir.path()).get().density,
            Density::Compact
        );
    }

    #[test]
    fn corrupt_file_is_moved_aside() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join(SETTINGS_FILE);
        fs::write(&path, "{ not json").unwrap();
        let store = SettingsStore::load(dir.path());
        assert_eq!(store.get(), Settings::default());
        assert!(!path.exists());
        assert_eq!(
            fs::read_to_string(dir.path().join(CORRUPT_SETTINGS_FILE)).unwrap(),
            "{ not json"
        );
    }
}
