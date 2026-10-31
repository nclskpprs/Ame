import { SHELL_PROFILE } from '$lib/agents/agents.svelte';
import { t } from '$lib/i18n';
import { commands } from '$lib/ipc/bindings';
import { describeError, type SessionInfo } from '$lib/ipc/types';
import { notices } from '$lib/stores/notices.svelte';
import { workspace } from '$lib/stores/workspace.svelte';
import { isRunning, sessions } from '$lib/terminal/sessions.svelte';

/** Size for sessions started before a terminal view has measured itself. */
const DEFAULT_SIZE = { cols: 120, rows: 30 };

/** The terminal sessions of one project and its terminal panel. */
export class TerminalGroup {
  readonly project: string;
  #activeId = $state<number | null>(null);
  /** The visible terminal should take the focus once it is ready. */
  focusPending = $state(false);
  /** A running session waiting for "stop / cancel" before it closes. */
  pendingClose = $state<number | null>(null);
  /** Size of the terminal view, used for new sessions. */
  size = { ...DEFAULT_SIZE };

  constructor(project: string) {
    this.project = project;
  }

  get sessions(): SessionInfo[] {
    return sessions.forProject(this.project);
  }

  /** The session shown in the panel: the chosen one, else the newest. */
  get active(): SessionInfo | null {
    const list = this.sessions;
    return list.find((s) => s.id === this.#activeId) ?? list.at(-1) ?? null;
  }

  get open(): boolean {
    return workspace.projects.find((p) => p.path === this.project)?.layout.terminalOpen ?? false;
  }

  activate(id: number): void {
    this.#activeId = id;
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

  /** Starts an agent profile; `resume` continues its last conversation. */
  async start(profile: string, resume = false): Promise<void> {
    const { cols, rows } = this.size;
    const result = await commands.startSession(this.project, profile, resume, cols, rows);
    if (result.status === 'error') {
      notices.push(t('terminal.startFailed', { message: describeError(result.error) }));
      return;
    }
    sessions.upsert(result.data);
    this.activate(result.data.id);
    this.show();
  }

  /** Closes a session. A running one asks first unless `force` is set. */
  async close(id: number, force = false): Promise<void> {
    const session = sessions.find(id);
    if (!session) return;
    if (isRunning(session) && !force) {
      this.pendingClose = id;
      this.#activeId = id;
      return;
    }
    if (this.pendingClose === id) this.pendingClose = null;
    const list = this.sessions;
    const index = list.findIndex((s) => s.id === id);
    const result = await commands.closeSession(id);
    if (result.status === 'error' && result.error.kind !== 'unknownSession') {
      notices.push(describeError(result.error));
    }
    sessions.remove(id);
    if (this.#activeId === id || this.active === null) {
      const next = list[index + 1] ?? list[index - 1];
      if (next) this.activate(next.id);
      else this.#activeId = null;
    }
  }

  startShell(): Promise<void> {
    return this.start(SHELL_PROFILE);
  }

  /** Replaces an exited session with a new one of the same profile. */
  async restart(id: number, resume = false): Promise<void> {
    const profile = sessions.find(id)?.profile ?? SHELL_PROFILE;
    await this.close(id, true);
    await this.start(profile, resume);
  }
}
