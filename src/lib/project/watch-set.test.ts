import { describe, expect, it } from 'vitest';
import { WatchSet } from './watch-set';

describe('WatchSet', () => {
  it('reports the root on the first call', () => {
    expect(new WatchSet().update([''])).toEqual(['']);
  });

  it('reports only changes, ignoring order and duplicates', () => {
    const set = new WatchSet();
    expect(set.update(['src', '', 'src'])).toEqual(['', 'src']);
    expect(set.update(['', 'src'])).toBeNull();
    expect(set.update([''])).toEqual(['']);
    expect(set.update([])).toEqual([]);
  });
});
