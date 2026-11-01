import type { ThemeName } from './tokens';

/** The resolved theme, for code that needs concrete colors (e.g. xterm.js). */
export const currentTheme = $state<{ name: ThemeName }>({ name: 'dark' });
