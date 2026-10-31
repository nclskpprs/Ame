# Progress Log

Newest entry first. Every agent session adds an entry: what was done, what
is open, what comes next.

## Current state

- **Milestone:** M0 — Foundation is done. Next: **M1 — Project shell**.
- **Next steps:**
  1. Push to GitHub and check that the first CI run is green on all three
     platforms (fix platform-specific issues, especially Windows).
  2. Start M1 on a feature branch: open multiple projects and the sidebar
     list, then the lazy file tree.

## Log

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
