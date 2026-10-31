import { describe, expect, it, vi } from 'vitest';
import type { AgentInfo } from '$lib/ipc/types';
import { orderedAgents } from './agents.svelte';
import { agentChoices } from './picker';

function agent(id: string, path: string | null, resumeArgs: string[] = []): AgentInfo {
  return {
    profile: { id, name: id.toUpperCase(), command: id, args: [], env: {}, resumeArgs },
    path,
    builtin: true,
  };
}

const list = [
  agent('claude', null, ['--continue']),
  agent('codex', '/bin/codex', ['resume', '--last']),
  agent('aider', '/bin/aider'),
  agent('shell', '/bin/zsh'),
];

describe('orderedAgents', () => {
  it('lists installed agents, then the shell, then missing agents', () => {
    expect(orderedAgents(list).map((a) => a.profile.id)).toEqual([
      'codex',
      'aider',
      'shell',
      'claude',
    ]);
  });
});

describe('agentChoices', () => {
  it('offers resume only for installed agents that support it', () => {
    const start = vi.fn();
    const choices = agentChoices(list, start);
    expect(choices.map((c) => c.id)).toEqual([
      'start:codex',
      'resume:codex',
      'start:aider',
      'start:shell',
      'start:claude',
    ]);
    choices[1]?.run();
    expect(start).toHaveBeenCalledWith('codex', true);
    choices[0]?.run();
    expect(start).toHaveBeenCalledWith('codex', false);
  });
});
