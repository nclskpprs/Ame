<script lang="ts">
  import { t } from '$lib/i18n';
  import type { Project } from '$lib/ipc/types';
  import { sessionFor } from '$lib/project/session';
  import { workspace } from '$lib/stores/workspace.svelte';
  import EditorPane from './EditorPane.svelte';
  import FileTree from './FileTree.svelte';
  import Resizer from './Resizer.svelte';
  import SearchPanel from './SearchPanel.svelte';
  import type { SidePanel } from '$lib/ipc/bindings';

  let { project }: { project: Project } = $props();

  const session = $derived(sessionFor(project.path));
  const panels: { id: SidePanel; label: 'sidePanel.files' | 'sidePanel.search' }[] = [
    { id: 'files', label: 'sidePanel.files' },
    { id: 'search', label: 'sidePanel.search' },
  ];
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
        </button>
      {/each}
    </div>
    <div class="panel" role="tabpanel">
      {#if project.layout.sidePanel === 'search'}
        <SearchPanel {session} />
      {:else}
        <FileTree tree={session.tree} onopen={(path) => void session.editors.open(path)} />
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
    <EditorPane group={session.editors} />
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
    gap: var(--ame-space-3);
    padding: var(--ame-space-2) var(--ame-space-3) 0;
    border-bottom: 1px solid var(--ame-border);
  }

  .panel-tabs button {
    padding: var(--ame-space-1) 0;
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: var(--ame-text-muted);
    font: inherit;
    font-size: var(--ame-font-size-small);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
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
    min-width: 0;
    min-height: 0;
  }
</style>
