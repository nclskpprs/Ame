//! Tauri commands for git.

use tauri::State;

use super::cli::{git, repo_prefix};
use super::status::{self, GitStatus};
use crate::error::{Error, Result};
use crate::fs::path::resolve;
use crate::workspace::projects::WorkspaceStore;

/// Branch and changed files, or `None` if the project is not in a git
/// repository (or git is not installed).
#[tauri::command]
#[specta::specta]
pub async fn git_status(
    store: State<'_, WorkspaceStore>,
    project: String,
) -> Result<Option<GitStatus>> {
    let root = store.root(&project)?;
    blocking(move || {
        let Some(prefix) = repo_prefix(&root)? else {
            return Ok(None);
        };
        let output = git(
            &root,
            &[
                "status",
                "--porcelain=v2",
                "-z",
                "--branch",
                "--untracked-files=all",
                "--",
                ".",
            ],
        )?;
        Ok(Some(status::parse(&output, &prefix)))
    })
    .await
    .or_else(|err| match err {
        Error::GitMissing => Ok(None),
        err => Err(err),
    })
}

/// The committed (`HEAD`) content of a file, for the diff view. `None` if
/// the file is new, binary or not valid UTF-8.
#[tauri::command]
#[specta::specta]
pub async fn git_original(
    store: State<'_, WorkspaceStore>,
    project: String,
    path: String,
) -> Result<Option<String>> {
    let root = store.root(&project)?;
    // Rejects paths that leave the project.
    resolve(&root, &path)?;
    blocking(move || {
        let Some(prefix) = repo_prefix(&root)? else {
            return Ok(None);
        };
        let spec = format!("HEAD:{prefix}{path}");
        match git(&root, &["show", &spec]) {
            Ok(bytes) if !bytes.contains(&0) => Ok(String::from_utf8(bytes).ok()),
            Ok(_) | Err(Error::Git(_)) => Ok(None),
            Err(err) => Err(err),
        }
    })
    .await
}

async fn blocking<T: Send + 'static>(
    run: impl FnOnce() -> Result<T> + Send + 'static,
) -> Result<T> {
    tauri::async_runtime::spawn_blocking(run)
        .await
        .map_err(|err| Error::Io(err.to_string()))?
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;

    use super::*;

    fn run(dir: &Path, args: &[&str]) {
        git(dir, args).unwrap_or_else(|err| panic!("git {args:?}: {err}"));
    }

    /// A repository with one commit, a change, a new file and a subfolder.
    fn repo() -> tempfile::TempDir {
        let dir = tempfile::TempDir::new().unwrap();
        let root = dir.path();
        run(root, &["init", "-q", "-b", "main"]);
        run(root, &["config", "user.email", "test@example.com"]);
        run(root, &["config", "user.name", "Test"]);
        fs::create_dir(root.join("web")).unwrap();
        fs::write(root.join("web/app.ts"), "one\n").unwrap();
        fs::write(root.join("README.md"), "readme\n").unwrap();
        run(root, &["add", "."]);
        run(root, &["commit", "-q", "-m", "init"]);
        fs::write(root.join("web/app.ts"), "two\n").unwrap();
        fs::write(root.join("web/new.ts"), "new\n").unwrap();
        dir
    }

    #[test]
    fn reads_status_and_originals_of_a_subfolder() {
        let dir = repo();
        let web = dir.path().join("web");
        let prefix = repo_prefix(&web).unwrap().unwrap();
        assert_eq!(prefix, "web/");
        let output = git(
            &web,
            &[
                "status",
                "--porcelain=v2",
                "-z",
                "--branch",
                "--untracked-files=all",
                "--",
                ".",
            ],
        )
        .unwrap();
        let status = status::parse(&output, &prefix);
        assert_eq!(status.branch.as_deref(), Some("main"));
        let paths: Vec<_> = status.files.iter().map(|f| f.path.as_str()).collect();
        assert_eq!(paths, vec!["app.ts", "new.ts"]);
        let original = git(&web, &["show", "HEAD:web/app.ts"]).unwrap();
        assert_eq!(original, b"one\n");
    }

    #[test]
    fn folders_outside_a_repository_have_no_prefix() {
        let dir = tempfile::TempDir::new().unwrap();
        assert_eq!(repo_prefix(dir.path()).unwrap(), None);
    }
}
