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
  // File states in git (tree, changes panel).
  'gitModified',
  'gitAdded',
  'gitUntracked',
  'gitDeleted',
  'gitConflict',
  // The 16 ANSI colors of the terminal.
  'ansiBlack',
  'ansiRed',
  'ansiGreen',
  'ansiYellow',
  'ansiBlue',
  'ansiMagenta',
  'ansiCyan',
  'ansiWhite',
  'ansiBrightBlack',
  'ansiBrightRed',
  'ansiBrightGreen',
  'ansiBrightYellow',
  'ansiBrightBlue',
  'ansiBrightMagenta',
  'ansiBrightCyan',
  'ansiBrightWhite',
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
    gitModified: '#E6B673',
    gitAdded: '#5ED3BA',
    gitUntracked: '#6FD49B',
    gitDeleted: '#F06A6A',
    gitConflict: '#FF8F8F',
    ansiBlack: '#22324A',
    ansiRed: '#F06A6A',
    ansiGreen: '#6FD49B',
    ansiYellow: '#E6B673',
    ansiBlue: '#5AA9FF',
    ansiMagenta: '#C59BFF',
    ansiCyan: '#5ED3CF',
    ansiWhite: '#C3D1E0',
    ansiBrightBlack: '#7D90A6',
    ansiBrightRed: '#FF8F8F',
    ansiBrightGreen: '#9BE6B8',
    ansiBrightYellow: '#F2CB8A',
    ansiBrightBlue: '#8EC5FF',
    ansiBrightMagenta: '#DBBEFF',
    ansiBrightCyan: '#8FE8E4',
    ansiBrightWhite: '#F1F5FA',
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
    gitModified: '#8A5700',
    gitAdded: '#0F7562',
    gitUntracked: '#1C7A47',
    gitDeleted: '#C23B3B',
    gitConflict: '#A83232',
    ansiBlack: '#1A2433',
    ansiRed: '#C23B3B',
    ansiGreen: '#1C7A47',
    ansiYellow: '#8A5700',
    ansiBlue: '#1F5FB8',
    ansiMagenta: '#8A3FB5',
    ansiCyan: '#0E6B6B',
    ansiWhite: '#5B6B80',
    ansiBrightBlack: '#4E5E72',
    ansiBrightRed: '#A83232',
    ansiBrightGreen: '#166B3D',
    ansiBrightYellow: '#7A4D00',
    ansiBrightBlue: '#2558A0',
    ansiBrightMagenta: '#7A35A0',
    ansiBrightCyan: '#0B5E5E',
    ansiBrightWhite: '#34465C',
  },
};

/** CSS custom property for a token, e.g. `textMuted` → `--ame-text-muted`. */
export function cssVariable(name: TokenName): `--ame-${string}` {
  return `--ame-${name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`;
}
