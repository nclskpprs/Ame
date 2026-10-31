<script lang="ts">
  import type { ThemePreference } from '$lib/ipc/bindings';
  import { t, type MessageKey } from '$lib/i18n';
  import { settings } from '$lib/stores/settings.svelte';

  const options: { value: ThemePreference; label: MessageKey }[] = [
    { value: 'system', label: 'settings.theme.system' },
    { value: 'dark', label: 'settings.theme.dark' },
    { value: 'light', label: 'settings.theme.light' },
  ];
</script>

<fieldset class="switcher">
  <legend class="visually-hidden">{t('settings.theme.label')}</legend>
  {#each options as option (option.value)}
    <label class:selected={settings.value.theme === option.value}>
      <input
        type="radio"
        name="theme"
        value={option.value}
        checked={settings.value.theme === option.value}
        onchange={() => void settings.update({ theme: option.value })}
      />
      {t(option.label)}
    </label>
  {/each}
</fieldset>

<style>
  .switcher {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 2px;
    margin: 0;
    padding: 2px;
    border: 1px solid var(--ame-border);
    border-radius: var(--ame-radius);
  }

  label {
    position: relative;
    padding: var(--ame-space-1) 0;
    border-radius: calc(var(--ame-radius) - 2px);
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
    text-align: center;
    transition:
      background var(--ame-transition),
      color var(--ame-transition);
  }

  label:hover {
    color: var(--ame-text);
  }

  label.selected {
    background: var(--ame-bg);
    color: var(--ame-text);
  }

  label:has(input:focus-visible) {
    outline: 2px solid var(--ame-accent);
    outline-offset: 1px;
  }

  input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
