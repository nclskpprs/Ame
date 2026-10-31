<script lang="ts">
  import { t } from '$lib/i18n';
  import DropMark from './DropMark.svelte';
</script>

<section class="empty-state">
  <DropMark size={56} />
  <h1 class="title">{t('emptyState.title')}</h1>
  <p class="description">{t('emptyState.description')}</p>
</section>

<style>
  .empty-state {
    display: flex;
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
</style>
