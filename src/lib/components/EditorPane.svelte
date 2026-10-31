<script lang="ts">
  import { formatShortcut } from '$lib/commands/shortcuts';
  import { shortcutOf } from '$lib/commands/registry';
  import { t } from '$lib/i18n';
  import type { EditorGroup } from '$lib/project/editors.svelte';
  import Editor from './Editor.svelte';
  import EditorTabs from './EditorTabs.svelte';

  let { group }: { group: EditorGroup } = $props();

  const file = $derived(group.active);
  const pending = $derived(group.pendingClose ? group.find(group.pendingClose) : undefined);
  const hints = $derived(
    (
      [
        ['palette.open', 'editor.hintPalette'],
        ['quickOpen.open', 'editor.hintQuickOpen'],
        ['search.open', 'editor.hintSearch'],
      ] as const
    ).flatMap(([id, label]) => {
      const shortcut = shortcutOf(id);
      return shortcut ? [{ label, keys: formatShortcut(shortcut) }] : [];
    }),
  );

  async function saveAndClose(path: string) {
    if (await group.save(path)) group.close(path, true);
  }
</script>

<div class="pane">
  {#if group.files.length}
    <EditorTabs {group} />
  {/if}

  {#if pending}
    <div
      class="bar"
      role="alertdialog"
      aria-label={t('editor.closePrompt', { name: pending.name })}
    >
      <span>{t('editor.closePrompt', { name: pending.name })}</span>
      <button class="primary" onclick={() => void saveAndClose(pending.path)}>
        {t('editor.save')}
      </button>
      <button onclick={() => group.close(pending.path, true)}>{t('editor.dontSave')}</button>
      <button onclick={() => (group.pendingClose = null)}>{t('editor.cancel')}</button>
    </div>
  {:else if file?.conflict}
    <div class="bar" role="alert">
      <span>{t('editor.changedOnDisk')}</span>
      <button class="primary" onclick={() => void group.reload(file.path)}>
        {t('editor.reload')}
      </button>
      <button onclick={() => group.keepMine(file.path)}>{t('editor.keepMine')}</button>
    </div>
  {:else if file?.deleted}
    <div class="bar" role="status"><span>{t('editor.deletedOnDisk')}</span></div>
  {/if}

  <div class="content">
    {#if !file}
      <div class="message">
        <p>{t('editor.empty')}</p>
        {#if hints.length}
          <dl class="hints">
            {#each hints as hint (hint.label)}
              <dt>{t(hint.label)}</dt>
              <dd><kbd>{hint.keys}</kbd></dd>
            {/each}
          </dl>
        {/if}
      </div>
    {:else if file.status === 'ready'}
      <Editor {group} {file} />
    {:else if file.status === 'binary'}
      <p class="message">{t('editor.binary')}</p>
    {:else if file.status === 'tooLarge'}
      <p class="message">{t('editor.tooLarge', { megabytes: file.detail })}</p>
    {:else if file.status === 'error'}
      <p class="message">{t('editor.loadFailed', { message: file.detail })}</p>
    {/if}
  </div>
</div>

<style>
  .pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }

  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--ame-space-2);
    padding: var(--ame-space-2) var(--ame-space-3);
    background: var(--ame-surface);
    border-bottom: 1px solid var(--ame-needs-input);
  }

  .bar span {
    flex: 1;
  }

  .bar button {
    padding: 2px var(--ame-space-3);
    border: 1px solid var(--ame-border);
    border-radius: var(--ame-radius);
    background: var(--ame-bg);
    color: var(--ame-text);
    font: inherit;
  }

  .bar button.primary {
    border-color: var(--ame-accent);
  }

  .content {
    flex: 1;
    min-height: 0;
  }

  .message {
    display: grid;
    place-content: center;
    gap: var(--ame-space-3);
    height: 100%;
    margin: 0;
    color: var(--ame-text-muted);
    text-align: center;
  }

  .message p {
    margin: 0;
  }

  .hints {
    display: grid;
    grid-template-columns: auto auto;
    gap: var(--ame-space-1) var(--ame-space-4);
    margin: 0;
    text-align: left;
  }

  .hints dd {
    margin: 0;
  }

  kbd {
    font-family: inherit;
  }
</style>
