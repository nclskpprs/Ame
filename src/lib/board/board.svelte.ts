import { SvelteMap } from 'svelte/reactivity';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { agentChoices } from '$lib/agents/picker';
import { agents } from '$lib/agents/agents.svelte';
import { isAgentSession } from '$lib/agents/group';
import { contextFor } from '$lib/agents/library';
import { stateLabels } from '$lib/agents/state';
import { t } from '$lib/i18n';
import { commands, type PackageState } from '$lib/ipc/bindings';
import { describeError, type Package, type SessionInfo } from '$lib/ipc/types';
import { fuzzyMatch } from '$lib/palette/fuzzy';
import { segments } from '$lib/palette/highlight';
import { palette, type PaletteItem } from '$lib/palette/palette.svelte';
import { sessionFor } from '$lib/project/session';
import { notices } from '$lib/stores/notices.svelte';
import { settings } from '$lib/stores/settings.svelte';
import { sessions } from '$lib/terminal/sessions.svelte';
import { boardTemplates, renderPackage, templateOf } from './templates';

/** Columns of the board, in order. */
export const COLUMNS: readonly PackageState[] = ['open', 'started', 'done'];

/** A new, empty package of `project`. */
export function emptyPackage(project: string, template: string): Package {
  return {
    id: crypto.randomUUID(),
    project,
    template,
    title: '',
    fields: {},
    state: 'open',
    createdAt: Date.now(),
    startedAt: null,
    agent: null,
  };
}

/** The packages of one project, as shown on its board. */
class BoardState {
  project = $state<string | null>(null);
  packages = $state<Package[]>([]);
  /** Package being edited (its id), or `'new'` for the form of a new one. */
  editing = $state<string | null>(null);
  /** Session each package was sent to, for this app run only. */
  readonly #sessions = new SvelteMap<string, number>();

  get templates() {
    return boardTemplates(settings.value.templates);
  }

  async load(project: string): Promise<void> {
    if (this.project !== null && this.project !== project) this.editing = null;
    this.project = project;
    const list = await commands.listPackages(project);
    if (this.project === project) this.packages = list;
  }

  column(state: PackageState): Package[] {
    return this.packages.filter((item) => item.state === state);
  }

  /** The prompt a package sends. */
  async prompt(item: Package): Promise<string> {
    const template = templateOf(this.templates, item.template);
    return renderPackage(template, item, await contextFor(item.project));
  }

  /** Adds or updates a package; shown at once, saved in the background. */
  async save(item: Package): Promise<boolean> {
    const index = this.packages.findIndex((other) => other.id === item.id);
    this.packages = index === -1 ? [...this.packages, item] : this.packages.with(index, item);
    const result = await commands.savePackage(item);
    if (result.status === 'error') {
      notices.push(t('board.saveFailed', { message: describeError(result.error) }));
      await this.load(item.project);
      return false;
    }
    return true;
  }

  setState(item: Package, state: PackageState): Promise<boolean> {
    return this.save({ ...item, state });
  }

  async remove(item: Package): Promise<void> {
    this.packages = this.packages.filter((other) => other.id !== item.id);
    this.#sessions.delete(item.id);
    const result = await commands.deletePackage(item.id);
    if (result.status === 'error') {
      notices.push(t('board.saveFailed', { message: describeError(result.error) }));
      await this.load(item.project);
    }
  }

  /** The running session a package was sent to in this app run, if any. */
  sessionOf(item: Package): SessionInfo | undefined {
    const id = this.#sessions.get(item.id);
    return id === undefined ? undefined : sessions.find(id);
  }

  async copyPrompt(item: Package): Promise<void> {
    try {
      await writeText(await this.prompt(item));
      notices.push(t('board.promptCopied'), 'info');
    } catch (error) {
      notices.push(t('board.copyFailed', { message: String(error) }));
    }
  }

  /**
   * Sends a package to an agent: a running one of the project, or a new
   * one of `profile`. The prompt is queued, so a busy or starting agent gets
   * it as soon as it is ready.
   */
  async send(
    item: Package,
    target: { session: SessionInfo } | { profile: string; resume: boolean },
  ) {
    const session =
      'session' in target
        ? target.session
        : await sessionFor(item.project).terminals.start(target.profile, target.resume);
    if (!session) return;
    const result = await commands.queuePrompt(session.id, await this.prompt(item));
    if (result.status === 'error') {
      notices.push(t('board.sendFailed', { message: describeError(result.error) }));
      return;
    }
    this.#sessions.set(item.id, session.id);
    await this.save({ ...item, state: 'started', startedAt: Date.now(), agent: session.title });
    notices.push(t('board.sent', { title: item.title, agent: session.title }), 'info');
  }

  /** Opens the palette to pick the agent a package goes to. */
  pickAgent(item: Package): void {
    const loaded = agents.load();
    palette.open({
      label: t('board.pickerLabel', { title: item.title }),
      placeholder: t('board.pickerPlaceholder'),
      empty: t('agents.pickerEmpty'),
      source: async (query) => {
        const running = sessions.list.filter(
          (session) => session.project === item.project && isAgentSession(session),
        );
        const sendItems = running.flatMap((session): PaletteItem[] => {
          const title = t('board.sendTo', { agent: session.title });
          const match = fuzzyMatch(query, title);
          if (!match) return [];
          return [
            {
              id: `session:${session.id}`,
              label: segments(title, match.indices),
              detail: [{ text: t(stateLabels[session.state]), match: false }],
              run: () => this.send(item, { session }),
            },
          ];
        });
        const startItems = agentChoices(await loaded, (profile, resume) =>
          this.send(item, { profile, resume }),
        ).flatMap((choice): PaletteItem[] => {
          const title = t('board.startAgent', { agent: choice.title });
          const match = fuzzyMatch(query, title);
          if (!match) return [];
          return [
            {
              id: choice.id,
              label: segments(title, match.indices),
              detail: [{ text: choice.detail, match: false }],
              run: choice.run,
            },
          ];
        });
        return [...sendItems, ...startItems];
      },
    });
  }
}

export const board = new BoardState();
