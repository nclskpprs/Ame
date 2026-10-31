<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { untrack } from 'svelte';
  import { registerAppCommands } from '$lib/commands/app-commands';
  import { handleShortcut } from '$lib/commands/registry';
  import ContextMenu from '$lib/components/ContextMenu.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Palette from '$lib/components/Palette.svelte';
  import ProjectView from '$lib/components/ProjectView.svelte';
  import SettingsView from '$lib/components/SettingsView.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import { t } from '$lib/i18n';
  import { contextMenu } from '$lib/menu/context-menu.svelte';
  import { palette } from '$lib/palette/palette.svelte';
  import { activeSession, listenToFileChanges, pruneSessions } from '$lib/project/session';
  import { settings } from '$lib/stores/settings.svelte';
  import { view } from '$lib/stores/view.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import {
    applyAppearance,
    resolveRainEffects,
    resolveTheme,
    systemPrefersDark,
    systemPrefersReducedMotion,
    watchSystemPreferences,
  } from '$lib/theme/theme';

  let prefersDark = $state(systemPrefersDark());
  let reducedMotion = $state(systemPrefersReducedMotion());

  $effect(() => registerAppCommands());

  $effect(() => {
    const unlisten = listenToFileChanges();
    return () => void unlisten.then((stop) => stop());
  });

  $effect(() => pruneSessions(workspace.projects.map((p) => p.path)));

  // Switching projects or opening a file (e.g. from the palette) leaves the
  // settings, so the result is visible.
  $effect(() => {
    void workspace.activePath;
    void activeSession()?.editors.activePath;
    untrack(() => view.closeSettings());
  });

  $effect(() =>
    watchSystemPreferences(() => {
      prefersDark = systemPrefersDark();
      reducedMotion = systemPrefersReducedMotion();
    }),
  );

  $effect(() => {
    applyAppearance(document.documentElement, {
      theme: resolveTheme(settings.value.theme, prefersDark),
      density: settings.value.density,
      rainEffects: resolveRainEffects(settings.value.rainEffects, reducedMotion),
    });
  });

  $effect(() => {
    const project = workspace.active;
    const unsaved = (activeSession()?.editors.dirtyFiles.length ?? 0) > 0;
    const title = project
      ? t(unsaved ? 'app.windowTitleUnsaved' : 'app.windowTitle', { project: project.name })
      : t('app.name');
    void getCurrentWindow().setTitle(title);
  });
</script>

<svelte:window onkeydowncapture={handleShortcut} />

<div class="shell">
  <Sidebar />
  <main class="main">
    {#if view.settingsOpen}
      <SettingsView />
    {:else if workspace.active}
      {#key workspace.active.path}
        <ProjectView project={workspace.active} />
      {/key}
    {:else}
      <EmptyState />
    {/if}
  </main>
</div>

{#if palette.config}
  {#key palette.config}
    <Palette config={palette.config} />
  {/key}
{/if}

{#if contextMenu.config}
  {#key contextMenu.config}
    <ContextMenu config={contextMenu.config} />
  {/key}
{/if}

<style>
  .shell {
    display: grid;
    grid-template-columns: var(--ame-sidebar-width) 1fr;
    height: 100%;
  }

  .main {
    display: grid;
    place-items: stretch;
    min-width: 0;
    min-height: 0;
    background: var(--ame-bg);
  }
</style>
