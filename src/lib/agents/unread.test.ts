import { describe, expect, it } from 'vitest';
import type { AgentState } from '$lib/ipc/bindings';
import type { SessionInfo } from '$lib/ipc/types';
import { hasNewResult, nextUnread, unread } from './unread.svelte';

function session(id: number, state: AgentState, profile = 'claude'): SessionInfo {
  return {
    id,
    project: '/p',
    profile,
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

describe('hasNewResult', () => {
  it('counts finished work, questions and errors', () => {
    expect(hasNewResult('working', 'idle')).toBe(true);
    expect(hasNewResult('working', 'needsInput')).toBe(true);
    expect(hasNewResult('idle', 'error')).toBe(true);
    expect(hasNewResult('starting', 'idle')).toBe(false);
    expect(hasNewResult('idle', 'idle')).toBe(false);
  });
});

describe('unread', () => {
  it('ignores script runs', () => {
    unread.update([session(9, 'working', 'script:build')], null);
    unread.update([session(9, 'exited', 'script:build')], null);
    expect(unread.has(9)).toBe(false);
  });

  it('marks results the user does not look at, until they do', () => {
    unread.update([session(1, 'working'), session(2, 'working')], 2);
    unread.update([session(1, 'idle'), session(2, 'idle')], 2);
    expect(unread.has(1)).toBe(true);
    expect(unread.has(2)).toBe(false);
    unread.update([session(1, 'idle'), session(2, 'idle')], 1);
    expect(unread.has(1)).toBe(false);
  });

  it('keeps a session marked unread by hand while it stays shown', () => {
    unread.update([session(3, 'idle')], 3);
    unread.markUnread(3);
    unread.update([session(3, 'idle')], 3);
    expect(unread.has(3)).toBe(true);
    unread.update([session(3, 'idle')], null);
    expect(unread.has(3)).toBe(true);
    unread.update([session(3, 'idle')], 3);
    expect(unread.has(3)).toBe(false);
  });

  it('forgets closed sessions', () => {
    unread.update([session(4, 'working')], null);
    unread.update([session(4, 'needsInput')], null);
    expect(unread.has(4)).toBe(true);
    unread.update([], null);
    expect(unread.has(4)).toBe(false);
  });
});

describe('nextUnread', () => {
  it('goes to the next unread session after the current one', () => {
    const list = [session(5, 'idle'), session(6, 'idle'), session(7, 'idle')];
    unread.update(list, null);
    unread.markUnread(5);
    unread.markUnread(7);
    expect(nextUnread(list, 6)?.id).toBe(7);
    expect(nextUnread(list, 7)?.id).toBe(5);
    expect(nextUnread(list, undefined)?.id).toBe(5);
  });
});
