import { Channel } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { t } from '$lib/i18n';
import {
  commands,
  type UpdateInfo_Serialize as UpdateInfo,
  type UpdateProgress_Deserialize,
  type UpdateSupport,
} from '$lib/ipc/bindings';
import { describeError } from '$lib/ipc/types';
import { notifier } from '$lib/notify/notifier';
import { notices } from '$lib/stores/notices.svelte';

/** Page with the downloads of the newest release (see `update/mod.rs`). */
export const RELEASES_URL = 'https://github.com/nclskpprs/Ame/releases/latest';

/** The first automatic check waits until the start is over. */
export const FIRST_CHECK_MS = 10_000;
/** Automatic checks after that. */
export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Download progress in bytes; `total` is `null` when the size is unknown. */
export interface UpdateProgress {
  downloaded: number;
  total: number | null;
}

export type UpdatePhase = 'idle' | 'checking' | 'downloading' | 'installing';

/** Share of the download done, 0 to 1, or `null` when the size is unknown. */
export function progressShare(progress: UpdateProgress | null): number | null {
  if (!progress?.total) return null;
  return Math.min(1, progress.downloaded / progress.total);
}

/** Finds, announces and installs new versions of Ame (ADR 0026). */
class UpdateState {
  phase = $state<UpdatePhase>('idle');
  /** A newer version, once a check found one. */
  available = $state<UpdateInfo | null>(null);
  progress = $state<UpdateProgress | null>(null);
  support = $state<UpdateSupport>('download');
  /** Waiting for the user to accept that running sessions end. */
  confirming = $state(false);
  /** The user hid the notice for this version. */
  dismissed = $state<string | null>(null);
  #notified: string | null = null;
  #supportLoaded: Promise<void> | null = null;

  /** Whether the notice in the sidebar is shown. */
  get noticeShown(): boolean {
    return this.available !== null && this.dismissed !== this.available.version;
  }

  #loadSupport(): Promise<void> {
    this.#supportLoaded ??= commands.updateSupport().then((support) => {
      this.support = support;
    });
    return this.#supportLoaded;
  }

  /**
   * Asks for a newer version. `manual` checks report "up to date" and
   * errors; automatic ones stay silent unless they find something.
   */
  async check(manual = false): Promise<void> {
    if (this.phase !== 'idle') return;
    this.phase = 'checking';
    await this.#loadSupport();
    const result = await commands.checkUpdate();
    this.phase = 'idle';
    if (result.status === 'error') {
      if (manual) {
        notices.push(t('update.checkFailed', { message: describeError(result.error) }));
      }
      return;
    }
    this.available = result.data;
    if (!result.data) {
      if (manual) notices.push(t('update.upToDate'), 'info');
      return;
    }
    if (manual) this.dismissed = null;
    if (this.#notified !== result.data.version) {
      this.#notified = result.data.version;
      notifier.hint(
        t('update.notifyTitle', { version: result.data.version }),
        t('update.notifyBody'),
      );
    }
  }

  /**
   * Installs the update, or first shows the inline question when `running`
   * terminals or agents would end with the restart.
   */
  requestInstall(running: number): Promise<void> | void {
    this.dismissed = null;
    if (this.support === 'inApp' && running > 0 && !this.confirming) {
      this.confirming = true;
      return;
    }
    this.confirming = false;
    return this.install();
  }

  /** Downloads and installs the update; Ame restarts when it is done. */
  async install(): Promise<void> {
    if (!this.available || this.phase !== 'idle') return;
    if (this.support === 'download') {
      await this.openDownloads();
      return;
    }
    this.phase = 'downloading';
    this.progress = null;
    const channel = new Channel<UpdateProgress_Deserialize>();
    channel.onmessage = (message) => {
      const progress = { downloaded: message.downloaded ?? 0, total: message.total ?? null };
      this.progress = progress;
      if (progress.total !== null && progress.downloaded >= progress.total) {
        this.phase = 'installing';
      }
    };
    const result = await commands.installUpdate(channel);
    // On success Ame restarts and never gets here.
    this.phase = 'idle';
    if (result.status === 'error') {
      notices.push(t('update.installFailed', { message: describeError(result.error) }));
    }
  }

  async openDownloads(): Promise<void> {
    try {
      await openUrl(RELEASES_URL);
    } catch (error) {
      notices.push(t('update.openFailed', { message: String(error) }));
    }
  }

  dismiss(): void {
    if (this.available) this.dismissed = this.available.version;
  }

  /**
   * Checks shortly after the start and then every few hours while
   * `enabled()` is true. Returns a function that stops it.
   */
  schedule(enabled: () => boolean): () => void {
    const run = () => {
      if (enabled()) void this.check();
    };
    const first = setTimeout(run, FIRST_CHECK_MS);
    const interval = setInterval(run, CHECK_INTERVAL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }
}

export const updates = new UpdateState();
