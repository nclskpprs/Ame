# 0003. Svelte 5 and Vite without SvelteKit

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

The frontend renders many frequently changing status indicators, terminals
and lists. A small runtime and fine-grained reactivity help to keep memory
and CPU low. The app is a single window without routes, server rendering or
server endpoints.

## Decision

Use **Svelte 5** (runes) with **TypeScript** in strict mode, built with
**Vite**. Do **not** use SvelteKit: it adds routing, SSR and adapters that a
desktop single-page app does not need. `$lib` is configured as an alias to
keep familiar import paths.

## Consequences

- No virtual DOM, a very small runtime, fine-grained updates.
- Navigation between views is plain application state, not URL routing.
- If routing becomes necessary, a tiny client-side router can be added.
