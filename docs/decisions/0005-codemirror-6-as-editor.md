# 0005. CodeMirror 6 as the editor

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

Ame needs to view, edit and diff files, but it is not an IDE. Monaco is
large (several MB) and brings IDE features and workers we do not want.

## Decision

Use **CodeMirror 6** for the editor and its merge view for diffs. Load
language support on demand.

## Consequences

- Much smaller bundle and memory footprint, good performance on large files.
- Modular: only the needed extensions are loaded.
- IDE-like features (LSP) would have to be added explicitly and opt-in.
- The editor theme is derived from the design tokens (see ADR 0012).
