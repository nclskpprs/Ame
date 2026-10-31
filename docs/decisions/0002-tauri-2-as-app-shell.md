# 0002. Tauri 2 with a Rust backend as the app shell

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

Ame must be lean: under 150 MB RAM idle with three projects and a cold start
under one second, on macOS, Linux and Windows, including a portable Windows
`.exe`. Electron ships a full Chromium per app and typically needs several
hundred MB. The heavy work (PTYs, file watching, git, search) should not run
on the UI thread.

## Decision

Use **Tauri 2**. The UI runs in the system web view (WKWebView on macOS,
WebKitGTK on Linux, WebView2 on Windows); the backend is **Rust**.

## Consequences

- Small binaries and low memory use; Rust for all heavy lifting.
- Rendering differs per platform. WebKitGTK on Linux is partly slower; test
  on Linux early and keep a canvas fallback for the terminal.
- The Windows build depends on the WebView2 runtime (preinstalled on
  Windows 10/11); a clear error is needed when it is missing.
- Contributors need a Rust toolchain plus the Tauri system dependencies.
