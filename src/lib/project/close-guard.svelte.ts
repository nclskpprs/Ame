import { getCurrentWindow } from '@tauri-apps/api/window';
import { workspace } from '$lib/stores/workspace.svelte';
import type { OpenFile } from './editors.svelte';
import { allSessions, existingSession, type ProjectSession } from './session';

/** Closing the app or a project, held back because of unsaved files. */
export type CloseRequest = { kind: 'app' } | { kind: 'project'; path: string };

interface Unsaved {
  session: ProjectSession;
  files: OpenFile[];
}

/**
 * Keeps unsaved edits from being lost: closing a project or the window with
 * dirty tabs shows an inline bar (save all / discard / cancel) instead.
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

  /** Closes a project, or asks first if it has unsaved files. */
  async closeProject(path: string): Promise<void> {
    if (existingSession(path)?.editors.dirtyFiles.length) {
      this.request = { kind: 'project', path };
      return;
    }
    await workspace.remove(path);
  }

  /** Called when the window is about to close; returns whether to keep it open. */
  holdQuit(): boolean {
    if (this.#quitting) return false;
    if (!allSessions().some((session) => session.editors.dirtyFiles.length > 0)) return false;
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
