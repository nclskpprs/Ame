# 0026. In-app updates from GitHub releases

- **Status:** Accepted
- **Date:** 2026-11-03

## Context

The maintainer wants 0.1.0 to update itself: check on start and
periodically, tell the user (inline and as an OS notification) and install
with one click. Releases are built by `tauri-action` on GitHub and are not
code-signed (ad-hoc on macOS, unsigned on Windows).

## Decision

- **`tauri-plugin-updater`** with the endpoint
  `https://github.com/nclskpprs/Ame/releases/latest/download/latest.json`.
  `tauri-action` builds the signed updater artifacts
  (`bundle.createUpdaterArtifacts`) and uploads `latest.json`, preferring
  the NSIS installer on Windows (passive install mode). The minisign key
  pair belongs to the maintainer; the public key is in `tauri.conf.json`.
- Since `releases/latest` skips pre-releases, plain versions (also 0.x)
  are published as **full releases**; only versions with a `-` are
  pre-releases. The rolling preview stays a pre-release and is never seen
  by the updater.
- **Backend module `update/`** with specta-typed commands instead of the
  plugin's JavaScript API, like every other command (no extra
  capability): `update_support`, `check_update` (keeps the found update in
  state) and `install_update` (download with throttled progress over a
  channel, install, end all sessions, restart). On Windows the installer
  quits Ame itself; `on_before_exit` ends the sessions first.
- **Who updates in-app:** installed release builds on macOS and Windows and
  the Linux AppImage. The portable Windows build, `.deb`/`.rpm` installs
  and debug builds get a link to the release page (`UpdateSupport`).
- **Frontend** (`lib/update/update.svelte.ts`): a check 10 s after the
  start and every 6 h while the setting `updateCheck` is on (default);
  "Check for Updates" in the palette and the settings. A found version
  shows a notice in the sidebar (Install and restart / Later) and one OS
  notification per version. Running terminals and agents end with the
  restart, so the notice asks inline first when there are any.

## Alternatives considered

- **Plugin JavaScript API:** would need the `updater:default` capability
  and bypass the typed `commands` and the session shutdown before the
  restart.
- **Own update check against the GitHub API:** reimplements signature
  checks and installers per platform.
- **Install silently in the background:** would end running agents without
  the user's consent.

## Consequences

- Release and preview builds need the signing secrets; a lost private key
  means existing installs can no longer update.
- A draft release is invisible to the updater until it is published, so
  checking the draft first stays safe.
- Updates are not code-signed beyond the updater signature; macOS and
  Windows warnings at first install stay as documented in RELEASING.
