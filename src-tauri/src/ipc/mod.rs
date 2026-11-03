//! Typed IPC between the Rust backend and the web view.
//!
//! Every command is registered in [`builder`]. The TypeScript bindings in
//! `src/lib/ipc/bindings.ts` are generated from it with `tauri-specta` by
//! debug builds and by `cargo test`.

use specta_typescript::Typescript;
use tauri::Wry;
use tauri_specta::{Builder, collect_commands, collect_events};

use crate::agents::commands as agents;
use crate::background::TrayAction;
use crate::background::commands as background;
use crate::bench;
use crate::board::commands as board;
use crate::fs::commands as fs;
use crate::fs::watcher::FsChanged;
use crate::git::commands as git;
use crate::git::commands::CheckpointsChanged;
use crate::pty::commands as pty;
use crate::pty::commands::SessionsChanged;
use crate::scripts::commands as scripts;
use crate::workspace::commands;

/// Path of the generated TypeScript bindings.
pub const BINDINGS_PATH: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../src/lib/ipc/bindings.ts");

const BINDINGS_HEADER: &str =
    "// Regenerate with `cargo test --workspace` or by running the app in debug mode.\n";

/// Collects all commands and events exposed to the frontend.
pub fn builder() -> Builder<Wry> {
    // Types whose serialized and deserialized shapes differ (e.g. structs with
    // `#[serde(default)]`) are exported twice: `Foo_Serialize` is what the
    // backend sends, `Foo_Deserialize` what it accepts.
    Builder::<Wry>::new()
        .commands(collect_commands![
            bench::app_ready,
            commands::get_settings,
            commands::set_settings,
            commands::get_app_info,
            commands::get_workspace,
            commands::pick_folder,
            commands::add_project,
            commands::remove_project,
            commands::set_active_project,
            commands::set_project_pinned,
            commands::set_project_muted,
            commands::set_project_group,
            commands::set_project_layout,
            fs::read_dir,
            fs::create_entry,
            fs::move_entry,
            fs::trash_entry,
            fs::reveal_entry,
            fs::native_path,
            fs::read_file,
            fs::write_file,
            fs::watch_dirs,
            fs::quick_open,
            fs::search_text,
            fs::cancel_search,
            git::git_status,
            git::git_original,
            git::git_stage,
            git::git_unstage,
            git::git_commit,
            scripts::list_scripts,
            scripts::run_script,
            board::list_packages,
            board::save_package,
            board::delete_package,
            git::git_branches,
            git::git_switch,
            git::list_checkpoints,
            git::create_checkpoint,
            git::checkpoint_changes,
            git::restore_checkpoint,
            agents::list_agents,
            pty::start_session,
            pty::list_sessions,
            pty::session_previews,
            pty::session_usage,
            pty::attach_session,
            pty::detach_session,
            pty::write_session,
            pty::paste_session,
            pty::queue_prompt,
            pty::remove_queued_prompt,
            pty::move_queued_prompt,
            pty::clear_prompt_queue,
            pty::resize_session,
            pty::stop_session,
            pty::close_session,
            background::hide_window,
            background::show_window,
            background::quit_app,
            background::set_tray,
        ])
        .events(collect_events![
            FsChanged,
            SessionsChanged,
            TrayAction,
            CheckpointsChanged
        ])
}

/// Writes the TypeScript bindings to [`BINDINGS_PATH`].
pub fn export_bindings(builder: &Builder<Wry>) -> Result<(), specta_typescript::Error> {
    builder.export(Typescript::default().header(BINDINGS_HEADER), BINDINGS_PATH)
}

#[cfg(test)]
mod tests {
    /// Keeps `src/lib/ipc/bindings.ts` in sync with the Rust types. CI fails
    /// if this changes the committed file.
    #[test]
    fn export_bindings() {
        super::export_bindings(&super::builder()).expect("failed to export bindings");
    }
}
