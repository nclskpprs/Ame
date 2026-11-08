<script lang="ts">
  import { formatShortcut } from '$lib/commands/shortcuts';
  import { shortcutOf } from '$lib/commands/registry';
  import { t } from '$lib/i18n';
  import type { Project } from '$lib/ipc/types';
  import { contextMenu } from '$lib/menu/context-menu.svelte';
  import { closeGuard } from '$lib/project/close-guard.svelte';
  import type { MenuEntry } from '$lib/menu/menu';
  import { copyPath, revealEntry, revealLabel } from '$lib/fs/reveal';
  import { combinedRain, combinedState, stateLabels } from '$lib/agents/state';
  import { sessions } from '$lib/terminal/sessions.svelte';
  import { view } from '$lib/stores/view.svelte';
  import { pageProject } from '$lib/stores/navigation';
  import { workspace } from '$lib/stores/workspace.svelte';
  import StatusDot from './StatusDot.svelte';
  import UnreadMark from './UnreadMark.svelte';
  import { unread } from '$lib/agents/unread.svelte';
  import { describeUsage, formatMemory } from '$lib/agents/usage';
  import { usage } from '$lib/agents/usage.svelte';
  import {
    groupNames,
    projectSections,
    sectionDrop,
    type ProjectSection,
  } from '$lib/workspace/sections';

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
  /** Rain density and sent prompts per project. */
  const rains = $derived(
    new Map(
      workspace.projects.map((project) => [
        project.path,
        combinedRain(sessions.forProject(project.path)),
      ]),
    ),
  );
  /** CPU and memory of each project's running sessions. */
  const usages = $derived(
    new Map(workspace.projects.map((project) => [project.path, usage.forProject(project.path)])),
  );
  /** Index of each project in sidebar order, for the Mod+1…9 hints. */
  const indexOf = $derived(
    new Map(sections.flatMap((s) => s.projects).map((p, i) => [p.path, i] as const)),
  );

  /** Projects with an agent result the user has not looked at yet. */
  const unreadProjects = $derived(
    new Set(unread.among(sessions.list).map((session) => session.project)),
  );

  /** The project whose page (or board) is shown; none on the dashboard. */
  const current = $derived(pageProject(view.page));

  let editingGroupOf = $state<string | null>(null);

  /** Path of the project being dragged, and the section it hovers. */
  let dragging = $state<string | null>(null);
  let dropKey = $state<string | null>(null);
  const draggedProject = $derived(workspace.projects.find((p) => p.path === dragging) ?? null);
  /** While dragging, an empty "Projects" section to take a project out of its group. */
  const shownSections = $derived(
    draggedProject && !sections.some((s) => s.kind === 'projects')
      ? [...sections, { kind: 'projects' as const, projects: [] }]
      : sections,
  );

  function sectionKey(section: Pick<ProjectSection, 'kind' | 'title'>): string {
    return section.kind + (section.title ?? '');
  }

  function ondragstart(event: DragEvent, project: Project) {
    if (!event.dataTransfer) return;
    dragging = project.path;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', project.name);
  }

  function ondragover(event: DragEvent, section: ProjectSection) {
    if (!draggedProject || !sectionDrop(draggedProject, section)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    dropKey = sectionKey(section);
  }

  function ondragleave(event: DragEvent, section: ProjectSection) {
    const next = event.relatedTarget;
    const node = event.currentTarget as HTMLElement;
    if (next instanceof Node && node.contains(next)) return;
    if (dropKey === sectionKey(section)) dropKey = null;
  }

  function ondrop(event: DragEvent, section: ProjectSection) {
    const project = draggedProject;
    ondragend();
    const change = project ? sectionDrop(project, section) : null;
    if (!project || !change) return;
    event.preventDefault();
    void (async () => {
      if (change.pinned !== undefined) await workspace.setPinned(project.path, change.pinned);
      if (change.group !== undefined) await workspace.setGroup(project.path, change.group);
    })();
  }

  function ondragend() {
    dragging = null;
    dropKey = null;
  }

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
    const unreadSessions = unread.among(sessions.forProject(project.path));
    contextMenu.show(event, project.name, [
      ...(unreadSessions.length
        ? [
            {
              kind: 'action' as const,
              label: t('unread.markRead'),
              run: () => unreadSessions.forEach((session) => unread.markRead(session.id)),
            },
            { kind: 'separator' as const },
          ]
        : []),
      {
        kind: 'action',
        label: t('projectMenu.openBoard'),
        run: () => view.showProject(project.path, 'board'),
      },
      { kind: 'separator' },
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
      { kind: 'action', label: revealLabel(''), run: () => revealEntry(project.path, '') },
      { kind: 'action', label: t('reveal.copyPath'), run: () => copyPath(project.path, '') },
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

{#each shownSections as section (sectionKey(section))}
  <section
    class="section"
    class:group={section.kind === 'group'}
    class:drop={dropKey === sectionKey(section)}
    aria-label={sectionTitle(section)}
    ondragover={(event) => ondragover(event, section)}
    ondragleave={(event) => ondragleave(event, section)}
    ondrop={(event) => ondrop(event, section)}
  >
    <h2 class="section-label">{sectionTitle(section)}</h2>
    {#if section.projects.length === 0}
      <p class="drop-hint">{t('sidebar.dropToUngroup')}</p>
    {/if}
    <ul>
      {#each section.projects as project (project.path)}
        <li>
          <button
            class="project"
            class:active={project.path === current}
            aria-current={project.path === current ? 'page' : undefined}
            class:dragging={dragging === project.path}
            title={project.path}
            draggable="true"
            ondragstart={(event) => ondragstart(event, project)}
            {ondragend}
            onclick={() => void view.showProject(project.path)}
            oncontextmenu={(event) => showMenu(event, project)}
          >
            <span class="name" class:unread={unreadProjects.has(project.path)}>{project.name}</span>
            {#if unreadProjects.has(project.path)}<UnreadMark />{/if}
            <kbd class="hint">{hint(project)}</kbd>
            {#if usages.get(project.path)}
              {@const projectUsage = usages.get(project.path) ?? { cpu: 0, memory: 0 }}
              <span
                class="usage"
                title={describeUsage(projectUsage)}
                aria-label={t('usage.projectLabel', {
                  project: project.name,
                  usage: describeUsage(projectUsage),
                })}>{formatMemory(projectUsage.memory)}</span
              >
            {/if}
            {#if states.has(project.path)}
              <StatusDot
                state={states.get(project.path) ?? 'idle'}
                intensity={rains.get(project.path)?.intensity}
                prompts={rains.get(project.path)?.prompts}
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

  .section {
    border: 1px solid transparent;
    border-radius: var(--ame-radius);
  }

  .section + .section {
    margin-top: var(--ame-space-3);
  }

  /* Groups get a frame, so it is clear where one ends and the next begins. */
  .section.group {
    padding: var(--ame-space-1);
    border-color: var(--ame-border);
    background: color-mix(in srgb, var(--ame-bg) 35%, transparent);
  }

  .section.group .section-label {
    color: var(--ame-text);
  }

  .section.drop {
    border-color: var(--ame-accent);
    border-style: dashed;
  }

  .drop-hint {
    margin: 0;
    padding: var(--ame-space-1) var(--ame-space-2);
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
  }

  .project.dragging {
    opacity: 0.5;
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

  .name.unread {
    color: var(--ame-text);
    font-weight: 600;
  }

  .hint {
    color: var(--ame-text-muted);
    font-family: inherit;
    font-size: var(--ame-font-size-small);
    opacity: 0;
    transition: opacity var(--ame-transition);
  }

  .usage {
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
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
