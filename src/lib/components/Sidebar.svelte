<script lang="ts">
  import { t } from '$lib/i18n';
  import { notices } from '$lib/stores/notices.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import ProjectList from './ProjectList.svelte';
  import ThemeSwitcher from './ThemeSwitcher.svelte';
</script>

<nav class="sidebar" aria-label={t('sidebar.label')}>
  <header class="brand">
    <div class="title">
      <span class="name">{t('app.name')}</span>
      <span class="tagline">{t('app.tagline')}</span>
    </div>
    <button
      class="icon-button"
      title={t('sidebar.openFolder')}
      aria-label={t('sidebar.openFolder')}
      onclick={() => void workspace.openFolder()}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M8 3v10M3 8h10" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>
  </header>

  <div class="projects">
    <ProjectList />
  </div>

  <footer class="footer">
    {#if settings.saveError}
      <p class="notice error" role="alert">
        {t('settings.saveFailed', { message: settings.saveError })}
      </p>
    {/if}
    {#each notices.list as notice (notice.id)}
      <p class="notice" class:error={notice.kind === 'error'} role="alert">
        <span>{notice.message}</span>
        <button
          class="dismiss"
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
    <ThemeSwitcher />
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

  .icon-button,
  .dismiss {
    display: grid;
    place-items: center;
    padding: var(--ame-space-1);
    border: 0;
    border-radius: var(--ame-radius);
    background: transparent;
    color: var(--ame-text-muted);
  }

  .icon-button:hover,
  .dismiss:hover {
    background: var(--ame-bg);
    color: var(--ame-text);
  }

  svg path {
    fill: none;
    stroke: currentColor;
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
