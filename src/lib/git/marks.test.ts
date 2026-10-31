import { describe, expect, it } from 'vitest';
import type { GitFile } from '$lib/ipc/types';
import { fileMark, treeMarks } from './marks';

function file(path: string, staged: GitFile['staged'], unstaged: GitFile['unstaged']): GitFile {
  return { path, origPath: null, staged, unstaged, modified: 1 };
}

describe('git marks', () => {
  it('prefers the working tree change', () => {
    expect(fileMark(file('a', 'modified', 'deleted'))).toBe('deleted');
    expect(fileMark(file('a', 'renamed', null))).toBe('renamed');
    expect(fileMark(file('a', 'added', 'modified'))).toBe('added');
    expect(fileMark(file('a', null, 'untracked'))).toBe('untracked');
    expect(fileMark(file('a', null, null))).toBeNull();
  });

  it('marks folders with the strongest change inside', () => {
    const marks = treeMarks([
      file('src/new.ts', null, 'untracked'),
      file('src/lib/a.ts', null, 'modified'),
      file('docs/x.md', null, 'untracked'),
    ]);
    expect(marks.get('src')).toBe('modified');
    expect(marks.get('src/lib')).toBe('modified');
    expect(marks.get('docs')).toBe('untracked');
    expect(marks.get('src/new.ts')).toBe('untracked');
    expect(marks.has('')).toBe(false);
  });
});
