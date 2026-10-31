<script lang="ts">
  import { t } from '$lib/i18n';
  import { iconName, iconUrl } from '$lib/fs/file-icons';
  import type { EditorGroup } from '$lib/project/editors.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import { currentTheme } from '$lib/theme/current.svelte';

  let { group }: { group: EditorGroup } = $props();

  function onauxclick(event: MouseEvent, path: string) {
    if (event.button === 1) group.close(path);
  }
</script>

<div class="tabs" role="tablist" aria-label={t('editor.tabs')}>
  {#each group.files as file (file.path)}
    <div class="tab" class:active={file.path === group.activePath} title={file.path}>
      <button
        class="label"
        role="tab"
        aria-selected={file.path === group.activePath}
        onclick={() => void group.activate(file.path)}
        onauxclick={(event) => onauxclick(event, file.path)}
      >
        {#if settings.value.fileIcons}
          <img
            class="icon"
            src={iconUrl(iconName(file.name, 'file'), currentTheme.name)}
            alt=""
            width="16"
            height="16"
            draggable="false"
          />
        {/if}
        {file.name}
      </button>
      <button
        class="close"
        class:dirty={file.dirty}
        aria-label={file.dirty ? t('editor.closeUnsaved') : t('editor.close')}
        title={file.dirty ? t('editor.closeUnsaved') : t('editor.close')}
        onclick={() => group.close(file.path)}
      >
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <circle class="dot" cx="8" cy="8" r="3.5" />
          <path class="cross" d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
        </svg>
      </button>
    </div>
  {/each}
</div>

<style>
  .tabs {
    display: flex;
    min-height: 0;
    overflow-x: auto;
    background: var(--ame-surface);
    border-bottom: 1px solid var(--ame-border);
    scrollbar-width: thin;
  }

  .tab {
    display: flex;
    flex: none;
    align-items: center;
    border-right: 1px solid var(--ame-border);
    color: var(--ame-text-muted);
  }

  .tab.active {
    background: var(--ame-bg);
    color: var(--ame-text);
    box-shadow: inset 0 2px 0 var(--ame-accent);
  }

  .label {
    display: flex;
    align-items: center;
    gap: var(--ame-space-2);
    padding: var(--ame-space-2) var(--ame-space-1) var(--ame-space-2) var(--ame-space-3);
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    white-space: nowrap;
  }

  .icon {
    flex: none;
  }

  .close {
    display: grid;
    place-items: center;
    margin-right: var(--ame-space-2);
    padding: 2px;
    border: 0;
    border-radius: var(--ame-radius);
    background: transparent;
    color: inherit;
  }

  .close:hover {
    background: var(--ame-surface);
  }

  .cross {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    opacity: 0;
  }

  .dot {
    fill: currentColor;
    opacity: 0;
  }

  .tab:hover .cross,
  .tab.active .cross,
  .close:focus-visible .cross {
    opacity: 1;
  }

  .close.dirty .dot {
    opacity: 1;
  }

  .close.dirty:hover .dot,
  .close.dirty:focus-visible .dot {
    opacity: 0;
  }

  .tab .close.dirty .cross {
    opacity: 0;
  }

  .tab .close.dirty:hover .cross,
  .tab .close.dirty:focus-visible .cross {
    opacity: 1;
  }
</style>
