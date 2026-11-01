import { t } from '$lib/i18n';
import { commands } from '$lib/ipc/bindings';
import type { AgentInfo, Project, SessionInfo } from '$lib/ipc/types';
import { fuzzyMatch } from '$lib/palette/fuzzy';
import { segments } from '$lib/palette/highlight';
import { palette, type PaletteItem } from '$lib/palette/palette.svelte';
import { isScript, type TerminalGroup } from '$lib/project/terminals.svelte';
import { notices } from '$lib/stores/notices.svelte';
import { isRunning } from '$lib/terminal/sessions.svelte';
import { SHELL_PROFILE, agents, isInstalled, orderedAgents } from './agents.svelte';

/** Paths of the other projects in the group of `project` (none without a group). */
export function groupFolders(projects: readonly Project[], project: string): string[] {
  const group = projects.find((p) => p.path === project)?.group;
  if (!group) return [];
  return projects.filter((p) => p.group === group && p.path !== project).map((p) => p.path);
}

/** Installed agents that can be given other folders. */
export function groupAgents(list: readonly AgentInfo[]): AgentInfo[] {
  return orderedAgents(list).filter(
    (agent) => isInstalled(agent) && Boolean(agent.profile.addDirArg?.trim()),
  );
}

/** An agent session (not the shell, not a script) that still runs. */
export function isAgentSession(session: SessionInfo): boolean {
  return isRunning(session) && session.profile !== SHELL_PROFILE && !isScript(session.profile);
}

/**
 * The agent of each project in a group that receives a broadcast prompt:
 * the newest running agent session per project.
 */
export function broadcastTargets(
  projects: readonly Project[],
  group: string,
  sessions: readonly SessionInfo[],
): SessionInfo[] {
  return projects
    .filter((project) => project.group === group)
    .flatMap((project) => {
      const newest = sessions
        .filter((session) => session.project === project.path && isAgentSession(session))
        .at(-1);
      return newest ? [newest] : [];
    });
}

/** Picks an agent that starts in `terminals`' project with the group's other folders. */
export function openGroupAgentPicker(
  terminals: TerminalGroup,
  dirs: string[],
  group: string,
): void {
  const loaded = agents.load();
  palette.open({
    label: t('groups.pickerLabel', { group }),
    placeholder: t('groups.pickerPlaceholder', { count: dirs.length }),
    empty: t('groups.pickerEmpty'),
    source: async (query) => {
      const list = groupAgents(await loaded);
      return list.flatMap((agent): PaletteItem[] => {
        const match = fuzzyMatch(query, agent.profile.name);
        if (!match) return [];
        return [
          {
            id: `group:${agent.profile.id}`,
            label: segments(agent.profile.name, match.indices),
            detail: [{ text: agent.path ?? '', match: false }],
            run: () => terminals.start(agent.profile.id, false, dirs),
          },
        ];
      });
    },
  });
}

/** Queues a prompt for every target; returns how many accepted it. */
export async function broadcast(targets: readonly SessionInfo[], text: string): Promise<number> {
  const results = await Promise.all(targets.map((s) => commands.queuePrompt(s.id, text)));
  return results.filter((result) => result.status === 'ok').length;
}

/** Asks for a prompt and queues it for the agents of a group. */
export function openBroadcast(group: string, targets: () => SessionInfo[]): void {
  palette.open({
    label: t('groups.broadcastLabel', { group }),
    placeholder: t('groups.broadcastPlaceholder', { count: targets().length }),
    empty: t('groups.broadcastEmpty'),
    source: (query) => {
      const text = query.trim();
      const list = targets();
      if (!text || list.length === 0) return [];
      return [
        {
          id: 'broadcast',
          label: [{ text: t('groups.broadcastItem', { count: list.length }), match: false }],
          detail: [{ text, match: false }],
          run: async () => {
            const sent = await broadcast(list, text);
            notices.push(t('groups.broadcastDone', { count: sent, group }), 'info');
          },
        },
      ];
    },
  });
}
