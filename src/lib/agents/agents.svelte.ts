import { commands } from '$lib/ipc/bindings';
import type { AgentInfo } from '$lib/ipc/types';

export const SHELL_PROFILE = 'shell';

/** Agent profiles and where their programs were found on the `PATH`. */
class AgentsStore {
  #list = $state.raw<AgentInfo[]>([]);

  get list(): readonly AgentInfo[] {
    return this.#list;
  }

  /** Looks at the `PATH` again, so newly installed agents show up. */
  async load(): Promise<readonly AgentInfo[]> {
    const result = await commands.listAgents();
    if (result.status === 'ok') this.#list = result.data;
    return this.#list;
  }

  find(id: string): AgentInfo | undefined {
    return this.#list.find((agent) => agent.profile.id === id);
  }
}

export const agents = new AgentsStore();

export function isInstalled(agent: AgentInfo): boolean {
  return agent.path !== null;
}

export function canResume(agent: AgentInfo): boolean {
  return agent.profile.resumeArgs.length > 0;
}

/** Installed agents first (in profile order), then the shell, then the rest. */
export function orderedAgents(list: readonly AgentInfo[]): AgentInfo[] {
  const rank = (agent: AgentInfo) =>
    agent.profile.id === SHELL_PROFILE ? 1 : isInstalled(agent) ? 0 : 2;
  return list
    .map((agent, index) => ({ agent, index }))
    .sort((a, b) => rank(a.agent) - rank(b.agent) || a.index - b.index)
    .map(({ agent }) => agent);
}
