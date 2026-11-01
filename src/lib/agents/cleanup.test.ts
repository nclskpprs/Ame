import { describe, expect, it, vi } from 'vitest';
import type { SessionInfo } from '$lib/ipc/types';
import { projectAgent } from './cleanup';

vi.mock('$lib/ipc/bindings', () => ({ commands: {}, events: {} }));
vi.mock('$lib/stores/notices.svelte', () => ({ notices: { push: vi.fn() } }));

const session = (id: number, project: string, profile: string) =>
  ({ id, project, profile, status: { state: 'running' } }) as SessionInfo;

describe('projectAgent', () => {
  it('picks the newest running agent of the project, not shells or scripts', () => {
    const list = [
      session(1, '/a', 'claude'),
      session(2, '/a', 'codex'),
      session(3, '/a', 'shell'),
      session(4, '/a', 'script:npm:dev'),
      session(5, '/b', 'claude'),
    ];
    expect(projectAgent(list, '/a')?.id).toBe(2);
    expect(projectAgent(list, '/c')).toBeUndefined();
  });
});
