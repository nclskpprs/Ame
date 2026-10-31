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
  // Syntax highlighting in the editor (blue and teal tones, see DESIGN.md).
  'syntaxKeyword',
  'syntaxString',
  'syntaxNumber',
  'syntaxComment',
  'syntaxFunction',
  'syntaxType',
  'syntaxProperty',
  'syntaxOperator',
  'syntaxTag',
  'syntaxAttribute',
  'syntaxLink',
  'syntaxInvalid',
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
    syntaxKeyword: '#78B4FF',
    syntaxString: '#5ED3BA',
    syntaxNumber: '#E6B673',
    syntaxComment: '#7D90A6',
    syntaxFunction: '#A5CDFF',
    syntaxType: '#7FDBCA',
    syntaxProperty: '#C3D1E0',
    syntaxOperator: '#97AABF',
    syntaxTag: '#78B4FF',
    syntaxAttribute: '#A5CDFF',
    syntaxLink: '#5AA9FF',
    syntaxInvalid: '#F06A6A',
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
    syntaxKeyword: '#1F5FB8',
    syntaxString: '#0F7562',
    syntaxNumber: '#8A5700',
    syntaxComment: '#5D6D80',
    syntaxFunction: '#2558A0',
    syntaxType: '#0E6B5C',
    syntaxProperty: '#34465C',
    syntaxOperator: '#4E5E72',
    syntaxTag: '#1F5FB8',
    syntaxAttribute: '#2558A0',
    syntaxLink: '#2A69BD',
    syntaxInvalid: '#C23B3B',
  },
};

/** CSS custom property for a token, e.g. `textMuted` → `--ame-text-muted`. */
export function cssVariable(name: TokenName): `--ame-${string}` {
  return `--ame-${name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`;
}
