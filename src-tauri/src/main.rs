// Prevents an additional console window on Windows in release builds. Do not remove.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Some(code) = ame_lib::run_cli() {
        std::process::exit(code);
    }
    ame_lib::run();
}
