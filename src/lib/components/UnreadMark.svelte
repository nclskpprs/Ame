<script lang="ts">
  import { t } from '$lib/i18n';

  /** A small dot for an agent result the user has not looked at yet. */
</script>

<span class="unread" title={t('unread.label')}>
  <span class="visually-hidden">{t('unread.label')}</span>
</span>

<style>
  .unread {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ame-accent);
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
