import { basename, dirname } from '$lib/fs/paths';
import { commands } from '$lib/ipc/bindings';
import type { ProjectSession } from '$lib/project/session';
import { segments } from './highlight';
import type { PaletteItem, PaletteSource } from './palette.svelte';

const QUICK_OPEN_LIMIT = 50;

/** Fuzzy file search in a project (backend), open tabs first for no query. */
export function fileSource(session: ProjectSession): PaletteSource {
  return async (query) => {
    const result = await commands.quickOpen(session.path, query, QUICK_OPEN_LIMIT);
    if (result.status === 'error') return [];
    let matches = result.data;
    if (!query.trim()) {
      const open = session.editors.files.map((file) => ({ path: file.path, indices: [] }));
      matches = [...open, ...matches.filter((m) => !open.some((o) => o.path === m.path))];
    }
    return matches.slice(0, QUICK_OPEN_LIMIT).map((match): PaletteItem => {
      const name = basename(match.path);
      const nameStart = Array.from(match.path).length - Array.from(name).length;
      return {
        id: `file:${match.path}`,
        label: segments(name, match.indices, nameStart),
        detail: segments(dirname(match.path), match.indices),
        run: () => session.openFile(match.path),
      };
    });
  };
}
