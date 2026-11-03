import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Package, SessionInfo } from '$lib/ipc/types';

let stored: Package[] = [];

function agent(id: number, title: string): SessionInfo {
  return {
    id,
    project: '/p',
    profile: 'claude',
    title,
    pid: null,
    startedAt: 0,
    status: { state: 'running' },
    state: 'idle',
    attention: null,
    queue: [],
    prompts: 0,
    intensity: 1,
    dirs: [],
  };
}

const queuePrompt = vi.fn(async (_id: number, _text: string) => ({
  status: 'ok' as const,
  data: null,
}));
const start = vi.fn(async (_profile: string, _resume: boolean) => agent(7, 'Codex'));
const push = vi.fn();

vi.mock('$lib/ipc/bindings', () => ({
  commands: {
    listPackages: async (project: string) => stored.filter((p) => p.project === project),
    savePackage: async (entry: Package) => {
      stored = [...stored.filter((p) => p.id !== entry.id), entry];
      return { status: 'ok', data: null };
    },
    deletePackage: async (id: string) => {
      stored = stored.filter((p) => p.id !== id);
      return { status: 'ok', data: null };
    },
    queuePrompt: (id: number, text: string) => queuePrompt(id, text),
    gitBranches: async () => ({ status: 'error', error: { kind: 'notARepository' } }),
  },
}));
vi.mock('$lib/stores/settings.svelte', () => ({ settings: { value: { templates: [] } } }));
vi.mock('$lib/stores/notices.svelte', () => ({ notices: { push } }));
vi.mock('$lib/stores/workspace.svelte', () => ({
  workspace: { projects: [{ path: '/p', name: 'proj' }] },
}));
vi.mock('$lib/project/session', () => ({
  sessionFor: () => ({ terminals: { start } }),
}));
vi.mock('$lib/terminal/sessions.svelte', () => ({
  sessions: { list: [], find: (id: number) => (id === 7 ? agent(7, 'Codex') : undefined) },
}));

const { board, emptyPackage } = await import('./board.svelte');

describe('board', () => {
  beforeEach(() => {
    stored = [];
    vi.clearAllMocks();
  });

  it('saves, lists per column and deletes packages', async () => {
    await board.load('/p');
    const item = { ...emptyPackage('/p', 'task'), title: 'First' };
    await board.save(item);
    expect(board.column('open').map((p) => p.title)).toEqual(['First']);

    await board.setState(item, 'done');
    expect(board.column('open')).toEqual([]);
    expect(stored[0]?.state).toBe('done');

    await board.remove(item);
    expect(board.packages).toEqual([]);
    expect(stored).toEqual([]);
  });

  it('sends the prompt to a running agent and marks the package started', async () => {
    await board.load('/p');
    const item = {
      ...emptyPackage('/p', 'task'),
      title: 'Fix login',
      fields: { ticket: 'AME-1' },
    };
    await board.save(item);
    await board.send(item, { session: agent(3, 'Claude Code') });

    expect(queuePrompt).toHaveBeenCalledWith(3, 'Fix login\n\nTicket: AME-1');
    const sent = board.packages[0];
    expect(sent?.state).toBe('started');
    expect(sent?.agent).toBe('Claude Code');
    expect(sent?.startedAt).not.toBeNull();
  });

  it('starts a new agent for a package and remembers the session', async () => {
    await board.load('/p');
    const item = { ...emptyPackage('/p', 'task'), title: 'Write docs' };
    await board.save(item);
    await board.send(item, { profile: 'codex', resume: false });

    expect(start).toHaveBeenCalledWith('codex', false);
    expect(queuePrompt).toHaveBeenCalledWith(7, 'Write docs');
    const sent = board.packages[0];
    expect(sent && board.sessionOf(sent)?.id).toBe(7);
  });
});
