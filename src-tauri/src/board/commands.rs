//! Tauri commands for the board.

use tauri::State;

use super::{BoardStore, Package};
use crate::error::Result;
use crate::workspace::projects::WorkspaceStore;

/// The work packages of a project.
#[tauri::command]
#[specta::specta]
pub fn list_packages(board: State<'_, BoardStore>, project: String) -> Vec<Package> {
    board.list(&project)
}

/// Adds or updates a work package of an open project.
#[tauri::command]
#[specta::specta]
pub fn save_package(
    board: State<'_, BoardStore>,
    store: State<'_, WorkspaceStore>,
    entry: Package,
) -> Result<()> {
    store.root(&entry.project)?;
    board.save(entry)
}

/// Deletes a work package.
#[tauri::command]
#[specta::specta]
pub fn delete_package(board: State<'_, BoardStore>, id: String) -> Result<()> {
    board.delete(&id)
}
