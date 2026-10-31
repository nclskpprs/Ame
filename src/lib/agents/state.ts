import type { AgentState } from '$lib/ipc/bindings';
import type { MessageKey } from '$lib/i18n';
import type { SessionInfo } from '$lib/ipc/types';

/** Most urgent first: what the user should look at. */
const URGENCY: readonly AgentState[] = [
  'needsInput',
  'error',
  'working',
  'starting',
  'idle',
  'exited',
];

/** The most urgent state among sessions, `null` without sessions. */
export function combinedState(sessions: readonly SessionInfo[]): AgentState | null {
  let best: AgentState | null = null;
  for (const session of sessions) {
    if (best === null || URGENCY.indexOf(session.state) < URGENCY.indexOf(best)) {
      best = session.state;
    }
  }
  return best;
}

/** Sessions that wait for the user. */
export function waitingCount(sessions: readonly SessionInfo[]): number {
  return sessions.filter((session) => session.state === 'needsInput').length;
}

export const stateLabels: Record<AgentState, MessageKey> = {
  starting: 'status.starting',
  working: 'status.working',
  needsInput: 'status.needsInput',
  idle: 'status.idle',
  exited: 'status.exited',
  error: 'status.error',
};
