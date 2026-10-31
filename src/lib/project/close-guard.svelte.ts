import { getCurrentWindow } from '@tauri-apps/api/window';
import type { SessionInfo } from '$lib/ipc/types';
import { workspace } from '$lib/stores/workspace.svelte';
import { isRunning, sessions as terminals } from '$lib/terminal/sessions.svelte';
import type { OpenFile } from './editors.svelte';
import { allSessions, existingSession, type ProjectSession } from './session';

/** Closing the app or a project, held back because of unsaved files or running agents. */
export type CloseRequest = { kind: 'app' } | { kind: 'project'; path: string };

interface Unsaved {
  session: ProjectSession;
  files: OpenFile[];
}

/**
 * Keeps work from being lost: closing a project or the window with dirty
 * tabs or running terminal sessions shows an inline bar (save all / discard
 * / cancel) instead.
 */
class CloseGuard {
  request = $state<CloseRequest | null>(null);
  #quitting = false;

  /** Unsaved tabs that the current request would discard. */
  get unsaved(): Unsaved[] {
    const request = this.request;
    if (!request) return [];
    const sessions =
      request.kind === 'app' ? allSessions() : [existingSession(request.path)].filter(isSession);
    return sessions
      .map((session) => ({ session, files: session.editors.dirtyFiles }))
      .filter((entry) => entry.files.length > 0);
  }

  /** Running sessions that the current request would stop. */
  get running(): SessionInfo[] {
    const request = this.request;
    if (!request) return [];
    const list = request.kind === 'app' ? terminals.list : terminals.forProject(request.path);
    return list.filter(isRunning);
  }

  /** Closes a project, or asks first if it has unsaved files or running sessions. */
  async closeProject(path: string): Promise<void> {
    const running = terminals.forProject(path).some(isRunning);
    if (running || existingSession(path)?.editors.dirtyFiles.length) {
      this.request = { kind: 'project', path };
      return;
    }
    await workspace.remove(path);
  }

  /** Called when the window is about to close; returns whether to keep it open. */
  holdQuit(): boolean {
    if (this.#quitting) return false;
    const dirty = allSessions().some((session) => session.editors.dirtyFiles.length > 0);
    if (!dirty && !terminals.list.some(isRunning)) return false;
    this.request = { kind: 'app' };
    return true;
  }

  /** Saves every affected file, then closes if all saves succeeded. */
  async saveAndClose(): Promise<void> {
    const results = await Promise.all(this.unsaved.map(({ session }) => session.editors.saveAll()));
    // A failed save shows a notice and keeps the bar open.
    if (results.every(Boolean)) await this.discardAndClose();
  }

  async discardAndClose(): Promise<void> {
    const request = this.request;
    this.request = null;
    if (!request) return;
    if (request.kind === 'project') {
      await workspace.remove(request.path);
    } else {
      this.#quitting = true;
      await workspace.flushLayouts();
      await getCurrentWindow().destroy();
    }
  }

  cancel(): void {
    this.request = null;
  }
}

function isSession(session: ProjectSession | undefined): session is ProjectSession {
  return session !== undefined;
}

export const closeGuard = new CloseGuard();
