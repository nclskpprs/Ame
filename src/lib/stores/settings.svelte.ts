import { commands, type AppInfo } from '$lib/ipc/bindings';
import { describeError, type Settings } from '$lib/ipc/types';

/** User settings, loaded from and saved to the Rust backend. */
class SettingsState {
  #value = $state.raw<Settings | null>(null);
  #appInfo = $state.raw<AppInfo | null>(null);
  #saveError = $state<string | null>(null);

  /** The current settings. Only valid after `load()` has resolved. */
  get value(): Settings {
    if (!this.#value) throw new Error('settings are not loaded yet');
    return this.#value;
  }

  get appInfo(): AppInfo | null {
    return this.#appInfo;
  }

  /** The last save error as a technical message, or `null`. */
  get saveError(): string | null {
    return this.#saveError;
  }

  async load(): Promise<void> {
    const [settings, appInfo] = await Promise.all([commands.getSettings(), commands.getAppInfo()]);
    this.#value = settings;
    this.#appInfo = appInfo;
  }

  /** Applies the change immediately and rolls it back if saving fails. */
  async update(patch: Partial<Settings>): Promise<void> {
    const previous = this.value;
    const next = { ...previous, ...patch };
    this.#value = next;
    this.#saveError = null;

    const result = await commands.setSettings(next);
    if (result.status === 'error') {
      this.#value = previous;
      this.#saveError = describeError(result.error);
    }
  }
}

export const settings = new SettingsState();
