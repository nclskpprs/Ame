//! Ame — Agent Manager Editor.
//!
//! The Rust backend of the Tauri app. See `docs/ARCHITECTURE.md` for an
//! overview of the modules.

pub mod agents;
pub mod error;
pub mod fs;
pub mod git;
pub mod ipc;
pub mod notify;
pub mod pty;
pub mod scripts;
pub mod workspace;

use tauri::{App, Manager, RunEvent, WebviewWindowBuilder};
use tauri_specta::Event;

use fs::quick_open::QuickOpen;
use fs::search::SearchControl;
use fs::watcher::FsWatcher;
use pty::PtyManager;
use pty::commands::SessionsChanged;
use workspace::paths::AppPaths;
use workspace::projects::WorkspaceStore;
use workspace::settings::SettingsStore;

/// Label of the main window as defined in `tauri.conf.json`.
const MAIN_WINDOW: &str = "main";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = ipc::builder();

    #[cfg(debug_assertions)]
    if let Err(err) = ipc::export_bindings(&builder) {
        eprintln!("failed to export TypeScript bindings: {err}");
    }

    pty::env::warm_up();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            builder.mount_events(app);

            let paths = AppPaths::resolve(app.handle())?;
            log::info!(
                "config dir: {} ({:?})",
                paths.config_dir.display(),
                paths.source
            );
            app.manage(SettingsStore::load(&paths.config_dir));
            app.manage(WorkspaceStore::load(&paths.config_dir));
            app.manage(FsWatcher::new(app.handle().clone())?);
            app.manage(QuickOpen::default());
            app.manage(SearchControl::default());
            let handle = app.handle().clone();
            app.manage(PtyManager::new(move |sessions| {
                if let Err(err) = (SessionsChanged { sessions }).emit(&handle) {
                    log::warn!("could not emit session change: {err}");
                }
            }));
            create_main_window(app, &paths)?;
            app.manage(paths);
            Ok(())
        })
        .build(tauri::generate_context!());

    match app {
        Ok(app) => app.run(|app, event| {
            if let RunEvent::Exit = event {
                app.state::<PtyManager>().shutdown();
            }
        }),
        Err(err) => {
            eprintln!("error while running Ame: {err}");
            std::process::exit(1);
        }
    }
}

/// Creates the main window from its config. It is not created automatically
/// (`"create": false`) so that portable mode can keep the web view data
/// (cache, local storage) next to the executable as well.
fn create_main_window(app: &App, paths: &AppPaths) -> Result<(), Box<dyn std::error::Error>> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == MAIN_WINDOW)
        .ok_or("main window is missing in tauri.conf.json")?;

    let mut window = WebviewWindowBuilder::from_config(app.handle(), config)?;
    if paths.is_portable() {
        window = window.data_directory(paths.config_dir.join("webview"));
    }
    window.build()?;
    Ok(())
}
