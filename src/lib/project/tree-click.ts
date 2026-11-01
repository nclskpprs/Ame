import type { EntryKind } from '$lib/ipc/bindings';

/** What a mouse click on a file tree row does. */
export type TreeClick = 'toggle' | 'open' | 'select' | 'none';

/**
 * Decides the action for a click. `detail` is the click count of the
 * `click` event (1 for a single click, 2 for the second click of a double
 * click). Folders toggle on the first click only, so a double click does not
 * collapse them again. Files open on a double click, or on a single click
 * when that is enabled in the settings.
 */
export function treeClick(kind: EntryKind, detail: number, singleClick: boolean): TreeClick {
  if (kind === 'dir') return detail <= 1 ? 'toggle' : 'none';
  if (singleClick || detail === 2) return 'open';
  return 'select';
}
