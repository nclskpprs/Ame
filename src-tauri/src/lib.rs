//! Ame — Agent Manager Editor.
//!
//! The Rust backend of the Tauri app. See `docs/ARCHITECTURE.md` for an
//! overview of the modules.

pub mod agents;
pub mod background;
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

use agents::adapters::Adapters;
use background::Tray;
use fs::quick_open::QuickOpen;
use fs::search::SearchControl;
use fs::watcher::FsWatcher;
use pty::PtyManager;
use pty::commands::SessionsChanged;
use workspace::paths::AppPaths;
use workspace::projects::WorkspaceStore;
use workspace::settings::SettingsStore;

/// Label of the main window as defined in `tauri.conf.json`.
pub(crate) const MAIN_WINDOW: &str = "main";

/// Runs a command-line helper if the arguments ask for one (e.g. the hook
/// helper `ame hook claude`) and returns its exit code; `None` starts the
/// app. Must run before anything else, so helpers stay fast.
pub fn run_cli() -> Option<i32> {
    agents::adapters::cli::run(std::env::args_os().skip(1))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = ipc::builder();

    #[cfg(debug_assertions)]
    if let Err(err) = ipc::export_bindings(&builder) {
        eprintln!("failed to export TypeScript bindings: {err}");
    }

    pty::env::warm_up();

    let app = tauri::Builder::default()
        // Must come first: a second start only shows the running app.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            background::show_main_window(app);
        }))
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
            app.manage(Tray::default());
            app.manage(SearchControl::default());
            let handle = app.handle().clone();
            let pty = PtyManager::new(move |sessions| {
                if let Err(err) = (SessionsChanged { sessions }).emit(&handle) {
                    log::warn!("could not emit session change: {err}");
                }
            });
            let hooks = pty.clone();
            app.manage(Adapters::start(&paths.config_dir, move |message| {
                hooks.apply_hook(&message);
            }));
            app.manage(pty);
            create_main_window(app, &paths)?;
            app.manage(paths);
            Ok(())
        })
        .build(tauri::generate_context!());

    match app {
        Ok(app) => app.run(|app, event| match event {
            RunEvent::Exit => app.state::<PtyManager>().shutdown(),
            // Quitting from the OS (the macOS app menu, Cmd+Q) while the
            // window still exists goes through the frontend's checks for
            // unsaved files and running agents, which then call `quit_app`
            // (that exit has a code). Closing the last window has no window
            // left and exits right away.
            RunEvent::ExitRequested {
                code: None, api, ..
            } if app.get_webview_window(MAIN_WINDOW).is_some() => {
                api.prevent_exit();
                background::show_main_window(app);
                if let Err(err) = background::TrayAction::Quit.emit(app) {
                    log::warn!("could not ask the window to quit: {err}");
                }
            }
            // A click on the dock icon brings a hidden window back.
            #[cfg(target_os = "macos")]
            RunEvent::Reopen { .. } => background::show_main_window(app),
            _ => {}
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
