<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { untrack } from 'svelte';
  import { registerAppCommands } from '$lib/commands/app-commands';
  import { handleShortcut } from '$lib/commands/registry';
  import CloseGuardBar from '$lib/components/CloseGuardBar.svelte';
  import Dashboard from '$lib/components/Dashboard.svelte';
  import ContextMenu from '$lib/components/ContextMenu.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Palette from '$lib/components/Palette.svelte';
  import ProjectView from '$lib/components/ProjectView.svelte';
  import SettingsView from '$lib/components/SettingsView.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import { t } from '$lib/i18n';
  import { contextMenu } from '$lib/menu/context-menu.svelte';
  import { palette } from '$lib/palette/palette.svelte';
  import { closeGuard } from '$lib/project/close-guard.svelte';
  import {
    activeSession,
    listenToFileChanges,
    persistTerminalSessions,
    pruneSessions,
  } from '$lib/project/session';
  import { settings } from '$lib/stores/settings.svelte';
  import { sessions } from '$lib/terminal/sessions.svelte';
  import { currentTheme } from '$lib/theme/current.svelte';
  import { waitingCount } from '$lib/agents/state';
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

  $effect(() => {
    const unlisten = sessions.listen();
    // Sessions survive a reload of the web view (e.g. in development).
    void sessions.load();
    return () => void unlisten.then((stop) => stop());
  });

  $effect(() => pruneSessions(workspace.projects.map((p) => p.path)));

  // Rain animations pause while the window is hidden or not focused.
  $effect(() => {
    const root = document.documentElement;
    const update = () => {
      root.dataset.windowActive = String(document.hasFocus() && !document.hidden);
    };
    update();
    window.addEventListener('focus', update);
    window.addEventListener('blur', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.removeEventListener('focus', update);
      window.removeEventListener('blur', update);
      document.removeEventListener('visibilitychange', update);
    };
  });

  $effect(() => {
    if (sessions.initial !== null) persistTerminalSessions();
  });

  $effect(() => {
    const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
      if (closeGuard.holdQuit()) event.preventDefault();
      // Pending layout changes (e.g. the open sessions) must reach the disk.
      else await workspace.flushLayouts();
    });
    return () => void unlisten.then((stop) => stop());
  });

  // Switching projects or opening a file (e.g. from the palette) leaves the
  // settings and the dashboard, so the result is visible.
  $effect(() => {
    void workspace.activePath;
    void activeSession()?.editors.activePath;
    untrack(() => view.close(false));
  });

  $effect(() =>
    watchSystemPreferences(() => {
      prefersDark = systemPrefersDark();
      reducedMotion = systemPrefersReducedMotion();
    }),
  );

  $effect(() => {
    const theme = resolveTheme(settings.value.theme, prefersDark);
    currentTheme.name = theme;
    applyAppearance(document.documentElement, {
      theme,
      density: settings.value.density,
      rainEffects: resolveRainEffects(settings.value.rainEffects, reducedMotion),
    });
  });

  $effect(() => {
    const project = workspace.active;
    const unsaved = (activeSession()?.editors.dirtyFiles.length ?? 0) > 0;
    const base = project
      ? t(unsaved ? 'app.windowTitleUnsaved' : 'app.windowTitle', { project: project.name })
      : t('app.name');
    const waiting = waitingCount(sessions.list);
    const title = waiting > 0 ? t('app.windowTitleWaiting', { count: waiting, title: base }) : base;
    void getCurrentWindow().setTitle(title);
  });
</script>

<svelte:window onkeydowncapture={handleShortcut} />

<div class="shell">
  <Sidebar />
  <main class="main">
    {#if closeGuard.request}
      <CloseGuardBar request={closeGuard.request} />
    {/if}
    <div class="view">
      {#if view.settingsOpen}
        <SettingsView />
      {:else if view.dashboardOpen}
        <Dashboard />
      {:else if workspace.active}
        {#key workspace.active.path}
          <ProjectView project={workspace.active} />
        {/key}
      {:else}
        <EmptyState />
      {/if}
    </div>
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
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background: var(--ame-bg);
  }

  .view {
    display: grid;
    flex: 1;
    place-items: stretch;
    min-width: 0;
    min-height: 0;
  }
</style>
