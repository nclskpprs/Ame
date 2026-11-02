<script lang="ts">
  import { withAncestors } from '$lib/fs/paths';
  import { t } from '$lib/i18n';
  import type { Project } from '$lib/ipc/types';
  import { sessionFor } from '$lib/project/session';
  import { settings } from '$lib/stores/settings.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import ChangesPanel from './ChangesPanel.svelte';
  import EditorPane from './EditorPane.svelte';
  import FileTree from './FileTree.svelte';
  import Resizer from './Resizer.svelte';
  import ScriptsPanel from './ScriptsPanel.svelte';
  import SearchPanel from './SearchPanel.svelte';
  import TerminalPanel from './TerminalPanel.svelte';
  import TerminalStrip from './TerminalStrip.svelte';
  import type { SidePanel } from '$lib/ipc/bindings';
  import { untrack } from 'svelte';
  import { agents } from '$lib/agents/agents.svelte';
  import { sessions } from '$lib/terminal/sessions.svelte';

  let { project }: { project: Project } = $props();

  const session = $derived(sessionFor(project.path));
  const unsaved = $derived(withAncestors(session.editors.dirtyFiles.map((file) => file.path)));
  type PanelLabel =
    'sidePanel.files' | 'sidePanel.search' | 'sidePanel.changes' | 'sidePanel.scripts';
  /**
   * The changes panel appears only in git repositories, the scripts panel
   * only when there are scripts (progressive disclosure).
   */
  const panels = $derived<{ id: SidePanel; label: PanelLabel }[]>([
    { id: 'files', label: 'sidePanel.files' },
    { id: 'search', label: 'sidePanel.search' },
    ...(session.git.status
      ? [{ id: 'changes' as const, label: 'sidePanel.changes' as const }]
      : []),
    ...(session.scripts.list.length
      ? [{ id: 'scripts' as const, label: 'sidePanel.scripts' as const }]
      : []),
  ]);
  const changeCount = $derived(session.git.status?.files.length ?? 0);

  // Starts the preferred agent the first time the project is shown (if it
  // has no sessions); see TerminalGroup.autoStart.
  $effect(() => {
    const profile = settings.value.startAgent;
    if (sessions.initial === null) return;
    const terminals = session.terminals;
    untrack(() => {
      void agents.load().then((list) => {
        const installed = list.some((agent) => agent.profile.id === profile && agent.path);
        return terminals.autoStart(installed ? profile : '');
      });
    });
  });
</script>

<div class="project-view" style:--side-width="{project.layout.sidePanelWidth}px">
  <aside class="side" aria-label={t('sidePanel.label')}>
    <div class="panel-tabs" role="tablist">
      {#each panels as panel (panel.id)}
        <button
          role="tab"
          aria-selected={project.layout.sidePanel === panel.id}
          onclick={() => workspace.updateLayout(project.path, { sidePanel: panel.id })}
        >
          {t(panel.label)}
          {#if panel.id === 'changes' && changeCount}
            <span class="count">{changeCount}</span>
          {/if}
        </button>
      {/each}
    </div>
    <div class="panel" role="tabpanel">
      {#if project.layout.sidePanel === 'search'}
        <SearchPanel {session} />
      {:else if project.layout.sidePanel === 'changes' && session.git.status}
        <ChangesPanel {session} />
      {:else if project.layout.sidePanel === 'scripts' && session.scripts.list.length}
        <ScriptsPanel {session} />
      {:else}
        <FileTree
          tree={session.tree}
          {unsaved}
          git={session.git.marks}
          recent={session.git.recentMarks}
          icons={settings.value.fileIcons}
          singleClick={settings.value.fileOpen === 'singleClick'}
          ops={session}
          onopen={(path) => void session.editors.open(path)}
        />
      {/if}
    </div>
  </aside>
  <Resizer
    value={project.layout.sidePanelWidth}
    min={160}
    max={640}
    label={t('sidePanel.resize')}
    onchange={(width) => workspace.updateLayout(project.path, { sidePanelWidth: width })}
  />
  <section class="editor-area">
    <div class="editor">
      <EditorPane
        group={session.editors}
        following={session.following}
        onstopfollowing={() => session.setFollowing(false)}
      />
    </div>
    {#if project.layout.terminalOpen}
      <Resizer
        orientation="horizontal"
        invert
        value={project.layout.terminalHeight}
        min={96}
        max={2000}
        label={t('terminal.resize')}
        onchange={(height) => workspace.updateLayout(project.path, { terminalHeight: height })}
      />
      <div class="terminal" style:--terminal-height="{project.layout.terminalHeight}px">
        <TerminalPanel group={session.terminals} />
      </div>
    {:else}
      <TerminalStrip group={session.terminals} />
    {/if}
  </section>
</div>

<style>
  .project-view {
    display: grid;
    grid-template-columns: var(--side-width) auto 1fr;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }

  .side {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    background: var(--ame-surface);
  }

  .panel-tabs {
    display: flex;
    column-gap: var(--ame-space-2);
    padding: var(--ame-space-2) var(--ame-space-3) 0;
    overflow-x: auto;
    border-bottom: 1px solid var(--ame-border);
    scrollbar-width: none;
  }

  .panel-tabs button {
    flex: none;
    padding: var(--ame-space-1) 0;
    white-space: nowrap;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--ame-text-muted);
    font: inherit;
    font-size: var(--ame-font-size-small);
    font-weight: 600;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .count {
    margin-left: var(--ame-space-1);
    font-weight: 400;
  }

  .panel-tabs button[aria-selected='true'] {
    border-bottom-color: var(--ame-accent);
    color: var(--ame-text);
  }

  .panel {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .editor-area {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .editor {
    flex: 1;
    min-height: 96px;
  }

  .terminal {
    flex: none;
    /* Leave room for the editor when the window gets small. */
    height: min(var(--terminal-height), calc(100% - 96px));
    min-height: 0;
  }
</style>
