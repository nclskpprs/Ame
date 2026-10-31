import { Image } from '@tauri-apps/api/image';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { waitingCount } from '$lib/agents/state';
import { t } from '$lib/i18n';
import type { SessionInfo } from '$lib/ipc/types';
import { palettes, type ThemeName } from '$lib/theme/tokens';
import { transition, type NotifyReason, type Tracked } from './rules';

export interface NotifyContext {
  /** Whether the user is looking at this session right now. */
  visible: (session: SessionInfo) => boolean;
  /** Whether notifications are on for the session's project. */
  enabled: (session: SessionInfo) => boolean;
  projectName: (path: string) => string;
  theme: ThemeName;
}

const isWindows = typeof navigator !== 'undefined' && /Windows/.test(navigator.userAgent);
const BADGE_SIZE = 16;

const titles: Record<NotifyReason, 'notify.needsInput' | 'notify.done' | 'notify.error'> = {
  needsInput: 'notify.needsInput',
  done: 'notify.done',
  error: 'notify.error',
};

/**
 * Sends OS notifications when an agent the user is not looking at starts
 * waiting, finishes a longer task or fails, and keeps the dock/taskbar badge
 * at the number of waiting agents.
 */
class Notifier {
  #tracked = new Map<number, Tracked>();
  #permission: Promise<boolean> | null = null;
  #badge = 0;

  update(list: readonly SessionInfo[], context: NotifyContext): void {
    const now = Date.now();
    const seen = new Set<number>();
    for (const session of list) {
      seen.add(session.id);
      const { tracked, reason } = transition(this.#tracked.get(session.id), session, now);
      this.#tracked.set(session.id, tracked);
      if (reason && context.enabled(session) && !context.visible(session)) {
        void this.#notify(session, reason, context);
      }
    }
    for (const id of [...this.#tracked.keys()]) {
      if (!seen.has(id)) this.#tracked.delete(id);
    }
    void this.#setBadge(waitingCount(list), context.theme);
  }

  async #notify(session: SessionInfo, reason: NotifyReason, context: NotifyContext) {
    if (!(await this.#allowed())) return;
    const project = context.projectName(session.project);
    sendNotification({
      title: t(titles[reason], { agent: session.title }),
      body: session.attention ? t('notify.body', { project, message: session.attention }) : project,
    });
  }

  #allowed(): Promise<boolean> {
    this.#permission ??= (async () =>
      (await isPermissionGranted()) || (await requestPermission()) === 'granted')().catch(
      () => false,
    );
    return this.#permission;
  }

  async #setBadge(count: number, theme: ThemeName) {
    if (count === this.#badge) return;
    this.#badge = count;
    const window = getCurrentWindow();
    try {
      if (isWindows)
        await window.setOverlayIcon(count ? await overlayIcon(count, theme) : undefined);
      else await window.setBadgeCount(count || undefined);
    } catch {
      // Not every platform or desktop environment supports badges.
    }
  }
}

/** A small amber badge with the count, for the Windows taskbar. */
async function overlayIcon(count: number, theme: ThemeName): Promise<Image> {
  const palette = palettes[theme];
  const canvas = new OffscreenCanvas(BADGE_SIZE, BADGE_SIZE);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('no 2d context');
  context.fillStyle = palette.needsInput;
  context.beginPath();
  context.arc(BADGE_SIZE / 2, BADGE_SIZE / 2, BADGE_SIZE / 2, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = palettes.dark.bg;
  context.font = 'bold 11px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(count > 9 ? '9+' : String(count), BADGE_SIZE / 2, BADGE_SIZE / 2 + 1);
  const pixels = context.getImageData(0, 0, BADGE_SIZE, BADGE_SIZE).data;
  return Image.new(new Uint8Array(pixels.buffer), BADGE_SIZE, BADGE_SIZE);
}

export const notifier = new Notifier();
