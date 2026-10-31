<script lang="ts">
  import { t } from '$lib/i18n';
  import type { SessionInfo } from '$lib/ipc/types';
  import type { TerminalGroup } from '$lib/project/terminals.svelte';
  import { isRunning } from '$lib/terminal/sessions.svelte';
  import Terminal from './Terminal.svelte';

  let { group }: { group: TerminalGroup } = $props();

  const active = $derived(group.active);
  const pending = $derived(
    group.pendingClose === null
      ? undefined
      : group.sessions.find((s) => s.id === group.pendingClose),
  );

  function exitText(session: SessionInfo): string {
    if (session.status.state !== 'exited') return '';
    return session.status.signal
      ? t('terminal.endedBySignal', { signal: session.status.signal })
      : t('terminal.exited', { code: session.status.exitCode });
  }

  function onauxclick(event: MouseEvent, id: number) {
    if (event.button === 1) void group.close(id);
  }
</script>

<section class="panel" aria-label={t('terminal.panel')}>
  <div class="bar">
    <div class="tabs" role="tablist" aria-label={t('terminal.sessions')}>
      {#each group.sessions as session (session.id)}
        <div class="tab" class:active={session.id === active?.id}>
          <button
            class="label"
            role="tab"
            aria-selected={session.id === active?.id}
            title={isRunning(session) ? session.title : exitText(session)}
            onclick={() => group.activate(session.id)}
            onauxclick={(event) => onauxclick(event, session.id)}
          >
            <span class="state" class:exited={!isRunning(session)} aria-hidden="true"></span>
            {session.title}
          </button>
          <button
            class="icon close"
            aria-label={t('terminal.close', { title: session.title })}
            title={t('terminal.close', { title: session.title })}
            onclick={() => void group.close(session.id)}
          >
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
            </svg>
          </button>
        </div>
      {/each}
    </div>
    <button
      class="icon"
      aria-label={t('terminal.newShell')}
      title={t('terminal.newShell')}
      onclick={() => void group.startShell()}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M8 3v10M3 8h10" />
      </svg>
    </button>
    <button
      class="icon"
      aria-label={t('terminal.hide')}
      title={t('terminal.hide')}
      onclick={() => group.hide()}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M4 6l4 4 4-4" />
      </svg>
    </button>
  </div>

  {#if pending}
    <div
      class="notice"
      role="alertdialog"
      aria-label={t('terminal.stopPrompt', { title: pending.title })}
    >
      <span>{t('terminal.stopPrompt', { title: pending.title })}</span>
      <button class="primary" onclick={() => void group.close(pending.id, true)}>
        {t('terminal.stopAndClose')}
      </button>
      <button onclick={() => (group.pendingClose = null)}>{t('terminal.cancel')}</button>
    </div>
  {:else if active && !isRunning(active)}
    <div class="notice" role="status">
      <span>{exitText(active)}</span>
      <button class="primary" onclick={() => void group.restart(active.id)}>
        {t('terminal.restart')}
      </button>
      <button onclick={() => void group.close(active.id)}>{t('terminal.closeExited')}</button>
    </div>
  {/if}

  <div class="body">
    {#if active}
      {#key active.id}
        <Terminal session={active} {group} />
      {/key}
    {:else}
      <div class="empty">
        <p>{t('terminal.empty')}</p>
        <button class="primary" onclick={() => void group.startShell()}>
          {t('terminal.newShell')}
        </button>
      </div>
    {/if}
  </div>
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--ame-bg);
  }

  .bar {
    display: flex;
    align-items: stretch;
    min-height: 0;
    background: var(--ame-surface);
    border-bottom: 1px solid var(--ame-border);
  }

  .tabs {
    display: flex;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
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
    padding: var(--ame-space-1) var(--ame-space-1) var(--ame-space-1) var(--ame-space-3);
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    white-space: nowrap;
  }

  .state {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ame-accent);
  }

  .state.exited {
    background: var(--ame-text-muted);
  }

  .icon {
    display: grid;
    place-items: center;
    margin: var(--ame-space-1);
    padding: 2px;
    border: 0;
    border-radius: var(--ame-radius);
    background: transparent;
    color: var(--ame-text-muted);
  }

  .icon:hover {
    background: var(--ame-bg);
    color: var(--ame-text);
  }

  .close {
    margin-left: 0;
  }

  .tab:not(:hover, .active) .close:not(:focus-visible) {
    opacity: 0;
  }

  svg path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .notice {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--ame-space-2);
    padding: var(--ame-space-1) var(--ame-space-3);
    background: var(--ame-surface);
    border-bottom: 1px solid var(--ame-border);
  }

  .notice[role='alertdialog'] {
    border-bottom-color: var(--ame-needs-input);
  }

  .notice span {
    flex: 1;
    color: var(--ame-text-muted);
  }

  .notice button,
  .empty button {
    padding: 2px var(--ame-space-3);
    border: 1px solid var(--ame-border);
    border-radius: var(--ame-radius);
    background: var(--ame-bg);
    color: var(--ame-text);
    font: inherit;
  }

  button.primary {
    border-color: var(--ame-accent);
  }

  .body {
    flex: 1;
    min-height: 0;
  }

  .empty {
    display: grid;
    place-content: center;
    justify-items: center;
    gap: var(--ame-space-2);
    height: 100%;
    color: var(--ame-text-muted);
  }

  .empty p {
    margin: 0;
  }
</style>
