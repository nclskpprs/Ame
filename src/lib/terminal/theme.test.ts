import { describe, expect, it } from 'vitest';
import { palettes } from '$lib/theme/tokens';
import { terminalTheme } from './theme';

describe('terminalTheme', () => {
  it('uses the design tokens', () => {
    const theme = terminalTheme(palettes.dark);
    expect(theme.background).toBe(palettes.dark.bg);
    expect(theme.foreground).toBe(palettes.dark.text);
    expect(theme.brightCyan).toBe(palettes.dark.ansiBrightCyan);
  });

  it('only contains hex colors', () => {
    for (const palette of Object.values(palettes)) {
      for (const color of Object.values(terminalTheme(palette))) {
        expect(color).toMatch(/^#[0-9A-F]{6}([0-9A-F]{2})?$/i);
      }
    }
  });
});
