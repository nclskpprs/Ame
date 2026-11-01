import { sessionFor } from '$lib/project/session';
import { view } from '$lib/stores/view.svelte';
import { workspace } from '$lib/stores/workspace.svelte';

/** Opens a session's project and shows the session in the terminal panel. */
export function showSession(project: string, id: number): void {
  const terminals = sessionFor(project).terminals;
  terminals.activate(id);
  terminals.show();
  view.close(false);
  void workspace.activate(project);
}
