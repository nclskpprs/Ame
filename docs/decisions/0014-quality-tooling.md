# 0014. Lint, format, test and git hook tooling

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

Agents and humans commit frequently. Formatting and obvious mistakes must be
caught automatically and identically on every machine and in CI.

## Decision

- **Rust:** `rustfmt`, `clippy` with `-D warnings` and workspace lints
  (`unsafe_code` forbidden, `unwrap`/`expect` warned outside tests), unit
  tests with `cargo test`.
- **Frontend:** Prettier (with the Svelte plugin) for formatting, ESLint
  (flat config with `typescript-eslint` and `eslint-plugin-svelte`),
  `svelte-check` for types, **Vitest** for unit tests.
- **Git hooks** via **lefthook** (installed by `pnpm install`): fast checks
  on staged files at `pre-commit`, the full `pnpm verify` at `pre-push`.
- **CI** (GitHub Actions) runs the frontend checks once and the Rust checks
  on macOS, Linux and Windows.
- TypeScript is pinned to 6.0.x until `svelte-check` and `typescript-eslint`
  support TypeScript 7.

## Consequences

- One command (`pnpm verify`) answers "is this ready to commit?".
- Hooks can be skipped in emergencies (`--no-verify`), but CI cannot.
