import { shortcutOf } from '$lib/commands/registry';
import { formatShortcut } from '$lib/commands/shortcuts';
import { t } from '$lib/i18n';
import { commands, type AppError } from '$lib/ipc/bindings';
import { describeError, type SessionInfo } from '$lib/ipc/types';
import type { TerminalGroup } from '$lib/project/terminals.svelte';
import { notices } from '$lib/stores/notices.svelte';
import { isRunning } from '$lib/terminal/sessions.svelte';

/** Longest preview of a queued prompt, in characters. */
const PREVIEW_CHARS = 120;

/** The session a new queued prompt goes to: the running one shown in the panel. */
export function queueTarget(group: TerminalGroup): SessionInfo | null {
  const shown = group.active;
  return shown && isRunning(shown) ? shown : null;
}

/** Opens the queue composer for the running session shown in the panel. */
export function openQueueComposer(group: TerminalGroup): void {
  if (!queueTarget(group)) {
    const shortcut = shortcutOf('agents.start');
    notices.push(
      t('agents.noRunningSession', { shortcut: shortcut ? formatShortcut(shortcut) : '' }),
    );
    return;
  }
  // The composer takes the focus, not the terminal.
  group.show(false);
  group.composing = true;
}

/** One line for the list: the first non-empty line, shortened. */
export function promptPreview(text: string): string {
  const line =
    text
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l) ?? '';
  const more = line !== text.trim();
  if (line.length > PREVIEW_CHARS) return `${line.slice(0, PREVIEW_CHARS - 1)}…`;
  return more ? `${line} …` : line;
}

type Outcome = { status: 'ok'; data: unknown } | { status: 'error'; error: AppError };

async function run(call: Promise<Outcome>): Promise<boolean> {
  const result = await call;
  if (result.status === 'error') notices.push(describeError(result.error));
  return result.status === 'ok';
}

/** Queues a prompt; returns whether it was accepted. */
export function queuePrompt(session: SessionInfo, text: string): Promise<boolean> {
  return run(commands.queuePrompt(session.id, text));
}

export function removeQueuedPrompt(session: SessionInfo, prompt: number): Promise<boolean> {
  return run(commands.removeQueuedPrompt(session.id, prompt));
}

export function moveQueuedPrompt(
  session: SessionInfo,
  prompt: number,
  by: number,
): Promise<boolean> {
  return run(commands.moveQueuedPrompt(session.id, prompt, by));
}

export function clearPromptQueue(session: SessionInfo): Promise<boolean> {
  return run(commands.clearPromptQueue(session.id));
}
