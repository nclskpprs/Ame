import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { commands, type DirEntry } from '$lib/ipc/bindings';
import { describeError } from '$lib/ipc/types';
import { ancestors, dirname, isWithin, movedPath } from '$lib/fs/paths';

export type Children =
  | { status: 'loading' }
  | { status: 'loaded'; entries: DirEntry[] }
  | { status: 'error'; message: string };

/**
 * A file operation waiting for input in the file tree: a path for a new
 * entry or a move, or the confirmation to move an entry to the trash.
 */
export type TreeEdit =
  | { kind: 'newFile' | 'newFolder'; value: string }
  | { kind: 'move'; path: string; value: string }
  | { kind: 'trash'; path: string; isDir: boolean };

/** File operations of the project a tree belongs to (see `ProjectSession`). */
export interface FileOps {
  createEntry(path: string, kind: 'file' | 'dir'): Promise<boolean>;
  moveEntry(from: string, to: string): Promise<boolean>;
  trashEntry(path: string): Promise<boolean>;
}

export interface TreeRow {
  entry: DirEntry;
  depth: number;
  expanded: boolean;
  /** Excluded by `.gitignore`, itself or through a parent folder. */
  ignored: boolean;
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
  /** The file operation waiting for input, if any. */
  edit = $state<TreeEdit | null>(null);
  #onChange: () => void;
  #showIgnored: () => boolean;

  /**
   * `onChange` is called when the expanded directories change;
   * `showIgnored` tells whether files excluded by `.gitignore` are listed.
   */
  constructor(
    project: string,
    expanded: readonly string[],
    onChange: () => void,
    showIgnored: () => boolean = () => false,
  ) {
    this.project = project;
    this.expanded = new SvelteSet(expanded);
    this.#onChange = onChange;
    this.#showIgnored = showIgnored;
  }

  /** Lists every loaded directory again, e.g. after a setting changed. */
  async reloadAll(): Promise<void> {
    await Promise.all([...this.children.keys()].map((dir) => this.load(dir)));
  }

  /** Loads the root and the restored expanded directories. */
  async init(): Promise<void> {
    await Promise.all(['', ...this.expanded].map((dir) => this.load(dir)));
  }

  async load(dir: string): Promise<void> {
    if (!this.children.has(dir)) this.children.set(dir, { status: 'loading' });
    const result = await commands.readDir(this.project, dir, this.#showIgnored());
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

  /** The folder a new entry goes into: the selected folder, or its parent. */
  targetDir(): string {
    const selected = this.selected;
    if (selected === null) return '';
    const isDir = this.rows().some(
      (row) => row.entry.path === selected && row.entry.kind === 'dir',
    );
    return isDir ? selected : dirname(selected);
  }

  /** Asks for the path of a new file or folder in the target folder. */
  startNew(kind: 'newFile' | 'newFolder'): void {
    const dir = this.targetDir();
    this.edit = { kind, value: dir ? `${dir}/` : '' };
  }

  /** Asks where to move (or how to rename) an entry. */
  startMove(path: string): void {
    this.edit = { kind: 'move', path, value: path };
  }

  /** Asks to confirm moving an entry to the trash. */
  startTrash(path: string): void {
    const isDir = this.rows().some((row) => row.entry.path === path && row.entry.kind === 'dir');
    this.edit = { kind: 'trash', path, isDir };
  }

  /** Keeps expanded folders and the selection after a move. */
  moved(from: string, to: string): void {
    const expanded = [...this.expanded];
    for (const dir of expanded) {
      const next = movedPath(dir, from, to);
      if (next === null) continue;
      this.expanded.delete(dir);
      this.expanded.add(next);
    }
    for (const dir of [...this.children.keys()]) {
      if (movedPath(dir, from, to) !== null) this.children.delete(dir);
    }
    if (this.selected !== null) this.selected = movedPath(this.selected, from, to) ?? this.selected;
    this.#onChange();
    for (const dir of this.expanded) {
      if (!this.children.has(dir) && isWithin(dir, to)) void this.load(dir);
    }
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
    const visit = (dir: string, depth: number, parentIgnored: boolean) => {
      const children = this.children.get(dir);
      if (children?.status !== 'loaded') return;
      for (const entry of children.entries) {
        const expanded = entry.kind === 'dir' && this.expanded.has(entry.path);
        const ignored = parentIgnored || entry.ignored;
        rows.push({ entry, depth, expanded, ignored });
        if (expanded) visit(entry.path, depth + 1, ignored);
      }
    };
    visit('', 0, false);
    return rows;
  }
}
