# 0011. Settings storage and portable mode

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

Settings must be human-readable, robust against crashes and corrupt files,
and work in a portable Windows build that leaves no traces in the user
profile.

## Decision

- Settings are pretty-printed **JSON** (`settings.json`), owned by the Rust
  backend and exposed via `get_settings` / `set_settings`.
- The config directory is resolved in this order:
  1. `AME_CONFIG_DIR` environment variable (development, tests, benchmarks),
  2. **portable mode** when a file named `portable` or `portable.txt` lies
     next to the executable → `<exe dir>/data/`,
  3. the OS app config directory (`app_config_dir()` of Tauri).
- In portable mode the web view data directory is moved to
  `<exe dir>/data/webview/` as well (Windows and Linux; macOS does not
  support a custom data directory).
- Writes are atomic (temp file + rename). Missing fields use defaults;
  unknown fields are ignored; an unparsable file is moved to
  `settings.corrupt.json` and defaults are used. A `version` field allows
  migrations.
- The bundle identifier is `io.github.nclskpprs.ame`.

## Consequences

- The app always starts, even with a broken settings file.
- Portable mode works on every platform, but is only useful where the
  executable directory is writable (not inside a macOS `.app` or an
  AppImage).
- Changing the bundle identifier later would move the default config
  directory; a migration would be needed.
