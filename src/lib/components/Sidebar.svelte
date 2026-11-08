<script lang="ts">
  import { t } from '$lib/i18n';
  import { notices } from '$lib/stores/notices.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { view } from '$lib/stores/view.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { combinedRain, combinedState } from '$lib/agents/state';
  import { shortcutOf } from '$lib/commands/registry';
  import { formatShortcut } from '$lib/commands/shortcuts';
  import { sessions } from '$lib/terminal/sessions.svelte';
  import ProjectList from './ProjectList.svelte';
  import StatusDot from './StatusDot.svelte';
  import ThemeSwitcher from './ThemeSwitcher.svelte';
  import UpdateNotice from './UpdateNotice.svelte';

  const overall = $derived(combinedState(sessions.list));
  const rain = $derived(combinedRain(sessions.list));
  const page = $derived(view.page);

  function hint(command: string): string {
    const shortcut = shortcutOf(command);
    return shortcut ? formatShortcut(shortcut) : '';
  }
</script>

<nav class="sidebar" aria-label={t('sidebar.label')}>
  <header class="brand">
    <div class="title">
      <span class="name">{t('app.name')}</span>
      <span class="tagline">{t('app.tagline')}</span>
    </div>
    <button
      class="icon-btn"
      title={t('sidebar.openFolder')}
      aria-label={t('sidebar.openFolder')}
      onclick={() => void workspace.openFolder()}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M8 3v10M3 8h10" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>
  </header>

  <div class="pages">
    <button
      class="nav"
      class:active={page.kind === 'dashboard'}
      aria-current={page.kind === 'dashboard' ? 'page' : undefined}
      onclick={() => view.open('dashboard')}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path
          d="M2.5 2.5h4.5v4.5h-4.5zM9 2.5h4.5v4.5h-4.5zM2.5 9h4.5v4.5h-4.5zM9 9h4.5v4.5h-4.5z"
        />
      </svg>
      <span class="label">{t('sidebar.dashboard')}</span>
      <kbd class="hint">{hint('dashboard.toggle')}</kbd>
      {#if overall}<StatusDot state={overall} intensity={rain.intensity} />{/if}
    </button>

    {#if workspace.active}
      {@const project = workspace.active}
      <button
        class="nav"
        class:active={page.kind === 'board'}
        aria-current={page.kind === 'board' ? 'page' : undefined}
        title={t('sidebar.boardOf', { project: project.name })}
        onclick={() => void view.showProject(project.path, 'board')}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M2.5 2.5h3v11h-3zM6.5 2.5h3v7h-3zM10.5 2.5h3v4.5h-3z" />
        </svg>
        <span class="label">{t('sidebar.board')}</span>
        <kbd class="hint">{hint('board.toggle')}</kbd>
      </button>
    {/if}
  </div>

  <div class="projects">
    <ProjectList />
  </div>

  <footer class="footer">
    <UpdateNotice />
    {#if settings.saveError}
      <p class="notice error" role="alert">
        {t('settings.saveFailed', { message: settings.saveError })}
      </p>
    {/if}
    {#each notices.list as notice (notice.id)}
      <p class="notice" class:error={notice.kind === 'error'} role="alert">
        <span>{notice.message}</span>
        <button
          class="icon-btn dismiss"
          aria-label={t('sidebar.dismiss')}
          title={t('sidebar.dismiss')}
          onclick={() => notices.dismiss(notice.id)}
        >
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </p>
    {/each}
    <div class="footer-row">
      <div class="theme"><ThemeSwitcher /></div>
      <button
        class="icon-btn"
        title={t('sidebar.settings')}
        aria-label={t('sidebar.settings')}
        aria-current={page.kind === 'settings' ? 'page' : undefined}
        onclick={() => view.openSettings()}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path
            d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6.9 1.5h2.2l.4 1.8 1.2.7 1.8-.6 1.1 1.9-1.4 1.2v1.4l1.4 1.2-1.1 1.9-1.8-.6-1.2.7-.4 1.8H6.9l-.4-1.8-1.2-.7-1.8.6-1.1-1.9 1.4-1.2V7.1L2.4 5.9l1.1-1.9 1.8.6 1.2-.7z"
            stroke-width="1.2"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>
    {#if settings.appInfo?.portable}
      <span class="badge" title={settings.appInfo.configDir}>{t('sidebar.portableMode')}</span>
    {/if}
  </footer>
</nav>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--ame-space-4);
    min-width: 0;
    min-height: 0;
    padding: var(--ame-space-4) var(--ame-space-3);
    background: var(--ame-surface);
    border-right: 1px solid var(--ame-border);
  }

  .brand {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--ame-space-2);
    padding: 0 var(--ame-space-1);
  }

  .title {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .name {
    font-size: var(--ame-font-size-title);
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .tagline {
    color: var(--ame-text-muted);
  }

  .footer-row {
    display: flex;
    align-items: center;
    gap: var(--ame-space-1);
  }

  .theme {
    flex: 1;
    min-width: 0;
  }

  svg path {
    fill: none;
    stroke: currentColor;
  }

  .pages {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin: calc(var(--ame-space-2) * -1) 0;
  }

  .nav {
    display: flex;
    align-items: center;
    gap: var(--ame-space-2);
    padding: var(--ame-space-1) var(--ame-space-2);
    border: 0;
    border-radius: var(--ame-radius);
    background: transparent;
    color: var(--ame-text-muted);
    font: inherit;
    text-align: left;
  }

  .nav {
    transition:
      background-color var(--ame-transition),
      color var(--ame-transition);
  }

  .nav:hover {
    background: color-mix(in srgb, var(--ame-bg) 55%, transparent);
    color: var(--ame-text);
  }

  .nav.active {
    background: var(--ame-bg);
    color: var(--ame-text);
  }

  .nav .label {
    flex: 1;
  }

  .hint {
    color: var(--ame-text-muted);
    font-family: inherit;
    font-size: var(--ame-font-size-small);
    opacity: 0;
    transition: opacity var(--ame-transition);
  }

  .nav:hover .hint,
  .nav:focus-visible .hint {
    opacity: 1;
  }

  .nav path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.2;
    stroke-linejoin: round;
  }

  .projects {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .footer {
    display: flex;
    flex-direction: column;
    gap: var(--ame-space-2);
  }

  .notice {
    display: flex;
    align-items: flex-start;
    gap: var(--ame-space-2);
    margin: 0;
    padding: var(--ame-space-2);
    border: 1px solid var(--ame-border);
    border-radius: var(--ame-radius);
    color: var(--ame-text);
    font-size: var(--ame-font-size-small);
    overflow-wrap: anywhere;
  }

  .notice span {
    flex: 1;
  }

  .notice.error {
    border-color: var(--ame-error);
  }

  .badge {
    align-self: flex-start;
    padding: 0 var(--ame-space-2);
    border: 1px solid var(--ame-border);
    border-radius: var(--ame-radius);
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
  }
</style>
