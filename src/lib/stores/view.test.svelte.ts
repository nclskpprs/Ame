// @vitest-environment jsdom
import { untrack } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fakeBackend, project, resetBackend } from '$lib/test/backend';
import { view } from './view.svelte';
import { workspace } from './workspace.svelte';

const alpha = project('alpha');
const beta = project('beta');
let stop: () => void;

beforeEach(async () => {
  view.overlay = null;
  await fakeBackend({ version: 1, projects: [alpha, beta], active: alpha.path });
  // The effect of App.svelte: switching projects leaves the overlays.
  stop = $effect.root(() => {
    $effect(() => {
      void workspace.activePath;
      untrack(() => view.close(false));
    });
  });
});

afterEach(() => {
  stop();
  resetBackend();
});

describe('view.showProject', () => {
  it('opens the board of another project after the switch closed overlays', async () => {
    view.open('dashboard');
    await view.showProject(beta.path, 'board');
    expect(workspace.activePath).toBe(beta.path);
    expect(view.overlay).toBe('board');
    expect(view.page).toEqual({ kind: 'board', path: beta.path });
  });

  it('shows the project page and never toggles it away', async () => {
    view.open('board');
    await view.showProject(alpha.path);
    expect(view.page).toEqual({ kind: 'project', path: alpha.path });
    await view.showProject(alpha.path);
    expect(view.page).toEqual({ kind: 'project', path: alpha.path });
  });

  it('keeps the board open when it is shown again', async () => {
    await view.showProject(alpha.path, 'board');
    await view.showProject(alpha.path, 'board');
    expect(view.overlay).toBe('board');
  });
});

describe('view.toggle', () => {
  it('still toggles for the keyboard shortcuts', () => {
    view.toggle('dashboard');
    expect(view.overlay).toBe('dashboard');
    view.toggle('dashboard');
    expect(view.overlay).toBeNull();
  });
});
