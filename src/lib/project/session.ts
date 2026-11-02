import { commands, events } from '$lib/ipc/bindings';
import { describeError } from '$lib/ipc/types';
import { notices } from '$lib/stores/notices.svelte';
import { settings } from '$lib/stores/settings.svelte';
import { workspace } from '$lib/stores/workspace.svelte';
import { sessions as terminalSessions } from '$lib/terminal/sessions.svelte';
import { EditorGroup } from './editors.svelte';
import { FileTreeState } from './file-tree.svelte';
import { CheckpointState } from './checkpoints.svelte';
import { GitState } from './git.svelte';
import { ScriptState, touchesManifest } from './scripts.svelte';
import { newest } from '$lib/git/recent';
import { ancestors, isWithin } from '$lib/fs/paths';
import { t } from '$lib/i18n';
import { SearchState } from './search.svelte';
import { TerminalGroup } from './terminals.svelte';
import { WatchSet } from './watch-set';

/**
 * Runtime state of an open project (file tree, editors, terminals). Kept while the app runs, so switching projects is instant.
 */
export class ProjectSession {
  readonly path: string;
  readonly tree: FileTreeState;
  readonly editors: EditorGroup;
  readonly search: SearchState;
  readonly terminals: TerminalGroup;
  readonly git: GitState;
  readonly checkpoints: CheckpointState;
  readonly scripts: ScriptState;
  readonly #watched = new WatchSet();

  constructor(path: string) {
    this.path = path;
    const layout = workspace.projects.find((p) => p.path === path)?.layout;
    this.tree = new FileTreeState(
      path,
      layout?.expandedDirs ?? [],
      () => {
        workspace.updateLayout(path, { expandedDirs: [...this.tree.expanded] });
        this.syncWatches();
      },
      () => settings.value.showIgnored,
    );
    this.editors = new EditorGroup(path, layout, () => {
      workspace.updateLayout(path, this.editors.layout());
      this.syncWatches();
    });
    this.search = new SearchState(path);
    this.terminals = new TerminalGroup(path, layout?.sessions ?? [], layout?.activeSession ?? null);
    this.git = new GitState(path);
    this.git.ignore = (file) => this.editors.savedRecently(file);
    this.git.onChange = (paths) => this.#follow(paths);
    void this.git.refresh();
    this.scripts = new ScriptState(path);
    void this.scripts.refresh();
    this.checkpoints = new CheckpointState(path);
    this.checkpoints.onRestored = () => {
      this.git.refreshSoon(0);
      void this.editors.refreshDiffs();
    };
    void this.tree.init().then(() => this.syncWatches());
  }

  /** Opens a file in the editor and reveals it in the tree. */
  async openFile(path: string): Promise<void> {
    await Promise.all([this.editors.open(path), this.tree.reveal(path)]);
  }

  get following(): boolean {
    return workspace.projects.find((p) => p.path === this.path)?.layout.follow ?? false;
  }

  setFollowing(follow: boolean): void {
    workspace.updateLayout(this.path, { follow });
  }

  /** Follow mode: shows the newest changed file as a diff, keeping the focus. */
  #follow(paths: string[]): void {
    if (!this.following) return;
    const path = newest(paths, this.git.status?.files ?? []);
    if (!path) return;
    void this.editors.open(path, { focus: false }).then(() => this.editors.setDiff(path, true));
  }

  /** Opens a file with its changes against `HEAD` shown inline. */
  async openDiff(path: string): Promise<void> {
    await this.editors.open(path);
    await this.editors.setDiff(path, true);
  }

  /** Opens a file and selects a range on a line (columns in UTF-16 units). */
  async openLocation(path: string, line: number, from: number, to: number): Promise<void> {
    await this.editors.reveal(path, line, from, to);
  }

  /** Creates an empty file (and opens it) or a folder; returns success. */
  async createEntry(path: string, kind: 'file' | 'dir'): Promise<boolean> {
    const result = await commands.createEntry(this.path, path, kind);
    if (result.status === 'error') {
      notices.push(t('fileTree.createFailed', { message: describeError(result.error) }));
      return false;
    }
    await this.tree.refresh([path, ...ancestors(path).slice(1)]);
    if (kind === 'file') await this.openFile(path);
    else await this.tree.reveal(path);
    return true;
  }

  /** Moves or renames a file or folder; returns success. */
  async moveEntry(from: string, to: string): Promise<boolean> {
    if (from === to) return true;
    const result = await commands.moveEntry(this.path, from, to);
    if (result.status === 'error') {
      notices.push(t('fileTree.moveFailed', { message: describeError(result.error) }));
      return false;
    }
    this.tree.moved(from, to);
    this.editors.moved(from, to);
    await this.tree.refresh([from, to, ...ancestors(to).slice(1)]);
    await this.tree.reveal(to);
    this.syncWatches();
    this.git.refreshSoon();
    return true;
  }

  /** Moves a file or folder to the trash; returns success. */
  async trashEntry(path: string): Promise<boolean> {
    const result = await commands.trashEntry(this.path, path);
    if (result.status === 'error') {
      notices.push(t('fileTree.trashFailed', { message: describeError(result.error) }));
      return false;
    }
    if (this.tree.selected !== null && isWithin(this.tree.selected, path)) {
      this.tree.selected = null;
    }
    await this.tree.refresh([path]);
    void this.editors.onFsChanged(
      this.editors.files.map((f) => f.path).filter((f) => isWithin(f, path)),
    );
    this.git.refreshSoon();
    return true;
  }

  /** Tells the backend which directories to watch, if the set changed. */
  syncWatches(): void {
    const dirs = this.#watched.update([...this.tree.watchedDirs(), ...this.editors.watchedDirs()]);
    if (!dirs) return;
    void commands.watchDirs(this.path, dirs).then((result) => {
      if (result.status === 'error') notices.push(describeError(result.error));
    });
  }

  /**
   * Changes on disk (ADR 0024). Paths inside `.git` only mean that the git
   * state changed (a commit, checkout or staging).
   */
  onFsChanged(paths: readonly string[]): void {
    this.git.refreshSoon();
    const files = paths.filter((path) => path !== '.git' && !path.startsWith('.git/'));
    if (files.length === 0) return;
    void this.tree.refresh(files);
    void this.editors.onFsChanged(files);
    if (touchesManifest(files)) void this.scripts.refresh();
  }
}

const sessions = new Map<string, ProjectSession>();

/**
 * Remembers the open terminal sessions of every shown project in its layout,
 * so they can be resumed after a restart. Call from an effect: it reads the
 * reactive session lists.
 */
export function persistTerminalSessions(): void {
  for (const session of sessions.values()) {
    const saved = session.terminals.saved();
    const activeSession = session.terminals.savedActive();
    const layout = workspace.projects.find((p) => p.path === session.path)?.layout;
    if (
      layout &&
      (JSON.stringify(layout.sessions) !== JSON.stringify(saved) ||
        (layout.activeSession ?? null) !== activeSession)
    ) {
      workspace.updateLayout(session.path, { sessions: saved, activeSession });
    }
  }
}

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

const gitStates = new Map<string, string>();

/**
 * Refreshes the git status of projects whose agents are busy or just
 * changed state. On Linux the file watcher only sees visible folders
 * (ADR 0024), so agent changes elsewhere are picked up this way. Call
 * periodically.
 */
export function pollGit(): void {
  for (const session of sessions.values()) {
    const states = terminalSessions
      .forProject(session.path)
      .map((s) => s.state)
      .join(',');
    const busy = /working|starting|needsInput/.test(states);
    if (busy || gitStates.get(session.path) !== states) session.git.refreshSoon(0);
    gitStates.set(session.path, states);
  }
}

/** Routes file change events from the backend to the sessions. */
/** Refreshes the checkpoint list of a project when the backend took one. */
export function listenToCheckpoints(): Promise<() => void> {
  return events.checkpointsChanged.listen((event) => {
    void sessions.get(event.payload.project)?.checkpoints.refresh();
  });
}

export function listenToFileChanges(): Promise<() => void> {
  return events.fsChanged.listen((event) => {
    sessions.get(event.payload.project)?.onFsChanged(event.payload.paths);
  });
}
