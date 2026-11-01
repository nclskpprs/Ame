<script lang="ts">
  import { stateLabels } from '$lib/agents/state';
  import { t } from '$lib/i18n';
  import type { Script } from '$lib/ipc/bindings';
  import type { ProjectSession } from '$lib/project/session';
  import { isRunning } from '$lib/terminal/sessions.svelte';
  import StatusDot from './StatusDot.svelte';

  let { session }: { session: ProjectSession } = $props();

  const terminals = $derived(session.terminals);

  /** The newest session of a script, running or not. */
  function lastRun(script: Script) {
    return terminals.sessions.filter((s) => s.profile === `script:${script.id}`).at(-1);
  }

  function show(id: number) {
    terminals.activate(id);
    terminals.show();
  }
</script>

<div class="scripts">
  <ul>
    {#each session.scripts.list as script (script.id)}
      {@const run = lastRun(script)}
      <li class="row">
        <button
          class="script"
          title={script.command}
          onclick={() => (run ? show(run.id) : void terminals.runScript(script.id))}
        >
          {#if run}
            <StatusDot
              state={run.state}
              label={isRunning(run)
                ? t(stateLabels[run.state])
                : run.status.state === 'exited' && run.status.exitCode === 0
                  ? t('scripts.succeeded')
                  : t('scripts.failed')}
            />
          {:else}
            <span class="idle" aria-hidden="true"></span>
          {/if}
          <span class="name">{script.name}</span>
          <span class="runner">{script.runner}</span>
        </button>
        {#if run && isRunning(run)}
          <button
            class="action"
            aria-label={t('scripts.stop', { name: script.name })}
            title={t('scripts.stop', { name: script.name })}
            onclick={() => void terminals.close(run.id, true)}
          >
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <rect x="4" y="4" width="8" height="8" rx="1" />
            </svg>
          </button>
        {:else}
          <button
            class="action"
            aria-label={t('scripts.run', { name: script.name })}
            title={t('scripts.run', { name: script.name })}
            onclick={() => {
              if (run) void terminals.close(run.id, true);
              void terminals.runScript(script.id);
            }}
          >
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path d="M5 3.5v9l7-4.5z" />
            </svg>
          </button>
        {/if}
      </li>
    {/each}
  </ul>
</div>

<style>
  .scripts {
    padding: var(--ame-space-2) 0;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .row {
    display: flex;
    align-items: center;
    padding-right: var(--ame-space-2);
  }

  .row:hover {
    background: var(--ame-surface);
  }

  .script {
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--ame-space-2);
    min-width: 0;
    padding: 2px var(--ame-space-3);
    border: 0;
    background: transparent;
    color: var(--ame-text);
    font: inherit;
    text-align: left;
  }

  .idle {
    flex: none;
    width: 8px;
    height: 8px;
    border: 1px solid var(--ame-text-muted);
    border-radius: 50%;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .runner {
    margin-left: auto;
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
  }

  .action {
    display: grid;
    place-items: center;
    padding: 2px;
    border: 0;
    border-radius: var(--ame-radius);
    background: transparent;
    color: var(--ame-text-muted);
  }

  .action:hover {
    background: var(--ame-bg);
    color: var(--ame-text);
  }

  .action path,
  .action rect {
    fill: currentColor;
  }
</style>
