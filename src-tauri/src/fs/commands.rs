//! Tauri commands for the file tree and the editor.

use std::collections::HashSet;

use tauri::State;

use super::file::{self, FileContent};
use super::path::resolve;
use super::tree::{self, DirEntry};
use super::watcher::FsWatcher;
use crate::error::Result;
use crate::workspace::projects::WorkspaceStore;

/// Lists a directory of an open project (`""` for the root).
#[tauri::command]
#[specta::specta]
pub async fn read_dir(
    store: State<'_, WorkspaceStore>,
    project: String,
    path: String,
) -> Result<Vec<DirEntry>> {
    tree::read_dir(&store.root(&project)?, &path)
}

#[tauri::command]
#[specta::specta]
pub async fn read_file(
    store: State<'_, WorkspaceStore>,
    project: String,
    path: String,
) -> Result<FileContent> {
    file::read_file(&store.root(&project)?, &path)
}

#[tauri::command]
#[specta::specta]
pub async fn write_file(
    store: State<'_, WorkspaceStore>,
    project: String,
    path: String,
    text: String,
) -> Result<()> {
    file::write_file(&store.root(&project)?, &path, &text)
}

/// Sets the directories of a project whose changes the UI wants to hear
/// about (non-recursive). Replaces the previous set.
#[tauri::command]
#[specta::specta]
pub async fn watch_dirs(
    store: State<'_, WorkspaceStore>,
    watcher: State<'_, FsWatcher>,
    project: String,
    dirs: Vec<String>,
) -> Result<()> {
    let root = store.root(&project)?;
    let dirs = dirs
        .iter()
        .map(|dir| resolve(&root, dir))
        .collect::<Result<HashSet<_>>>()?;
    watcher.set_watched(&project, dirs);
    Ok(())
}
