<script lang="ts">
  import { formatShortcut } from '$lib/commands/shortcuts';
  import { shortcutOf } from '$lib/commands/registry';
  import { t } from '$lib/i18n';
  import type { Project } from '$lib/ipc/types';
  import { contextMenu } from '$lib/menu/context-menu.svelte';
  import { closeGuard } from '$lib/project/close-guard.svelte';
  import type { MenuEntry } from '$lib/menu/menu';
  import { combinedState, stateLabels } from '$lib/agents/state';
  import { sessions } from '$lib/terminal/sessions.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import StatusDot from './StatusDot.svelte';
  import { groupNames, projectSections, type ProjectSection } from '$lib/workspace/sections';

  const sections = $derived(projectSections(workspace.projects));
  /** The most urgent agent state per project with sessions. */
  const states = $derived(
    new Map(
      workspace.projects.flatMap((project) => {
        const state = combinedState(sessions.forProject(project.path));
        return state ? [[project.path, state] as const] : [];
      }),
    ),
  );
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

  function showMenu(event: MouseEvent, project: Project) {
    const otherGroups = groupNames(workspace.projects).filter((g) => g !== project.group);
    contextMenu.show(event, project.name, [
      {
        kind: 'action',
        label: t(project.pinned ? 'projectMenu.unpin' : 'projectMenu.pin'),
        run: () => workspace.setPinned(project.path, !project.pinned),
      },
      {
        kind: 'action',
        label: t(project.muted ? 'projectMenu.unmute' : 'projectMenu.mute'),
        run: () => workspace.setMuted(project.path, !project.muted),
      },
      {
        kind: 'submenu',
        label: t('projectMenu.moveToGroup'),
        items: [
          ...otherGroups.map((group): MenuEntry => ({
            kind: 'action',
            label: group,
            run: () => workspace.setGroup(project.path, group),
          })),
          ...(otherGroups.length ? [{ kind: 'separator' } as const] : []),
          {
            kind: 'action',
            label: t('projectMenu.newGroup'),
            run: () => (editingGroupOf = project.path),
          },
          ...(project.group
            ? [
                {
                  kind: 'action',
                  label: t('projectMenu.removeFromGroup'),
                  run: () => workspace.setGroup(project.path, null),
                } as const,
              ]
            : []),
        ],
      },
      { kind: 'separator' },
      {
        kind: 'action',
        label: t('projectMenu.close'),
        run: () => closeGuard.closeProject(project.path),
      },
    ]);
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
            oncontextmenu={(event) => showMenu(event, project)}
          >
            <span class="name">{project.name}</span>
            <kbd class="hint">{hint(project)}</kbd>
            {#if states.has(project.path)}
              <StatusDot
                state={states.get(project.path) ?? 'idle'}
                label={t('status.projectLabel', {
                  project: project.name,
                  state: t(stateLabels[states.get(project.path) ?? 'idle']),
                })}
              />
            {/if}
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
