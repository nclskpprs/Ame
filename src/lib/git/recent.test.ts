import { describe, expect, it } from 'vitest';
import type { GitFile } from '$lib/ipc/types';
import {
  NO_RECENT,
  RECENT_MS,
  changedFiles,
  modificationTimes,
  newest,
  updateRecent,
  withFolders,
} from './recent';

function file(path: string, modified: number | null): GitFile {
  return { path, origPath: null, staged: null, unstaged: 'modified', modified };
}

describe('recent changes', () => {
  it('finds nothing on the first status', () => {
    expect(changedFiles(null, [file('a', 1)])).toEqual([]);
  });

  it('finds new and newer files', () => {
    const before = modificationTimes([file('a', 100), file('b', 100), file('gone', null)]);
    expect(before.has('gone')).toBe(false);
    const after = [file('a', 100), file('b', 200), file('c', 50), file('gone', null)];
    expect(changedFiles(before, after)).toEqual(['b', 'c']);
  });

  it('picks the newest file', () => {
    const files = [file('a', 100), file('b', 300), file('c', 200)];
    expect(newest(['a', 'c'], files)).toBe('c');
    expect(newest([], files)).toBeNull();
  });

  it('adds new changes and drops expired ones', () => {
    expect(updateRecent(NO_RECENT, [], 0)).toBeNull();
    const first = updateRecent(NO_RECENT, ['src/a.ts'], 1000);
    expect([...(first ?? [])]).toEqual([['src/a.ts', 1000]]);
    const later = updateRecent(first ?? NO_RECENT, ['b'], 1000 + RECENT_MS);
    expect([...(later ?? [])]).toEqual([['b', 1000 + RECENT_MS]]);
    expect([...withFolders(first ?? NO_RECENT)].sort()).toEqual(['src', 'src/a.ts']);
  });
});
