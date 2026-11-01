//! Running in the background: closing the window hides it while agents run,
//! a tray icon shows their state and brings the window back, and a second
//! start of Ame shows the running one. See ADR 0020.

pub mod commands;

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Runtime};
use tauri_specta::Event;

use crate::MAIN_WINDOW;
use crate::error::{Error, Result};
use crate::pty::SessionId;

const TRAY_ID: &str = "main";
const MENU_SHOW: &str = "show";
const MENU_QUIT: &str = "quit";
const MENU_SESSION: &str = "session:";

/// What the tray shows. Built by the frontend, which has the translations
/// and the theme colors.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TrayModel {
    pub tooltip: String,
    pub show_label: String,
    pub quit_label: String,
    /// One entry per agent session, e.g. "Claude Code · project — waiting".
    pub sessions: Vec<TrayEntry>,
    /// A status icon (RGBA); `None` shows the app icon.
    pub icon: Option<TrayImage>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TrayEntry {
    pub id: SessionId,
    pub label: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct TrayImage {
    pub rgba: Vec<u8>,
    pub width: u32,
    pub height: u32,
}

/// Something chosen in the tray menu that the frontend handles.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Event)]
#[serde(tag = "action", rename_all = "camelCase")]
pub enum TrayAction {
    /// Quit, with the usual checks for unsaved files and running agents.
    Quit,
    /// Show this session.
    Session { id: SessionId },
}

/// The tray icon, created on the first update from the frontend. Managed as
/// Tauri state.
#[derive(Default)]
pub struct Tray {
    icon: Mutex<Option<TrayIcon>>,
    model: Mutex<Option<TrayModel>>,
}

impl Tray {
    /// Creates or updates the tray icon. Desktops without a tray (e.g. GNOME
    /// without an extension) simply show nothing.
    pub fn update(&self, app: &AppHandle, model: TrayModel) -> Result<()> {
        let mut current = lock(&self.model);
        if current.as_ref() == Some(&model) {
            return Ok(());
        }
        let menu = menu(app, &model).map_err(tray_error)?;
        let icon = match &model.icon {
            Some(image) => Some(Image::new_owned(
                image.rgba.clone(),
                image.width,
                image.height,
            )),
            None => app.default_window_icon().cloned(),
        };
        let mut tray = lock(&self.icon);
        if let Some(tray) = tray.as_ref() {
            tray.set_menu(Some(menu)).map_err(tray_error)?;
            tray.set_tooltip(Some(&model.tooltip)).map_err(tray_error)?;
            tray.set_icon(icon).map_err(tray_error)?;
        } else {
            let mut builder = TrayIconBuilder::with_id(TRAY_ID)
                .menu(&menu)
                .tooltip(&model.tooltip)
                // A left click shows the window, the menu is on the right.
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| on_menu(app, event.id().as_ref()))
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                });
            if let Some(icon) = icon {
                builder = builder.icon(icon);
            }
            *tray = Some(builder.build(app).map_err(tray_error)?);
        }
        *current = Some(model);
        Ok(())
    }
}

fn menu<R: Runtime>(app: &AppHandle<R>, model: &TrayModel) -> tauri::Result<Menu<R>> {
    let menu = Menu::new(app)?;
    for entry in &model.sessions {
        let id = format!("{MENU_SESSION}{}", entry.id);
        menu.append(&MenuItem::with_id(
            app,
            id,
            &entry.label,
            true,
            None::<&str>,
        )?)?;
    }
    if !model.sessions.is_empty() {
        menu.append(&PredefinedMenuItem::separator(app)?)?;
    }
    menu.append(&MenuItem::with_id(
        app,
        MENU_SHOW,
        &model.show_label,
        true,
        None::<&str>,
    )?)?;
    menu.append(&MenuItem::with_id(
        app,
        MENU_QUIT,
        &model.quit_label,
        true,
        None::<&str>,
    )?)?;
    Ok(menu)
}

fn on_menu<R: Runtime>(app: &AppHandle<R>, id: &str) {
    let action = match id {
        MENU_SHOW => None,
        MENU_QUIT => Some(TrayAction::Quit),
        _ => match id.strip_prefix(MENU_SESSION).map(str::parse) {
            Some(Ok(id)) => Some(TrayAction::Session { id }),
            _ => return,
        },
    };
    show_main_window(app);
    if let Some(action) = action
        && let Err(err) = action.emit(app)
    {
        log::warn!("could not send the tray action: {err}");
    }
}

/// Shows, restores and focuses the main window, e.g. from the tray, a second
/// start of the app or the macOS dock.
pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW) else {
        return;
    };
    let shown = window
        .show()
        .and_then(|()| window.unminimize())
        .and_then(|()| window.set_focus());
    if let Err(err) = shown {
        log::warn!("could not show the window: {err}");
    }
}

fn tray_error(err: impl std::fmt::Display) -> Error {
    Error::Io(format!("tray: {err}"))
}

fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}
