import { commands, events } from '$lib/ipc/bindings';
import { describeError } from '$lib/ipc/types';
import { notices } from '$lib/stores/notices.svelte';
import { workspace } from '$lib/stores/workspace.svelte';
import { FileTreeState } from './file-tree.svelte';

/**
 * Runtime state of an open project (file tree, later editors and
 * terminals). Kept while the app runs, so switching projects is instant.
 */
export class ProjectSession {
  readonly path: string;
  readonly tree: FileTreeState;
  #watched = '';

  constructor(path: string) {
    this.path = path;
    const layout = workspace.projects.find((p) => p.path === path)?.layout;
    this.tree = new FileTreeState(path, layout?.expandedDirs ?? [], () => {
      workspace.updateLayout(path, { expandedDirs: [...this.tree.expanded] });
      this.syncWatches();
    });
    void this.tree.init().then(() => this.syncWatches());
  }

  /** Tells the backend which directories to watch, if the set changed. */
  syncWatches(): void {
    const dirs = [...new Set(this.tree.watchedDirs())].sort();
    const key = dirs.join('\n');
    if (key === this.#watched) return;
    this.#watched = key;
    void commands.watchDirs(this.path, dirs).then((result) => {
      if (result.status === 'error') notices.push(describeError(result.error));
    });
  }

  onFsChanged(paths: readonly string[]): void {
    void this.tree.refresh(paths);
  }
}

const sessions = new Map<string, ProjectSession>();

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
