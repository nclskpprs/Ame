import type { Density, RainEffects, ThemePreference } from '$lib/ipc/bindings';
import { cssVariable, palettes, tokenNames, type ThemeName } from './tokens';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Resolves the theme preference against the system color scheme. */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ThemeName {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

/** Rain effects are switched off when the system asks for reduced motion. */
export function resolveRainEffects(setting: RainEffects, reducedMotion: boolean): RainEffects {
  return reducedMotion ? 'off' : setting;
}

export interface Appearance {
  theme: ThemeName;
  density: Density;
  rainEffects: RainEffects;
}

/** Writes the tokens as CSS custom properties and data attributes. */
export function applyAppearance(root: HTMLElement, appearance: Appearance): void {
  const palette = palettes[appearance.theme];
  for (const name of tokenNames) {
    root.style.setProperty(cssVariable(name), palette[name]);
  }
  root.style.colorScheme = appearance.theme;
  root.dataset.theme = appearance.theme;
  root.dataset.density = appearance.density;
  root.dataset.rain = appearance.rainEffects;
}

export function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

export function systemPrefersReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/** Calls `onChange` whenever the system color scheme or motion preference changes. */
export function watchSystemPreferences(onChange: () => void): () => void {
  const queries = [DARK_QUERY, REDUCED_MOTION_QUERY].map((query) => window.matchMedia(query));
  queries.forEach((query) => query.addEventListener('change', onChange));
  return () => queries.forEach((query) => query.removeEventListener('change', onChange));
}
