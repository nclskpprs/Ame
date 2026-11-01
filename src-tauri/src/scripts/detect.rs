//! Finds the scripts of a project in `package.json` and `composer.json` at
//! its root. Nothing else is scanned (no indexing).

use std::path::Path;

use serde::{Deserialize, Serialize};
use specta::Type;

/// The tool that runs a script.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum Runner {
    Npm,
    Pnpm,
    Yarn,
    Bun,
    Composer,
}

impl Runner {
    /// The command that runs it, e.g. `pnpm`.
    pub fn command(self) -> &'static str {
        match self {
            Self::Npm => "npm",
            Self::Pnpm => "pnpm",
            Self::Yarn => "yarn",
            Self::Bun => "bun",
            Self::Composer => "composer",
        }
    }

    /// Arguments that run the script `name`.
    pub fn args(self, name: &str) -> Vec<String> {
        let run = match self {
            Self::Composer => "run-script",
            _ => "run",
        };
        vec![run.to_owned(), name.to_owned()]
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct Script {
    /// Unique within the project, e.g. `pnpm:build`.
    pub id: String,
    pub name: String,
    pub runner: Runner,
    /// What the script does, as written in the manifest (for tooltips).
    pub command: String,
}

/// All scripts of a project: `package.json` first, then `composer.json`,
/// each in the order of the file.
pub fn scripts(root: &Path) -> Vec<Script> {
    let mut scripts = Vec::new();
    if let Some(manifest) = read_json(&root.join("package.json")) {
        let runner = package_runner(root, &manifest);
        scripts.extend(entries(&manifest, runner, |_| true));
    }
    if let Some(manifest) = read_json(&root.join("composer.json")) {
        // `pre-…`/`post-…` scripts are composer event hooks, not tasks.
        scripts.extend(entries(&manifest, Runner::Composer, |name| {
            !name.starts_with("pre-") && !name.starts_with("post-")
        }));
    }
    scripts
}

/// The package manager of a Node project: the lock file decides, then the
/// `packageManager` field, then npm.
fn package_runner(root: &Path, manifest: &serde_json::Value) -> Runner {
    const LOCKS: [(&str, Runner); 5] = [
        ("pnpm-lock.yaml", Runner::Pnpm),
        ("yarn.lock", Runner::Yarn),
        ("bun.lock", Runner::Bun),
        ("bun.lockb", Runner::Bun),
        ("package-lock.json", Runner::Npm),
    ];
    if let Some((_, runner)) = LOCKS.iter().find(|(file, _)| root.join(file).is_file()) {
        return *runner;
    }
    let declared = manifest
        .get("packageManager")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default();
    match declared.split('@').next().unwrap_or_default() {
        "pnpm" => Runner::Pnpm,
        "yarn" => Runner::Yarn,
        "bun" => Runner::Bun,
        _ => Runner::Npm,
    }
}

fn entries(
    manifest: &serde_json::Value,
    runner: Runner,
    keep: impl Fn(&str) -> bool,
) -> Vec<Script> {
    let Some(map) = manifest
        .get("scripts")
        .and_then(serde_json::Value::as_object)
    else {
        return Vec::new();
    };
    map.iter()
        .filter(|(name, _)| keep(name))
        .map(|(name, value)| Script {
            id: format!("{}:{name}", runner.command()),
            name: name.clone(),
            runner,
            command: describe(value),
        })
        .collect()
}

/// A script's body: a string, or (composer) a list of commands.
fn describe(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(text) => text.clone(),
        serde_json::Value::Array(items) => items
            .iter()
            .filter_map(serde_json::Value::as_str)
            .collect::<Vec<_>>()
            .join(" && "),
        _ => String::new(),
    }
}

fn read_json(path: &Path) -> Option<serde_json::Value> {
    let text = std::fs::read_to_string(path).ok()?;
    match serde_json::from_str(&text) {
        Ok(value) => Some(value),
        Err(err) => {
            log::debug!("ignoring {}: {err}", path.display());
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use super::*;

    fn names(scripts: &[Script]) -> Vec<(&str, Runner)> {
        scripts.iter().map(|s| (s.id.as_str(), s.runner)).collect()
    }

    #[test]
    fn reads_package_scripts_in_file_order_with_the_locked_manager() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(
            dir.path().join("package.json"),
            r#"{"scripts": {"dev": "vite", "build": "vite build", "lint": "eslint ."}}"#,
        )
        .unwrap();
        assert_eq!(
            names(&scripts(dir.path())),
            vec![
                ("npm:dev", Runner::Npm),
                ("npm:build", Runner::Npm),
                ("npm:lint", Runner::Npm)
            ]
        );
        fs::write(dir.path().join("pnpm-lock.yaml"), "").unwrap();
        let found = scripts(dir.path());
        assert_eq!(found[0].id, "pnpm:dev");
        assert_eq!(found[1].command, "vite build");
    }

    #[test]
    fn uses_the_package_manager_field_without_a_lock_file() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(
            dir.path().join("package.json"),
            r#"{"packageManager": "yarn@4.1.0", "scripts": {"test": "jest"}}"#,
        )
        .unwrap();
        assert_eq!(scripts(dir.path())[0].runner, Runner::Yarn);
    }

    #[test]
    fn reads_composer_scripts_without_event_hooks() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(
            dir.path().join("composer.json"),
            r#"{"scripts": {"post-install-cmd": "x", "test": ["phpunit", "phpstan"], "serve": "php -S localhost:8000"}}"#,
        )
        .unwrap();
        let found = scripts(dir.path());
        assert_eq!(
            names(&found),
            vec![
                ("composer:test", Runner::Composer),
                ("composer:serve", Runner::Composer)
            ]
        );
        assert_eq!(found[0].command, "phpunit && phpstan");
        assert_eq!(
            Runner::Composer.args("test"),
            vec!["run-script".to_owned(), "test".to_owned()]
        );
    }

    #[test]
    fn ignores_missing_and_broken_manifests() {
        let dir = tempfile::tempdir().unwrap();
        assert!(scripts(dir.path()).is_empty());
        fs::write(dir.path().join("package.json"), "{ not json").unwrap();
        assert!(scripts(dir.path()).is_empty());
        fs::write(dir.path().join("package.json"), r#"{"name": "x"}"#).unwrap();
        assert!(scripts(dir.path()).is_empty());
    }
}
