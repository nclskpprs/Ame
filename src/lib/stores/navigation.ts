import type { Overlay } from './view.svelte';

/**
 * The page the sidebar marks as current. The sidebar behaves like page
 * navigation: exactly one entry is current, and clicking an entry shows its
 * page instead of toggling it.
 */
export type Page =
  | { kind: 'dashboard' | 'settings' }
  | { kind: 'board' | 'project'; path: string }
  | { kind: 'none' };

export function currentPage(overlay: Overlay | null, activePath: string | null): Page {
  if (overlay === 'dashboard' || overlay === 'settings') return { kind: overlay };
  if (activePath === null) return { kind: 'none' };
  return { kind: overlay === 'board' ? 'board' : 'project', path: activePath };
}

/** The project the page belongs to: a project page and its board. */
export function pageProject(page: Page): string | null {
  return page.kind === 'project' || page.kind === 'board' ? page.path : null;
}
