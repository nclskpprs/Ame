import { describe, expect, it } from 'vitest';
import { languageIdFor } from './languages';

describe('languageIdFor', () => {
  it('maps extensions', () => {
    expect(languageIdFor('src/App.tsx')).toBe('typescript');
    expect(languageIdFor('index.PHP')).toBe('php');
    expect(languageIdFor('README.md')).toBe('markdown');
    expect(languageIdFor('a/b/c.svelte')).toBe('html');
  });

  it('maps well-known file names', () => {
    expect(languageIdFor('.prettierrc')).toBe('json');
  });

  it('returns null for unknown files', () => {
    expect(languageIdFor('Makefile')).toBeNull();
    expect(languageIdFor('main.rs')).toBeNull();
  });
});
