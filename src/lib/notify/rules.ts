import type { AgentState } from '$lib/ipc/bindings';
import type { SessionInfo } from '$lib/ipc/types';

/** Why the user is notified about a session. */
export type NotifyReason = 'needsInput' | 'done' | 'error';

/** What the notifier remembers about a session between updates. */
export interface Tracked {
  state: AgentState;
  /** When the current working phase began (ms), `null` when not working. */
  workingSince: number | null;
}

/** Short tasks are not worth a "done" notification. */
export const DONE_AFTER_WORK_MS = 10_000;

/**
 * Decides whether a state change is worth a notification: an agent starts
 * waiting for input, fails, or finishes after working for a while. Sessions
 * seen for the first time never notify (e.g. after a reload).
 */
export function transition(
  previous: Tracked | undefined,
  session: SessionInfo,
  now: number,
): { tracked: Tracked; reason: NotifyReason | null } {
  const state = session.state;
  const workingSince =
    state === 'working' ? (previous?.state === 'working' ? previous.workingSince : now) : null;
  const tracked = { state, workingSince };
  if (!previous || previous.state === state) return { tracked, reason: null };

  if (state === 'needsInput') return { tracked, reason: 'needsInput' };
  if (state === 'error') return { tracked, reason: 'error' };
  const finished = state === 'idle' || state === 'exited';
  const workedLong =
    previous.state === 'working' &&
    previous.workingSince !== null &&
    now - previous.workingSince >= DONE_AFTER_WORK_MS;
  return { tracked, reason: finished && workedLong ? 'done' : null };
}
