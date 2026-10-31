import { commands } from '$lib/ipc/bindings';
import { isRunning, sessions } from '$lib/terminal/sessions.svelte';
import { sumUsage, type Usage } from './usage';

/** How often the usage is fetched; the backend measures every two seconds. */
const INTERVAL_MS = 2000;

/**
 * Resource usage of the running sessions. Fetched only while the window is
 * visible and some session runs, so a hidden app does no extra work.
 */
class UsageState {
  #bySession = $state.raw(new Map<number, Usage>());

  forSession(id: number): Usage | null {
    return this.#bySession.get(id) ?? null;
  }

  /** The summed usage of a project's running sessions. */
  forProject(path: string): Usage | null {
    return sumUsage(
      sessions.forProject(path).flatMap((session) => this.#bySession.get(session.id) ?? []),
    );
  }

  /** Starts polling; returns a function that stops it. */
  start(): () => void {
    const tick = async () => {
      if (document.hidden || !sessions.list.some(isRunning)) {
        if (this.#bySession.size) this.#bySession = new Map();
        return;
      }
      const list = await commands.sessionUsage();
      this.#bySession = new Map(
        list.map((item) => [item.id, { cpu: item.cpu ?? 0, memory: item.memory ?? 0 }]),
      );
    };
    void tick();
    const timer = setInterval(() => void tick(), INTERVAL_MS);
    return () => clearInterval(timer);
  }
}

export const usage = new UsageState();
