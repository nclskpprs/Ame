# Architecture

This document describes the current architecture and the planned modules.
Sections are marked **implemented** or **planned**. Keep it up to date when
the architecture changes and record decisions as ADRs in
[decisions/](decisions/).

## Overview

```
┌──────────────────────────── Ame process ────────────────────────────┐
│                                                                     │
│  System web view (WKWebView / WebKitGTK / WebView2)                 │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Svelte 5 + TypeScript                                          │  │
│  │ sidebar · file tree · CodeMirror 6 · xterm.js · dashboard · diff │  │
│  └───────────────▲──────────────────────────────┬─────────────────┘  │
│        events (batched, throttled)     commands (typed, tauri-specta) │
│  ┌───────────────┴──────────────────────────────▼─────────────────┐  │
│  │ Rust backend (Tauri 2)                                          │  │
│  │ workspace · fs · pty · agents · git · scripts · notify · ipc    │  │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Tech stack

| Area                    | Choice                                                             | Reason                                                       | ADR                                                              |
| ----------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| App shell               | Tauri 2                                                            | System web view instead of Chromium, small binaries, low RAM | [0002](decisions/0002-tauri-2-as-app-shell.md)                   |
| Backend                 | Rust                                                               | Heavy work (PTY, files, git, search) off the UI thread       | [0002](decisions/0002-tauri-2-as-app-shell.md)                   |
| Frontend                | Svelte 5 + TypeScript + Vite (no SvelteKit)                        | No virtual DOM, tiny runtime                                 | [0003](decisions/0003-svelte-5-and-vite-without-sveltekit.md)    |
| Package manager         | pnpm                                                               | Fast, strict, disk-efficient                                 | [0004](decisions/0004-pnpm-and-cargo-workspace.md)               |
| Editor                  | CodeMirror 6                                                       | Much lighter than Monaco, modular, fast on large files       | [0005](decisions/0005-codemirror-6-as-editor.md)                 |
| Terminal UI             | xterm.js + WebGL addon                                             | Standard, GPU rendering                                      | [0006](decisions/0006-terminal-stack.md)                         |
| PTY                     | `portable-pty` (from WezTerm)                                      | Works on Windows too (ConPTY)                                | [0006](decisions/0006-terminal-stack.md)                         |
| Backend terminal buffer | Raw output ring buffer (1 MiB per session), replayed into xterm.js | Background sessions run without an xterm.js instance         | [0018](decisions/0018-pty-sessions-and-output-replay.md)         |
| File watching           | `notify` (debounced)                                               | Native per OS                                                | [0007](decisions/0007-filesystem-and-search-crates.md)           |
| File search / ignore    | `ignore` + `grep` (ripgrep libraries)                              | Fast, respects `.gitignore`                                  | [0007](decisions/0007-filesystem-and-search-crates.md)           |
| Fuzzy quick open        | `nucleo`                                                           | Very fast fuzzy matcher                                      | [0007](decisions/0007-filesystem-and-search-crates.md)           |
| Git                     | git CLI for status/diff, optionally `gix` later                    | Simple, reliable, no libgit2 dependency                      | [0008](decisions/0008-git-via-cli.md)                            |
| Typed IPC               | `specta` + `tauri-specta`                                          | TypeScript types generated from Rust                         | [0009](decisions/0009-typed-ipc-with-tauri-specta.md)            |
| i18n                    | Own tiny `t()` helper + JSON per locale                            | Zero runtime dependencies, typed keys                        | [0010](decisions/0010-i18n-with-json-locale-files.md)            |
| Settings                | JSON in the app config dir, or next to the `.exe` in portable mode | Human-readable, no extra deps                                | [0011](decisions/0011-settings-storage-and-portable-mode.md)     |
| Theming                 | Design tokens in TS, applied as CSS custom properties              | One source for UI, editor and terminal colors                | [0012](decisions/0012-design-tokens-as-css-custom-properties.md) |

## Repository layout

```
Cargo.toml            Cargo workspace (member: src-tauri; the hook helper is
                      a subcommand of the app binary, `ame hook <agent>`)
package.json          frontend + tooling (pnpm)
src-tauri/            Rust backend
  src/
    lib.rs            app setup, plugin and command registration
    main.rs           binary entry point
    workspace/        projects, settings, portable mode
    fs/               lazy tree, watcher, read/write, search
    pty/              session manager, ring buffers, process tree
    agents/           profiles, status detection, adapters/
    git/              status, diff, worktrees
    scripts/          package.json / composer.json discovery + runner
    notify/           OS notifications, dock/taskbar badge
    ipc/              Tauri commands + events (typed)
src/                  Svelte frontend
  App.svelte          root component
  main.ts             entry point
  app.css             global styles (uses design tokens only)
  lib/commands/       command registry, shortcuts, app commands
  lib/components/     sidebar, file tree, editor, search, palette, …
  lib/editor/         CodeMirror setup, theme, languages
  lib/fs/             helpers for project-relative paths
  lib/i18n/           translation helper and tests
  lib/ipc/            generated bindings (bindings.ts) — do not edit; types.ts
  lib/menu/           context menu state, keyboard navigation, placement
  lib/palette/        palette state, sources, fuzzy matching
  lib/project/        per-project sessions: file tree, editors, search
  lib/settings/       option lists for the settings view
  lib/stores/         app-wide state: settings, workspace, view, notices
  lib/terminal/       xterm.js view, input queue, terminal theme, sessions
  lib/theme/          design tokens and theme logic
locales/en.json       source of truth for UI strings
docs/                 vision, architecture, design, roadmap, progress, ADRs
```

## Rules

- The backend sends events (status, file changed, PTY output) **batched and
  throttled** to the frontend.
- Terminals that are not visible have **no xterm.js instance**. Their output
  lands in a Rust ring buffer and is restored when the terminal is opened.
- All IPC types are **generated from Rust** with `tauri-specta`, so frontend
  and backend stay type-safe. Debug builds and `cargo test` regenerate
  `src/lib/ipc/bindings.ts`; CI fails if the committed file is stale.

## Settings and portable mode — implemented (M0)

Module: `src-tauri/src/workspace/`.

- Settings are stored as pretty-printed JSON in `settings.json`.
- **Config directory resolution** (first match wins):
  1. `AME_CONFIG_DIR` environment variable (development, tests, benchmarks).
  2. **Portable mode:** a file named `portable` (or `portable.txt`) next to
     the executable → `<exe dir>/data/`. The web view data then lives in
     `<exe dir>/data/webview/` as well. Intended for the portable Windows
     `.exe`, but works wherever the executable directory is writable.
  3. The OS app config directory from Tauri (`app_config_dir()`), e.g.
     `%APPDATA%\io.github.nclskpprs.ame\` on Windows,
     `~/.config/io.github.nclskpprs.ame/` on Linux and
     `~/Library/Application Support/io.github.nclskpprs.ame/` on macOS.
- Writes are atomic (write a temp file, then rename).
- Missing fields fall back to defaults, so older files keep working. A file
  that cannot be parsed is moved aside to `settings.corrupt.json` and
  defaults are used.
- Every file carries a `version` for future migrations.
- Commands: `get_settings`, `set_settings` (async, so the file write does
  not block the main thread), `get_app_info` (version, portable flag, config
  dir).
- The main window is created in Rust (`"create": false` in
  `tauri.conf.json`) so that portable mode can set its data directory.
- Frontend state: `src/lib/stores/settings.svelte.ts`. Updates are applied
  optimistically and rolled back if saving fails.

## Theming — implemented (M0)

- Tokens for _Ame Dark_ and _Ame Light_ live in `src/lib/theme/tokens.ts`
  (values in [DESIGN.md](DESIGN.md)).
- `src/lib/theme/theme.ts` resolves the `theme` setting (`system`, `dark`,
  `light`) with `prefers-color-scheme` and the rain setting with
  `prefers-reduced-motion`. `applyAppearance()` writes the tokens as CSS
  custom properties (`--ame-bg`, `--ame-text`, …) onto `<html>`, plus
  `data-theme`, `data-density` and `data-rain` attributes. It runs once
  before the first render and again whenever a setting or a system
  preference changes.
- Spacing, radii and fonts are CSS custom properties in `src/app.css` and
  change with `data-density`.
- Components only use `var(--ame-…)`; a test rejects literal colors in
  `.svelte` and `.css` files. CodeMirror and xterm.js themes will be derived
  from the same token objects.
- A unit test checks WCAG AA contrast: 4.5:1 for text tokens and 3:1 for
  indicator tokens, on `bg` and `surface`.

## Layout — implemented (M0/M1)

- `App.svelte`: sidebar | main area. The main area shows the active
  project's `ProjectView` or the `EmptyState` (with the drop/cursor mark).
- `Sidebar.svelte`: app name, open-folder button, project list (pinned,
  groups, ungrouped), notices, theme switcher, portable-mode badge.
- `ProjectView.svelte`: side panel (Files / Search tabs) | `Resizer` |
  `EditorPane` (tabs, inline bars, editor) above the terminal panel. The
  side panel width and tab and the terminal panel height and visibility are
  part of the project layout.
- `SettingsView.svelte` replaces the main area (`Mod+,`); it closes when a
  project or file is opened.

## i18n — implemented (M0)

- `locales/en.json` is the source of truth. Other locales are added as
  `locales/<code>.json` with the same keys; missing keys fall back to
  English.
- `t(key, params?)` in `src/lib/i18n/` with keys typed from `en.json` and
  `{name}` placeholders.
- Tests ensure every locale has exactly the keys of `en.json` and that no
  Svelte component contains raw, untranslated text.

## Terminal sessions — implemented (M2)

Module: `src-tauri/src/pty/` (see
[ADR 0018](decisions/0018-pty-sessions-and-output-replay.md)).

- `PtyManager` owns all sessions (`portable-pty`). A session runs one
  program in the project folder with the login shell environment
  (`pty/env.rs`) plus `TERM=xterm-256color`, `COLORTERM=truecolor`,
  `TERM_PROGRAM=Ame` and `AME_SESSION_ID`.
- Output goes into a 1 MiB ring buffer and, batched and throttled (16 ms),
  to the attached view through a `Channel<String>`. Attaching replays the
  buffer first.
- Commands: `start_session`, `list_sessions`, `attach_session`,
  `detach_session`, `write_session`, `paste_session` (bracketed paste when
  the program enabled it, used by "Send Selection to Agent"),
  `resize_session`, `stop_session`, `close_session`; the `sessions-changed` event carries all sessions when
  one starts, exits or closes. Closing a project closes its sessions; quitting
  the app ends all of them.
- Frontend: `TerminalGroup` (`lib/project/terminals.svelte.ts`) holds the
  sessions of a project and the panel state; the panel (`TerminalPanel`)
  shows one xterm.js instance (`lib/terminal/terminal-view.ts`, loaded on
  demand) for the active session only. Input goes through an `InputQueue`
  (one write in flight). On Linux and Windows, commands only run while a
  terminal has focus if they opt in (`terminal: true`), so Ctrl+K, Ctrl+P, …
  reach the program.

## Project groups for agents — implemented (M5b)

- Profiles have `addDirArg` (Claude Code and Codex `--add-dir`, Gemini CLI
  `--include-directories`; editable, an empty string turns it off).
  `start_session(…, dirs)` checks that every folder is an open project and
  repeats the option per folder; the session keeps `dirs` (restart, and
  `SavedSession.dirs` for restoring after a restart). The title gets
  `(+N)`.
- `lib/agents/group.ts`: "Start Agent for Project Group…" (agents with a
  folder option, started in the active project with the group's other
  folders) and "Send Prompt to Project Group…" (the palette as a text
  input; the prompt is queued for the newest running agent of each project
  in the group, so busy agents get it when they are done).
- Dashboard: cards in blocks per group (alphabetical) with a combined
  status, then the ungrouped ones (`lib/agents/dashboard.ts`).

## Scripts — implemented (M5)

- `scripts/detect.rs` reads `package.json` and `composer.json` at the
  project root only (no indexing), in file order (`serde_json` with
  `preserve_order`). The package manager comes from the lock file, then
  the `packageManager` field, then npm; composer `pre-…`/`post-…` event
  hooks are left out.
- `run_script` starts a PTY session with the profile `script:<id>` (e.g.
  `script:pnpm:build`) and the script name as title, so status dots, exit
  codes, notifications and restart work as for agents. Script sessions
  are not offered for restoring after a restart and take no checkpoints.
- Frontend: `project/scripts.svelte.ts` (refreshed when a manifest or lock
  file at the root changes), the scripts side panel (only when there are
  scripts) with run/stop and the last result, "Run script: …" entries in
  the command palette, command "Show Scripts".

## Branches and ready-made prompts — implemented

- `git/branches.rs`: `git_branches` lists local branches (newest commit
  first, upstream, current) and the main branch (`develop` if it exists,
  else the branch `origin/HEAD` points to, else `main`/`master`/`trunk`);
  `git_switch` runs `git switch --no-guess`, so uncommitted changes stay
  and git refuses when they would be overwritten.
- Frontend: the branch name in the changes panel and "Switch Branch…" open
  the branch picker (`lib/git/branches.ts`).
- Prompt library: built-in prompts (`lib/agents/prompts.ts`) plus the
  user's own in `settings.prompts` (`LibraryPrompt`: id, name, text).
  `{project}`, `{branch}` and `{main}` are filled in per target agent from
  `git_branches` when sending. "Send Prompt…" (`Mod+Alt+P`,
  `lib/agents/library.ts`) offers every prompt for the project's newest
  agent and, in a group, for each project's agent; everything goes through
  the prompt queue. Edited in the settings (`PromptSettings.svelte`); the
  queue composer can save its text to the library.
- Built-in "clean up branches": only `git branch -d`, protects the main
  branches, asks before touching unmerged work; also reachable as its own
  commands for the project and the group.

## Checkpoints — implemented (M4)

- `git/checkpoints.rs` (ADR 0023): snapshots on hidden refs
  `refs/ame/checkpoints/<key>/<ms>` via a temporary index; `create`,
  `list`, `changes` (diff to a fresh snapshot), `restore` (with an undo
  checkpoint). One global lock serializes them.
- `PtyManager::on_prompt` reports submitted prompts from the status loop;
  `lib.rs` takes a checkpoint for agent sessions (not the shell) when the
  setting `checkpoints` is on and emits `checkpoints-changed`.
- Frontend: `project/checkpoints.svelte.ts` per project, listed in the
  changes panel with the files changed since, inline confirmation and
  Undo; command "Create Checkpoint".

## Benchmarks — implemented (M3)

- `bench.rs` (ADR 0022): `mark_start` in `main`, the frontend calls
  `app_ready` after its first frame; the startup time is logged on every
  start. With `AME_BENCH=<file>` the app measures the memory of its process
  tree after 5 s (PSS on Linux, RSS elsewhere), writes JSON and quits; the
  single-instance plugin is off in this mode.
- `scripts/bench.mjs` runs the release binary with three projects and
  reports medians; the CI job `bench` runs it under `xvfb-run`.
- `pty/tree.rs` leaves threads out of process trees (sysinfo lists them as
  processes on Linux), which the resource monitor relies on as well.

## Running in the background — implemented (M2)

Module: `src-tauri/src/background/` (see
[ADR 0020](decisions/0020-keep-running-in-the-background-instead-of-a-daemon.md)).

- Closing the window: `App.svelte` asks `closeDecision()`
  (`lib/background/close.ts`): with running sessions and
  `closeAction: background` it calls `hide_window`; otherwise the close
  guard decides. The first hide sends a hint notification.
- Quitting: `closeGuard.quit()` (`Mod+Q`, tray, macOS app menu via
  `ExitRequested`) asks inline if needed, then `quit_app` (`app.exit(0)`);
  `RunEvent::Exit` ends all sessions.
- Tray: `set_tray(TrayModel)` creates or updates the icon, tooltip and
  menu; the frontend builds the model (`lib/background/tray.ts`) whenever a
  session state changes. Menu choices come back as the `tray-action`
  event (quit, show a session). `tauri-plugin-single-instance` and macOS
  `Reopen` call `show_main_window`.
- `pty/tree.rs`: stopping, closing or quitting sessions first ends the
  descendants of their programs (`sysinfo`), then the programs.

## Agent profiles — implemented (M2)

Module: `src-tauri/src/agents/`.

- `profiles.rs`: built-in profiles (Claude Code, Codex CLI, Gemini CLI,
  OpenCode, Aider, Shell) with command, arguments, environment and resume
  arguments. Custom profiles live in `settings.json` (`agents`); one with a
  built-in id replaces that profile.
- `detect.rs`: resolves commands on the login shell `PATH` (`which`); the
  shell profile runs the default shell. `list_agents` returns every profile
  with the found path, so new installs show up without a restart.
- `start_session(project, profile, resume, cols, rows)` starts a profile;
  with `resume` its resume arguments are appended (e.g. `claude --continue`).
- Frontend: `lib/agents/` (store, ordering, palette picker `Mod+Shift+A`);
  the empty terminal panel offers the installed agents.
- Resume after a restart: the open sessions of every shown project are kept
  in its layout (`ProjectLayout.sessions`: profile and title; layouts are
  flushed before the window closes). After a restart they appear as
  previous sessions in the panel; "Continue conversation" starts the profile
  with its resume arguments. After a mere reload of the web view the backend
  still has the sessions, so nothing is offered.

## Agent status detection — implemented (M3)

States: `starting` · `working` · `needs_input` · `idle` (done) · `exited` ·
`error`.

Three layers combine into one result:

1. **Generic** (works with any agent):
   - Output activity: bytes in the last _N_ seconds → `working`; silence
     above a threshold → `idle`.
   - CPU load of the session's process tree (e.g. via `sysinfo`) as a second
     signal.
   - Terminal signals: BEL (`\x07`) and OSC 9 / OSC 777 notifications, which
     many CLIs emit → `needs_input` or `idle`.
   - Process exit → `exited`, or `error` on a non-zero exit code.
2. **Profile patterns:** each agent profile can define regexes that are
   matched against the last screen lines (e.g. confirmation prompts) →
   `needs_input`.
3. **Precise adapters** (optional): agents with a hook or notify system report
   their status directly. For Claude Code via its hooks (`SessionStart`,
   `UserPromptSubmit`, `PreCompact`, `Notification`, `Stop`). Each session
   gets its id in `AME_SESSION_ID`; the hooks run the Ame executable as a
   helper (`ame hook claude`), which reports to a local endpoint (loopback
   TCP with a token, see
   [ADR 0019](decisions/0019-agent-hooks-via-the-app-binary-and-a-loopback-endpoint.md)).
   Other agents can follow the same pattern where they support hooks or
   notify commands.

Adapter signals take precedence over heuristics (details below). Changes to `needs_input` or
`idle` trigger an OS notification and a badge (can be disabled per project).

Implementation (`src-tauri/src/agents/`):

- `signals.rs` parses output for bells (outside escape sequences), OSC 9 /
  OSC 777 notifications (OSC 9 progress reports are ignored) and the plain
  text.
- `status.rs` (`StatusTracker`, one per session) combines: output within the
  last 400 ms → `working`; a bell, notification or matching pattern since the
  last input → `needs_input`; output within `idleAfterMs` (default 3 s) or
  CPU use → `working`; nothing printed yet → `starting`; else `idle`; exit
  code 0 → `exited`, otherwise `error`. Output within 250 ms after input is
  treated as echo. Patterns only see text printed since the last input, so
  an answered question does not match again. Automatic terminal replies
  (cursor reports, focus events, color queries) do not count as input.
- `cpu.rs` sums CPU and memory of each session's process tree (`sysinfo`,
  every 2 s); above 10 % of a core counts as busy. The session keeps the
  last measurement; `session_usage` returns it, polled every 2 s by
  `lib/agents/usage.svelte.ts` only while the window is visible and a
  session runs (sidebar: memory per project, dashboard: per session).
- The `agent-status` thread re-evaluates every 250 ms and emits
  `sessions-changed` only when a state changed. `SessionInfo` carries
  `state` and `attention` (the notification text).
- Profiles have `needsInputPatterns` and `idleAfterMs`; common yes/no
  prompts (`(y/n)`, `[y/N]`, …) are always detected.
- Adapters (`agents/adapters/`): `Adapters::start` runs the `endpoint`
  (one JSON line per connection: protocol version, token, session, agent,
  event, detail, message) and writes `adapters/claude-settings.json` into
  the config dir. Profiles with `adapter: "claude-hooks"` start with
  `--settings <that file>` plus `AME_HOOK` and `AME_HOOK_TOKEN`. `cli.rs`
  is the helper (`main.rs` runs it before Tauri starts; it prints nothing
  and always exits with 0); `claude.rs` maps events to signals.
  `PtyManager::apply_hook` passes them to the session's `StatusTracker`:
  the adapter's last signal wins, except that the exit always counts and
  that "working" turns idle once the heuristics see the agent quiet (an
  interrupt sends no `Stop`). Input while the adapter says "needs input"
  means working again.
- Dashboard (`Dashboard.svelte`, an overlay of the main area like the
  settings): one card per session, most urgent first; the last output line
  comes from `session_previews`, polled every second only while the
  dashboard is shown (the status tracker keeps the last 2 KiB of plain
  text).
- Notifications (`lib/notify/`): `transition()` decides per state change
  (needs input, error, or idle/exited after at least 10 s of work; never for
  sessions seen the first time). The notifier sends an OS notification
  (`tauri-plugin-notification`) only when the session is not visible (window
  unfocused, other project, panel hidden, other tab) and neither the setting
  `notifications` nor the project's `muted` flag turns it off. The badge
  shows the waiting count (`setBadgeCount` on macOS/Linux, a drawn overlay
  icon on Windows).
- Rain (`lib/rain/`): `SessionInfo.intensity` (1–3, output bytes per
  second over 1 s windows, only while working) sets the density of the
  working rain; `SessionInfo.prompts` counts submitted prompts (input
  ending in Enter outside a bracketed paste) and makes `StatusDot` play a
  one-shot falling drop. `Sky` is a pure particle model (drops → ripples,
  paper), `RainCanvas` draws it on one canvas at ≤ 30 fps and only while
  particles exist, stopping when the window is inactive or rain is off.
  `RainSky.svelte` is the dashboard header sky; `PaperOverlay.svelte` is
  the origami easter egg (a secret palette command: `Command.secret`).
- Frontend: `StatusDot` (rain style, CSS transforms on pseudo-elements,
  paused when the window is inactive or rain is off), the most urgent state
  per project in the sidebar, the waiting count in the window title.

- Prompt queue (ADR 0021, `agents/queue.rs`): follow-up prompts per
  session, part of `SessionInfo.queue`. The status loop sends the next one
  as a paste plus Enter when the session is idle, the user did not type for
  4 s and the previous prompt was picked up (or 30 s passed). Frontend:
  `PromptQueue.svelte` above the terminal, `lib/agents/queue.ts`.

Example agent profile:

```json
{
  "id": "claude",
  "name": "Claude Code",
  "command": "claude",
  "args": [],
  "env": {},
  "idleAfterMs": 4000,
  "needsInputPatterns": ["Do you want to", "\\(y/n\\)"],
  "resumeArgs": ["--continue"],
  "adapter": "claude-hooks"
}
```

## Projects and layout restoration — implemented (M1)

- `WorkspaceStore` (`src-tauri/src/workspace/projects.rs`) persists
  `workspace.json`: open projects (path = id, name, group, pinned), the
  active project and a `ProjectLayout` per project (open tabs, active tab,
  expanded directories, side panel tab and width). All mutations are saved
  immediately; layout changes are debounced in the frontend (500 ms).
- Shared JSON persistence (`workspace/storage.rs`): atomic writes and
  `*.corrupt.json` backups, also used by the settings.
- The frontend keeps a `ProjectSession` per open project
  (`src/lib/project/session.ts`) with the file tree, editors and search, so
  switching projects keeps all state.
- Context menu on projects: pin, move to group, close (HTML menu, see
  [ADR 0017](decisions/0017-html-context-menus.md)).
  `Mod+1…9` and `Mod+Alt+Up/Down` switch projects; the window title shows
  the active project.

## File system — implemented (M1)

- All paths crossing IPC are **project-relative with `/`**; the backend
  resolves them inside the project root and rejects anything escaping it
  (`fs/path.rs`). Commands only work for open projects.
- `read_dir` lists one directory (ignore rules, dotfiles visible, `.git`
  hidden, directories first). `read_file` returns text or flags binary /
  non-UTF-8 / too large (> 10 MB). `write_file` writes in place to keep
  permissions, symlinks and hard links.
- `FsWatcher` watches only visible directories, non-recursively, and emits
  debounced `fs-changed` events (see
  [ADR 0015](decisions/0015-watch-only-visible-directories.md)).

## File icons — implemented

- `src/lib/fs/file-icons.ts` maps file and folder names to icons from
  Material Icon Theme (MIT, `licenses/material-icon-theme-MIT.txt`). About
  100 SVGs (~110 KB) live in `public/file-icons/` and are loaded by the
  browser only when a row shows them; nothing is added to the JS bundle. A
  test checks that every mapped icon is bundled. Setting: `fileIcons`.

## Editor — implemented (M1)

- One CodeMirror 6 view per project shows the active tab; every tab keeps
  its own `EditorState` (undo history, selection) and scroll snapshot.
- Lean extension set (no autocompletion or linting), language support
  loaded on demand, theme built from CSS variables only, CRLF preserved.
- Changes on disk reload clean tabs with a minimal diff (cursor stays);
  dirty tabs get an inline "reload / keep mine" bar. Closing a dirty tab
  asks inline (save / don't save / cancel).

## Search and quick open — implemented (M1)

- Quick open: `fs/quick_open.rs` walks the project on demand (cached 5 s,
  max 200,000 files) and ranks paths with `nucleo-matcher`.
- Text search: `fs/search.rs` uses `grep-searcher`/`grep-regex`, streams
  batches through a Tauri channel, stops at 5,000 matches, and a new search
  cancels the running one. Ranges are UTF-16 offsets for the frontend.

## Commands and palette — implemented (M1)

- Central command registry with platform-aware shortcuts and a command
  palette for commands, projects and files (see
  [ADR 0016](decisions/0016-commands-shortcuts-and-palette.md)).
- Context menus are one HTML overlay (`ContextMenu.svelte`) with full
  keyboard support; callers pass translated entries to `contextMenu.show()`
  (see [ADR 0017](decisions/0017-html-context-menus.md)).
- In debug builds, frontend errors and the startup time are forwarded to
  the backend log.

## Git — implemented (M4)

Module: `src-tauri/src/git/` (git CLI, ADR 0008).

- `cli.rs` runs git with `GIT_OPTIONAL_LOCKS=0` (read-only calls never take
  the index lock an agent might need), `GIT_TERMINAL_PROMPT=0`, the login
  shell `PATH`, and without a console window on Windows. A missing git or a
  folder outside a repository simply means "no git" in the UI.
- `status.rs` parses `git status --porcelain=v2 -z --branch` limited to the
  project folder; paths are made project-relative (projects can be
  subfolders of a repository).
- Commands: `git_status`, `git_original` (`HEAD` content for diffs),
  `git_stage` (`add -A`), `git_unstage` (`restore --staged`, `rm --cached`
  before the first commit) and `git_commit` (hooks run; their output is the
  error message). Paths are checked to stay inside the project.
- Frontend: `GitState` per project (`lib/project/git.svelte.ts`) refreshes
  on file events, window focus and every 3 s while an agent of the project
  is busy (`pollGit`), because the watcher only sees visible folders.
  `lib/git/marks.ts` turns files into tree marks (folders take the strongest
  mark inside); colors are the `git*` tokens.
- Changes panel (`ChangesPanel.svelte`), a side panel tab shown only in git
  repositories. Diffs are inline in the normal editor tab:
  `EditorGroup.setDiff` reconfigures a per-tab compartment with
  `@codemirror/merge`'s `unifiedMergeView` against `git_original` (loaded on
  demand), with Keep/Revert buttons per chunk; the file stays editable.
- Recently changed files: `git_status` returns the modification time of
  every changed file; `GitState` compares it with the previous status
  (`lib/git/recent.ts`) and marks files changed since then for a minute
  (accent bar in the tree), except files the editor saved itself. Follow
  mode (`ProjectLayout.follow`) opens the newest of them as an inline diff
  without moving the focus (`EditorGroup.open(path, { focus: false })`).

## Projects and views — planned (M2–M5)

- **Sidebar:** a status dot per agent session.
- **Dashboard:** grid of all sessions across all projects — project, agent,
  status, runtime, last output line, number of changed files.
- **Project view:** file tree · editor tabs · terminal panel (multiple
  sessions) · changes panel.
- **Changes panel:** live `git status` plus diff (CodeMirror merge view);
  files the agent just changed are highlighted. Optional _follow_ mode opens
  the most recently changed file automatically.
- **Git worktrees (later):** several agents in parallel in the same repo, each
  in its own worktree and branch, created and merged with one click.
