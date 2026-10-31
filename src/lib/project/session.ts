import { commands, events } from '$lib/ipc/bindings';
import { describeError } from '$lib/ipc/types';
import { notices } from '$lib/stores/notices.svelte';
import { workspace } from '$lib/stores/workspace.svelte';
import { EditorGroup } from './editors.svelte';
import { FileTreeState } from './file-tree.svelte';
import { SearchState } from './search.svelte';
import { TerminalGroup } from './terminals.svelte';

/**
 * Runtime state of an open project (file tree, editors, terminals). Kept while the app runs, so switching projects is instant.
 */
export class ProjectSession {
  readonly path: string;
  readonly tree: FileTreeState;
  readonly editors: EditorGroup;
  readonly search: SearchState;
  readonly terminals: TerminalGroup;
  #watched = '';

  constructor(path: string) {
    this.path = path;
    const layout = workspace.projects.find((p) => p.path === path)?.layout;
    this.tree = new FileTreeState(path, layout?.expandedDirs ?? [], () => {
      workspace.updateLayout(path, { expandedDirs: [...this.tree.expanded] });
      this.syncWatches();
    });
    this.editors = new EditorGroup(path, layout, () => {
      workspace.updateLayout(path, this.editors.layout());
      this.syncWatches();
    });
    this.search = new SearchState(path);
    this.terminals = new TerminalGroup(path);
    void this.tree.init().then(() => this.syncWatches());
  }

  /** Opens a file in the editor and reveals it in the tree. */
  async openFile(path: string): Promise<void> {
    await Promise.all([this.editors.open(path), this.tree.reveal(path)]);
  }

  /** Opens a file and selects a range on a line (columns in UTF-16 units). */
  async openLocation(path: string, line: number, from: number, to: number): Promise<void> {
    await this.editors.reveal(path, line, from, to);
  }

  /** Tells the backend which directories to watch, if the set changed. */
  syncWatches(): void {
    const dirs = [...this.tree.watchedDirs(), ...this.editors.watchedDirs()]
      .filter((dir, index, all) => all.indexOf(dir) === index)
      .sort();
    const key = dirs.join('\n');
    if (key === this.#watched) return;
    this.#watched = key;
    void commands.watchDirs(this.path, dirs).then((result) => {
      if (result.status === 'error') notices.push(describeError(result.error));
    });
  }

  onFsChanged(paths: readonly string[]): void {
    void this.tree.refresh(paths);
    void this.editors.onFsChanged(paths);
  }
}

const sessions = new Map<string, ProjectSession>();

/** The session of the active project, if any. */
export function activeSession(): ProjectSession | null {
  const path = workspace.activePath;
  return path ? sessionFor(path) : null;
}

/** The session of a project if it was created already (does not create one). */
export function existingSession(path: string): ProjectSession | undefined {
  return sessions.get(path);
}

export function allSessions(): ProjectSession[] {
  return [...sessions.values()];
}

export function sessionFor(path: string): ProjectSession {
  let session = sessions.get(path);
  if (!session) {
    session = new ProjectSession(path);
    sessions.set(path, session);
  }
  return session;
}

/** Drops sessions of projects that are no longer open. */
export function pruneSessions(openPaths: readonly string[]): void {
  for (const path of sessions.keys()) {
    if (!openPaths.includes(path)) sessions.delete(path);
  }
}

/** Routes file change events from the backend to the sessions. */
export function listenToFileChanges(): Promise<() => void> {
  return events.fsChanged.listen((event) => {
    sessions.get(event.payload.project)?.onFsChanged(event.payload.paths);
  });
}
