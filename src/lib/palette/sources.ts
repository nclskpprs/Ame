import { paletteCommands, shortcutOf } from '$lib/commands/registry';
import { formatShortcut } from '$lib/commands/shortcuts';
import { basename, dirname } from '$lib/fs/paths';
import { t } from '$lib/i18n';
import { commands } from '$lib/ipc/bindings';
import type { ProjectSession } from '$lib/project/session';
import { workspace } from '$lib/stores/workspace.svelte';
import { fuzzyMatch } from './fuzzy';
import { segments } from './highlight';
import type { PaletteItem, PaletteSource } from './palette.svelte';

/** Files shown in the command palette (quick open shows more). */
const PALETTE_FILE_LIMIT = 8;

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

interface Scored {
  score: number;
  item: PaletteItem;
}

function byScore(a: Scored, b: Scored): number {
  return b.score - a.score;
}

/** Commands that can run right now, fuzzy-matched by title. */
function commandItems(query: string): Scored[] {
  return paletteCommands().flatMap((command) => {
    const title = t(command.title);
    const match = fuzzyMatch(query, title);
    if (!match) return [];
    const shortcut = shortcutOf(command.id);
    return [
      {
        score: match.score,
        item: {
          id: `command:${command.id}`,
          label: segments(title, match.indices),
          hint: shortcut ? formatShortcut(shortcut) : undefined,
          run: command.run,
        },
      },
    ];
  });
}

/** Open projects other than the active one, fuzzy-matched by name. */
function projectItems(query: string): Scored[] {
  return workspace.projects
    .filter((project) => project.path !== workspace.activePath)
    .flatMap((project) => {
      const match = fuzzyMatch(query, project.name);
      if (!match) return [];
      return [
        {
          score: match.score,
          item: {
            id: `project:${project.path}`,
            label: segments(project.name, match.indices),
            detail: [{ text: t('palette.kindProject'), match: false }],
            run: () => workspace.activate(project.path),
          },
        },
      ];
    });
}

/**
 * The command palette: commands, projects and (with a query and an active
 * project) files, in that order.
 */
export function everythingSource(session: ProjectSession | null): PaletteSource {
  const files = session ? fileSource(session) : null;
  return async (query) => {
    const local = [...commandItems(query).sort(byScore), ...projectItems(query).sort(byScore)].map(
      (scored) => scored.item,
    );
    if (!files || !query.trim()) return local;
    const fileItems = (await files(query)).slice(0, PALETTE_FILE_LIMIT);
    return [...local, ...fileItems];
  };
}
