import { ancestors } from '$lib/fs/paths';
import type { Change } from '$lib/ipc/bindings';
import type { GitFile } from '$lib/ipc/types';

/** How a file (or a folder with changes inside) is marked. */
export type GitMark = 'conflicted' | 'modified' | 'added' | 'renamed' | 'untracked' | 'deleted';

/** Strongest first: a folder shows the strongest mark of its files. */
const STRENGTH: readonly GitMark[] = [
  'conflicted',
  'modified',
  'renamed',
  'added',
  'deleted',
  'untracked',
];

function markOf(change: Change): GitMark {
  switch (change) {
    case 'conflicted':
      return 'conflicted';
    case 'added':
    case 'copied':
      return 'added';
    case 'renamed':
      return 'renamed';
    case 'deleted':
      return 'deleted';
    case 'untracked':
      return 'untracked';
    case 'modified':
    case 'typeChanged':
      return 'modified';
  }
}

/** The mark of a file: its working tree change, else its staged change. */
export function fileMark(file: GitFile): GitMark | null {
  const change = file.unstaged ?? file.staged;
  if (!change) return null;
  // A file added to the index and edited since is still a new file.
  if (file.staged === 'added' && change === 'modified') return 'added';
  return markOf(change);
}

function stronger(a: GitMark, b: GitMark): GitMark {
  return STRENGTH.indexOf(a) <= STRENGTH.indexOf(b) ? a : b;
}

/** Marks for changed files and the folders that contain them. */
export function treeMarks(files: readonly GitFile[]): Map<string, GitMark> {
  const marks = new Map<string, GitMark>();
  for (const file of files) {
    const mark = fileMark(file);
    if (!mark) continue;
    marks.set(file.path, mark);
    for (const dir of ancestors(file.path)) {
      if (dir === '') continue;
      const current = marks.get(dir);
      marks.set(dir, current ? stronger(current, mark) : mark);
    }
  }
  return marks;
}

/** One-letter badge, as in `git status --short`. */
export const markLetters: Record<GitMark, string> = {
  conflicted: '!',
  modified: 'M',
  renamed: 'R',
  added: 'A',
  deleted: 'D',
  untracked: 'U',
};
