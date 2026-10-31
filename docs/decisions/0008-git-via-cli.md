# 0008. Git via the git CLI

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

Ame needs git status, diffs and later worktrees. libgit2 bindings add a C
dependency and behave subtly differently from git itself; `gix` is promising
but not complete for every operation.

## Decision

Call the **git CLI** for status and diff (machine-readable output such as
`git status --porcelain=v2 -z`). Consider **gix** later for hot paths.

## Consequences

- Exactly the behavior users know from git, including their config and hooks.
- Requires git on the `PATH`; Ame shows a clear message when it is missing.
- Process spawning costs a few milliseconds per call; calls are debounced.
