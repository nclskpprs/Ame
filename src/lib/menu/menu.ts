/**
 * Context menu model: entries, keyboard navigation and placement. The UI is
 * `ContextMenu.svelte`; the open menu lives in `context-menu.svelte.ts`.
 */

/** An entry in a context menu. Labels are already translated. */
export type MenuEntry =
  | { kind: 'action'; label: string; run: () => unknown }
  | { kind: 'submenu'; label: string; items: MenuEntry[] }
  | { kind: 'separator' };

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** A rectangle in viewport coordinates, like `DOMRect`. */
export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Distance between a menu and the edge of the window. */
const EDGE_MARGIN = 4;

function focusable(entry: MenuEntry | undefined): boolean {
  return entry !== undefined && entry.kind !== 'separator';
}

/**
 * Index of the next entry in `direction` that can be focused, wrapping
 * around and skipping separators. With `from < 0` (nothing active yet) it
 * starts at the first or the last entry. Returns -1 if there is none.
 */
export function step(entries: readonly MenuEntry[], from: number, direction: 1 | -1): number {
  const count = entries.length;
  const start = from < 0 ? (direction > 0 ? -1 : count) : from;
  for (let i = 1; i <= count; i++) {
    const index = (((start + direction * i) % count) + count) % count;
    if (focusable(entries[index])) return index;
  }
  return -1;
}

/**
 * Index of the next entry after `from` whose label starts with `char`
 * (ignoring case), wrapping around. Returns -1 if there is none.
 */
export function typeahead(entries: readonly MenuEntry[], from: number, char: string): number {
  const needle = char.toLocaleLowerCase();
  const count = entries.length;
  for (let i = 1; i <= count; i++) {
    const index = (Math.max(from, -1) + i) % count;
    const entry = entries[index];
    if (entry && entry.kind !== 'separator' && entry.label.toLocaleLowerCase().startsWith(needle)) {
      return index;
    }
  }
  return -1;
}

/** A zero-size rectangle at a point, e.g. the pointer position. */
export function pointRect({ x, y }: Point): Rect {
  return { left: x, top: y, right: x, bottom: y };
}

/**
 * Top-left corner for a menu of `size` next to `anchor` inside `viewport`.
 *
 * Like native menus, it opens to the right of and below the anchor's top
 * edge. If there is no room, it opens to the left of the anchor or ends at
 * its bottom edge, and finally it is pushed inside the window. For a point
 * anchor this means "below and right of the pointer, or flipped"; for a
 * submenu item it means "beside the item".
 */
export function placeMenu(anchor: Rect, size: Size, viewport: Size): Point {
  return {
    x: placeAxis(anchor.right, anchor.left - size.width, size.width, viewport.width),
    y: placeAxis(anchor.top, anchor.bottom - size.height, size.height, viewport.height),
  };
}

function placeAxis(preferred: number, flipped: number, size: number, available: number): number {
  const max = available - EDGE_MARGIN - size;
  if (preferred <= max) return preferred;
  if (flipped >= EDGE_MARGIN) return flipped;
  return Math.max(EDGE_MARGIN, max);
}
