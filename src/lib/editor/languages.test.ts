import { describe, expect, it } from 'vitest';
import { languageIdFor, loadLanguage } from './languages';

describe('languageIdFor', () => {
  it('maps extensions', () => {
    expect(languageIdFor('src/App.tsx')).toBe('typescript');
    expect(languageIdFor('index.PHP')).toBe('php');
    expect(languageIdFor('README.md')).toBe('markdown');
    expect(languageIdFor('a/b/c.svelte')).toBe('html');
    expect(languageIdFor('src/main.rs')).toBe('rust');
    expect(languageIdFor('app.py')).toBe('python');
    expect(languageIdFor('.github/workflows/ci.yml')).toBe('yaml');
    expect(languageIdFor('Cargo.toml')).toBe('toml');
    expect(languageIdFor('scripts/build.sh')).toBe('shell');
    expect(languageIdFor('styles/main.scss')).toBe('scss');
    expect(languageIdFor('include/a.hpp')).toBe('cpp');
  });

  it('maps well-known file names', () => {
    expect(languageIdFor('.prettierrc')).toBe('json');
    expect(languageIdFor('docker/Dockerfile')).toBe('dockerfile');
    expect(languageIdFor('Cargo.lock')).toBe('toml');
    expect(languageIdFor('Gemfile')).toBe('ruby');
  });

  it('maps variants of well-known file names', () => {
    expect(languageIdFor('Dockerfile.dev')).toBe('dockerfile');
    expect(languageIdFor('.env.local')).toBe('properties');
  });

  it('returns null for unknown files', () => {
    expect(languageIdFor('Makefile')).toBeNull();
    expect(languageIdFor('LICENSE')).toBeNull();
    expect(languageIdFor('notes.txt')).toBeNull();
  });
});

describe('loadLanguage', () => {
  it('loads Lezer grammars and legacy modes', async () => {
    expect(await loadLanguage('a.rs')).not.toBeNull();
    expect(await loadLanguage('a.toml')).not.toBeNull();
    expect(await loadLanguage('a.kt')).not.toBeNull();
    expect(await loadLanguage('notes.txt')).toBeNull();
  });
});
