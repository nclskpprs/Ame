import { describe, expect, it } from 'vitest';
import { formatShortcut, matchesShortcut, parseShortcut } from './shortcuts';

function key(code: string, keyName: string, mods: Partial<KeyboardEvent> = {}) {
  return {
    code,
    key: keyName,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...mods,
  };
}

describe('parseShortcut', () => {
  it('parses modifiers and key', () => {
    expect(parseShortcut('Mod+Shift+F')).toEqual({ mod: true, shift: true, alt: false, key: 'F' });
    expect(parseShortcut('Escape')).toEqual({
      mod: false,
      shift: false,
      alt: false,
      key: 'Escape',
    });
  });
});

describe('matchesShortcut', () => {
  const find = parseShortcut('Mod+Shift+F');

  it('uses Ctrl on Windows/Linux and Cmd on macOS', () => {
    expect(matchesShortcut(key('KeyF', 'F', { ctrlKey: true, shiftKey: true }), find, false)).toBe(
      true,
    );
    expect(matchesShortcut(key('KeyF', 'F', { metaKey: true, shiftKey: true }), find, true)).toBe(
      true,
    );
    expect(matchesShortcut(key('KeyF', 'F', { metaKey: true, shiftKey: true }), find, false)).toBe(
      false,
    );
  });

  it('requires the exact modifiers', () => {
    expect(matchesShortcut(key('KeyF', 'f', { ctrlKey: true }), find, false)).toBe(false);
    expect(
      matchesShortcut(
        key('KeyF', 'F', { ctrlKey: true, shiftKey: true, altKey: true }),
        find,
        false,
      ),
    ).toBe(false);
  });

  it('matches digits by physical key even with Shift', () => {
    const shortcut = parseShortcut('Mod+Shift+1');
    expect(
      matchesShortcut(key('Digit1', '!', { ctrlKey: true, shiftKey: true }), shortcut, false),
    ).toBe(true);
  });

  it('matches named keys by key', () => {
    expect(matchesShortcut(key('Escape', 'Escape'), parseShortcut('Escape'), false)).toBe(true);
  });
});

describe('formatShortcut', () => {
  it('formats per platform', () => {
    const shortcut = parseShortcut('Mod+Shift+f');
    expect(formatShortcut(shortcut, true)).toBe('⇧⌘F');
    expect(formatShortcut(shortcut, false)).toBe('Ctrl+Shift+F');
  });

  it('shows arrow keys as arrows', () => {
    const shortcut = parseShortcut('Mod+Alt+ArrowDown');
    expect(formatShortcut(shortcut, false)).toBe('Ctrl+Alt+↓');
    expect(formatShortcut(shortcut, true)).toBe('⌥⌘↓');
  });
});
