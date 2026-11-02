import { describe, expect, it } from 'vitest';
import {
  ancestors,
  basename,
  dirname,
  extension,
  isWithin,
  withAncestors,
  cleanPath,
  movedPath,
} from './paths';

describe('paths', () => {
  it('splits paths', () => {
    expect(dirname('src/lib/a.ts')).toBe('src/lib');
    expect(dirname('a.ts')).toBe('');
    expect(basename('src/lib/a.ts')).toBe('a.ts');
    expect(basename('a.ts')).toBe('a.ts');
  });

  it('finds extensions', () => {
    expect(extension('src/App.Svelte')).toBe('svelte');
    expect(extension('.gitignore')).toBe('');
    expect(extension('Makefile')).toBe('');
    expect(extension('a.d.ts')).toBe('ts');
  });

  it('lists ancestors', () => {
    expect(ancestors('a/b/c')).toEqual(['', 'a', 'a/b']);
    expect(ancestors('file')).toEqual(['']);
  });

  it('checks containment', () => {
    expect(isWithin('src/a.ts', 'src')).toBe(true);
    expect(isWithin('srcx/a.ts', 'src')).toBe(false);
    expect(isWithin('anything', '')).toBe(true);
  });

  it('adds ancestor directories without the root', () => {
    expect([...withAncestors(['src/lib/a.ts', 'src/b.ts', 'c.ts'])].sort()).toEqual([
      'c.ts',
      'src',
      'src/b.ts',
      'src/lib',
      'src/lib/a.ts',
    ]);
    expect(withAncestors([]).size).toBe(0);
  });
});

describe('movedPath', () => {
  it('maps the moved entry and everything inside it', () => {
    expect(movedPath('src/lib', 'src/lib', 'core/lib')).toBe('core/lib');
    expect(movedPath('src/lib/a.ts', 'src/lib', 'core/lib')).toBe('core/lib/a.ts');
    expect(movedPath('src/library.ts', 'src/lib', 'core/lib')).toBeNull();
  });
});

describe('cleanPath', () => {
  it('normalizes typed paths', () => {
    expect(cleanPath(' src//new.ts ')).toBe('src/new.ts');
    expect(cleanPath('./a\\b/')).toBe('a/b');
    expect(cleanPath('/')).toBe('');
  });
});
