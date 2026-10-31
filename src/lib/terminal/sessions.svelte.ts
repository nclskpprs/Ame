import { commands, events } from '$lib/ipc/bindings';
import type { SessionInfo } from '$lib/ipc/types';

/** All terminal sessions of the app. The Rust backend is the source of truth. */
class SessionsStore {
  #list = $state.raw<SessionInfo[]>([]);

  get list(): readonly SessionInfo[] {
    return this.#list;
  }

  async load(): Promise<void> {
    this.#list = await commands.listSessions();
  }

  /** Follows session changes from the backend; returns a stop function. */
  listen(): Promise<() => void> {
    return events.sessionsChanged.listen((event) => {
      this.#list = event.payload.sessions;
    });
  }

  /** Applies a session the frontend just started, before the event arrives. */
  upsert(session: SessionInfo): void {
    const others = this.#list.filter((s) => s.id !== session.id);
    this.#list = [...others, session].sort((a, b) => a.id - b.id);
  }

  remove(id: number): void {
    this.#list = this.#list.filter((s) => s.id !== id);
  }

  forProject(project: string): SessionInfo[] {
    return this.#list.filter((s) => s.project === project);
  }

  find(id: number): SessionInfo | undefined {
    return this.#list.find((s) => s.id === id);
  }
}

export const sessions = new SessionsStore();

export function isRunning(session: SessionInfo): boolean {
  return session.status.state === 'running';
}
