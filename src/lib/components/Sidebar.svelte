<script lang="ts">
  import { t } from '$lib/i18n';
  import { settings } from '$lib/stores/settings.svelte';
  import ThemeSwitcher from './ThemeSwitcher.svelte';
</script>

<nav class="sidebar" aria-label={t('sidebar.label')}>
  <header class="brand">
    <span class="name">{t('app.name')}</span>
    <span class="tagline">{t('app.tagline')}</span>
  </header>

  <section class="projects">
    <h2 class="section-label">{t('sidebar.label')}</h2>
    <p class="muted">{t('sidebar.empty')}</p>
  </section>

  <footer class="footer">
    {#if settings.saveError}
      <p class="error" role="alert">
        {t('settings.saveFailed', { message: settings.saveError })}
      </p>
    {/if}
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
    padding: var(--ame-space-4) var(--ame-space-3);
    background: var(--ame-surface);
    border-right: 1px solid var(--ame-border);
  }

  .brand {
    display: flex;
    flex-direction: column;
    padding: 0 var(--ame-space-1);
  }

  .name {
    font-size: var(--ame-font-size-title);
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .tagline,
  .muted {
    color: var(--ame-text-muted);
  }

  .projects {
    flex: 1;
    padding: 0 var(--ame-space-1);
  }

  .section-label {
    margin: 0 0 var(--ame-space-2);
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .muted {
    margin: 0;
  }

  .footer {
    display: flex;
    flex-direction: column;
    gap: var(--ame-space-2);
  }

  .error {
    margin: 0;
    padding: var(--ame-space-2);
    border: 1px solid var(--ame-error);
    border-radius: var(--ame-radius);
    color: var(--ame-text);
    font-size: var(--ame-font-size-small);
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
