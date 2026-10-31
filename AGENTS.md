# AGENTS.md

Rules for every coding agent (and human) working on this repository. This file
is the single source of truth; `CLAUDE.md` and similar files only import it.

## Project

**Ame — Agent Manager Editor** is a lean, cross-platform desktop app
(Tauri 2 + Rust + Svelte 5 + TypeScript) that keeps many projects open and
runs any terminal coding agent per project, with live agent status, a file
tree, a lightweight editor and a live diff. It is a cockpit for agentic
coding, **not** an IDE: no indexing, no language server by default.

Read these before you change anything substantial:

| Document                                     | Content                                      |
| -------------------------------------------- | -------------------------------------------- |
| [docs/PROGRESS.md](docs/PROGRESS.md)         | What happened last, what is open, next steps |
| [docs/ROADMAP.md](docs/ROADMAP.md)           | Milestones with checkboxes                   |
| [docs/VISION.md](docs/VISION.md)             | Goals, principles, scope, risks              |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Current architecture and planned modules     |
| [docs/DESIGN.md](docs/DESIGN.md)             | Rain concept, design tokens, UX              |
| [docs/decisions/](docs/decisions/)           | Architecture decision records (ADRs)         |

## Workflow

1. **Before every task** read `docs/PROGRESS.md` and `docs/ROADMAP.md`.
2. Work in **small steps**. One commit per finished task.
3. Use **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`,
   `test:`, `chore:`, `ci:`, `perf:`, `build:`), optionally with a scope:
   `feat(pty): add ring buffer`.
4. Work on **feature branches** (`feat/…`, `fix/…`, `docs/…`). Never commit
   directly to `main` (M0 was the only exception).
5. **All checks must be green before every commit** (see below).
6. **After every task** update `docs/PROGRESS.md` (log entry, open points,
   next steps) and tick or extend `docs/ROADMAP.md`. Add user-visible changes
   to `CHANGELOG.md` under _Unreleased_.
7. Record every significant architecture decision as an **ADR** in
   `docs/decisions/NNNN-short-title.md` (copy the format of existing ADRs)
   and update `docs/ARCHITECTURE.md` when the architecture changes.
8. If the plan is unclear or seems wrong, ask the maintainer before deciding.

## Commands

| Command                                                 | Purpose                                           |
| ------------------------------------------------------- | ------------------------------------------------- |
| `pnpm install`                                          | Install dependencies and git hooks                |
| `pnpm tauri dev`                                        | Run the app in development mode                   |
| `pnpm tauri build`                                      | Build a release bundle                            |
| `cargo fmt --all`                                       | Format Rust                                       |
| `cargo clippy --workspace --all-targets -- -D warnings` | Lint Rust                                         |
| `cargo test --workspace`                                | Rust tests; regenerates `src/lib/ipc/bindings.ts` |
| `pnpm lint`                                             | Prettier check + ESLint                           |
| `pnpm format`                                           | Format frontend files with Prettier               |
| `pnpm check`                                            | `svelte-check` (types)                            |
| `pnpm test`                                             | Vitest unit tests                                 |
| `pnpm verify`                                           | All checks above in sequence                      |

## Language

- **Everything in this repository is English:** code, identifiers, comments,
  commit messages, docs, issues, PR descriptions and UI text.

## Code rules

### General

- **Performance first.** Targets: < 150 MB RAM idle with 3 projects open,
  cold start < 1 s, interactions < 50 ms. Measure instead of guessing.
- **No indexing.** Load directories only when expanded, search on demand,
  respect `.gitignore`. Nothing that smells like indexing before 0.1, and
  afterwards only as an opt-in per project.
- **Agent-agnostic.** An agent is a command in a PTY. Agent-specific features
  are optional adapters on top of the generic behavior.
- Prefer small, focused modules. Follow the layout in `docs/ARCHITECTURE.md`.

### Rust (`src-tauri/`)

- Heavy work (PTY, files, git, search) runs in the backend, never on the UI
  thread.
- Events to the frontend are **batched and throttled**.
- Return `Result` with typed errors (`thiserror`); no `unwrap()`/`expect()`
  outside tests unless the invariant is documented in a comment.
- Every Tauri command and every type crossing IPC derives `specta::Type` and
  is registered in `ipc::builder()`. The TypeScript bindings in
  `src/lib/ipc/bindings.ts` are generated — never edit them by hand.
- Unit tests live next to the code (`#[cfg(test)] mod tests`).

### Frontend (`src/`)

- Svelte 5 with runes (`$state`, `$derived`, `$effect`) and TypeScript in
  strict mode.
- Call the backend only through the generated `commands` in
  `src/lib/ipc/bindings.ts` (friendly type names in `src/lib/ipc/types.ts`).
- Every user action is a command in the registry
  (`src/lib/commands/`) with an i18n title and, where useful, a shortcut,
  so it shows up in the command palette (ADR 0016).
- Paths crossing IPC are project-relative with `/` separators; never send
  absolute file paths of project files to the backend.
- **No UI string without an i18n key.** Add the key to `locales/en.json` and
  render it with `t('key')`. This includes `aria-label`, `title`,
  `placeholder` and `alt`. The test `src/lib/i18n/no-raw-text.test.ts` fails
  on raw text in components.
- **No hard-coded colors.** Use the CSS custom properties from the design
  tokens (`var(--ame-…)`, see `src/lib/theme/tokens.ts`).
- Hidden terminals have no xterm.js instance; their output stays in the
  Rust ring buffer and is replayed when shown.

## Design and UX principles

Ame (雨) means _rain_. The design is calm and bluish; rain is a sparse accent
that **carries information and is never decoration**. Details and tokens:
[docs/DESIGN.md](docs/DESIGN.md).

- **Calm over noise.** No toolbars full of icons; features live in the
  command palette and context menus.
- **Status without searching.** Agent status is visible in the sidebar, the
  dashboard, the window title and the dock/taskbar badge.
- **Keyboard first.** Every action has a shortcut and is findable in the
  command palette.
- **No modal dialogs for routine work.** Inline confirmation and undo
  instead of "Are you sure?".
- **Instant response.** Interactions under 50 ms, no splash screen, show a
  spinner only after 300 ms.
- **Three-step onboarding:** open a folder, pick an agent, go. Installed
  agents on the `PATH` are detected automatically.
- **Progressive disclosure.** Git, scripts and resource panels appear only
  when the project needs them.
- **Selectable density** (comfortable / compact).
- **Accessibility.** Full keyboard operation, visible focus, screen reader
  labels, contrast of at least WCAG AA.
- **Rain only where it signals status:** status indicators, dashboard
  header, empty states and the app icon. **Never in the editor or the
  terminal** — there, only the code matters.
- **Animation budget:** one canvas or CSS transforms only (no DOM element per
  drop), max 30 fps, paused when the window is hidden or unfocused, < 1 %
  CPU, respect `prefers-reduced-motion` and the _Rain effects: on / subtle /
  off_ setting.

## Definition of Done

A task is done when:

- [ ] it works on macOS, Linux and Windows (or the limitation is documented),
- [ ] `pnpm verify` passes (fmt, clippy, cargo test, lint, check, test),
- [ ] new logic has tests,
- [ ] there are no new hard-coded UI strings or colors,
- [ ] docs are updated: `docs/PROGRESS.md`, `docs/ROADMAP.md`, and if
      relevant `docs/ARCHITECTURE.md`, an ADR and `CHANGELOG.md`,
- [ ] it is committed with a Conventional Commit message.
