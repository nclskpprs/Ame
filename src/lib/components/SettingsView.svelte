<script lang="ts">
  import { t } from '$lib/i18n';
  import type {
    CloseAction,
    Density,
    FileOpen,
    RainEffects,
    ThemePreference,
  } from '$lib/ipc/bindings';
  import {
    densityOptions,
    fileOpenOptions,
    rainOptions,
    themeOptions,
  } from '$lib/settings/options';
  import { settings } from '$lib/stores/settings.svelte';
  import { view } from '$lib/stores/view.svelte';
  import AgentSettings from './AgentSettings.svelte';
  import SegmentedControl from './SegmentedControl.svelte';

  let root: HTMLElement | undefined = $state();

  $effect(() => {
    if (!root) return;
    root.focus();
    // Escape anywhere inside the settings returns to the project.
    const onkeydown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      view.close();
    };
    root.addEventListener('keydown', onkeydown);
    return () => root?.removeEventListener('keydown', onkeydown);
  });
</script>

<section class="settings" aria-labelledby="settings-title" tabindex="-1" bind:this={root}>
  <header class="header">
    <h1 id="settings-title">{t('settings.title')}</h1>
    <button
      class="close"
      aria-label={t('settings.close')}
      title={t('settings.closeHint')}
      onclick={() => view.close()}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </button>
  </header>

  <div class="content">
    <section class="group" aria-labelledby="settings-appearance">
      <h2 id="settings-appearance">{t('settings.appearance')}</h2>
      <div class="row">
        <span class="label">{t('settings.theme.label')}</span>
        <SegmentedControl
          name="settings-theme"
          label={t('settings.theme.label')}
          options={themeOptions()}
          value={settings.value.theme}
          onchange={(theme: ThemePreference) => void settings.update({ theme })}
        />
      </div>
      <div class="row">
        <span class="label">{t('settings.density.label')}</span>
        <SegmentedControl
          name="settings-density"
          label={t('settings.density.label')}
          options={densityOptions()}
          value={settings.value.density}
          onchange={(density: Density) => void settings.update({ density })}
        />
      </div>
      <div class="row">
        <div class="text">
          <span class="label">{t('settings.rain.label')}</span>
          <span class="description">{t('settings.rain.description')}</span>
        </div>
        <SegmentedControl
          name="settings-rain"
          label={t('settings.rain.label')}
          options={rainOptions()}
          value={settings.value.rainEffects}
          onchange={(rainEffects: RainEffects) => void settings.update({ rainEffects })}
        />
      </div>
    </section>

    <section class="group" aria-labelledby="settings-files">
      <h2 id="settings-files">{t('settings.files')}</h2>
      <div class="row">
        <div class="text">
          <span class="label">{t('settings.fileOpen.label')}</span>
          <span class="description">{t('settings.fileOpen.description')}</span>
        </div>
        <SegmentedControl
          name="settings-file-open"
          label={t('settings.fileOpen.label')}
          options={fileOpenOptions()}
          value={settings.value.fileOpen}
          onchange={(fileOpen: FileOpen) => void settings.update({ fileOpen })}
        />
      </div>
      <div class="row">
        <span class="label">{t('settings.fileIcons.label')}</span>
        <SegmentedControl
          name="settings-file-icons"
          label={t('settings.fileIcons.label')}
          options={[
            { value: 'on', label: t('settings.fileIcons.on') },
            { value: 'off', label: t('settings.fileIcons.off') },
          ]}
          value={settings.value.fileIcons ? 'on' : 'off'}
          onchange={(value) => void settings.update({ fileIcons: value === 'on' })}
        />
      </div>
    </section>

    <section class="group" aria-labelledby="settings-agents">
      <h2 id="settings-agents">{t('settings.agents.title')}</h2>
      <div class="row">
        <div class="text">
          <span class="label">{t('settings.agents.notifications')}</span>
          <span class="description">{t('settings.agents.notificationsDescription')}</span>
        </div>
        <SegmentedControl
          name="settings-notifications"
          label={t('settings.agents.notifications')}
          options={[
            { value: 'on', label: t('settings.agents.on') },
            { value: 'off', label: t('settings.agents.off') },
          ]}
          value={settings.value.notifications ? 'on' : 'off'}
          onchange={(value) => void settings.update({ notifications: value === 'on' })}
        />
      </div>
      <div class="row">
        <div class="text">
          <span class="label">{t('settings.closeAction.label')}</span>
          <span class="description">{t('settings.closeAction.description')}</span>
        </div>
        <SegmentedControl
          name="settings-close-action"
          label={t('settings.closeAction.label')}
          options={[
            { value: 'background', label: t('settings.closeAction.background') },
            { value: 'quit', label: t('settings.closeAction.quit') },
          ]}
          value={settings.value.closeAction}
          onchange={(value) => void settings.update({ closeAction: value as CloseAction })}
        />
      </div>
      <div class="row">
        <div class="text">
          <span class="label">{t('settings.checkpoints.label')}</span>
          <span class="description">{t('settings.checkpoints.description')}</span>
        </div>
        <SegmentedControl
          name="settings-checkpoints"
          label={t('settings.checkpoints.label')}
          options={[
            { value: 'on', label: t('settings.checkpoints.on') },
            { value: 'off', label: t('settings.checkpoints.off') },
          ]}
          value={settings.value.checkpoints ? 'on' : 'off'}
          onchange={(value) => void settings.update({ checkpoints: value === 'on' })}
        />
      </div>
      <p class="intro">{t('settings.agents.description')}</p>
      <AgentSettings />
    </section>
  </div>
</section>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    outline: none;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ame-space-3);
    padding: var(--ame-space-3) var(--ame-space-6);
    border-bottom: 1px solid var(--ame-border);
  }

  h1 {
    margin: 0;
    font-size: var(--ame-font-size-title);
    font-weight: 600;
  }

  .close {
    display: grid;
    place-items: center;
    padding: var(--ame-space-1);
    border: 0;
    border-radius: var(--ame-radius);
    background: transparent;
    color: var(--ame-text-muted);
  }

  .close:hover {
    background: var(--ame-surface);
    color: var(--ame-text);
  }

  .close path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
  }

  .content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--ame-space-4) var(--ame-space-6) var(--ame-space-6);
  }

  .group {
    max-width: 720px;
  }

  .group + .group {
    margin-top: var(--ame-space-6);
  }

  h2 {
    margin: 0 0 var(--ame-space-2);
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--ame-space-2) var(--ame-space-4);
    padding: var(--ame-space-3) 0;
    border-bottom: 1px solid var(--ame-border);
  }

  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .intro {
    margin: var(--ame-space-3) 0 var(--ame-space-2);
    color: var(--ame-text-muted);
  }

  .description {
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
  }
</style>
