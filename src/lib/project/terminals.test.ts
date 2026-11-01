import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionInfo } from '$lib/ipc/types';

let backend: SessionInfo[] = [];
let nextId = 10;

function info(id: number, project: string, profile: string): SessionInfo {
  return {
    id,
    project,
    profile,
    title: profile.toUpperCase(),
    pid: null,
    startedAt: 0,
    status: { state: 'running' },
    state: 'starting',
    attention: null,
    queue: [],
    prompts: 0,
    intensity: 1,
    dirs: [],
  };
}

const startSession = vi.fn(async (project: string, profile: string, _resume: boolean) => {
  const session = info(nextId++, project, profile);
  backend = [...backend, session];
  return { status: 'ok' as const, data: session };
});

const runScript = vi.fn(async (project: string, id: string) => {
  const session = info(nextId++, project, `script:${id}`);
  backend = [...backend, session];
  return { status: 'ok' as const, data: session };
});

vi.mock('$lib/ipc/bindings', () => ({
  commands: {
    runScript: (project: string, id: string) => runScript(project, id),
    listSessions: async () => backend,
    startSession: (project: string, profile: string, resume: boolean) =>
      startSession(project, profile, resume),
    closeSession: async () => ({ status: 'ok', data: null }),
  },
  events: { sessionsChanged: { listen: async () => () => {} } },
}));
vi.mock('$lib/stores/workspace.svelte', () => ({
  workspace: { projects: [], updateLayout: vi.fn() },
}));
vi.mock('$lib/stores/notices.svelte', () => ({ notices: { push: vi.fn() } }));

const { sessions } = await import('$lib/terminal/sessions.svelte');
const { TerminalGroup } = await import('./terminals.svelte');

const saved = [
  { profile: 'claude', title: 'Claude Code', dirs: [] },
  { profile: 'shell', title: 'Shell', dirs: [] },
];

describe('TerminalGroup restoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('offers previous sessions after a restart', async () => {
    backend = [];
    await sessions.load();
    const group = new TerminalGroup('/a', saved);
    expect(group.restorable.map((r) => r.profile)).toEqual(['claude', 'shell']);
    // With no live session, the first previous one is shown.
    expect(group.selectedRestorable?.profile).toBe('claude');
    expect(group.active).toBeNull();
    expect(group.saved()).toEqual(saved);
  });

  it('resumes a previous session and remembers the new one', async () => {
    const group = new TerminalGroup('/a', saved);
    const key = group.restorable[0]?.key ?? 0;
    await group.restore(key, true);
    expect(startSession).toHaveBeenCalledWith('/a', 'claude', true);
    expect(group.restorable.map((r) => r.profile)).toEqual(['shell']);
    expect(group.active?.profile).toBe('claude');
    expect(group.selectedRestorable).toBeNull();
    expect(group.saved().map((s) => s.profile)).toEqual(['shell', 'claude']);
  });

  it('dismisses previous sessions', () => {
    const group = new TerminalGroup('/b', saved);
    const key = group.restorable[1]?.key ?? 0;
    group.dismissRestorable(key);
    expect(group.restorable.map((r) => r.profile)).toEqual(['claude']);
  });
});

describe('TerminalGroup scripts', () => {
  it('runs a script once, shows it while it runs and does not restore it', async () => {
    backend = [];
    await sessions.load();
    const group = new TerminalGroup('/s');
    await group.runScript('pnpm:dev');
    expect(runScript).toHaveBeenCalledWith('/s', 'pnpm:dev');
    expect(group.active?.profile).toBe('script:pnpm:dev');
    await group.runScript('pnpm:dev');
    expect(runScript).toHaveBeenCalledTimes(1);
    expect(group.scriptSession('pnpm:dev')).toBeDefined();
    expect(group.saved()).toEqual([]);
  });
});
