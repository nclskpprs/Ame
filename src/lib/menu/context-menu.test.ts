import { describe, expect, it, vi } from 'vitest';
import { contextMenu, menuOrigin } from './context-menu.svelte';
import type { MenuEntry } from './menu';

function element() {
  return {
    focus: vi.fn(),
    getBoundingClientRect: () => ({ left: 10, top: 40, right: 230, bottom: 64 }),
  };
}

function contextMenuEvent(clientX: number, clientY: number, extra: object = {}) {
  return {
    clientX,
    clientY,
    currentTarget: element(),
    preventDefault: vi.fn(),
    ...extra,
  } as unknown as MouseEvent;
}

const items: MenuEntry[] = [{ kind: 'action', label: 'Pin', run: () => {} }];

describe('menuOrigin', () => {
  it('opens at the pointer', () => {
    expect(menuOrigin(contextMenuEvent(120, 80))).toEqual({
      at: { x: 120, y: 80 },
      keyboard: false,
    });
  });

  it('opens below the element when the event has no position', () => {
    expect(menuOrigin(contextMenuEvent(0, 0))).toEqual({ at: { x: 18, y: 64 }, keyboard: true });
  });

  it('treats a pointer event without pointer type as keyboard-triggered', () => {
    const event = contextMenuEvent(30, 50, { pointerType: '' });
    expect(menuOrigin(event)).toEqual({ at: { x: 30, y: 50 }, keyboard: true });
    expect(menuOrigin(contextMenuEvent(30, 50, { pointerType: 'mouse' })).keyboard).toBe(false);
  });
});

describe('contextMenu', () => {
  it('opens for an event and suppresses the default menu', () => {
    const event = contextMenuEvent(120, 80);
    contextMenu.show(event, 'ame', items);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(contextMenu.config).toMatchObject({
      label: 'ame',
      items,
      at: { x: 120, y: 80 },
      keyboard: false,
      returnFocus: event.currentTarget,
    });
    contextMenu.close();
  });

  it('returns the focus to the origin when closed', () => {
    const event = contextMenuEvent(120, 80);
    contextMenu.show(event, 'ame', items);
    contextMenu.close();
    expect(contextMenu.config).toBeNull();
    expect((event.currentTarget as unknown as ReturnType<typeof element>).focus).toHaveBeenCalled();
  });

  it('leaves the focus alone when closed by an outside click', () => {
    const event = contextMenuEvent(120, 80);
    contextMenu.show(event, 'ame', items);
    contextMenu.close(false);
    expect(contextMenu.config).toBeNull();
    expect((event.currentTarget as unknown as ReturnType<typeof element>).focus).not.toBeCalled();
  });
});
