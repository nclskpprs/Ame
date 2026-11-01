import { describe, expect, it } from 'vitest';
import { placeMenu, pointRect, step, typeahead, type MenuEntry } from './menu';

const run = () => {};
const entries: MenuEntry[] = [
  { kind: 'separator' },
  { kind: 'action', label: 'Pin', run },
  { kind: 'submenu', label: 'Move to group', items: [] },
  { kind: 'separator' },
  { kind: 'action', label: 'Close project', run },
  { kind: 'action', label: 'Copy path', run },
];

describe('step', () => {
  it('moves to the next entry and skips separators', () => {
    expect(step(entries, 1, 1)).toBe(2);
    expect(step(entries, 2, 1)).toBe(4);
    expect(step(entries, 4, -1)).toBe(2);
  });

  it('wraps around at both ends', () => {
    expect(step(entries, 5, 1)).toBe(1);
    expect(step(entries, 1, -1)).toBe(5);
  });

  it('starts at the first or last entry when nothing is active', () => {
    expect(step(entries, -1, 1)).toBe(1);
    expect(step(entries, -1, -1)).toBe(5);
  });

  it('returns -1 when no entry can be focused', () => {
    expect(step([], -1, 1)).toBe(-1);
    expect(step([{ kind: 'separator' }], 0, 1)).toBe(-1);
  });

  it('stays on a single entry', () => {
    const single: MenuEntry[] = [{ kind: 'action', label: 'Pin', run }];
    expect(step(single, 0, 1)).toBe(0);
    expect(step(single, 0, -1)).toBe(0);
  });
});

describe('typeahead', () => {
  it('finds the next label starting with the letter, ignoring case', () => {
    expect(typeahead(entries, -1, 'c')).toBe(4);
    expect(typeahead(entries, 4, 'C')).toBe(5);
    expect(typeahead(entries, 5, 'c')).toBe(4);
    expect(typeahead(entries, 1, 'm')).toBe(2);
  });

  it('returns -1 without a match', () => {
    expect(typeahead(entries, 1, 'x')).toBe(-1);
    expect(typeahead([], -1, 'a')).toBe(-1);
  });
});

describe('placeMenu', () => {
  const viewport = { width: 800, height: 600 };
  const size = { width: 200, height: 120 };

  it('opens below and to the right of the pointer', () => {
    expect(placeMenu(pointRect({ x: 100, y: 50 }), size, viewport)).toEqual({ x: 100, y: 50 });
  });

  it('flips to the left and up near the right and bottom edges', () => {
    expect(placeMenu(pointRect({ x: 700, y: 550 }), size, viewport)).toEqual({ x: 500, y: 430 });
  });

  it('is pushed inside the window when neither side fits', () => {
    const wide = { width: 760, height: 580 };
    expect(placeMenu(pointRect({ x: 100, y: 100 }), wide, viewport)).toEqual({ x: 36, y: 16 });
  });

  it('keeps a margin when the menu is larger than the window', () => {
    const huge = { width: 900, height: 700 };
    expect(placeMenu(pointRect({ x: 100, y: 100 }), huge, viewport)).toEqual({ x: 4, y: 4 });
  });

  it('opens a submenu beside its parent, or on the other side', () => {
    const parent = { left: 100, top: 40, right: 300, bottom: 70 };
    expect(placeMenu(parent, size, viewport)).toEqual({ x: 300, y: 40 });
    const nearEdge = { left: 500, top: 520, right: 700, bottom: 550 };
    expect(placeMenu(nearEdge, size, viewport)).toEqual({ x: 300, y: 430 });
  });
});
