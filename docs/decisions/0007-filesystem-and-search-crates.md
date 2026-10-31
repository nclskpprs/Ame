# 0007. File watching, ignore rules, search and fuzzy matching

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

Ame must not index projects. File tree, quick open and search must still be
fast on large repositories and respect `.gitignore`.

## Decision

- **notify** (with debouncing) for native file watching per OS.
- **ignore** and **grep** (the libraries behind ripgrep) for walking
  directories with ignore rules and for on-demand text search.
- **nucleo** for fuzzy matching in quick open and the command palette.
- Directories are read only when expanded; nothing is crawled up front.

## Consequences

- Fast, battle-tested building blocks with native performance.
- Quick open walks the tree on demand; results stream in instead of coming
  from an index.
