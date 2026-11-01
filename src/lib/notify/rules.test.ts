import { describe, expect, it } from 'vitest';
import type { AgentState } from '$lib/ipc/bindings';
import type { SessionInfo } from '$lib/ipc/types';
import { DONE_AFTER_WORK_MS, transition, type Tracked } from './rules';

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
  };
}

/** Feeds a sequence of [time, state] and collects the reasons. */
function run(steps: [number, AgentState][]): (string | null)[] {
  let tracked: Tracked | undefined;
  return steps.map(([time, state]) => {
    const result = transition(tracked, session(state), time);
    tracked = result.tracked;
    return result.reason;
  });
}

describe('transition', () => {
  it('never notifies for a session seen for the first time', () => {
    expect(run([[0, 'needsInput']])).toEqual([null]);
  });

  it('notifies when input is needed or the agent fails', () => {
    expect(
      run([
        [0, 'working'],
        [1000, 'needsInput'],
        [2000, 'needsInput'],
        [3000, 'error'],
      ]),
    ).toEqual([null, 'needsInput', null, 'error']);
  });

  it('notifies "done" only after a longer working phase', () => {
    expect(
      run([
        [0, 'idle'],
        [1000, 'working'],
        [3000, 'idle'],
        [4000, 'working'],
        [4000 + DONE_AFTER_WORK_MS, 'working'],
        [5000 + DONE_AFTER_WORK_MS, 'idle'],
      ]),
    ).toEqual([null, null, null, null, null, 'done']);
  });
});
