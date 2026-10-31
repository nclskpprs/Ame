# Contributing to Ame

Thanks for your interest in Ame! This document explains how to set up the
project, which conventions we follow and how to get a change merged.

By participating you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- **Bug reports** — use the *Bug report* issue template.
- **Feature ideas** — use the *Feature request* template. Check the
  [roadmap](docs/ROADMAP.md) first; maybe it is already planned.
- **Agent profiles** — know a terminal coding agent Ame should support out of
  the box? Use the *Agent profile request* template.
- **Code and docs** — pick an open issue or a roadmap item and open a pull
  request.

## Development setup

### Prerequisites

- [Rust](https://rustup.rs/) stable, with `rustfmt` and `clippy`
- [Node.js](https://nodejs.org/) 24 or newer
- [pnpm](https://pnpm.io/) (the version is pinned in `package.json`;
  `corepack enable` picks it up automatically)
- Tauri 2 system dependencies, see the
  [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) and the
  [README](README.md#prerequisites)

### First run

```sh
pnpm install       # also installs the git hooks (lefthook)
pnpm tauri dev     # start the app with hot reload
```

### Checks

All of these must pass before every commit and in CI:

| Command                                                 | What it does                          |
| ------------------------------------------------------- | ------------------------------------- |
| `cargo fmt --all`                                       | Format Rust code                      |
| `cargo clippy --workspace --all-targets -- -D warnings` | Lint Rust code                        |
| `cargo test --workspace`                                | Rust tests (also regenerates IPC types) |
| `pnpm lint`                                             | Prettier check + ESLint               |
| `pnpm check`                                            | Svelte and TypeScript type check      |
| `pnpm test`                                             | Frontend unit tests (Vitest)          |

`pnpm verify` runs all of them in sequence. `pnpm format` formats the
frontend code.

The git hooks run the fast checks (formatting and linting of staged files)
on `pre-commit` and the full suite on `pre-push`.

## Project layout

```
src-tauri/          Rust backend (Tauri 2)
  src/
    workspace/      projects, settings, portable mode
    fs/             lazy file tree, watcher, read/write, search
    pty/            session manager, ring buffers, process tree
    agents/         agent profiles, status detection, adapters
    git/            status, diff, worktrees
    scripts/        package.json / composer.json discovery and runner
    notify/         OS notifications, dock/taskbar badge
    ipc/            typed Tauri commands and events
src/                Svelte 5 + TypeScript frontend
  lib/components/   UI components
  lib/stores/       state (Svelte runes)
  lib/i18n/         translation helper
  lib/ipc/          generated IPC bindings (do not edit by hand)
  lib/theme/        design tokens and themes
locales/            translation files (en.json is the source of truth)
docs/               roadmap, architecture, design, ADRs, progress log
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## Conventions

- **English everywhere:** code, comments, commit messages, docs, issues and
  UI text.
- **No hard-coded UI strings.** Every user-visible string is a key in
  `locales/en.json` and is rendered through `t()`. A test fails if a Svelte
  component contains raw text.
- **Typed IPC.** IPC types are generated from Rust with `tauri-specta` into
  `src/lib/ipc/bindings.ts`. Never edit that file by hand; run
  `cargo test --workspace` to regenerate it.
- **Performance first.** No indexing. Load lazily. Keep work off the UI
  thread. See the performance rules in [AGENTS.md](AGENTS.md).
- **Architecture decisions** are recorded as short ADRs in
  [docs/decisions/](docs/decisions/).

## Branches and commits

- `main` is protected. Work on a feature branch, e.g. `feat/lazy-file-tree`
  or `fix/pty-resize`.
- Use [Conventional Commits](https://www.conventionalcommits.org/):
  `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `ci:`, `perf:`,
  `build:`. Use a scope when it helps, e.g. `feat(pty): add ring buffer`.
- Keep commits small: one commit per finished task.
- Update [CHANGELOG.md](CHANGELOG.md) under *Unreleased* for user-visible
  changes.

## Pull requests

1. Make sure `pnpm verify` passes.
2. Fill in the pull request template.
3. CI must be green on macOS, Linux and Windows.
4. A maintainer reviews and merges.

## License

Ame is dual-licensed under MIT or Apache-2.0. Unless you explicitly state
otherwise, any contribution intentionally submitted for inclusion in the
work by you, as defined in the Apache-2.0 license, shall be dual licensed as
above, without any additional terms or conditions.
