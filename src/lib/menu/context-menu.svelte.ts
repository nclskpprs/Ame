import type { MenuEntry, Point } from './menu';

export interface ContextMenuConfig {
  /** Accessible name of the menu, e.g. the project name. */
  label: string;
  items: MenuEntry[];
  /** Where the menu opens (viewport coordinates). */
  at: Point;
  /** Opened from the keyboard (Shift+F10, Menu key): the first item gets focus. */
  keyboard: boolean;
  /** Gets the focus back when the menu is closed with Escape or an action runs. */
  returnFocus: HTMLElement | null;
}

/**
 * Where a `contextmenu` event wants its menu. Keyboard-triggered events may
 * carry no position, so those menus open below the element instead.
 */
export function menuOrigin(event: MouseEvent): { at: Point; keyboard: boolean } {
  if (event.clientX !== 0 || event.clientY !== 0) {
    return { at: { x: event.clientX, y: event.clientY }, keyboard: isKeyboardEvent(event) };
  }
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  return { at: { x: rect.left + 8, y: rect.bottom }, keyboard: true };
}

/** Where `contextmenu` is a PointerEvent, keyboard-triggered ones have no pointer type. */
function isKeyboardEvent(event: MouseEvent): boolean {
  return 'pointerType' in event && event.pointerType === '';
}

let current = $state.raw<ContextMenuConfig | null>(null);

/**
 * The context menu overlay; only one is open at a time. It is drawn in HTML
 * instead of as a native menu (ADR 0017).
 */
export const contextMenu = {
  get config(): ContextMenuConfig | null {
    return current;
  },

  /** Opens a menu for a `contextmenu` event on the element it is attached to. */
  show(event: MouseEvent, label: string, items: MenuEntry[]): void {
    event.preventDefault();
    const { at, keyboard } = menuOrigin(event);
    current = {
      label,
      items,
      at,
      keyboard,
      returnFocus: event.currentTarget as HTMLElement | null,
    };
  },

  /**
   * Closes the menu. With `restoreFocus`, focus goes back synchronously to
   * the element the menu was opened from, before any action runs, so the
   * action can move the focus on.
   */
  close(restoreFocus = true): void {
    const config = current;
    current = null;
    if (restoreFocus) config?.returnFocus?.focus();
  },
};
