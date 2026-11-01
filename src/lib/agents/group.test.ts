import { describe, expect, it, vi } from 'vitest';
import type { AgentInfo, Project, SessionInfo } from '$lib/ipc/types';
import { broadcastTargets, groupAgents, groupFolders } from './group';

vi.mock('$lib/ipc/bindings', () => ({ commands: {}, events: {} }));
vi.mock('$lib/stores/notices.svelte', () => ({ notices: { push: vi.fn() } }));

function project(path: string, group: string | null): Project {
  return { path, name: path, group, pinned: false, muted: false } as Project;
}

function session(id: number, projectPath: string, profile: string, running = true): SessionInfo {
  return {
    id,
    project: projectPath,
    profile,
    title: profile,
    pid: null,
    startedAt: 0,
    status: running ? { state: 'running' } : { state: 'exited', exitCode: 0, signal: null },
    state: 'idle',
    attention: null,
    queue: [],
    prompts: 0,
    intensity: 1,
    dirs: [],
  };
}

const projects = [project('/a', 'client'), project('/b', 'client'), project('/c', null)];

describe('project groups', () => {
  it('lists the other folders of a group', () => {
    expect(groupFolders(projects, '/a')).toEqual(['/b']);
    expect(groupFolders(projects, '/c')).toEqual([]);
  });

  it('offers installed agents with a folder option', () => {
    const agent = (id: string, addDirArg: string | null, path: string | null) =>
      ({ profile: { id, name: id, addDirArg }, path }) as unknown as AgentInfo;
    const list = [
      agent('claude', '--add-dir', '/bin/claude'),
      agent('aider', null, '/bin/aider'),
      agent('gemini', '--include-directories', null),
    ];
    expect(groupAgents(list).map((a) => a.profile.id)).toEqual(['claude']);
  });

  it('sends a broadcast to the newest running agent of each project', () => {
    const sessions = [
      session(1, '/a', 'claude'),
      session(2, '/a', 'codex'),
      session(3, '/a', 'shell'),
      session(4, '/b', 'claude', false),
      session(5, '/b', 'script:npm:dev'),
      session(6, '/c', 'claude'),
    ];
    expect(broadcastTargets(projects, 'client', sessions).map((s) => s.id)).toEqual([2]);
  });
});
