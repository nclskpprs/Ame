# 0004. pnpm and a Cargo workspace

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

The repository contains a frontend (Node tooling) and a Rust backend. M3
adds a helper CLI for agent hooks, which is a second Rust crate.

## Decision

- **pnpm** is the Node package manager. The version is pinned via the
  `packageManager` field; build scripts of dependencies are blocked unless
  allowed in `pnpm-workspace.yaml`.
- The repository root is a **Cargo workspace** with `src-tauri` as its
  first member. Shared metadata and lints live in `[workspace.package]` and
  `[workspace.lints]`.

## Consequences

- `cargo fmt/clippy/test --workspace` run from the root and cover all crates.
- The helper CLI can be added as a new workspace member and share code.
- Contributors need pnpm (`corepack enable` is enough).
