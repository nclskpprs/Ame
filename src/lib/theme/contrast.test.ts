import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';
import { palettes, type ThemeName, type TokenName } from './tokens';

/** WCAG AA: 4.5:1 for normal text, 3:1 for UI components and indicators. */
const TEXT_MIN = 4.5;
const INDICATOR_MIN = 3;

const backgrounds: TokenName[] = ['bg', 'surface'];
const textTokens: TokenName[] = ['text', 'textMuted'];
const indicatorTokens: TokenName[] = ['accent', 'needsInput', 'done', 'error'];

describe('contrastRatio', () => {
  it('matches known values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});

for (const [theme, palette] of Object.entries(palettes) as [
  ThemeName,
  (typeof palettes)[ThemeName],
][]) {
  describe(`Ame ${theme} contrast`, () => {
    for (const background of backgrounds) {
      for (const token of textTokens) {
        it(`${token} on ${background} meets ${TEXT_MIN}:1`, () => {
          expect(contrastRatio(palette[token], palette[background])).toBeGreaterThanOrEqual(
            TEXT_MIN,
          );
        });
      }

      for (const token of indicatorTokens) {
        it(`${token} on ${background} meets ${INDICATOR_MIN}:1`, () => {
          expect(contrastRatio(palette[token], palette[background])).toBeGreaterThanOrEqual(
            INDICATOR_MIN,
          );
        });
      }
    }
  });
}
