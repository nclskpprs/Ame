import { getCurrentWebview } from '@tauri-apps/api/webview';

/**
 * Zoom steps of the whole UI in percent, like a browser's. Mod+Plus and
 * Mod+Minus move one step, Mod+0 resets to 100.
 */
export const ZOOM_STEPS = [50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200] as const;

export const DEFAULT_ZOOM = 100;
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;

/** The next step in a direction (1 = in, -1 = out), clamped to the range. */
export function nextZoom(current: number, direction: 1 | -1): number {
  if (direction > 0) return ZOOM_STEPS.find((step) => step > current) ?? MAX_ZOOM;
  return ZOOM_STEPS.findLast((step) => step < current) ?? MIN_ZOOM;
}

/** A stored zoom value made safe to apply (unknown values become 100). */
export function validZoom(value: number): number {
  return Number.isFinite(value) && value >= MIN_ZOOM && value <= MAX_ZOOM ? value : DEFAULT_ZOOM;
}

/** Zooms the whole web view (text, layout and terminals scale together). */
export function applyZoom(percent: number): void {
  getCurrentWebview()
    .setZoom(validZoom(percent) / 100)
    .catch(() => {});
}
