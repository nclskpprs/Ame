<script lang="ts">
  import { t } from '$lib/i18n';
  import { isRunning, sessions } from '$lib/terminal/sessions.svelte';
  import { progressShare, updates } from '$lib/update/update.svelte';

  const running = $derived(sessions.list.filter(isRunning).length);
  const share = $derived(progressShare(updates.progress));
  const busy = $derived(updates.phase === 'downloading' || updates.phase === 'installing');

  function install() {
    void updates.requestInstall(running);
  }

  function focus(node: HTMLElement) {
    node.focus();
  }
</script>

{#if updates.available && updates.noticeShown}
  <section class="update" aria-label={t('update.label')} aria-live="polite">
    <p class="title">{t('update.available', { version: updates.available.version })}</p>
    {#if busy}
      <p class="detail">
        {updates.phase === 'installing'
          ? t('update.installing')
          : share === null
            ? t('update.downloading')
            : t('update.downloadingShare', { percent: Math.round(share * 100) })}
      </p>
      {#if share !== null}
        <div
          class="bar"
          role="progressbar"
          aria-label={t('update.downloading')}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={Math.round(share * 100)}
        >
          <span style:width="{share * 100}%"></span>
        </div>
      {/if}
    {:else if updates.confirming}
      <p class="detail">{t('update.confirmSessions', { count: running })}</p>
      <div class="actions">
        <button class="primary" onclick={install}>{t('update.installAnyway')}</button>
        <button use:focus onclick={() => (updates.confirming = false)}>{t('update.cancel')}</button>
      </div>
    {:else}
      <p class="detail">
        {updates.support === 'inApp' ? t('update.installHint') : t('update.downloadHint')}
      </p>
      <div class="actions">
        <button class="primary" onclick={install}>
          {updates.support === 'inApp' ? t('update.install') : t('update.download')}
        </button>
        <button onclick={() => updates.dismiss()}>{t('update.later')}</button>
      </div>
    {/if}
  </section>
{/if}

<style>
  .update {
    display: grid;
    gap: var(--ame-space-1);
    padding: var(--ame-space-2);
    border: 1px solid var(--ame-accent);
    border-radius: var(--ame-radius);
    background: var(--ame-bg);
  }

  p {
    margin: 0;
  }

  .title {
    color: var(--ame-text);
    font-weight: 600;
  }

  .detail {
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ame-space-2);
    margin-top: var(--ame-space-1);
  }

  button {
    padding: 2px var(--ame-space-2);
    border: 1px solid var(--ame-border);
    border-radius: var(--ame-radius);
    background: transparent;
    color: var(--ame-text);
    font: inherit;
    font-size: var(--ame-font-size-small);
  }

  button:hover {
    border-color: var(--ame-text-muted);
  }

  button.primary {
    border-color: var(--ame-accent);
    color: var(--ame-accent);
  }

  .bar {
    height: 3px;
    overflow: hidden;
    border-radius: var(--ame-radius);
    background: var(--ame-border);
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--ame-accent);
  }
</style>
