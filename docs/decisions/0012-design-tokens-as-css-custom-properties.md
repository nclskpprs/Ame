# 0012. Design tokens as CSS custom properties

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

The UI, the CodeMirror theme and the terminal colors must share one palette
(Ame Dark and Ame Light, see `docs/DESIGN.md`). The theme follows the system
by default and can be switched at runtime.

## Decision

- Colors are defined once in `src/lib/theme/tokens.ts`.
- `applyAppearance()` writes them as CSS custom properties (`--ame-bg`, …)
  onto `<html>` and sets `data-theme`, `data-density` and `data-rain`.
- Components use only `var(--ame-…)`; a test rejects literal colors in
  `.svelte` and `.css` files. Non-color tokens (spacing, radii, fonts) live
  in `src/app.css` and change with `data-density`.
- A unit test checks WCAG AA contrast for the text and indicator colors.

## Consequences

- One source of truth for every surface that needs colors.
- Theme switches are instant and need no re-render.
- `index.html` repeats the two background colors to avoid a flash before
  the app has loaded; keep them in sync with `tokens.ts`.
