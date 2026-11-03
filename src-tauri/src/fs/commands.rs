//! Tauri commands for the file tree and the editor.

use std::collections::HashSet;

use tauri::State;
use tauri::ipc::Channel;

use super::file::{self, FileContent};
use super::ops;
use super::path::resolve;
use super::quick_open::{FileMatch, QuickOpen};
use super::search::{self, FileResults, SearchControl, SearchOptions, SearchSummary};
use super::tree::{self, DirEntry, EntryKind};
use super::watcher::FsWatcher;
use crate::error::Result;
use crate::workspace::projects::WorkspaceStore;

/// Lists a directory of an open project (`""` for the root); with
/// `show_ignored`, entries excluded by `.gitignore` are listed too.
#[tauri::command]
#[specta::specta]
pub async fn read_dir(
    store: State<'_, WorkspaceStore>,
    project: String,
    path: String,
    show_ignored: bool,
) -> Result<Vec<DirEntry>> {
    tree::read_dir(&store.root(&project)?, &path, show_ignored)
}

/// Creates an empty file or a folder in an open project.
#[tauri::command]
#[specta::specta]
pub async fn create_entry(
    store: State<'_, WorkspaceStore>,
    project: String,
    path: String,
    kind: EntryKind,
) -> Result<()> {
    ops::create_entry(&store.root(&project)?, &path, kind)
}

/// Moves or renames a file or folder inside an open project.
#[tauri::command]
#[specta::specta]
pub async fn move_entry(
    store: State<'_, WorkspaceStore>,
    project: String,
    from: String,
    to: String,
) -> Result<()> {
    ops::move_entry(&store.root(&project)?, &from, &to)
}

/// Moves a file or folder of an open project to the trash.
#[tauri::command]
#[specta::specta]
pub async fn trash_entry(
    store: State<'_, WorkspaceStore>,
    project: String,
    path: String,
) -> Result<()> {
    ops::trash_entry(&store.root(&project)?, &path)
}

/// Shows a file or folder of an open project in the system file manager;
/// `""` opens the project folder.
#[tauri::command]
#[specta::specta]
pub async fn reveal_entry(
    store: State<'_, WorkspaceStore>,
    project: String,
    path: String,
) -> Result<()> {
    ops::reveal_entry(&store.root(&project)?, &path)
}

/// The absolute path of a file or folder of an open project (`""` for the
/// project folder), with the separators of the operating system.
#[tauri::command]
#[specta::specta]
pub async fn native_path(
    store: State<'_, WorkspaceStore>,
    project: String,
    path: String,
) -> Result<String> {
    let path = ops::native_path(&store.root(&project)?, &path)?;
    Ok(path.to_string_lossy().into_owned())
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

/// Sets the directories of a project the UI shows (expanded folders, folders
/// of open files). Replaces the previous set; see `FsWatcher` for what is
/// watched on each platform.
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
    watcher.set_watched(&project, &root, dirs);
    Ok(())
}

/// Fuzzy-matches the files of a project for quick open.
#[tauri::command]
#[specta::specta]
pub async fn quick_open(
    store: State<'_, WorkspaceStore>,
    quick_open: State<'_, QuickOpen>,
    project: String,
    query: String,
    limit: u32,
) -> Result<Vec<FileMatch>> {
    let root = store.root(&project)?;
    Ok(quick_open.search(&project, &root, &query, limit as usize))
}

/// Searches the text of all files in a project. Batches of results are sent
/// through `on_results`; the summary is returned when the search ends.
/// Starting a new search cancels the previous one.
#[tauri::command]
#[specta::specta]
pub async fn search_text(
    store: State<'_, WorkspaceStore>,
    control: State<'_, SearchControl>,
    project: String,
    query: String,
    options: SearchOptions,
    on_results: Channel<Vec<FileResults>>,
) -> Result<SearchSummary> {
    let root = store.root(&project)?;
    let matcher = search::build_matcher(&query, &options)?;
    let generation = control.start();
    let control = control.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        search::search(&root, &matcher, &control, generation, |batch| {
            // The frontend may have gone away; the search ends anyway.
            let _ = on_results.send(batch);
        })
    })
    .await
    .map_err(|err| crate::error::Error::Io(err.to_string()))
}

#[tauri::command]
#[specta::specta]
pub fn cancel_search(control: State<'_, SearchControl>) {
    control.cancel();
}
