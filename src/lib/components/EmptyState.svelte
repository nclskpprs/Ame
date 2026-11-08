<script lang="ts">
  import { formatShortcut } from '$lib/commands/shortcuts';
  import { shortcutOf } from '$lib/commands/registry';
  import { t } from '$lib/i18n';
  import { workspace } from '$lib/stores/workspace.svelte';
  import DropMark from './DropMark.svelte';

  const shortcut = shortcutOf('workspace.openFolder');
</script>

<section class="empty-state">
  <DropMark size={56} />
  <h1 class="title">{t('emptyState.title')}</h1>
  <p class="description">{t('emptyState.description')}</p>
  <button class="btn large primary" onclick={() => void workspace.openFolder()}>
    {t('emptyState.openFolder')}
    {#if shortcut}<kbd>{formatShortcut(shortcut)}</kbd>{/if}
  </button>
</section>

<style>
  .empty-state {
    display: flex;
    place-self: center;
    flex-direction: column;
    align-items: center;
    gap: var(--ame-space-2);
    max-width: 420px;
    padding: var(--ame-space-6);
    text-align: center;
  }

  .title {
    margin: var(--ame-space-2) 0 0;
    font-size: var(--ame-font-size-title);
    font-weight: 600;
  }

  .description {
    margin: 0;
    color: var(--ame-text-muted);
  }

  .primary {
    margin-top: var(--ame-space-3);
  }

  kbd {
    color: var(--ame-text-muted);
    font-family: inherit;
    font-size: var(--ame-font-size-small);
  }
</style>
