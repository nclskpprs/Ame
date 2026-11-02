import { describe, expect, it, vi } from 'vitest';
import type { DirEntry } from '$lib/ipc/bindings';

const listings: Record<string, DirEntry[]> = {
  '': [
    { name: 'node_modules', path: 'node_modules', kind: 'dir', ignored: true },
    { name: 'src', path: 'src', kind: 'dir', ignored: false },
  ],
  node_modules: [{ name: 'a.js', path: 'node_modules/a.js', kind: 'file', ignored: false }],
  src: [{ name: 'main.ts', path: 'src/main.ts', kind: 'file', ignored: false }],
};
const readDir = vi.fn(async (_project: string, dir: string, _showIgnored: boolean) => ({
  status: 'ok' as const,
  data: listings[dir] ?? [],
}));

vi.mock('$lib/ipc/bindings', () => ({
  commands: {
    readDir: (project: string, dir: string, showIgnored: boolean) =>
      readDir(project, dir, showIgnored),
  },
}));

const { FileTreeState } = await import('./file-tree.svelte');

describe('FileTreeState', () => {
  it('asks for ignored files only when they are shown', async () => {
    let show = false;
    const tree = new FileTreeState(
      '/p',
      [],
      () => {},
      () => show,
    );
    await tree.init();
    expect(readDir).toHaveBeenLastCalledWith('/p', '', false);
    show = true;
    await tree.reloadAll();
    expect(readDir).toHaveBeenLastCalledWith('/p', '', true);
  });

  it('dims everything inside an ignored folder', async () => {
    const tree = new FileTreeState('/p', ['node_modules', 'src'], () => {});
    await tree.init();
    expect(tree.rows().map((row) => [row.entry.path, row.ignored])).toEqual([
      ['node_modules', true],
      ['node_modules/a.js', true],
      ['src', false],
      ['src/main.ts', false],
    ]);
  });
});
