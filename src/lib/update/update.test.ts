import { beforeEach, describe, expect, it, vi } from 'vitest';

type CheckResult =
  | { status: 'ok'; data: { version: string; currentVersion: string; notes: string | null } | null }
  | { status: 'error'; error: { kind: 'update'; message: string } };

let checkResult: CheckResult = { status: 'ok', data: null };
let support: 'inApp' | 'download' = 'inApp';
const installUpdate = vi.fn(async () => ({ status: 'ok' as const, data: null }));
const push = vi.fn();
const hint = vi.fn();
const openUrl = vi.fn(async () => {});

vi.mock('@tauri-apps/api/core', () => ({
  Channel: class {
    onmessage: ((message: unknown) => void) | null = null;
  },
}));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl }));
vi.mock('$lib/ipc/bindings', () => ({
  commands: {
    updateSupport: async () => support,
    checkUpdate: async () => checkResult,
    installUpdate,
  },
}));
vi.mock('$lib/stores/notices.svelte', () => ({ notices: { push } }));
vi.mock('$lib/notify/notifier', () => ({ notifier: { hint } }));

const { updates, progressShare, RELEASES_URL } = await import('./update.svelte');

const found = (version: string): CheckResult => ({
  status: 'ok',
  data: { version, currentVersion: '0.1.0', notes: null },
});

describe('updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updates.available = null;
    updates.dismissed = null;
    updates.confirming = false;
    checkResult = { status: 'ok', data: null };
  });

  it('reports "up to date" and errors only for manual checks', async () => {
    await updates.check();
    expect(push).not.toHaveBeenCalled();
    await updates.check(true);
    expect(push).toHaveBeenCalledTimes(1);

    checkResult = { status: 'error', error: { kind: 'update', message: 'offline' } };
    await updates.check();
    expect(push).toHaveBeenCalledTimes(1);
    await updates.check(true);
    expect(push).toHaveBeenCalledTimes(2);
  });

  it('announces a new version once and can be dismissed', async () => {
    checkResult = found('0.2.0');
    await updates.check();
    await updates.check();
    expect(hint).toHaveBeenCalledTimes(1);
    expect(updates.noticeShown).toBe(true);

    updates.dismiss();
    expect(updates.noticeShown).toBe(false);
    await updates.check();
    expect(updates.noticeShown).toBe(false);
    await updates.check(true);
    expect(updates.noticeShown).toBe(true);
  });

  it('asks before a restart ends running sessions', async () => {
    support = 'inApp';
    checkResult = found('0.2.0');
    await updates.check();

    await updates.requestInstall(2);
    expect(updates.confirming).toBe(true);
    expect(installUpdate).not.toHaveBeenCalled();

    await updates.requestInstall(2);
    expect(installUpdate).toHaveBeenCalledTimes(1);
  });

  it('opens the download page for builds that cannot update themselves', async () => {
    support = 'download';
    (updates as { support: string }).support = 'download';
    checkResult = found('0.2.0');
    await updates.check();
    await updates.requestInstall(3);
    expect(openUrl).toHaveBeenCalledWith(RELEASES_URL);
    expect(installUpdate).not.toHaveBeenCalled();
  });

  it('computes the download share', () => {
    expect(progressShare(null)).toBeNull();
    expect(progressShare({ downloaded: 5, total: null })).toBeNull();
    expect(progressShare({ downloaded: 5, total: 10 })).toBe(0.5);
    expect(progressShare({ downloaded: 12, total: 10 })).toBe(1);
  });
});
