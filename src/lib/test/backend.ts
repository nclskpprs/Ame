/**
 * A fake Tauri backend for component tests. It answers the IPC calls the
 * stores make, keeps the workspace and the settings in memory and records
 * every call, so a test can render real components and check what they
 * asked the backend to do. Use it in files with `@vitest-environment jsdom`.
 */
import { clearMocks, mockIPC } from '@tauri-apps/api/mocks';
import type { Project, ProjectLayout, Settings, WorkspaceState } from '$lib/ipc/types';
import { settings } from '$lib/stores/settings.svelte';
import { workspace } from '$lib/stores/workspace.svelte';

export const LAYOUT: ProjectLayout = {
  openFiles: [],
  activeFile: null,
  expandedDirs: [],
  sidePanel: 'files',
  sidePanelWidth: 260,
  terminalOpen: false,
  terminalHeight: 300,
  sessions: [],
  activeSession: null,
  follow: false,
};

export function project(name: string, extra: Partial<Project> = {}): Project {
  return {
    path: `/p/${name}`,
    name,
    group: null,
    pinned: false,
    muted: false,
    layout: LAYOUT,
    ...extra,
  };
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  theme: 'system',
  locale: 'en',
  rainEffects: 'on',
  density: 'comfortable',
  zoom: 100,
  fileOpen: 'doubleClick',
  showIgnored: false,
  fileIcons: true,
  notifications: true,
  closeAction: 'background',
  checkpoints: true,
  startAgent: '',
  updateCheck: true,
  backgroundHintShown: false,
  collapsedSections: [],
  agents: [],
  prompts: [],
  templates: [],
};

export interface FakeBackend {
  state: WorkspaceState;
  settings: Settings;
  /** Every IPC call, in order. */
  calls: { cmd: string; args: Record<string, unknown> }[];
  /** Calls of one command. */
  callsOf(cmd: string): Record<string, unknown>[];
}

/**
 * Installs the fake backend and loads the stores from it. Call it in
 * `beforeEach`; `resetBackend` in `afterEach` removes it again.
 */
export async function fakeBackend(
  state: WorkspaceState,
  initialSettings: Partial<Settings> = {},
): Promise<FakeBackend> {
  const backend: FakeBackend = {
    state: structuredClone(state),
    settings: { ...DEFAULT_SETTINGS, ...initialSettings },
    calls: [],
    callsOf: (cmd) => backend.calls.filter((call) => call.cmd === cmd).map((call) => call.args),
  };
  const update = (path: unknown, change: Partial<Project>) => {
    backend.state = {
      ...backend.state,
      projects: backend.state.projects.map((p) => (p.path === path ? { ...p, ...change } : p)),
    };
    return backend.state;
  };
  mockIPC((cmd, payload) => {
    const args = (payload ?? {}) as Record<string, unknown>;
    backend.calls.push({ cmd, args });
    switch (cmd) {
      case 'get_settings':
        return backend.settings;
      case 'set_settings':
        backend.settings = args.settings as Settings;
        return null;
      case 'get_app_info':
        return { version: '0.0.0', portable: false, configDir: '/config' };
      case 'get_workspace':
        return backend.state;
      case 'set_active_project':
        backend.state = { ...backend.state, active: args.project as string };
        return backend.state;
      case 'set_project_pinned':
        return update(args.project, { pinned: args.pinned as boolean });
      case 'set_project_group':
        return update(args.project, { group: (args.group as string | null) ?? null });
      case 'list_packages':
        return [];
      default:
        return null;
    }
  });
  await Promise.all([settings.load(), workspace.load()]);
  return backend;
}

export function resetBackend(): void {
  clearMocks();
}
