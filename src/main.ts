import { mount } from 'svelte';
import '@fontsource-variable/jetbrains-mono';
import './app.css';
import App from './App.svelte';
import { setLocale } from '$lib/i18n';
import { settings } from '$lib/stores/settings.svelte';
import { workspace } from '$lib/stores/workspace.svelte';
import {
  applyAppearance,
  resolveRainEffects,
  resolveTheme,
  systemPrefersDark,
  systemPrefersReducedMotion,
} from '$lib/theme/theme';

await Promise.all([settings.load(), workspace.load()]);
await setLocale(settings.value.locale);

// Apply the theme before the first render to avoid a flash of wrong colors.
applyAppearance(document.documentElement, {
  theme: resolveTheme(settings.value.theme, systemPrefersDark()),
  density: settings.value.density,
  rainEffects: resolveRainEffects(settings.value.rainEffects, systemPrefersReducedMotion()),
});

const target = document.getElementById('app');
if (!target) throw new Error('missing #app element');

export default mount(App, { target });
