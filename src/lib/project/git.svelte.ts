import { commands } from '$lib/ipc/bindings';
import type { GitStatus } from '$lib/ipc/types';
import { treeMarks, type GitMark } from '$lib/git/marks';

/** Delay that merges bursts of refresh requests (saves, file events). */
const REFRESH_DELAY_MS = 300;

/** Git status of one project; `status` is `null` outside a repository. */
export class GitState {
  readonly project: string;
  status = $state.raw<GitStatus | null>(null);
  readonly marks: Map<string, GitMark> = $derived(treeMarks(this.status?.files ?? []));
  #timer: ReturnType<typeof setTimeout> | undefined;
  #running = false;
  #again = false;

  constructor(project: string) {
    this.project = project;
  }

  /** Refreshes after a short delay; repeated calls are merged. */
  refreshSoon(delay = REFRESH_DELAY_MS): void {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => void this.refresh(), delay);
  }

  /** Runs `git status` now; a request during a run is queued once. */
  async refresh(): Promise<void> {
    if (this.#running) {
      this.#again = true;
      return;
    }
    this.#running = true;
    try {
      const result = await commands.gitStatus(this.project);
      // Errors (e.g. a broken repository) keep the last known status.
      if (result.status === 'ok') this.status = result.data;
    } finally {
      this.#running = false;
      if (this.#again) {
        this.#again = false;
        this.refreshSoon();
      }
    }
  }
}
