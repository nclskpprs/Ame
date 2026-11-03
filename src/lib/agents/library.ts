import { shortcutOf } from '$lib/commands/registry';
import { formatShortcut } from '$lib/commands/shortcuts';
import { t } from '$lib/i18n';
import { commands } from '$lib/ipc/bindings';
import type { Project, SessionInfo } from '$lib/ipc/types';
import { fuzzyMatch } from '$lib/palette/fuzzy';
import { segments } from '$lib/palette/highlight';
import { palette, type PaletteItem } from '$lib/palette/palette.svelte';
import { notices } from '$lib/stores/notices.svelte';
import { settings } from '$lib/stores/settings.svelte';
import { workspace } from '$lib/stores/workspace.svelte';
import { sessions } from '$lib/terminal/sessions.svelte';
import { basename } from '$lib/fs/paths';
import { broadcastTargets, isAgentSession } from './group';
import { libraryPrompts, newPromptId, type PromptContext, type PromptEntry } from './prompts';

/** The newest running agent of a project, if any. */
export function projectAgent(
  list: readonly SessionInfo[],
  project: string,
): SessionInfo | undefined {
  return list.filter((s) => s.project === project && isAgentSession(s)).at(-1);
}

export function entryName(entry: PromptEntry): string {
  return entry.nameKey ? t(entry.nameKey) : entry.name;
}

/** Values for the placeholders of a prompt sent to an agent of `project`. */
export async function contextFor(project: string): Promise<PromptContext> {
  const name = workspace.projects.find((p) => p.path === project)?.name ?? basename(project);
  const result = await commands.gitBranches(project);
  const branches = result.status === 'ok' ? result.data : null;
  return {
    project: name,
    branch: branches?.branches.find((b) => b.current)?.name ?? null,
    main: branches?.main ?? null,
  };
}

/**
 * Queues a library prompt for each agent, filled in for the agent's own
 * project. Busy agents get it when they are done.
 */
export async function sendLibraryPrompt(
  entry: PromptEntry,
  targets: readonly SessionInfo[],
): Promise<void> {
  if (targets.length === 0) {
    const shortcut = shortcutOf('agents.start');
    notices.push(
      t('agents.noRunningSession', { shortcut: shortcut ? formatShortcut(shortcut) : '' }),
    );
    return;
  }
  const results = await Promise.all(
    targets.map(async (session) =>
      commands.queuePrompt(session.id, entry.render(await contextFor(session.project))),
    ),
  );
  const queued = results.filter((result) => result.status === 'ok').length;
  notices.push(t('prompts.queued', { name: entryName(entry), count: queued }), 'info');
}

/** Sends a prompt to the active project's agent. */
export function sendToProject(entry: PromptEntry, project: string): Promise<void> {
  const agent = projectAgent(sessions.list, project);
  return sendLibraryPrompt(entry, agent ? [agent] : []);
}

/** Sends a prompt to the agents of every project in a group. */
export function sendToGroup(entry: PromptEntry, group: string): Promise<void> {
  return sendLibraryPrompt(entry, broadcastTargets(workspace.projects, group, sessions.list));
}

/** Picker items: each prompt for the project, and for its group if it has one. */
export function promptItems(
  entries: readonly PromptEntry[],
  project: Project,
  query: string,
): PaletteItem[] {
  return entries.flatMap((entry) => {
    const name = entryName(entry);
    const match = fuzzyMatch(query, name);
    if (!match) return [];
    const items: PaletteItem[] = [
      {
        id: `prompt:${entry.id}`,
        label: segments(name, match.indices),
        detail: [{ text: t('prompts.toAgent'), match: false }],
        hint: entry.builtIn ? t('prompts.builtIn') : undefined,
        run: () => sendToProject(entry, project.path),
      },
    ];
    if (project.group) {
      const group = project.group;
      items.push({
        id: `prompt-group:${entry.id}`,
        label: segments(name, match.indices),
        detail: [{ text: t('prompts.toGroup', { group }), match: false }],
        hint: entry.builtIn ? t('prompts.builtIn') : undefined,
        run: () => sendToGroup(entry, group),
      });
    }
    return items;
  });
}

/** Opens the prompt library for the active project. */
export function openPromptPicker(project: Project): void {
  palette.open({
    label: t('prompts.pickerLabel'),
    placeholder: t('prompts.pickerPlaceholder'),
    empty: t('prompts.pickerEmpty'),
    source: (query) => promptItems(libraryPrompts(settings.value.prompts), project, query),
  });
}

/** Saves text as a new user prompt, named after its first line. */
export async function saveToLibrary(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const prompts = settings.value.prompts;
  const name = trimmed.split('\n')[0]?.slice(0, 60) ?? '';
  const id = newPromptId(prompts.map((p) => p.id));
  await settings.update({ prompts: [...prompts, { id, name, text: trimmed }] });
  notices.push(t('prompts.saved', { name }), 'info');
}
