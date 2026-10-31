import { commands, type AppError } from '$lib/ipc/bindings';
import { describeError, type GitStatus } from '$lib/ipc/types';
import { notices } from '$lib/stores/notices.svelte';
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

  /** A git command is running (stage, commit, …). */
  busy = $state(false);

  stage(paths: string[]): Promise<boolean> {
    return this.#run(() => commands.gitStage(this.project, paths));
  }

  unstage(paths: string[]): Promise<boolean> {
    return this.#run(() => commands.gitUnstage(this.project, paths));
  }

  commit(message: string): Promise<boolean> {
    return this.#run(() => commands.gitCommit(this.project, message));
  }

  /** Runs a git command, reports errors, and refreshes the status. */
  async #run(
    action: () => Promise<{ status: 'ok' } | { status: 'error'; error: AppError }>,
  ): Promise<boolean> {
    this.busy = true;
    try {
      const result = await action();
      if (result.status === 'error') notices.push(describeError(result.error));
      return result.status === 'ok';
    } finally {
      this.busy = false;
      await this.refresh();
    }
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
