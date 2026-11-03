import { SHELL_PROFILE } from '$lib/agents/agents.svelte';
import { t } from '$lib/i18n';
import { commands } from '$lib/ipc/bindings';
import type { SavedSession_Serialize as SavedSession } from '$lib/ipc/bindings';
import { describeError, type SessionInfo } from '$lib/ipc/types';
import { notices } from '$lib/stores/notices.svelte';
import { workspace } from '$lib/stores/workspace.svelte';
import { isRunning, sessions } from '$lib/terminal/sessions.svelte';

/** Profile ids of script sessions (see `scripts/mod.rs`). */
export const SCRIPT_PREFIX = 'script:';

export function isScript(profile: string): boolean {
  return profile.startsWith(SCRIPT_PREFIX);
}

/** Size for sessions started before a terminal view has measured itself. */
const DEFAULT_SIZE = { cols: 120, rows: 30 };

/** A session from the last run of the app that can be started again. */
export interface Restorable extends SavedSession {
  key: number;
}

/** The terminal sessions of one project and its terminal panel. */
export class TerminalGroup {
  readonly project: string;
  /** Session ids, most recently shown first. */
  #history = $state<number[]>([]);
  /** Index in `saved()` of the session shown when the app last ran. */
  readonly #savedActive: number | null;
  #restorable = $state<Restorable[]>([]);
  #selectedRestorable = $state<number | null>(null);
  /** The visible terminal should take the focus once it is ready. */
  focusPending = $state(false);
  /** A running session waiting for "stop / cancel" before it closes. */
  pendingClose = $state<number | null>(null);
  /** The preferred agent was started (or skipped) for this project. */
  #autoStartDone = false;
  /** The prompt queue composer is open for the shown session. */
  composing = $state(false);
  /** Size of the terminal view, used for new sessions. */
  size = { ...DEFAULT_SIZE };

  /**
   * `saved` are the sessions that were open when the app last ran,
   * `savedActive` the index of the one that was shown.
   */
  constructor(
    project: string,
    saved: readonly SavedSession[] = [],
    savedActive: number | null = null,
  ) {
    this.project = project;
    this.#restorable = saved.map((session, index) => ({ ...session, key: index + 1 }));
    this.#savedActive = savedActive;
  }

  get sessions(): SessionInfo[] {
    return sessions.forProject(this.project);
  }

  /**
   * Sessions of the last run that were not started again yet. Empty when
   * the backend still runs sessions of this project (the web view was only
   * reloaded), and until the sessions are loaded.
   */
  get restorable(): Restorable[] {
    const initial = sessions.initial;
    if (initial === null || initial.some((s) => s.project === this.project)) return [];
    return this.#restorable;
  }

  /** The previous session shown in the panel instead of a terminal, if any. */
  get selectedRestorable(): Restorable | null {
    const list = this.restorable;
    const selected = list.find((r) => r.key === this.#selectedRestorable);
    if (selected) return selected;
    if (this.sessions.length > 0) return null;
    return list.find((r) => r.key === (this.#savedActive ?? 0) + 1) ?? list[0] ?? null;
  }

  /**
   * The session shown in the panel: the one used last, else the one shown
   * when the app last ran (after a reload of the web view), else the newest.
   */
  get active(): SessionInfo | null {
    if (this.selectedRestorable) return null;
    const list = this.sessions;
    for (const id of this.#history) {
      const session = list.find((s) => s.id === id);
      if (session) return session;
    }
    if (this.#savedActive !== null && this.restorable.length === 0) {
      const remembered = list.filter((s) => !isScript(s.profile))[this.#savedActive];
      if (remembered) return remembered;
    }
    return list.at(-1) ?? null;
  }

  /** Index in `saved()` of the shown session or previous session. */
  savedActive(): number | null {
    const restorable = this.restorable;
    const selected = this.selectedRestorable;
    if (selected) return restorable.indexOf(selected);
    const active = this.active;
    if (!active || isScript(active.profile)) return null;
    const index = this.sessions.filter((s) => !isScript(s.profile)).indexOf(active);
    return index < 0 ? null : restorable.length + index;
  }

  /**
   * What to remember for the next start: previous and current sessions.
   * Scripts are not restored; they are started again from the scripts panel.
   */
  saved(): SavedSession[] {
    return [
      ...this.restorable.map(({ profile, title, dirs }) => ({ profile, title, dirs })),
      ...this.sessions
        .filter((session) => !isScript(session.profile))
        .map(({ profile, title, dirs }) => ({ profile, title, dirs })),
    ];
  }

  selectRestorable(key: number): void {
    this.#selectedRestorable = key;
  }

  dismissRestorable(key: number): void {
    this.#restorable = this.#restorable.filter((r) => r.key !== key);
    if (this.#selectedRestorable === key) this.#selectedRestorable = null;
  }

  /** Starts a previous session again; `resume` continues its conversation. */
  async restore(key: number, resume: boolean): Promise<void> {
    const entry = this.#restorable.find((r) => r.key === key);
    if (!entry) return;
    this.dismissRestorable(key);
    await this.start(entry.profile, resume, entry.dirs ?? []);
  }

  get open(): boolean {
    return workspace.projects.find((p) => p.path === this.project)?.layout.terminalOpen ?? false;
  }

  activate(id: number): void {
    this.#remember(id);
    this.#selectedRestorable = null;
    this.focusPending = true;
  }

  /** Moves to the next (1) or previous (-1) session. */
  cycle(offset: number): void {
    const list = this.sessions;
    const index = list.findIndex((s) => s.id === this.active?.id);
    const next = list[(index + offset + list.length) % list.length];
    if (next) this.activate(next.id);
  }

  show(focus = true): void {
    if (!this.open) workspace.updateLayout(this.project, { terminalOpen: true });
    if (focus) this.focusPending = true;
  }

  hide(): void {
    workspace.updateLayout(this.project, { terminalOpen: false });
  }

  toggle(): void {
    if (this.open) this.hide();
    else this.show();
  }

  /**
   * Starts an agent profile (`resume` continues its last conversation;
   * `dirs` are other projects it gets, for a group) or, for a `script:`
   * profile, runs that script. Returns the new session, or `null` if it
   * could not be started (the user was told why).
   */
  async start(profile: string, resume = false, dirs: string[] = []): Promise<SessionInfo | null> {
    const { cols, rows } = this.size;
    const result = isScript(profile)
      ? await commands.runScript(this.project, profile.slice(SCRIPT_PREFIX.length), cols, rows)
      : await commands.startSession(this.project, profile, resume, dirs, cols, rows);
    if (result.status === 'error') {
      notices.push(t('terminal.startFailed', { message: describeError(result.error) }));
      return null;
    }
    sessions.upsert(result.data);
    this.activate(result.data.id);
    this.show();
    return result.data;
  }

  /** Closes a session. A running one asks first unless `force` is set. */
  async close(id: number, force = false): Promise<void> {
    const session = sessions.find(id);
    if (!session) return;
    if (isRunning(session) && !force) {
      this.pendingClose = id;
      this.#remember(id);
      return;
    }
    if (this.pendingClose === id) this.pendingClose = null;
    const list = this.sessions;
    const index = list.findIndex((s) => s.id === id);
    const result = await commands.closeSession(id);
    if (result.status === 'error' && result.error.kind !== 'unknownSession') {
      notices.push(describeError(result.error));
    }
    const wasActive = this.active?.id === id;
    this.#history = this.#history.filter((other) => other !== id);
    sessions.remove(id);
    if (!wasActive && this.active !== null) return;
    // Back to the session used before, else a neighbor.
    const remaining = this.sessions;
    const previous = this.#history.find((other) => remaining.some((s) => s.id === other));
    const next = previous ?? list[index + 1]?.id ?? list[index - 1]?.id;
    if (next !== undefined) this.activate(next);
  }

  #remember(id: number): void {
    this.#history = [id, ...this.#history.filter((other) => other !== id)];
  }

  /**
   * Starts the preferred agent once per app run when the project is shown
   * and has neither sessions nor previous ones to resume. Returns whether
   * it started one. Call only after the sessions were loaded.
   */
  async autoStart(profile: string): Promise<boolean> {
    if (this.#autoStartDone || sessions.initial === null) return false;
    this.#autoStartDone = true;
    if (!profile || this.sessions.length > 0 || this.restorable.length > 0) return false;
    await this.start(profile);
    return true;
  }

  /** The running session of a script, if any. */
  scriptSession(id: string): SessionInfo | undefined {
    return this.sessions.find((s) => s.profile === SCRIPT_PREFIX + id && isRunning(s));
  }

  /** Runs a script, or shows it if it is running already. */
  async runScript(id: string): Promise<void> {
    const running = this.scriptSession(id);
    if (running) {
      this.activate(running.id);
      this.show();
      return;
    }
    await this.start(SCRIPT_PREFIX + id);
  }

  async startShell(): Promise<void> {
    await this.start(SHELL_PROFILE);
  }

  /** Replaces an exited session with a new one of the same profile. */
  async restart(id: number, resume = false): Promise<void> {
    const session = sessions.find(id);
    await this.close(id, true);
    await this.start(session?.profile ?? SHELL_PROFILE, resume, session?.dirs ?? []);
  }
}
