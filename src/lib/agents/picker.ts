import { t } from '$lib/i18n';
import type { AgentInfo } from '$lib/ipc/types';
import { fuzzyMatch } from '$lib/palette/fuzzy';
import { segments } from '$lib/palette/highlight';
import { palette, type PaletteItem, type PaletteSource } from '$lib/palette/palette.svelte';
import type { TerminalGroup } from '$lib/project/terminals.svelte';
import { agents, canResume, isInstalled, orderedAgents } from './agents.svelte';

interface Choice {
  id: string;
  title: string;
  detail: string;
  run: () => unknown;
}

/** Start and resume entries for every profile, installed agents first. */
export function agentChoices(
  list: readonly AgentInfo[],
  start: (profile: string, resume: boolean) => unknown,
): Choice[] {
  return orderedAgents(list).flatMap((agent) => {
    const { id, name } = agent.profile;
    const detail = agent.path ?? t('agents.notInstalled');
    const choices: Choice[] = [
      { id: `start:${id}`, title: name, detail, run: () => start(id, false) },
    ];
    if (isInstalled(agent) && canResume(agent)) {
      choices.push({
        id: `resume:${id}`,
        title: t('agents.resume', { name }),
        detail,
        run: () => start(id, true),
      });
    }
    return choices;
  });
}

function agentSource(group: TerminalGroup, loaded: Promise<readonly AgentInfo[]>): PaletteSource {
  return async (query) => {
    const choices = agentChoices(await loaded, (profile, resume) => group.start(profile, resume));
    return choices.flatMap((choice): PaletteItem[] => {
      const match = fuzzyMatch(query, choice.title);
      if (!match) return [];
      return [
        {
          id: choice.id,
          label: segments(choice.title, match.indices),
          detail: [{ text: choice.detail, match: false }],
          run: choice.run,
        },
      ];
    });
  };
}

/** Opens the palette with the agents of a project. */
export function openAgentPicker(group: TerminalGroup): void {
  palette.open({
    label: t('agents.pickerLabel'),
    placeholder: t('agents.pickerPlaceholder'),
    empty: t('agents.pickerEmpty'),
    source: agentSource(group, agents.load()),
  });
}
