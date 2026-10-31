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
| Backend terminal buffer | `alacritty_terminal` or `vt100`                                    | Background sessions run without an xterm.js instance         | [0006](decisions/0006-terminal-stack.md)                         |
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
Cargo.toml            Cargo workspace (members: src-tauri, later the helper CLI)
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
  lib/components/     sidebar, file tree, editor, terminal, dashboard, diff
  lib/stores/         application state (Svelte runes)
  lib/i18n/           translation helper and tests
  lib/ipc/            generated bindings (bindings.ts) — do not edit
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
  2. **Portable mode:** a file named `portable` next to the executable →
     `<exe dir>/data/`. Intended for the portable Windows `.exe`, but works on
     every platform.
  3. The OS app config directory from Tauri (`app_config_dir()`), e.g.
     `%APPDATA%\io.github.nclskpprs.ame\` on Windows,
     `~/.config/io.github.nclskpprs.ame/` on Linux and
     `~/Library/Application Support/io.github.nclskpprs.ame/` on macOS.
- Writes are atomic (write a temp file, then rename).
- Missing fields fall back to defaults, so older files keep working. A file
  that cannot be parsed is moved aside to `settings.corrupt.json` and
  defaults are used.
- Every file carries a `version` for future migrations.
- Commands: `get_settings`, `set_settings`, `get_app_info` (version,
  portable flag, config dir).
- Frontend state: `src/lib/stores/settings.svelte.ts`.

## Theming — implemented (M0)

- Tokens for _Ame Dark_ and _Ame Light_ live in `src/lib/theme/tokens.ts`
  (values in [DESIGN.md](DESIGN.md)).
- `applyTheme()` resolves the `theme` setting (`system`, `dark`, `light`)
  with `prefers-color-scheme` and writes the tokens as CSS custom properties
  (`--ame-bg`, `--ame-text`, …) onto `<html>`, plus `data-theme`,
  `data-density` and `data-rain` attributes.
- Components only use `var(--ame-…)`. CodeMirror and xterm.js themes will be
  derived from the same token objects.
- A unit test checks the WCAG AA contrast of the text tokens.

## i18n — implemented (M0)

- `locales/en.json` is the source of truth. Other locales are added as
  `locales/<code>.json` with the same keys; missing keys fall back to
  English.
- `t(key, params?)` in `src/lib/i18n/` with keys typed from `en.json` and
  `{name}` placeholders.
- Tests ensure every locale has exactly the keys of `en.json` and that no
  Svelte component contains raw, untranslated text.

## Agent status detection — planned (M3)

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
   their status directly. For Claude Code via its hooks (`UserPromptSubmit`,
   `Notification`, `Stop`, `SessionStart`/`SessionEnd`). The app sets an
   environment variable with the session ID per session and opens a small
   local endpoint (Unix socket, named pipe on Windows) that a bundled helper
   CLI calls. Other agents follow the same pattern where they support hooks
   or notify commands.

Adapter signals take precedence over heuristics. Changes to `needs_input` or
`idle` trigger an OS notification and a badge (can be disabled per project).

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

## Projects and views — planned (M1–M5)

- **Sidebar:** all open projects with a status dot per agent session;
  shortcuts `Ctrl/Cmd+1…9`; project groups and pinning.
- **Dashboard:** grid of all sessions across all projects — project, agent,
  status, runtime, last output line, number of changed files.
- **Project view:** file tree · editor tabs · terminal panel (multiple
  sessions) · changes panel.
- **Changes panel:** live `git status` plus diff (CodeMirror merge view);
  files the agent just changed are highlighted. Optional _follow_ mode opens
  the most recently changed file automatically.
- **Scripts panel:** detects `package.json` scripts (npm/pnpm/yarn/bun based
  on the lock file) and `composer.json` scripts; each script runs in its own
  task terminal with a status.
- **Sessions survive project switches;** after an app restart, projects and
  layout are restored.
- **Git worktrees (later):** several agents in parallel in the same repo, each
  in its own worktree and branch, created and merged with one click.
