import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import en from '$locales/en.json';
import { interpolate, lookup, setLocale, t } from './i18n.svelte';

type Tree = { [key: string]: string | Tree };

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : keys(value, `${prefix}${key}.`),
  );
}

describe('t', () => {
  it('returns the English message', () => {
    expect(t('app.name')).toBe('Ame');
    expect(t('settings.theme.label')).toBe('Theme');
  });

  it('interpolates parameters', () => {
    expect(t('settings.saveFailed', { message: 'disk full' })).toBe(
      'Could not save settings: disk full',
    );
  });

  it('falls back to English for unknown locales', async () => {
    await setLocale('xx');
    expect(t('app.name')).toBe('Ame');
  });
});

describe('lookup', () => {
  it('resolves nested keys and rejects partial paths', () => {
    expect(lookup(en, 'settings.theme.dark')).toBe('Dark');
    expect(lookup(en, 'settings.theme')).toBeUndefined();
    expect(lookup(en, 'does.not.exist')).toBeUndefined();
  });
});

describe('interpolate', () => {
  it('keeps unknown placeholders', () => {
    expect(interpolate('{a} and {b}', { a: 1 })).toBe('1 and {b}');
  });
});

describe('locale files', () => {
  const dir = new URL('../../../locales/', import.meta.url);
  const englishKeys = keys(en).sort();

  for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
    it(`${file} has exactly the keys of en.json`, () => {
      const messages = JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as Tree;
      expect(keys(messages).sort()).toEqual(englishKeys);
    });
  }
});
