<script lang="ts">
  import type { Project } from '$lib/ipc/types';

  let { project }: { project: Project } = $props();
</script>

<section class="project-view">
  <header class="header">
    <h1 class="name">{project.name}</h1>
    <span class="path">{project.path}</span>
  </header>
</section>

<style>
  .project-view {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-width: 0;
  }

  .header {
    display: flex;
    align-items: baseline;
    gap: var(--ame-space-3);
    padding: var(--ame-space-3) var(--ame-space-4);
    border-bottom: 1px solid var(--ame-border);
  }

  .name {
    margin: 0;
    font-size: var(--ame-font-size);
    font-weight: 600;
  }

  .path {
    overflow: hidden;
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
