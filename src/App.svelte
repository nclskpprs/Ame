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
  import PaperOverlay from '$lib/components/PaperOverlay.svelte';
  import { paper } from '$lib/rain/paper.svelte';
  import ProjectView from '$lib/components/ProjectView.svelte';
  import SettingsView from '$lib/components/SettingsView.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import { t } from '$lib/i18n';
  import { contextMenu } from '$lib/menu/context-menu.svelte';
  import { palette } from '$lib/palette/palette.svelte';
  import { closeGuard } from '$lib/project/close-guard.svelte';
  import {
    activeSession,
    existingSession,
    listenToCheckpoints,
    listenToFileChanges,
    persistTerminalSessions,
    pollGit,
    pruneSessions,
  } from '$lib/project/session';
  import { settings } from '$lib/stores/settings.svelte';
  import { sessions } from '$lib/terminal/sessions.svelte';
  import { currentTheme } from '$lib/theme/current.svelte';
  import { applyZoom } from '$lib/theme/zoom';
  import { waitingCount } from '$lib/agents/state';
  import { countBadge, notifier } from '$lib/notify/notifier';
  import { showSession } from '$lib/agents/show';
  import { usage } from '$lib/agents/usage.svelte';
  import { closeDecision } from '$lib/background/close';
  import { trayModel } from '$lib/background/tray';
  import { shortcutOf } from '$lib/commands/registry';
  import { formatShortcut } from '$lib/commands/shortcuts';
  import { basename } from '$lib/fs/paths';
  import { commands, events } from '$lib/ipc/bindings';
  import { isRunning } from '$lib/terminal/sessions.svelte';
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

  const TRAY_ICON_SIZE = 32;

  let prefersDark = $state(systemPrefersDark());
  let reducedMotion = $state(systemPrefersReducedMotion());

  $effect(() => registerAppCommands());

  $effect(() => usage.start());

  $effect(() => {
    const unlisten = listenToFileChanges();
    return () => void unlisten.then((stop) => stop());
  });

  $effect(() => {
    const unlisten = listenToCheckpoints();
    return () => void unlisten.then((stop) => stop());
  });

  $effect(() => {
    const unlisten = sessions.listen();
    // Sessions survive a reload of the web view (e.g. in development).
    void sessions.load();
    return () => void unlisten.then((stop) => stop());
  });

  $effect(() => pruneSessions(workspace.projects.map((p) => p.path)));

  /** Git status of busy projects is refreshed this often. */
  const GIT_POLL_MS = 3000;
  $effect(() => {
    const timer = setInterval(pollGit, GIT_POLL_MS);
    const onFocus = () => activeSession()?.git.refreshSoon(0);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  });

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
    const list = sessions.list;
    untrack(() =>
      notifier.update(list, {
        theme: currentTheme.name,
        projectName: (path) => workspace.projects.find((p) => p.path === path)?.name ?? path,
        enabled: (session) =>
          settings.value.notifications &&
          !workspace.projects.find((p) => p.path === session.project)?.muted,
        visible: (session) => {
          if (!document.hasFocus() || document.hidden) return false;
          if (view.dashboardOpen) return true;
          const terminals = existingSession(session.project)?.terminals;
          return (
            view.overlay === null &&
            workspace.activePath === session.project &&
            terminals?.open === true &&
            terminals.active?.id === session.id
          );
        },
      }),
    );
  });

  $effect(() => {
    const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
      const decision = closeDecision(
        settings.value.closeAction,
        sessions.list.some(isRunning),
        () => closeGuard.holdQuit(),
      );
      if (decision === 'close') {
        // Pending layout changes (e.g. the open sessions) must reach the disk.
        await workspace.flushLayouts();
        return;
      }
      event.preventDefault();
      if (decision === 'hide') await hideToBackground();
    });
    return () => void unlisten.then((stop) => stop());
  });

  async function hideToBackground() {
    await workspace.flushLayouts();
    await commands.hideWindow();
    if (settings.value.backgroundHintShown) return;
    const quit = shortcutOf('app.quit');
    notifier.hint(
      t('background.hintTitle'),
      t('background.hintBody', { shortcut: quit ? formatShortcut(quit) : '' }),
    );
    await settings.update({ backgroundHintShown: true });
  }

  $effect(() => {
    const unlisten = events.trayAction.listen(({ payload }) => {
      if (payload.action === 'quit') void closeGuard.quit();
      else {
        const session = sessions.list.find((s) => s.id === payload.id);
        if (session) showSession(session.project, session.id);
      }
    });
    return () => void unlisten.then((stop) => stop());
  });

  // The tray lists every session; it only changes when a state, a title or
  // a project name changes.
  let lastTray = '';
  $effect(() => {
    const list = sessions.list;
    const theme = currentTheme.name;
    const names = new Map(workspace.projects.map((p) => [p.path, p.name]));
    untrack(() => {
      const waiting = waitingCount(list);
      const model = trayModel(list, (path) => names.get(path) ?? basename(path), null);
      const key = JSON.stringify([model, waiting, theme]);
      if (key === lastTray) return;
      lastTray = key;
      if (waiting) model.icon = trayIcon(waiting, theme);
      void commands.setTray(model);
    });
  });

  function trayIcon(count: number, theme: typeof currentTheme.name) {
    try {
      return {
        rgba: Array.from(countBadge(count, theme, TRAY_ICON_SIZE)),
        width: TRAY_ICON_SIZE,
        height: TRAY_ICON_SIZE,
      };
    } catch {
      return null;
    }
  }

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

  $effect(() => applyZoom(settings.value.zoom));

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

<!-- Mounted with the first paper burst of the origami easter egg. -->
{#if paper.bursts > 0}
  <PaperOverlay />
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
