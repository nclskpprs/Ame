# Progress Log

Newest entry first. Every agent session adds an entry: what was done, what
is open, what comes next.

## Current state

- **Milestone:** M1 — Project shell is done on branch
  `feat/m1-project-shell` (waiting for review and merge). Next: **M2 —
  Terminals and agents**.
- **Next steps:**
  1. Maintainer reviews and merges `feat/m1-project-shell`; check CI.
  2. Start M2 on a new branch: PTY manager with ring buffer and xterm.js,
     agent profiles, sessions in the background.

## Log

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
