import { describe, expect, it } from 'vitest';
import type { AgentState } from '$lib/ipc/bindings';
import type { SessionInfo } from '$lib/ipc/types';
import { trayModel } from './tray';

function session(id: number, state: AgentState): SessionInfo {
  return {
    id,
    project: '/p/ame',
    profile: 'claude',
    title: 'Claude Code',
    pid: 1,
    startedAt: 0,
    status: { state: 'running' },
    state,
    attention: null,
    queue: [],
    prompts: 0,
    intensity: 1,
    dirs: [],
  };
}

const name = (path: string) => path.split('/').pop() ?? path;

describe('trayModel', () => {
  it('lists sessions most urgent first and counts waiting agents', () => {
    const model = trayModel(
      [session(1, 'idle'), session(2, 'needsInput'), session(3, 'working')],
      name,
      null,
    );
    expect(model.sessions.map((s) => s.id)).toEqual([2, 3, 1]);
    expect(model.sessions[0]?.label).toBe('Claude Code · ame — Needs your input');
    expect(model.tooltip).toBe('Ame — 1 waiting for you');
    expect(model.icon).toBeNull();
  });

  it('counts working agents when none waits', () => {
    expect(trayModel([session(1, 'working')], name, null).tooltip).toBe('Ame — 1 working');
    expect(trayModel([], name, null).tooltip).toBe('Ame');
  });
});
