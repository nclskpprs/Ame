import { commands, type AppError } from '$lib/ipc/bindings';
import { describeError, type GitStatus } from '$lib/ipc/types';
import { notices } from '$lib/stores/notices.svelte';
import { treeMarks, type GitMark } from '$lib/git/marks';
import {
  NO_RECENT,
  RECENT_MS,
  changedFiles,
  modificationTimes,
  updateRecent,
  withFolders,
  type Recent,
} from '$lib/git/recent';

/** Delay that merges bursts of refresh requests (saves, file events). */
const REFRESH_DELAY_MS = 300;

/** Git status of one project; `status` is `null` outside a repository. */
export class GitState {
  readonly project: string;
  status = $state.raw<GitStatus | null>(null);
  readonly marks: ReadonlyMap<string, GitMark> = $derived(treeMarks(this.status?.files ?? []));
  /** Files changed on disk recently (path → when it was noticed). */
  recent = $state.raw<Recent>(NO_RECENT);
  /** Recently changed files and the folders that contain them. */
  readonly recentMarks: ReadonlySet<string> = $derived(withFolders(this.recent));
  /** Changes to ignore (e.g. files the editor just saved itself). */
  ignore: (path: string) => boolean = () => false;
  /** Called with files that changed on disk since the last status. */
  onChange: ((paths: string[]) => void) | null = null;
  #mtimes: Map<string, number> | null = null;
  #expireTimer: ReturnType<typeof setTimeout> | undefined;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #running = false;
  #again = false;

  constructor(project: string) {
    this.project = project;
  }

  #noticeChanges(): void {
    const files = this.status?.files ?? [];
    const changed = changedFiles(this.#mtimes, files).filter((path) => !this.ignore(path));
    this.#mtimes = modificationTimes(files);
    const updated = updateRecent(this.recent, changed, Date.now());
    if (updated) this.recent = updated;
    if (this.recent.size) {
      clearTimeout(this.#expireTimer);
      this.#expireTimer = setTimeout(() => this.#noticeChanges(), RECENT_MS);
    }
    if (changed.length) this.onChange?.(changed);
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
      if (result.status === 'ok') {
        this.status = result.data;
        this.#noticeChanges();
      }
    } finally {
      this.#running = false;
      if (this.#again) {
        this.#again = false;
        this.refreshSoon();
      }
    }
  }
}
