import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { t, type MessageKey } from '$lib/i18n';
import { commands } from '$lib/ipc/bindings';
import { describeError } from '$lib/ipc/types';
import { notices } from '$lib/stores/notices.svelte';

export type FileManager = 'finder' | 'explorer' | 'fileManager';

/** The file manager of the platform, which names the "Reveal in …" actions. */
export function fileManager(
  platform = typeof navigator === 'undefined' ? '' : navigator.platform,
): FileManager {
  if (/Mac|iPhone|iPad/.test(platform)) return 'finder';
  if (/Win/.test(platform)) return 'explorer';
  return 'fileManager';
}

const manager = fileManager();

const entryLabels: Record<FileManager, MessageKey> = {
  finder: 'reveal.finder',
  explorer: 'reveal.explorer',
  fileManager: 'reveal.fileManager',
};
const projectLabels: Record<FileManager, MessageKey> = {
  finder: 'reveal.projectFinder',
  explorer: 'reveal.projectExplorer',
  fileManager: 'reveal.projectFileManager',
};
const entryCommands: Record<FileManager, MessageKey> = {
  finder: 'commands.revealEntryFinder',
  explorer: 'commands.revealEntryExplorer',
  fileManager: 'commands.revealEntryFileManager',
};
const projectCommands: Record<FileManager, MessageKey> = {
  finder: 'commands.revealProjectFinder',
  explorer: 'commands.revealProjectExplorer',
  fileManager: 'commands.revealProjectFileManager',
};

/** Menu label for revealing a file or folder (`""` is the project). */
export function revealLabel(path: string): string {
  return t(path === '' ? projectLabels[manager] : entryLabels[manager]);
}

/** Command palette titles of the reveal commands on this platform. */
export const revealCommandTitles = {
  entry: entryCommands[manager],
  project: projectCommands[manager],
};

/**
 * Shows a file or folder of a project in the system file manager; the
 * project root (`""`) opens the project folder.
 */
export async function revealEntry(project: string, path: string): Promise<void> {
  const result = await commands.revealEntry(project, path);
  if (result.status === 'error') {
    notices.push(t('reveal.failed', { message: describeError(result.error) }));
  }
}

/**
 * Copies the absolute path of a file or folder (`""` is the project), or
 * its project-relative path, to the clipboard.
 */
export async function copyPath(project: string, path: string, relative = false): Promise<void> {
  let text = path;
  if (!relative) {
    const result = await commands.nativePath(project, path);
    if (result.status === 'error') {
      notices.push(t('reveal.copyFailed', { message: describeError(result.error) }));
      return;
    }
    text = result.data;
  }
  try {
    await writeText(text);
    notices.push(t('reveal.copied', { path: text }), 'info');
  } catch (error) {
    notices.push(t('reveal.copyFailed', { message: String(error) }));
  }
}
