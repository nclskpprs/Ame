import { describe, expect, it } from 'vitest';
import type { AgentState } from '$lib/ipc/bindings';
import type { SessionInfo } from '$lib/ipc/types';
import { combinedRain, combinedState, waitingCount } from './state';

function session(state: AgentState): SessionInfo {
  return {
    id: 1,
    project: '/p',
    profile: 'claude',
    title: 'Claude Code',
    pid: null,
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

describe('combinedState', () => {
  it('picks the most urgent state', () => {
    expect(combinedState([])).toBeNull();
    expect(combinedState([session('idle'), session('working')])).toBe('working');
    expect(combinedState([session('working'), session('needsInput')])).toBe('needsInput');
    expect(combinedState([session('exited'), session('error')])).toBe('error');
  });

  it('counts sessions that wait for the user', () => {
    expect(waitingCount([session('needsInput'), session('idle'), session('needsInput')])).toBe(2);
  });

  it('combines the rain of sessions', () => {
    expect(combinedRain([])).toEqual({ intensity: 1, prompts: 0 });
    const heavyIdle = { ...session('idle'), intensity: 3, prompts: 2 };
    const working = { ...session('working'), intensity: 2, prompts: 3 };
    expect(combinedRain([heavyIdle, working])).toEqual({ intensity: 2, prompts: 5 });
  });
});
