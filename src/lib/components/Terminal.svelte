<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { t } from '$lib/i18n';
  import type { SessionInfo } from '$lib/ipc/types';
  import type { TerminalGroup } from '$lib/project/terminals.svelte';
  import { TerminalView } from '$lib/terminal/terminal-view';
  import { terminalTheme } from '$lib/terminal/theme';
  import { currentTheme } from '$lib/theme/current.svelte';
  import { palettes } from '$lib/theme/tokens';

  let { session, group }: { session: SessionInfo; group: TerminalGroup } = $props();

  let container: HTMLElement;
  // The parent keys this component by session id, so the id never changes.
  const view = new TerminalView(untrack(() => session.id));

  onMount(() => {
    void view.mount(container, {
      theme: terminalTheme(palettes[currentTheme.name]),
      onResize: (cols, rows) => (group.size = { cols, rows }),
    });
    return () => view.dispose();
  });

  $effect(() => view.setTheme(terminalTheme(palettes[currentTheme.name])));

  $effect(() => {
    if (!group.focusPending) return;
    group.focusPending = false;
    view.focus();
  });
</script>

<div
  class="terminal"
  role="region"
  aria-label={t('terminal.label', { title: session.title })}
  bind:this={container}
></div>

<style>
  .terminal {
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: var(--ame-space-1) 0 0 var(--ame-space-2);
    background: var(--ame-bg);
  }

  /* xterm.js sizes itself to the container; keep its scrollbar calm. */
  .terminal :global(.xterm) {
    height: 100%;
  }
</style>
