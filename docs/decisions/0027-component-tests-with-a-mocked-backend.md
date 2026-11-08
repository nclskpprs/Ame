# 0027. Component tests with a mocked backend

- **Status:** Accepted
- **Date:** 2026-11-08

## Context

The frontend had only unit tests of pure functions and stores. The
maintainer asked for tests that secure what a user does with the mouse
(sidebar navigation, the board entry, folding groups). Real end-to-end
tests of the Tauri app need `tauri-driver` (WebDriver), which supports
Linux and Windows but not macOS, the maintainer's machine; they would be a
separate CI job with a built app.

## Decision

- **Component tests** with Vitest, `@testing-library/svelte` and jsdom:
  real components are rendered, clicked and inspected. A test file opts
  in with `// @vitest-environment jsdom`; all other tests keep the fast
  `node` environment.
- The backend is replaced by **`mockIPC` from `@tauri-apps/api/mocks`**
  behind the helper `src/lib/test/backend.ts`. The generated bindings stay
  in use, the fake keeps the workspace and the settings in memory and
  records every call.
- Runes in tests go into `*.test.svelte.ts` files (e.g. to reproduce an
  effect of `App.svelte` with `$effect.root`).
- **End-to-end tests** with `tauri-driver` stay a later option for a Linux
  CI job.

## Consequences

- UI behavior (which page is current, what a click sends to the backend)
  is tested on every platform in under a second, without a built app.
- jsdom has no layout, canvas or WebGL: drag and drop geometry, the
  terminal and the rain are not covered and still need a manual check.
- Commands that are not faked return `null`; a test that needs one adds a
  case to the helper.
