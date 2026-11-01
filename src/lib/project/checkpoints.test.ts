import { describe, expect, it, vi } from 'vitest';
import { summarize } from './checkpoints.svelte';

vi.mock('$lib/ipc/bindings', () => ({ commands: {} }));
vi.mock('$lib/stores/notices.svelte', () => ({ notices: { push: vi.fn() } }));

describe('summarize', () => {
  it('counts what a restore does', () => {
    expect(
      summarize([
        { path: 'a', change: 'added' },
        { path: 'b', change: 'modified' },
        { path: 'c', change: 'modified' },
        { path: 'd', change: 'deleted' },
      ]),
    ).toEqual({ back: 1, changed: 2, removed: 1 });
  });
});
