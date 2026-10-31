import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { commands, type DirEntry } from '$lib/ipc/bindings';
import { describeError } from '$lib/ipc/types';
import { ancestors, dirname, isWithin } from '$lib/fs/paths';

export type Children =
  | { status: 'loading' }
  | { status: 'loaded'; entries: DirEntry[] }
  | { status: 'error'; message: string };

export interface TreeRow {
  entry: DirEntry;
  depth: number;
  expanded: boolean;
}

/**
 * State of the lazy file tree of one project. Directories are listed only
 * when they are expanded; the root (`""`) is always loaded.
 */
export class FileTreeState {
  readonly project: string;
  readonly children = new SvelteMap<string, Children>();
  readonly expanded: SvelteSet<string>;
  selected = $state<string | null>(null);
  #onChange: () => void;

  /** `onChange` is called when the expanded directories change. */
  constructor(project: string, expanded: readonly string[], onChange: () => void) {
    this.project = project;
    this.expanded = new SvelteSet(expanded);
    this.#onChange = onChange;
  }

  /** Loads the root and the restored expanded directories. */
  async init(): Promise<void> {
    await Promise.all(['', ...this.expanded].map((dir) => this.load(dir)));
  }

  async load(dir: string): Promise<void> {
    if (!this.children.has(dir)) this.children.set(dir, { status: 'loading' });
    const result = await commands.readDir(this.project, dir);
    if (result.status === 'ok') {
      this.children.set(dir, { status: 'loaded', entries: result.data });
    } else if (dir !== '' && this.expanded.has(dir)) {
      // The directory is gone or unreadable: forget it.
      this.#collapse(dir);
      this.children.delete(dir);
    } else {
      this.children.set(dir, { status: 'error', message: describeError(result.error) });
    }
  }

  async toggle(dir: string): Promise<void> {
    if (this.expanded.has(dir)) {
      this.#collapse(dir);
    } else {
      await this.expand(dir);
    }
  }

  async expand(dir: string): Promise<void> {
    if (this.expanded.has(dir)) return;
    this.expanded.add(dir);
    this.#onChange();
    if (!this.children.has(dir)) await this.load(dir);
  }

  /** Expands all ancestors of `path` and selects it. */
  async reveal(path: string): Promise<void> {
    for (const dir of ancestors(path).slice(1)) await this.expand(dir);
    this.selected = path;
  }

  #collapse(dir: string): void {
    for (const other of [...this.expanded]) {
      if (isWithin(other, dir)) this.expanded.delete(other);
    }
    this.#onChange();
  }

  /** Directories whose changes the tree needs to hear about. */
  watchedDirs(): string[] {
    return ['', ...this.expanded];
  }

  /** Reloads the loaded directories affected by changed paths. */
  async refresh(changed: readonly string[]): Promise<void> {
    const dirs = changed
      .flatMap((path) => [dirname(path), path])
      .filter((dir, index, all) => this.children.has(dir) && all.indexOf(dir) === index);
    await Promise.all(dirs.map((dir) => this.load(dir)));
  }

  /** Visible rows in display order. */
  rows(): TreeRow[] {
    const rows: TreeRow[] = [];
    const visit = (dir: string, depth: number) => {
      const children = this.children.get(dir);
      if (children?.status !== 'loaded') return;
      for (const entry of children.entries) {
        const expanded = entry.kind === 'dir' && this.expanded.has(entry.path);
        rows.push({ entry, depth, expanded });
        if (expanded) visit(entry.path, depth + 1);
      }
    };
    visit('', 0);
    return rows;
  }
}
