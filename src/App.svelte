<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { registerAppCommands } from '$lib/commands/app-commands';
  import { handleShortcut } from '$lib/commands/registry';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import ProjectView from '$lib/components/ProjectView.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import { t } from '$lib/i18n';
  import { settings } from '$lib/stores/settings.svelte';
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
    const title = project ? t('app.windowTitle', { project: project.name }) : t('app.name');
    void getCurrentWindow().setTitle(title);
  });
</script>

<svelte:window onkeydowncapture={handleShortcut} />

<div class="shell">
  <Sidebar />
  <main class="main">
    {#if workspace.active}
      {#key workspace.active.path}
        <ProjectView project={workspace.active} />
      {/key}
    {:else}
      <EmptyState />
    {/if}
  </main>
</div>

<style>
  .shell {
    display: grid;
    grid-template-columns: var(--ame-sidebar-width) 1fr;
    height: 100%;
  }

  .main {
    display: grid;
    place-items: center;
    min-width: 0;
    min-height: 0;
    background: var(--ame-bg);
  }
</style>
