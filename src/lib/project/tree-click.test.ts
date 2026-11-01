import { describe, expect, it } from 'vitest';
import { treeClick } from './tree-click';

describe('treeClick', () => {
  it('opens files on a double click by default', () => {
    expect(treeClick('file', 1, false)).toBe('select');
    expect(treeClick('file', 2, false)).toBe('open');
    expect(treeClick('file', 3, false)).toBe('select');
  });

  it('opens files on a single click when enabled', () => {
    expect(treeClick('file', 1, true)).toBe('open');
    expect(treeClick('file', 2, true)).toBe('open');
  });

  it('toggles folders once per double click', () => {
    expect(treeClick('dir', 0, false)).toBe('toggle');
    expect(treeClick('dir', 1, false)).toBe('toggle');
    expect(treeClick('dir', 2, false)).toBe('none');
    expect(treeClick('dir', 1, true)).toBe('toggle');
  });
});
