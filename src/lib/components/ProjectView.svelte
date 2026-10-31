<script lang="ts">
  import { t } from '$lib/i18n';
  import type { Project } from '$lib/ipc/types';
  import { sessionFor } from '$lib/project/session';
  import { workspace } from '$lib/stores/workspace.svelte';
  import EditorPane from './EditorPane.svelte';
  import FileTree from './FileTree.svelte';
  import Resizer from './Resizer.svelte';

  let { project }: { project: Project } = $props();

  const session = $derived(sessionFor(project.path));
</script>

<div class="project-view" style:--side-width="{project.layout.sidePanelWidth}px">
  <aside class="side" aria-label={t('sidePanel.label')}>
    <FileTree tree={session.tree} onopen={(path) => void session.editors.open(path)} />
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
    min-width: 0;
    overflow: auto;
    background: var(--ame-surface);
  }

  .editor-area {
    min-width: 0;
    min-height: 0;
  }
</style>
