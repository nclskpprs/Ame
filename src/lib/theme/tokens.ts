/**
 * Design tokens for Ame Dark and Ame Light (see docs/DESIGN.md).
 *
 * This file is the single source of truth for colors. The UI uses them as
 * CSS custom properties (`--ame-bg`, `--ame-text-muted`, …); the editor and
 * terminal themes are derived from the same objects.
 */

export const tokenNames = [
  'bg',
  'surface',
  'border',
  'text',
  'textMuted',
  'accent',
  'needsInput',
  'done',
  'error',
] as const;

export type TokenName = (typeof tokenNames)[number];
export type Palette = Readonly<Record<TokenName, string>>;
export type ThemeName = 'dark' | 'light';

export const palettes: Readonly<Record<ThemeName, Palette>> = {
  dark: {
    bg: '#0E1621', // night sky
    surface: '#152131',
    border: '#22324A',
    text: '#D8E2EE',
    textMuted: '#8597AD',
    accent: '#5AA9FF', // also: working
    needsInput: '#F2B84B',
    done: '#4FD1B5',
    error: '#F06A6A',
  },
  light: {
    bg: '#F5F8FB', // mist
    surface: '#FFFFFF',
    border: '#DCE4EE',
    text: '#1A2433',
    textMuted: '#5B6B80',
    accent: '#2F74D0', // also: working
    needsInput: '#B47A0E',
    done: '#1E9E82',
    error: '#D14343',
  },
};

/** CSS custom property for a token, e.g. `textMuted` → `--ame-text-muted`. */
export function cssVariable(name: TokenName): `--ame-${string}` {
  return `--ame-${name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`;
}
