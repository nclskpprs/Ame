import { describe, expect, it, vi } from 'vitest';
import type { Project, SessionInfo } from '$lib/ipc/types';

vi.mock('$lib/ipc/bindings', () => ({ commands: {}, events: {} }));
vi.mock('$lib/stores/notices.svelte', () => ({ notices: { push: vi.fn() } }));
vi.mock('$lib/stores/settings.svelte', () => ({ settings: { value: { prompts: [] } } }));
vi.mock('$lib/stores/workspace.svelte', () => ({ workspace: { projects: [] } }));

const { projectAgent, promptItems } = await import('./library');
const { libraryPrompts } = await import('./prompts');

const session = (id: number, project: string, profile: string) =>
  ({ id, project, profile, status: { state: 'running' } }) as SessionInfo;

describe('prompt library sending', () => {
  it('picks the newest running agent of the project, not shells or scripts', () => {
    const list = [
      session(1, '/a', 'claude'),
      session(2, '/a', 'codex'),
      session(3, '/a', 'shell'),
      session(4, '/a', 'script:npm:dev'),
    ];
    expect(projectAgent(list, '/a')?.id).toBe(2);
    expect(projectAgent(list, '/c')).toBeUndefined();
  });

  it('offers each prompt for the project and, in a group, for the group', () => {
    const entries = libraryPrompts([{ id: 'p1', name: 'Write tests', text: 'Add tests' }]);
    const grouped = { path: '/a', name: 'a', group: 'client' } as Project;
    const single = { path: '/b', name: 'b', group: null } as Project;
    expect(promptItems(entries, grouped, '').map((i) => i.id)).toEqual([
      'prompt:builtin:cleanUpBranches',
      'prompt-group:builtin:cleanUpBranches',
      'prompt:p1',
      'prompt-group:p1',
    ]);
    expect(promptItems(entries, single, 'tests').map((i) => i.id)).toEqual(['prompt:p1']);
  });
});
