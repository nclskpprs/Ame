//! Ame — Agent Manager Editor.
//!
//! The Rust backend of the Tauri app. See `docs/ARCHITECTURE.md` for an
//! overview of the modules.

pub mod agents;
pub mod fs;
pub mod git;
pub mod ipc;
pub mod notify;
pub mod pty;
pub mod scripts;
pub mod workspace;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!());

    if let Err(err) = result {
        eprintln!("error while running Ame: {err}");
        std::process::exit(1);
    }
}
