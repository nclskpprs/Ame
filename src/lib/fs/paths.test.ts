import { describe, expect, it } from 'vitest';
import { ancestors, basename, dirname, extension, isWithin } from './paths';

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
});
