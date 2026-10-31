import { commands, type AppError } from '$lib/ipc/bindings';
import {
  describeError,
  type Project,
  type ProjectLayout,
  type WorkspaceState,
} from '$lib/ipc/types';
import { notices } from './notices.svelte';

type Result<T> = { status: 'ok'; data: T } | { status: 'error'; error: AppError };

/** Delay before layout changes (tabs, panel sizes, …) are written to disk. */
const LAYOUT_SAVE_DELAY_MS = 500;

/** Open projects and the active one. The Rust backend is the source of truth. */
class WorkspaceStore {
  #projects = $state.raw<Project[]>([]);
  #active = $state<string | null>(null);
  #layoutTimers = new Map<string, ReturnType<typeof setTimeout>>();

  get projects(): readonly Project[] {
    return this.#projects;
  }

  get activePath(): string | null {
    return this.#active;
  }

  get active(): Project | null {
    return this.#projects.find((p) => p.path === this.#active) ?? null;
  }

  async load(): Promise<void> {
    this.#apply(await commands.getWorkspace());
  }

  /** Shows the folder picker and opens the chosen folder. */
  async openFolder(): Promise<void> {
    const path = await commands.pickFolder();
    if (path) await this.add(path);
  }

  async add(path: string): Promise<void> {
    this.#handle(await commands.addProject(path));
  }

  async remove(path: string): Promise<void> {
    void this.#flushLayout(path);
    this.#handle(await commands.removeProject(path));
  }

  async activate(path: string): Promise<void> {
    if (path === this.#active) return;
    this.#active = path;
    this.#handle(await commands.setActiveProject(path));
  }

  async setPinned(path: string, pinned: boolean): Promise<void> {
    this.#handle(await commands.setProjectPinned(path, pinned));
  }

  async setGroup(path: string, group: string | null): Promise<void> {
    this.#handle(await commands.setProjectGroup(path, group));
  }

  /**
   * Updates the layout of a project immediately in memory and saves it
   * shortly after, so dragging a splitter does not write on every frame.
   */
  updateLayout(path: string, change: Partial<ProjectLayout>): void {
    this.#projects = this.#projects.map((p) =>
      p.path === path ? { ...p, layout: { ...p.layout, ...change } } : p,
    );
    clearTimeout(this.#layoutTimers.get(path));
    this.#layoutTimers.set(
      path,
      setTimeout(() => void this.#flushLayout(path), LAYOUT_SAVE_DELAY_MS),
    );
  }

  /** Writes all pending layout changes now, e.g. before the app quits. */
  async flushLayouts(): Promise<void> {
    await Promise.all([...this.#layoutTimers.keys()].map((path) => this.#flushLayout(path)));
  }

  async #flushLayout(path: string): Promise<void> {
    const timer = this.#layoutTimers.get(path);
    if (timer === undefined) return;
    clearTimeout(timer);
    this.#layoutTimers.delete(path);
    const project = this.#projects.find((p) => p.path === path);
    if (!project) return;
    const result = await commands.setProjectLayout(path, project.layout);
    if (result.status === 'error') notices.push(describeError(result.error));
  }

  #handle(result: Result<WorkspaceState>): void {
    if (result.status === 'ok') this.#apply(result.data);
    else notices.push(describeError(result.error));
  }

  #apply(state: WorkspaceState): void {
    // Keep in-memory layouts that have not been saved yet.
    this.#projects = state.projects.map((p) =>
      this.#layoutTimers.has(p.path) ? (this.#projects.find((old) => old.path === p.path) ?? p) : p,
    );
    this.#active = state.active;
  }
}

export const workspace = new WorkspaceStore();
