import { shortcutOf } from '$lib/commands/registry';
import { formatShortcut } from '$lib/commands/shortcuts';
import { t } from '$lib/i18n';
import { commands } from '$lib/ipc/bindings';
import type { SessionInfo } from '$lib/ipc/types';
import { notices } from '$lib/stores/notices.svelte';
import { isAgentSession } from './group';
import { cleanUpBranchesPrompt } from './prompts';

/** The newest running agent of a project, if any. */
export function projectAgent(
  sessions: readonly SessionInfo[],
  project: string,
): SessionInfo | undefined {
  return sessions.filter((s) => s.project === project && isAgentSession(s)).at(-1);
}

/**
 * Queues the "clean up branches" prompt for each agent, naming the main
 * branch of its own project. Busy agents get it when they are done.
 */
export async function askToCleanUpBranches(targets: readonly SessionInfo[]): Promise<void> {
  if (targets.length === 0) {
    const shortcut = shortcutOf('agents.start');
    notices.push(
      t('agents.noRunningSession', { shortcut: shortcut ? formatShortcut(shortcut) : '' }),
    );
    return;
  }
  const results = await Promise.all(
    targets.map(async (session) => {
      const branches = await commands.gitBranches(session.project);
      const main = branches.status === 'ok' ? (branches.data?.main ?? null) : null;
      return commands.queuePrompt(session.id, cleanUpBranchesPrompt(main));
    }),
  );
  const queued = results.filter((result) => result.status === 'ok').length;
  notices.push(t('branches.cleanUpQueued', { count: queued }), 'info');
}
