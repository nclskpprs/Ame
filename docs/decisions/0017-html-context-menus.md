# 0017. Context menus in HTML instead of native menus

- **Status:** Accepted (supersedes the context menu part of
  [0016](0016-commands-shortcuts-and-palette.md))
- **Date:** 2026-10-31

## Context

ADR 0016 chose native menus (Tauri `Menu.popup()`) for context menus. In
the manual acceptance test on Linux (WSLg, a Wayland compositor) the project
context menu never appeared:

- Without a position, muda attaches the GTK menu to the root window, which
  Wayland refuses ("Couldn't map … as popup because it doesn't have a
  parent").
- With an explicit position the warning is gone, but the menu still does not
  show. The likely reason: Wayland only grants a popup grab for a recent
  input event, and our menu opens after several asynchronous IPC calls
  (create menu, create items, popup), after the click that triggered it.

GNOME and KDE use Wayland by default, so this is likely not limited to WSLg. The
cause sits between WebKitGTK, muda and the compositor, out of our reach.

## Decision

- Context menus are drawn **in HTML** by one overlay component
  (`src/lib/components/ContextMenu.svelte`), opened through
  `contextMenu.show(event, label, entries)` from
  `src/lib/menu/context-menu.svelte.ts`. Entries are actions, submenus and
  separators with already translated labels.
- The menu follows the WAI-ARIA menu pattern: `role="menu"` /
  `menuitem`, arrow keys, Home/End, typeahead, Right/Left for submenus,
  Enter/Space to run, Escape closes one level, Tab closes. Opened from the
  keyboard (Shift+F10, Menu key), the first item gets focus; focus returns
  to the origin when the menu closes with Escape or an action.
- It opens at the pointer and flips or shifts to stay inside the window
  (`placeMenu`). Clicks, scrolling, resizing and leaving the window close it;
  outside clicks still reach their target.
- Native menus remain an option for the application menu bar (macOS), which
  is not affected.

## Consequences

- Context menus look and behave the same on macOS, Linux (X11 and Wayland)
  and Windows, use the design tokens and density, and open without IPC.
- We own keyboard handling and accessibility of menus; the pure logic
  (`src/lib/menu/menu.ts`) is unit-tested, the component is not yet covered
  by automated UI tests.
- Menus cannot extend beyond the window, unlike native menus. Context menus
  in Ame are short, so this is acceptable.
- The `core:menu` permissions are no longer used by the frontend.
