import { SvelteSet } from 'svelte/reactivity';
import type { AgentState } from '$lib/ipc/bindings';
import type { SessionInfo } from '$lib/ipc/types';

/**
 * Whether a state change means the agent has a result for the user: it
 * finished working, waits for input, or ended.
 */
export function hasNewResult(previous: AgentState, state: AgentState): boolean {
  if (previous === state) return false;
  if (state === 'needsInput' || state === 'error') return true;
  return (state === 'idle' || state === 'exited') && previous === 'working';
}

/**
 * Sessions with a result the user has not looked at yet. A result is read
 * once its session is shown in the terminal panel while the window has the
 * focus. It stays unread for hours if nobody looks, and can be marked
 * unread again by hand.
 */
class UnreadState {
  readonly #ids = new SvelteSet<number>();
  /** The last known state per session id (not rendered, so not reactive). */
  #states: Record<number, AgentState> = {};
  #shown: number | null = null;
  /** Marked unread by hand while shown; read again once it was left. */
  #kept: number | null = null;

  has(id: number): boolean {
    return this.#ids.has(id);
  }

  /** Whether any of the sessions is unread. */
  any(sessions: readonly SessionInfo[]): boolean {
    return sessions.some((session) => this.#ids.has(session.id));
  }

  /** The unread session ids, in the order of `sessions`. */
  among(sessions: readonly SessionInfo[]): SessionInfo[] {
    return sessions.filter((session) => this.#ids.has(session.id));
  }

  /**
   * Call whenever the sessions or the shown session change. `shown` is the
   * session the user is looking at, or `null`.
   */
  update(list: readonly SessionInfo[], shown: number | null): void {
    const states: Record<number, AgentState> = {};
    for (const session of list) {
      states[session.id] = session.state;
      const previous = this.#states[session.id];
      if (previous !== undefined && hasNewResult(previous, session.state)) {
        this.#ids.add(session.id);
      }
    }
    for (const id of this.#ids) if (!(id in states)) this.#ids.delete(id);
    this.#states = states;

    if (shown !== this.#shown) {
      this.#shown = shown;
      this.#kept = null;
    }
    if (shown !== null && shown !== this.#kept) this.#ids.delete(shown);
  }

  markUnread(id: number): void {
    this.#ids.add(id);
    if (id === this.#shown) this.#kept = id;
  }

  markRead(id: number): void {
    this.#ids.delete(id);
    if (id === this.#kept) this.#kept = null;
  }
}

export const unread = new UnreadState();

/** The unread session after `current` in `list` order, wrapping around. */
export function nextUnread(
  list: readonly SessionInfo[],
  current: number | undefined,
): SessionInfo | undefined {
  const index = list.findIndex((session) => session.id === current);
  const ordered = [...list.slice(index + 1), ...list.slice(0, index + 1)];
  return ordered.find((session) => session.id !== current && unread.has(session.id));
}
