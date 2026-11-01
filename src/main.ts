import { mount } from 'svelte';
import '@fontsource-variable/jetbrains-mono';
import './app.css';
import App from './App.svelte';
import { forwardErrorsToLog } from '$lib/errors';
import { commands } from '$lib/ipc/bindings';
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

forwardErrorsToLog();
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

const app = mount(App, { target });
// The backend logs the startup time (and measures it in benchmark runs)
// once the first frame is painted.
requestAnimationFrame(() => setTimeout(() => void commands.appReady(), 0));

export default app;
