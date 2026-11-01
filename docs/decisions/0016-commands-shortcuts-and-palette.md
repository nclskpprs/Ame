# 0016. Commands, shortcuts and the command palette

- **Status:** Accepted; the context menu part is superseded by
  [0017](0017-html-context-menus.md)
- **Date:** 2026-10-31

## Context

The UX principles ask for "keyboard first", "every action has a shortcut
and is findable in the palette" and "calm over noise" (no toolbars).

## Decision

- Every user action is a **command** in a central registry
  (`src/lib/commands/registry.ts`): id, i18n title, optional shortcut,
  optional `when` condition, `run`.
- Shortcuts are written as `Mod+Shift+F`; `Mod` is Cmd on macOS and Ctrl
  elsewhere. Letters and digits match the physical key (`event.code`), so
  Shift and keyboard layouts do not break them. One global capture-phase
  handler dispatches them before the editor sees the key.
- The **command palette** (`Mod+K`, also `Mod+Shift+P`) lists available
  commands with their shortcuts, other open projects and, with a query,
  files. Quick open (`Mod+P`) is the same overlay limited to files.
- Context menus (e.g. on projects) are **native menus** created from the
  frontend with i18n labels, instead of custom HTML menus.

## Consequences

- New features add commands instead of buttons; the palette stays the
  place to discover them.
- Shortcuts are not configurable yet (planned under "Later").
- Native menus look platform-specific and need the `core:menu` permission.
