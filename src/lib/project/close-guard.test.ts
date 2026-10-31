import { beforeEach, describe, expect, it, vi } from 'vitest';

const destroy = vi.fn(async () => {});
const remove = vi.fn(async (_path: string) => {});

interface FakeFile {
  path: string;
  name: string;
}

class FakeEditors {
  dirtyFiles: FakeFile[];
  saveResult = true;
  saveAll = vi.fn(async () => {
    if (this.saveResult) this.dirtyFiles = [];
    return this.saveResult;
  });

  constructor(dirty: string[]) {
    this.dirtyFiles = dirty.map((path) => ({ path, name: path }));
  }
}

const sessions = new Map<string, { path: string; editors: FakeEditors }>();

vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ destroy }) }));
vi.mock('$lib/stores/workspace.svelte', () => ({ workspace: { remove } }));
vi.mock('./session', () => ({
  allSessions: () => [...sessions.values()],
  existingSession: (path: string) => sessions.get(path),
}));

const { closeGuard } = await import('./close-guard.svelte');

function addSession(path: string, dirty: string[] = []) {
  const session = { path, editors: new FakeEditors(dirty) };
  sessions.set(path, session);
  return session;
}

describe('closeGuard', () => {
  beforeEach(() => {
    sessions.clear();
    closeGuard.cancel();
    vi.clearAllMocks();
  });

  it('closes a clean project right away', async () => {
    addSession('/a');
    await closeGuard.closeProject('/a');
    expect(remove).toHaveBeenCalledWith('/a');
    expect(closeGuard.request).toBeNull();
  });

  it('closes a project without a session right away', async () => {
    await closeGuard.closeProject('/never-opened');
    expect(remove).toHaveBeenCalledWith('/never-opened');
  });

  it('holds back closing a project with unsaved files', async () => {
    addSession('/a', ['a.ts']);
    addSession('/b', ['b.ts']);
    await closeGuard.closeProject('/a');
    expect(remove).not.toHaveBeenCalled();
    expect(closeGuard.request).toEqual({ kind: 'project', path: '/a' });
    expect(closeGuard.unsaved.flatMap((entry) => entry.files.map((f) => f.path))).toEqual(['a.ts']);
  });

  it('saves and then closes the project', async () => {
    const session = addSession('/a', ['a.ts']);
    await closeGuard.closeProject('/a');
    await closeGuard.saveAndClose();
    expect(session.editors.saveAll).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith('/a');
    expect(closeGuard.request).toBeNull();
  });

  it('keeps the request when a save fails', async () => {
    const session = addSession('/a', ['a.ts']);
    session.editors.saveResult = false;
    await closeGuard.closeProject('/a');
    await closeGuard.saveAndClose();
    expect(remove).not.toHaveBeenCalled();
    expect(closeGuard.request).toEqual({ kind: 'project', path: '/a' });
  });

  it('lets the window close when nothing is unsaved', () => {
    addSession('/a');
    expect(closeGuard.holdQuit()).toBe(false);
    expect(closeGuard.request).toBeNull();
  });

  it('holds the window open for unsaved files in any project', async () => {
    addSession('/a');
    addSession('/b', ['b.ts']);
    expect(closeGuard.holdQuit()).toBe(true);
    expect(closeGuard.request).toEqual({ kind: 'app' });

    await closeGuard.discardAndClose();
    expect(destroy).toHaveBeenCalled();
    // The second close request (from destroy) is not held again.
    expect(closeGuard.holdQuit()).toBe(false);
  });

  it('cancel drops the request', async () => {
    addSession('/a', ['a.ts']);
    await closeGuard.closeProject('/a');
    closeGuard.cancel();
    expect(closeGuard.request).toBeNull();
    expect(remove).not.toHaveBeenCalled();
  });
});
