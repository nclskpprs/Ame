//! Typed IPC between the Rust backend and the web view.
//!
//! Every command is registered in [`builder`]. The TypeScript bindings in
//! `src/lib/ipc/bindings.ts` are generated from it with `tauri-specta` by
//! debug builds and by `cargo test`.

use specta_typescript::Typescript;
use tauri::Wry;
use tauri_specta::{Builder, collect_commands};

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
    Builder::<Wry>::new().commands(collect_commands![
        commands::get_settings,
        commands::set_settings,
        commands::get_app_info,
        commands::get_workspace,
        commands::pick_folder,
        commands::add_project,
        commands::remove_project,
        commands::set_active_project,
        commands::set_project_pinned,
        commands::set_project_group,
        commands::set_project_layout,
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
