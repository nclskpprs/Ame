import type { ITheme } from '@xterm/xterm';
import type { Palette } from '$lib/theme/tokens';

/** The xterm.js theme for a palette. xterm.js needs concrete colors, not CSS variables. */
export function terminalTheme(palette: Palette): ITheme {
  return {
    background: palette.bg,
    foreground: palette.text,
    cursor: palette.accent,
    cursorAccent: palette.bg,
    selectionBackground: `${palette.accent}55`,
    scrollbarSliderBackground: `${palette.border}99`,
    scrollbarSliderHoverBackground: palette.border,
    scrollbarSliderActiveBackground: palette.textMuted,
    black: palette.ansiBlack,
    red: palette.ansiRed,
    green: palette.ansiGreen,
    yellow: palette.ansiYellow,
    blue: palette.ansiBlue,
    magenta: palette.ansiMagenta,
    cyan: palette.ansiCyan,
    white: palette.ansiWhite,
    brightBlack: palette.ansiBrightBlack,
    brightRed: palette.ansiBrightRed,
    brightGreen: palette.ansiBrightGreen,
    brightYellow: palette.ansiBrightYellow,
    brightBlue: palette.ansiBrightBlue,
    brightMagenta: palette.ansiBrightMagenta,
    brightCyan: palette.ansiBrightCyan,
    brightWhite: palette.ansiBrightWhite,
  };
}
