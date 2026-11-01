# Progress Log

Newest entry first. Every agent session adds an entry: what was done, what
is open, what comes next.

## Current state

- **Milestone:** M2 is complete (the daemon was replaced by running in the
  background, ADR 0020). M3 — Status and dashboard: everything done
  except the performance benchmarks in CI. M4 —
  Git: checkpoints and review mode open.
- **Process (maintainer decision, 2026-10-31):** all further milestones go
  on the branch `feat/m1-project-shell`, one commit per task. The
  per-feature acceptance test is paused; the maintainer reviews everything
  at the end. The projects feature passed its acceptance test (10/10).
- **Next steps:**
  1. M3: performance benchmarks (RAM, startup time) in CI.
  2. M4: checkpoints before every prompt, review mode.
  3. M5: scripts; M5b: project groups for agents.

## Log

### 2026-11-01 — M3: rain status animations, prompt drop and origami

**Done**

- Backend: `SessionInfo.prompts` (submitted prompts: input ending in Enter
  outside a bracketed paste, also from the queue) and
  `SessionInfo.intensity` (1–3 from output bytes per second, only while
  working), both refreshed by the status loop.
- `StatusDot`: rain density per intensity, a one-shot drop falling into
  the dot for each new prompt (tabs, dashboard cards, sidebar projects),
  the error state as a static red drop.
- `lib/rain/`: `Sky` particle model, `RainCanvas` (one canvas, ≤ 30 fps,
  runs only while particles exist, stops when the window is inactive or
  rain is off; subtle halves the strength). `RainSky.svelte` in the
  dashboard header: each prompt falls as a drop and ends in a ripple.
- Origami (maintainer idea, a Konan easter egg): paper crane icon
  (`CraneIcon.svelte`) for the prompt queue; secret palette commands
  (`Command.secret`, shown only for an exact word) and "Dance of the
  Paper" for `konan`, `amegakure`, `origami` or `紙`: a swirl of white
  folded paper over the window (`PaperOverlay.svelte`, mounted on first
  use). Described in `docs/DESIGN.md`.
- Fix: the prompt queue composer was clipped in a small terminal panel
  (only the list scrolls now).

**Verified**

- Unit tests: intensity windows, prompt counting, submit detection, sky
  particles (drop → ripple, paper leaves, bound), `newPrompts`, rain mode,
  secret commands, `combinedRain`.
- In `pnpm tauri dev` on WSLg (light theme), driven with XTest: the queue
  sends the first prompt, the second waits; the dashboard sky drop and the
  drops into the status dots are visible; `konan` shows "Dance of the
  Paper" and white origami swirls over the window.
- `pnpm verify` green.

**Open**

- Vite's watcher does not see file changes on `/mnt/c` under WSL, so the
  dev app must be restarted after edits (F5 serves stale modules).
- A short black strip under the terminal while the queue bar appears
  (WebGL resize on WSLg); it was gone a moment later. Check on real
  platforms.
- Dark theme of the paper and the sky not looked at yet.

### 2026-11-01 — M3: prompt queue per agent

**Done**

- `agents/queue.rs` (ADR 0021): a queue per session in the backend, part
  of `SessionInfo.queue`. The status loop sends the next prompt (paste,
  then Enter after 150 ms, on its own thread) when the agent is idle, the
  user did not type for 4 s and the previous prompt was picked up (or 30 s
  passed). Commands `queue_prompt`, `remove_queued_prompt`,
  `move_queued_prompt`, `clear_prompt_queue`; new error kind
  `promptRejected`.
- Frontend: `PromptQueue.svelte` above the terminal (composer: Enter
  queues, Shift+Enter new line, Esc closes; list with move up/down and
  remove, "Clear all"), shown only while composing or prompts wait.
  Command "Queue Prompt for Agent" (`Mod+Alt+Enter`, also from a focused
  terminal) and a queue button in the terminal bar for running sessions;
  "N queued" on dashboard cards.

**Verified**

- Unit tests for the queue rules (idle only, typing pause, picked up,
  30 s fallback, limits, reorder) and the preview; a PTY test where a shell
  receives the first queued prompt by itself and keeps the second queued.
- `pnpm verify` green (131 Rust tests, 408 frontend tests).
- Not tried in the GUI yet (no WSLg run this session) and not with a real
  agent — check in the final review: queue two prompts for Claude Code
  while it works and watch them go out one after the other.

**Open**

- Prompts are not persisted; quitting or closing a session drops them.
- Heuristic agents (no adapter) that pause longer than `idleAfterMs` while
  thinking may get the next prompt early.

### 2026-11-01 — M3: resource monitor

**Done**

- `session_usage` command: CPU and memory of every running session's
  process tree (measured by the status loop every 2 s).
- Frontend: `lib/agents/usage.svelte.ts` polls only while the window is
  visible and a session runs; the sidebar shows the memory per project
  (CPU and memory in the tooltip), the dashboard cards show both.

**Verified**

- Unit tests for summing and formatting; seen in `pnpm tauri dev` on WSLg
  (sidebar "6 MB" for a shell, dashboard "CPU 0 % · RAM 6 MB").
- `pnpm verify` green.

**Open / resume here**

- Next is the prompt queue (M3). Session ended at the maintainer's request
  (shutdown); everything is committed on `feat/m1-project-shell`.
- Manual GUI tests on WSLg: start with `GDK_BACKEND=x11` and
  `AME_CONFIG_DIR=<temp dir>`; a ctypes XTest script (find the window by
  `_NET_WM_NAME`, send keys, `WM_DELETE_WINDOW`, `XGetImage` screenshots)
  works because WSLg has no xdotool. It lived in the session scratchpad and
  must be rewritten if needed.

### 2026-11-01 — M2: keep running in the background

**Done**

- Maintainer decision: instead of a daemon, closing the window hides it
  while agents run; quitting ends them (ADR 0020).
- `background/`: `hide_window`, `show_window`, `quit_app`, `set_tray`
  commands, tray icon with a session menu, single instance, macOS reopen
  and Cmd+Q through the close guard. Setting `closeAction` (settings
  view), one-time hint notification.
- `Mod+Q` "Quit Ame" (also from a focused terminal); the close guard
  quits through the backend.
- `pty/tree.rs`: ending a session also ends everything its program
  started (SIGTERM / terminate via `sysinfo`); the CPU monitor shares the
  tree walk.

**Verified**

- Tests: close decision, tray model, quit flow of the close guard, process
  tree walk, and a PTY test where a `setsid` child of a session ends when
  the session is closed.
- Manually in `pnpm tauri dev` on WSLg (X11, driven with XTest from a
  ctypes script): X with a running shell hides the window and the shell
  keeps running; a second start shows the window and exits; `Ctrl+Q` (also
  with the terminal focused) shows the inline guard and quitting ends the
  app and the shell; X without running sessions closes the app.
- `pnpm verify` green (400 frontend tests, 123 Rust tests).

**Open**

- The tray icon itself could not be seen under WSLg (no tray host); the
  appindicator was created without errors. Check in the final review.
- macOS (dock reopen, Cmd+Q routing) and Windows (tray click, Alt+F4)
  untested.

### 2026-10-31 — M3: Claude Code hooks adapter

**Done**

- `agents/adapters/` (ADR 0019): a loopback TCP endpoint with a random
  token; the hook helper as a subcommand of the app binary
  (`ame hook claude`, run before Tauri starts, silent, always exit 0);
  `claude-settings.json` in the config dir, passed with
  `claude --settings`. Profile field `adapter` (`claude-hooks` for the
  built-in Claude Code profile; edited profiles keep it).
- `StatusTracker` combines adapter signals with the heuristics: the
  adapter wins, the exit always counts, a quiet agent turns idle without a
  `Stop` (interrupts), answering a question means working.

**Verified**

- Unit tests for the endpoint (token, version, garbage), the event mapping,
  the settings file, the helper and the state combination; an integration
  test (`src-tauri/tests/hooks.rs`) runs the real `ame hook claude` from a
  PTY session that keeps printing and sees the session turn to "needs
  input" with Claude's message.
- The helper takes about 20 ms (debug build, Linux) and prints nothing.
- `pnpm verify` green.

**Open**

- Not tried with a real Claude Code session (it would use the
  maintainer's account): worth checking in the final review that
  `claude --settings` loads the hooks (`/hooks` in Claude Code lists them)
  and that the states follow.
- Windows: hooks run with Git Bash; without it (PowerShell) the hook fails
  silently and the heuristics remain. macOS and Windows untested.
- Other agents (Codex `notify`, Gemini CLI hooks) could use the same
  helper; not done yet.

### 2026-10-31 — File icons, agent settings, M3 status and M4 git

**Done** (one commit per task; this entry was written in the next session,
because the session that built the features ended before logging them)

- File type icons from Material Icon Theme (MIT) in the tree and tabs,
  loaded by the browser only when shown; setting `fileIcons`.
- Agent profiles in the settings view: detected paths, edit or reset
  built-in profiles, add custom ones.
- M3: generic status detection (output activity, CPU of the process tree,
  bells, OSC 9/777, exit code) plus `needsInputPatterns` per profile;
  status dots in terminal tabs and the sidebar, the waiting count in the
  window title; dashboard (`Mod+Shift+D`); OS notifications and the
  dock/taskbar badge, mutable per project.
- M4: git status in the file tree, changes panel (`Mod+Shift+G`), inline
  diff with Keep/Revert per chunk, stage/unstage/commit, recently changed
  files and follow mode (`Mod+Alt+F`).
- Fix: the watcher watches the project root and ignores read events (this
  caused a reload loop on Linux).

**Verified**

- On resume: `pnpm verify` green — 101 Rust tests, 393 frontend tests,
  clippy, ESLint, Prettier and svelte-check clean.

**Open**

- No ADRs were written for status detection and the git integration; the
  architecture document describes both (section _Agent status detection_
  and _Git_).
- Not tried by the maintainer yet (acceptance paused), not tested on macOS
  and Windows (badge overlay icon, notifications).

### 2026-10-31 — Editor wishes and M2 (terminals and agents)

**Done** (one commit per task)

- Maintainer wishes: settings view (`Mod+,`, gear in the sidebar); files open
  with a double click (single click is a setting); no autosave (unchanged,
  saving stays manual) plus "Save All Files"; unsaved markers in the tree
  and the window title; an inline guard when closing a project or the app
  with unsaved files; syntax highlighting for many more languages.
- PTY backend (`pty/`, ADR 0018): sessions with a 1 MiB ring buffer,
  throttled output channels, replay on attach, bracketed paste tracking,
  login shell environment capture.
- Terminal panel with xterm.js 6 (WebGL, DOM fallback), several sessions per
  project, background sessions without xterm instances, theme from tokens
  (new ANSI tokens with a contrast test), Ctrl shortcuts reach the program
  while a terminal has focus (commands opt in with `terminal: true`).
- Agent profiles (Claude Code, Codex, Gemini, OpenCode, Aider, Shell) with
  PATH detection and a picker (`Mod+Shift+A`); restart and resume of
  exited sessions; resume of the last run's sessions after a restart;
  "Send Selection to Agent" (`Mod+Shift+Enter`); a quit/close guard for
  running sessions.

**Verified**

- `cargo clippy -D warnings` clean, 73 Rust tests (PTY spawn, output,
  replay, input, stop/close on Unix); `pnpm check` clean, frontend tests
  green.
- Manually in `pnpm tauri dev` on WSLg (driven with XTest, screenshots):
  shell start, typing, colors, replay after hiding, Ctrl+K reaching bash,
  new session shortcut, inline stop confirmation, exit code bar and
  restart, dark theme switch, agent picker (Claude Code detected), session
  environment, quit guard, resume after restart, send to agent (bracketed
  paste in bash).

**Open**

- **Background daemon (M2 💡) is deferred — needs a maintainer decision.**
  Sessions surviving a UI close means a separate process with a local
  socket (Unix socket / Windows named pipe with a restrictive ACL), detached
  process handling on three platforms and a protocol version check; and the
  quit guard would change ("keep agents running?"). It can only be tested on
  Linux here. Proposal: do it after 0.1, or as its own milestone.
- Not tested on macOS and Windows yet (ConPTY, `.cmd` shims of npm agents,
  Cmd shortcuts). Claude Code itself was not started in tests (it would use
  the maintainer's account).
- WebGL under WSLg runs without GPU (DRI3 missing); the DOM renderer
  fallback was not forced in a test.
- File icons: the maintainer asked whether Atom Material Icons may be used.
  They are MIT licensed, but the README credits many icon sources (some
  CC BY from The Noun Project); Material Icon Theme (MIT, based on Apache
  2.0 Material icons) is cleaner and is the proposal.

### 2026-10-31 — M1 acceptance: HTML context menu

**Done**

- The maintainer's acceptance test of the projects feature failed TF05–TF08:
  the native project context menu never appeared on Linux (WSLg, Wayland),
  also after passing an explicit position (`4eec52c`).
- Replaced native context menus with an HTML menu (ADR 0017):
  `src/lib/menu/` (entries, keyboard navigation, placement, open state) and
  `ContextMenu.svelte` (WAI-ARIA menu, submenus, typeahead, focus return).
  `ProjectList.svelte` uses it for pin, groups and close.

**Verified**

- Unit tests for navigation, typeahead, placement and the open state.
- A throwaway DOM test (happy-dom, not committed) mounted `ProjectList`
  with the menu and ran TF05–TF08 by mouse and keyboard, Escape handling
  and outside clicks: all passed.

**Open**

- Maintainer re-runs TF05–TF08 in the app (plus the new keyboard case).
- No automated UI tests yet; a happy-dom setup for component tests would be
  cheap (decision for the maintainer).
- Pin and group are only reachable from the context menu, not as palette
  commands (AGENTS.md asks for commands for every action).

### 2026-10-31 — M1 completed

**Done** (branch `feat/m1-project-shell`, one commit per task)

- Projects: open several folders, pin, group (native context menu, inline
  group name), close; `workspace.json` with per-project layout (tabs,
  expanded folders, side panel tab and width) restored on start.
- File system backend: lazy `read_dir` with ignore rules, `read_file` /
  `write_file`, path safety, `FsWatcher` for visible directories only
  (ADR 0015).
- Layout: side panel (Files / Search) with keyboard-accessible splitter;
  lazy file tree with full keyboard navigation.
- Editor: CodeMirror 6 with tabs, per-tab state, on-demand languages,
  token-based theme (new syntax tokens, WCAG AA), JetBrains Mono bundled
  (OFL in `licenses/`), save/close with inline prompts, reload on disk
  changes, conflict bar.
- Quick open (`Mod+P`, nucleo) and text search (`Mod+Shift+F`, ripgrep
  libraries, streamed, cancellable).
- Command registry, shortcuts and command palette (`Mod+K`) (ADR 0016).
- Debug builds log frontend errors and the startup time to the terminal.

**Verified**

- `cargo clippy -D warnings` clean, 41 Rust tests; `pnpm check` clean,
  144 frontend tests, ESLint/Prettier clean.
- `pnpm tauri dev` on Linux (WSLg) with a restored layout (pinned project,
  group, expanded folders, three tabs): starts without frontend errors,
  frontend mounted after ~1 s in dev mode on the `/mnt/c` checkout.

**Open**

- Not yet tried interactively by the maintainer; no UI tests exist yet.
  Worth a manual pass: context menu, group naming, splitter, tree keyboard
  navigation, editor save/conflict flow, search jump, palette.
- Performance: CodeMirror is part of the startup bundle (~450 kB JS
  uncompressed); lazy-loading the editor would help the cold-start target.
  Measure in M3.
- Changes in collapsed folders are not watched (by design, ADR 0015); M4
  needs another signal for git status.
- Large directories and long result lists are rendered without
  virtualization (see "Later" in the roadmap).

### 2026-10-31 — M0 completed

**Done**

- Open-source files: dual license (MIT OR Apache-2.0), README,
  CONTRIBUTING, Code of Conduct (Contributor Covenant 2.1), SECURITY, issue
  templates (bug, feature, agent profile) and PR template.
- `AGENTS.md` (single source of truth incl. UX principles), `CLAUDE.md`, and
  `docs/` (vision, architecture, design, roadmap, progress, ADRs 0001–0014).
- Scaffold: Cargo workspace (`src-tauri`, crate `ame`), Tauri 2.12, Svelte
  5, Vite 8, TypeScript 6.0, pnpm 12, Node 24.
- Tooling: Prettier, ESLint, svelte-check, Vitest, clippy (`-D warnings`),
  rustfmt, lefthook hooks, `pnpm verify`.
- i18n: `locales/en.json`, typed `t()`, tests for locale keys and against
  raw text in components.
- Settings + portable mode (`src-tauri/src/workspace/`), typed IPC via
  tauri-specta (`src/lib/ipc/bindings.ts`), frontend settings state.
- Design tokens, Ame Dark/Light, theme switcher, base layout with sidebar
  and empty state.
- CI workflow for macOS, Linux and Windows.

**Verified**

- `cargo clippy --workspace --all-targets -- -D warnings`: clean.
- `cargo test --workspace`: 14 tests pass.
- `pnpm lint`, `pnpm check`: clean. `pnpm test`: all tests pass.
- `pnpm build`: 43.5 kB JS (17.2 kB gzip), 3.9 kB CSS.
- `pnpm tauri dev` on Linux (WSLg): the app starts, the config dir resolves
  and switching the theme writes `settings.json`.

**Decisions made with the maintainer**

- The light `needs-input` color was changed from `#C98A12` (2.76:1) to
  `#B47A0E` (3.44:1) to meet WCAG AA for indicators.
- Code of Conduct reports go through GitHub's private reporting form; the
  maintainer enables _Private vulnerability reporting_ in the repository
  settings.

**Open**

- CI has not run yet (nothing pushed). Branch protection for `main` must be
  configured on GitHub by the maintainer.
- Not verified on macOS and Windows yet (CI will cover build and tests;
  portable mode should be tried manually on Windows).
- The production CSP in `tauri.conf.json` is untested until the first
  release build (`devCsp` is disabled for development).
- The GitHub repository is called `Agent-Editor`; crate and binary are
  `ame`.
- Icons are the Tauri defaults until branding (before M6).

**Notes for agents**

- On WSL with the repo under `/mnt/c`, builds are slow; setting
  `CARGO_TARGET_DIR` to a Linux path (e.g. `~/.cache/ame-target`) helps.
