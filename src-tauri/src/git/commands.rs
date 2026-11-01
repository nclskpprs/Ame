//! Tauri commands for git.

use tauri::State;

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::AppHandle;
use tauri_specta::Event;

use super::branches::{self, Branches};
use super::checkpoints::{self, Checkpoint, CheckpointFile};
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
        let mut status = status::parse(&output, &prefix);
        for file in &mut status.files {
            file.modified = std::fs::metadata(root.join(&file.path))
                .and_then(|meta| meta.modified())
                .ok()
                .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|elapsed| elapsed.as_millis() as f64);
        }
        Ok(Some(status))
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

/// Adds files (also deletions) to the index.
#[tauri::command]
#[specta::specta]
pub async fn git_stage(
    store: State<'_, WorkspaceStore>,
    project: String,
    paths: Vec<String>,
) -> Result<()> {
    let root = store.root(&project)?;
    let paths = checked(&root, paths)?;
    blocking(move || {
        let mut args = vec!["add", "-A", "--"];
        args.extend(paths.iter().map(String::as_str));
        git(&root, &args).map(drop)
    })
    .await
}

/// Removes files from the index; the working tree stays as it is.
#[tauri::command]
#[specta::specta]
pub async fn git_unstage(
    store: State<'_, WorkspaceStore>,
    project: String,
    paths: Vec<String>,
) -> Result<()> {
    let root = store.root(&project)?;
    let paths = checked(&root, paths)?;
    blocking(move || {
        let mut restore = vec!["restore", "--staged", "--"];
        restore.extend(paths.iter().map(String::as_str));
        match git(&root, &restore) {
            Ok(_) => Ok(()),
            // Before the first commit there is nothing to restore from.
            Err(Error::Git(_)) => {
                let mut remove = vec!["rm", "--cached", "-r", "--quiet", "--"];
                remove.extend(paths.iter().map(String::as_str));
                git(&root, &remove).map(drop)
            }
            Err(err) => Err(err),
        }
    })
    .await
}

/// Commits the staged changes. Hooks run as usual; their output is the
/// error message when they fail.
#[tauri::command]
#[specta::specta]
pub async fn git_commit(
    store: State<'_, WorkspaceStore>,
    project: String,
    message: String,
) -> Result<()> {
    let root = store.root(&project)?;
    if message.trim().is_empty() {
        return Err(Error::Git("empty commit message".into()));
    }
    blocking(move || git(&root, &["commit", "-m", &message]).map(drop)).await
}

/// The local branches and the main branch, `None` outside a repository.
#[tauri::command]
#[specta::specta]
pub async fn git_branches(
    store: State<'_, WorkspaceStore>,
    project: String,
) -> Result<Option<Branches>> {
    let root = store.root(&project)?;
    blocking(move || {
        if repo_prefix(&root)?.is_none() {
            return Ok(None);
        }
        branches::list(&root).map(Some)
    })
    .await
    .or_else(|err| match err {
        Error::GitMissing => Ok(None),
        err => Err(err),
    })
}

/// Switches to a local branch (`git switch`); uncommitted changes stay.
#[tauri::command]
#[specta::specta]
pub async fn git_switch(
    store: State<'_, WorkspaceStore>,
    project: String,
    branch: String,
) -> Result<()> {
    let root = store.root(&project)?;
    blocking(move || branches::switch(&root, &branch)).await
}

/// A checkpoint was taken or restored in a project.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct CheckpointsChanged {
    pub project: String,
}

/// Takes a checkpoint in the background and reports it (see
/// `git::checkpoints`). Used before every prompt to an agent.
pub fn checkpoint_in_background(app: AppHandle, project: String, label: String) {
    let spawned = std::thread::Builder::new()
        .name("checkpoint".into())
        .spawn(
            move || match checkpoints::create(std::path::Path::new(&project), &label) {
                Ok(Some(_)) => {
                    if let Err(err) = (CheckpointsChanged { project }).emit(&app) {
                        log::warn!("could not report a checkpoint: {err}");
                    }
                }
                Ok(None) | Err(Error::GitMissing) => {}
                Err(err) => log::warn!("could not take a checkpoint: {err}"),
            },
        );
    if let Err(err) = spawned {
        log::warn!("could not start the checkpoint thread: {err}");
    }
}

/// The project's checkpoints, newest first (empty outside git).
#[tauri::command]
#[specta::specta]
pub async fn list_checkpoints(
    store: State<'_, WorkspaceStore>,
    project: String,
) -> Result<Vec<Checkpoint>> {
    let root = store.root(&project)?;
    blocking(move || checkpoints::list(&root))
        .await
        .or_else(|err| match err {
            Error::GitMissing => Ok(Vec::new()),
            err => Err(err),
        })
}

/// Takes a checkpoint now; `None` if nothing changed since the last one.
#[tauri::command]
#[specta::specta]
pub async fn create_checkpoint(
    store: State<'_, WorkspaceStore>,
    project: String,
    label: String,
) -> Result<Option<Checkpoint>> {
    let root = store.root(&project)?;
    blocking(move || checkpoints::create(&root, &label)).await
}

/// How the project's files differ now from a checkpoint.
#[tauri::command]
#[specta::specta]
pub async fn checkpoint_changes(
    store: State<'_, WorkspaceStore>,
    project: String,
    id: String,
) -> Result<Vec<CheckpointFile>> {
    let root = store.root(&project)?;
    blocking(move || checkpoints::changes(&root, &id)).await
}

/// Brings the project's files back to a checkpoint. Returns the checkpoint
/// that undoes it (`None` if nothing had changed).
#[tauri::command]
#[specta::specta]
pub async fn restore_checkpoint(
    store: State<'_, WorkspaceStore>,
    project: String,
    id: String,
) -> Result<Option<Checkpoint>> {
    let root = store.root(&project)?;
    blocking(move || checkpoints::restore(&root, &id)).await
}

/// Project-relative paths, checked to stay inside the project.
fn checked(root: &std::path::Path, paths: Vec<String>) -> Result<Vec<String>> {
    for path in &paths {
        resolve(root, path)?;
    }
    Ok(paths)
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
    fn stages_unstages_and_commits() {
        let dir = repo();
        let web = dir.path().join("web");
        let staged = |dir: &Path| {
            let output = git(dir, &["diff", "--cached", "--name-only"]).unwrap();
            String::from_utf8(output).unwrap()
        };
        run(&web, &["add", "-A", "--", "app.ts", "new.ts"]);
        assert_eq!(staged(&web), "web/app.ts\nweb/new.ts\n");
        run(&web, &["restore", "--staged", "--", "new.ts"]);
        assert_eq!(staged(&web), "web/app.ts\n");
        run(&web, &["commit", "-q", "-m", "change app"]);
        assert_eq!(staged(&web), "");
        let original = git(&web, &["show", "HEAD:web/app.ts"]).unwrap();
        assert_eq!(original, b"two\n");
    }

    #[test]
    fn rejects_paths_outside_the_project() {
        let dir = repo();
        assert!(checked(dir.path(), vec!["../etc/passwd".into()]).is_err());
        assert!(checked(dir.path(), vec!["web/app.ts".into()]).is_ok());
    }

    #[test]
    fn folders_outside_a_repository_have_no_prefix() {
        let dir = tempfile::TempDir::new().unwrap();
        assert_eq!(repo_prefix(dir.path()).unwrap(), None);
    }
}
