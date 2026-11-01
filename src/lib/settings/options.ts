import { t, type MessageKey } from '$lib/i18n';
import type { Density, FileOpen, RainEffects, ThemePreference } from '$lib/ipc/bindings';

export interface Option<T extends string> {
  value: T;
  label: string;
}

function translated<T extends string>(entries: readonly (readonly [T, MessageKey])[]): Option<T>[] {
  return entries.map(([value, key]) => ({ value, label: t(key) }));
}

export function themeOptions(): Option<ThemePreference>[] {
  return translated([
    ['system', 'settings.theme.system'],
    ['dark', 'settings.theme.dark'],
    ['light', 'settings.theme.light'],
  ]);
}

export function densityOptions(): Option<Density>[] {
  return translated([
    ['comfortable', 'settings.density.comfortable'],
    ['compact', 'settings.density.compact'],
  ]);
}

export function rainOptions(): Option<RainEffects>[] {
  return translated([
    ['on', 'settings.rain.on'],
    ['subtle', 'settings.rain.subtle'],
    ['off', 'settings.rain.off'],
  ]);
}

export function fileOpenOptions(): Option<FileOpen>[] {
  return translated([
    ['doubleClick', 'settings.fileOpen.doubleClick'],
    ['singleClick', 'settings.fileOpen.singleClick'],
  ]);
}
