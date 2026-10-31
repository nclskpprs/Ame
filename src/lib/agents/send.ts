import { shortcutOf } from '$lib/commands/registry';
import { formatShortcut } from '$lib/commands/shortcuts';
import { t } from '$lib/i18n';
import { languageIdFor } from '$lib/editor/languages';
import { commands } from '$lib/ipc/bindings';
import { describeError } from '$lib/ipc/types';
import type { ProjectSession } from '$lib/project/session';
import { notices } from '$lib/stores/notices.svelte';
import { isRunning } from '$lib/terminal/sessions.svelte';

export interface CodeReference {
  path: string;
  fromLine: number;
  toLine: number;
  text: string;
}

/**
 * Text sent to an agent for a selection: `path:from-to` and the code in a
 * fence. Without a selection only the location is sent. It ends with a line
 * break, so the user can type the prompt right after it.
 */
export function formatReference({ path, fromLine, toLine, text }: CodeReference): string {
  const lines = fromLine === toLine ? `${fromLine}` : `${fromLine}-${toLine}`;
  const location = `${path}:${lines}`;
  if (!text) return `${location} `;
  const longestRun = Math.max(2, ...Array.from(text.matchAll(/`+/g), (m) => m[0].length));
  const fence = '`'.repeat(longestRun + 1);
  const body = text.endsWith('\n') ? text : `${text}\n`;
  return `${location}\n${fence}${languageIdFor(path) ?? ''}\n${body}${fence}\n`;
}

/**
 * Sends the editor selection (or the cursor line) to the agent shown in the
 * project's terminal panel, or else to its newest running session.
 */
export async function sendSelectionToAgent(session: ProjectSession): Promise<void> {
  const selection = session.editors.selection();
  if (!selection) return;
  const terminals = session.terminals;
  const shown = terminals.active;
  const target = shown && isRunning(shown) ? shown : terminals.sessions.filter(isRunning).at(-1);
  if (!target) {
    const shortcut = shortcutOf('agents.start');
    notices.push(
      t('agents.noRunningSession', { shortcut: shortcut ? formatShortcut(shortcut) : '' }),
    );
    return;
  }
  const result = await commands.pasteSession(target.id, formatReference(selection));
  if (result.status === 'error') {
    notices.push(describeError(result.error));
    return;
  }
  terminals.activate(target.id);
  terminals.show();
}
