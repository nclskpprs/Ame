import { describe, expect, it } from 'vitest';
import { fuzzyMatch } from './fuzzy';

describe('fuzzyMatch', () => {
  it('matches subsequences case-insensitively', () => {
    expect(fuzzyMatch('ofo', 'Open Folder…')?.indices).toEqual([0, 5, 6]);
    expect(fuzzyMatch('xyz', 'Open Folder…')).toBeNull();
  });

  it('matches everything for an empty query', () => {
    expect(fuzzyMatch('  ', 'anything')).toEqual({ score: 0, indices: [] });
  });

  it('prefers word starts and consecutive characters', () => {
    const wordStart = fuzzyMatch('td', 'Theme: Dark')!;
    const inner = fuzzyMatch('td', 'Settings data')!;
    expect(wordStart.score).toBeGreaterThan(inner.score);

    const consecutive = fuzzyMatch('dark', 'Theme: Dark')!;
    const scattered = fuzzyMatch('dark', 'Density: Comfortable rank')!;
    expect(consecutive.score).toBeGreaterThan(scattered.score);
  });

  it('ignores spaces in the query', () => {
    expect(fuzzyMatch('theme dark', 'Theme: Dark')).not.toBeNull();
  });
});
