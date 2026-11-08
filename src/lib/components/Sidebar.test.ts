// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { view } from '$lib/stores/view.svelte';
import { workspace } from '$lib/stores/workspace.svelte';
import { fakeBackend, project, resetBackend, type FakeBackend } from '$lib/test/backend';
import Sidebar from './Sidebar.svelte';

const alpha = project('alpha');
const beta = project('beta');

let backend: FakeBackend;

beforeEach(async () => {
  view.overlay = null;
  backend = await fakeBackend({ version: 1, projects: [alpha, beta], active: alpha.path });
});

afterEach(resetBackend);

/** The sidebar entry that is marked as the current page. */
function current(): HTMLElement | null {
  return document.querySelector('[aria-current="page"]');
}

function projectButton(name: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^${name}`) });
}

describe('Sidebar navigation', () => {
  it('marks the active project as the current page', () => {
    render(Sidebar);
    expect(current()).toBe(projectButton('alpha'));
  });

  it('opens the dashboard on click and keeps it open on a second click', async () => {
    render(Sidebar);
    const dashboard = screen.getByRole('button', { name: /Dashboard/ });
    await fireEvent.click(dashboard);
    expect(view.overlay).toBe('dashboard');
    expect(current()).toBe(dashboard);

    await fireEvent.click(dashboard);
    expect(view.overlay).toBe('dashboard');
  });

  it('leaves the dashboard when the active project is clicked', async () => {
    render(Sidebar);
    view.open('dashboard');
    await tick();
    await fireEvent.click(projectButton('alpha'));
    await tick();
    expect(view.overlay).toBeNull();
    expect(current()).toBe(projectButton('alpha'));
  });

  it('switches to another project and leaves the dashboard', async () => {
    render(Sidebar);
    view.open('dashboard');
    await fireEvent.click(projectButton('beta'));
    await vi.waitFor(() => expect(view.overlay).toBeNull());
    expect(workspace.activePath).toBe(beta.path);
    expect(backend.callsOf('set_active_project')).toEqual([{ project: beta.path }]);
  });

  it('opens the settings on click without toggling them closed', async () => {
    render(Sidebar);
    const button = screen.getByRole('button', { name: 'Settings' });
    await fireEvent.click(button);
    await fireEvent.click(button);
    expect(view.overlay).toBe('settings');
    expect(current()).toBe(button);
  });
});

describe('Sidebar board entry', () => {
  it('opens the board of the active project', async () => {
    render(Sidebar);
    const board = screen.getByRole('button', { name: /^Board/ });
    expect(board.title).toBe('Board of alpha');
    await fireEvent.click(board);
    expect(view.overlay).toBe('board');
    expect(current()).toBe(board);
    // The project stays highlighted as the board's owner.
    expect(projectButton('alpha').classList.contains('active')).toBe(true);
  });

  it('is hidden without an active project', async () => {
    resetBackend();
    await fakeBackend({ version: 1, projects: [alpha], active: null });
    render(Sidebar);
    expect(screen.queryByRole('button', { name: /^Board/ })).toBeNull();
  });

  it('opens the board of another project from its context menu', async () => {
    const { contextMenu } = await import('$lib/menu/context-menu.svelte');
    render(Sidebar);
    await fireEvent.contextMenu(projectButton('beta'));
    const entries = contextMenu.config?.items ?? [];
    const open = entries.find((entry) => entry.kind === 'action' && entry.label === 'Open board');
    expect(open).toBeDefined();
    if (open?.kind === 'action') await open.run();
    expect(workspace.activePath).toBe(beta.path);
    expect(view.overlay).toBe('board');
    expect(current()).toBe(screen.getByRole('button', { name: /^Board/ }));
    contextMenu.close();
  });
});

describe('Sidebar sections', () => {
  beforeEach(async () => {
    resetBackend();
    backend = await fakeBackend({
      version: 1,
      projects: [alpha, project('gamma', { group: 'Work' }), project('delta', { group: 'Work' })],
      active: alpha.path,
    });
  });

  function workSection(): HTMLElement {
    return screen.getByRole('region', { name: 'Work' });
  }

  it('folds a group on a click on its header and remembers it', async () => {
    render(Sidebar);
    const header = within(workSection()).getByRole('button', { name: /Work/ });
    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(within(workSection()).getAllByRole('listitem')).toHaveLength(2);

    await fireEvent.click(header);
    await tick();
    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(within(workSection()).queryAllByRole('listitem')).toHaveLength(0);
    expect(within(header).getByText('2')).toBeTruthy();
    expect(backend.settings.collapsedSections).toEqual(['group:Work']);

    await fireEvent.click(header);
    await tick();
    expect(within(workSection()).getAllByRole('listitem')).toHaveLength(2);
    expect(backend.settings.collapsedSections).toEqual([]);
  });

  it('keeps the active project visible in a folded group', async () => {
    resetBackend();
    await fakeBackend(
      {
        version: 1,
        projects: [project('gamma', { group: 'Work' }), project('delta', { group: 'Work' })],
        active: '/p/delta',
      },
      { collapsedSections: ['group:Work'] },
    );
    render(Sidebar);
    const items = within(workSection()).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]?.textContent).toContain('delta');
  });
});

describe('Sidebar section commands', () => {
  it('fold and unfold all sections from the palette', async () => {
    const { registerAppCommands } = await import('$lib/commands/app-commands');
    const { paletteCommands, runCommand } = await import('$lib/commands/registry');
    resetBackend();
    backend = await fakeBackend({
      version: 1,
      projects: [project('a', { pinned: true }), project('b', { group: 'Work' }), project('c')],
      active: null,
    });
    const unregister = registerAppCommands();
    try {
      const ids = () => paletteCommands().map((command) => command.id);
      expect(ids()).toContain('sidebar.collapseSections');
      expect(ids()).not.toContain('sidebar.expandSections');

      runCommand('sidebar.collapseSections');
      await vi.waitFor(() =>
        expect(backend.settings.collapsedSections).toEqual(['pinned', 'group:Work', 'projects']),
      );
      expect(ids()).toContain('sidebar.expandSections');

      runCommand('sidebar.expandSections');
      await vi.waitFor(() => expect(backend.settings.collapsedSections).toEqual([]));
    } finally {
      unregister();
    }
  });
});
