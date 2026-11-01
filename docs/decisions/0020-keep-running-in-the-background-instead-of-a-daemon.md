# 0020. Keep running in the background instead of a daemon

- **Status:** Accepted
- **Date:** 2026-11-01

## Context

M2 planned a background daemon: PTY sessions in a separate Rust process
that survive a UI crash or close (like tmux). That needs a local socket
protocol with version checks, detached processes on three platforms and a
changed quit flow, and it could only be tested on Linux here.

The maintainer's actual need is narrower: closing the window must not stop
running agents. Quitting the app on purpose may end them.

## Decision

- **Closing the window** (X, Alt+F4) while agent sessions run **hides** the
  window; the app keeps running with all sessions, notifications and the
  badge. Without running sessions the app closes as before (with the
  inline guard for unsaved files). Setting `closeAction`: `background`
  (default) or `quit`. The first time, an OS notification explains this
  (`backgroundHintShown`).
- **Quitting** (`Mod+Q`, also from a focused terminal; the tray menu; the
  macOS app menu) goes through the close guard (unsaved files, running
  agents) and then ends the app with `quit_app`, which ends every session.
  On macOS an OS quit request (`ExitRequested` without an exit code while
  the window exists) is routed through the same guard.
- **Getting back:** a tray icon (left click shows the window; the menu lists
  every session with its state, plus "Show Ame" and "Quit Ame"); a second
  start of Ame (`tauri-plugin-single-instance`) shows the running one; on
  macOS the dock icon (`RunEvent::Reopen`). The frontend builds the tray
  model (translations, theme colors); while agents wait, the icon is the
  amber count badge.
- **Process trees:** stopping, closing or quitting a session first sends
  SIGTERM (terminate on Windows) to everything its program started
  (`pty/tree.rs`, `sysinfo`), so dev servers or watchers an agent started
  in the background do not outlive it.
- The daemon moves to "Later" in the roadmap.

## Alternatives considered

- **The daemon as planned:** survives a crash of the app as well, but at a
  high cost and risk before 0.1. Can still be built later; the frontend
  already replays sessions from a backend buffer.
- **Minimize instead of hide:** keeps a taskbar entry, but then the close
  button does the same as minimize, and the window stays in the
  Alt+Tab list without being wanted.
- **Windows Job Objects / Unix process groups** for the process tree:
  `unsafe` code (forbidden in this workspace) or platform-specific APIs;
  walking the tree with `sysinfo` works everywhere.

## Consequences

- Sessions survive closing the window, not a crash of the app. After a
  crash, the "previous sessions" offer of M2 (resume) still applies.
- Programs that a crashed app leaves behind are not cleaned up.
- On Linux the tray needs `libayatana-appindicator`; desktops without a
  tray (GNOME without an extension) show none, so a second start is the
  way back. Alt+F4 on Windows cannot be told apart from X.
- Only one instance of Ame runs per user (a development and a release
  build share the identifier).
