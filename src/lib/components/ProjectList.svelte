<script lang="ts">
  import { Menu } from '@tauri-apps/api/menu';
  import { formatShortcut } from '$lib/commands/shortcuts';
  import { shortcutOf } from '$lib/commands/registry';
  import { t } from '$lib/i18n';
  import type { Project } from '$lib/ipc/types';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { groupNames, projectSections, type ProjectSection } from '$lib/workspace/sections';

  const sections = $derived(projectSections(workspace.projects));
  /** Index of each project in sidebar order, for the Mod+1…9 hints. */
  const indexOf = $derived(
    new Map(sections.flatMap((s) => s.projects).map((p, i) => [p.path, i] as const)),
  );

  let editingGroupOf = $state<string | null>(null);

  function sectionTitle(section: ProjectSection): string {
    if (section.kind === 'pinned') return t('sidebar.pinned');
    if (section.kind === 'group') return section.title ?? '';
    return t('sidebar.projects');
  }

  function hint(project: Project): string {
    const index = indexOf.get(project.path) ?? 9;
    const shortcut = index < 9 ? shortcutOf(`workspace.switchProject${index + 1}`) : null;
    return shortcut ? formatShortcut(shortcut) : '';
  }

  async function showMenu(event: MouseEvent, project: Project) {
    event.preventDefault();
    const otherGroups = groupNames(workspace.projects).filter((g) => g !== project.group);
    const menu = await Menu.new({
      items: [
        {
          text: t(project.pinned ? 'projectMenu.unpin' : 'projectMenu.pin'),
          action: () => void workspace.setPinned(project.path, !project.pinned),
        },
        {
          text: t('projectMenu.moveToGroup'),
          items: [
            ...otherGroups.map((group) => ({
              text: group,
              action: () => void workspace.setGroup(project.path, group),
            })),
            ...(otherGroups.length ? [{ item: 'Separator' as const }] : []),
            { text: t('projectMenu.newGroup'), action: () => (editingGroupOf = project.path) },
            ...(project.group
              ? [
                  {
                    text: t('projectMenu.removeFromGroup'),
                    action: () => void workspace.setGroup(project.path, null),
                  },
                ]
              : []),
          ],
        },
        { item: 'Separator' },
        {
          text: t('projectMenu.close'),
          action: () => void workspace.remove(project.path),
        },
      ],
    });
    await menu.popup();
  }

  function commitGroup(project: Project, input: HTMLInputElement) {
    editingGroupOf = null;
    void workspace.setGroup(project.path, input.value);
  }

  function onGroupKey(event: KeyboardEvent, project: Project) {
    const input = event.currentTarget as HTMLInputElement;
    if (event.key === 'Enter') commitGroup(project, input);
    if (event.key === 'Escape') editingGroupOf = null;
  }

  function focus(node: HTMLInputElement) {
    node.focus();
  }
</script>

{#if sections.length === 0}
  <p class="muted">{t('sidebar.empty')}</p>
{/if}

{#each sections as section (section.kind + (section.title ?? ''))}
  <section class="section">
    <h2 class="section-label">{sectionTitle(section)}</h2>
    <ul>
      {#each section.projects as project (project.path)}
        <li>
          <button
            class="project"
            class:active={project.path === workspace.activePath}
            aria-current={project.path === workspace.activePath ? 'page' : undefined}
            title={project.path}
            onclick={() => void workspace.activate(project.path)}
            oncontextmenu={(event) => void showMenu(event, project)}
          >
            <span class="name">{project.name}</span>
            <kbd class="hint">{hint(project)}</kbd>
          </button>
          {#if editingGroupOf === project.path}
            <input
              class="group-input"
              placeholder={t('sidebar.groupName')}
              aria-label={t('sidebar.groupName')}
              value={project.group ?? ''}
              use:focus
              onkeydown={(event) => onGroupKey(event, project)}
              onblur={() => (editingGroupOf = null)}
            />
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/each}

<style>
  .muted {
    margin: 0;
    padding: 0 var(--ame-space-1);
    color: var(--ame-text-muted);
  }

  .section + .section {
    margin-top: var(--ame-space-3);
  }

  .section-label {
    margin: 0 0 var(--ame-space-1);
    padding: 0 var(--ame-space-1);
    overflow: hidden;
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-overflow: ellipsis;
    text-transform: uppercase;
    white-space: nowrap;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .project {
    display: flex;
    align-items: center;
    gap: var(--ame-space-2);
    width: 100%;
    padding: var(--ame-space-1) var(--ame-space-2);
    border: 0;
    border-radius: var(--ame-radius);
    background: transparent;
    color: var(--ame-text-muted);
    font: inherit;
    text-align: left;
  }

  .project:hover {
    color: var(--ame-text);
  }

  .project.active {
    background: var(--ame-bg);
    color: var(--ame-text);
  }

  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .hint {
    color: var(--ame-text-muted);
    font-family: inherit;
    font-size: var(--ame-font-size-small);
    opacity: 0;
    transition: opacity var(--ame-transition);
  }

  .project:hover .hint,
  .project:focus-visible .hint {
    opacity: 1;
  }

  .group-input {
    width: 100%;
    margin-top: var(--ame-space-1);
    padding: var(--ame-space-1) var(--ame-space-2);
    border: 1px solid var(--ame-accent);
    border-radius: var(--ame-radius);
    background: var(--ame-bg);
    color: var(--ame-text);
    font: inherit;
  }
</style>
