import type { CloseAction } from '$lib/ipc/bindings';

/** What closing the window does: hide it, ask first, or close the app. */
export type CloseDecision = 'hide' | 'guard' | 'close';

/**
 * With running agents and the `background` setting, the window only hides
 * and the agents keep working. Otherwise the close guard decides (unsaved
 * files, running agents), and without anything to lose the app closes.
 */
export function closeDecision(
  action: CloseAction,
  agentsRunning: boolean,
  held: () => boolean,
): CloseDecision {
  if (action === 'background' && agentsRunning) return 'hide';
  return held() ? 'guard' : 'close';
}
