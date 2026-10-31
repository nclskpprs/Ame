import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveRainEffects, resolveTheme } from './theme';
import { cssVariable } from './tokens';

describe('resolveTheme', () => {
  it('follows the system for "system"', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('respects an explicit choice', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('resolveRainEffects', () => {
  it('turns rain off for reduced motion', () => {
    expect(resolveRainEffects('on', true)).toBe('off');
    expect(resolveRainEffects('subtle', false)).toBe('subtle');
  });
});

describe('cssVariable', () => {
  it('converts token names to kebab case', () => {
    expect(cssVariable('bg')).toBe('--ame-bg');
    expect(cssVariable('textMuted')).toBe('--ame-text-muted');
    expect(cssVariable('needsInput')).toBe('--ame-needs-input');
  });
});

describe('styles use design tokens only', () => {
  const src = fileURLToPath(new URL('../../', import.meta.url));
  const files = globSync('**/*.{svelte,css}', { cwd: src });
  const literalColor = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch)\(/i;

  for (const file of files) {
    it(file, () => {
      const source = readFileSync(`${src}/${file}`, 'utf8');
      const offending = source.split('\n').filter((line) => literalColor.test(line));
      expect(offending, 'use var(--ame-…) tokens instead of literal colors').toEqual([]);
    });
  }
});
