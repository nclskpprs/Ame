<script lang="ts">
  import { openAgentPicker } from '$lib/agents/picker';
  import { shortcutOf } from '$lib/commands/registry';
  import { formatShortcut } from '$lib/commands/shortcuts';
  import { t } from '$lib/i18n';
  import type { TerminalGroup } from '$lib/project/terminals.svelte';
  import StatusDot from './StatusDot.svelte';

  /**
   * Shown below the editor while the terminal panel is hidden: opens it and
   * starts a shell or an agent without the keyboard.
   */
  let { group }: { group: TerminalGroup } = $props();

  function withShortcut(label: string, command: string): string {
    const shortcut = shortcutOf(command);
    return shortcut ? `${label} (${formatShortcut(shortcut)})` : label;
  }
</script>

<div class="strip">
  <button
    class="show"
    title={withShortcut(t('terminal.show'), 'terminal.toggle')}
    onclick={() => group.show()}
  >
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M4 10l4-4 4 4" />
    </svg>
    {t('terminal.panel')}
    {#each group.sessions as session (session.id)}
      <StatusDot state={session.state} label={session.title} />
    {/each}
  </button>
  <button
    title={withShortcut(t('terminal.newShell'), 'terminal.newShell')}
    onclick={() => void group.startShell()}
  >
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M3 4.5l3 3-3 3M8 11.5h5" />
    </svg>
    {t('terminal.newShell')}
  </button>
  <button
    title={withShortcut(t('terminal.startAgent'), 'agents.start')}
    onclick={() => openAgentPicker(group)}
  >
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M8 3v10M3 8h10" />
    </svg>
    {t('terminal.startAgent')}
  </button>
</div>

<style>
  .strip {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--ame-space-1);
    padding: 0 var(--ame-space-2);
    background: var(--ame-surface);
    border-top: 1px solid var(--ame-border);
  }

  button {
    display: flex;
    align-items: center;
    gap: var(--ame-space-1);
    margin: 2px 0;
    padding: 2px var(--ame-space-2);
    border: 0;
    border-radius: var(--ame-radius);
    background: transparent;
    color: var(--ame-text-muted);
    font: inherit;
    font-size: var(--ame-font-size-small);
    white-space: nowrap;
  }

  button:hover {
    background: var(--ame-bg);
    color: var(--ame-text);
  }

  .show {
    margin-right: auto;
  }

  svg path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
