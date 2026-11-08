import type { Project } from '$lib/ipc/types';

export type SectionKind = 'pinned' | 'group' | 'projects';

export interface ProjectSection {
  kind: SectionKind;
  /** Group name for `group` sections. */
  title?: string;
  projects: Project[];
}

/**
 * Orders projects for the sidebar: pinned first, then one section per group
 * (alphabetical), then ungrouped projects. Within a section, projects keep
 * the order in which they were opened.
 */
export function projectSections(projects: readonly Project[]): ProjectSection[] {
  const pinned = projects.filter((p) => p.pinned);
  const unpinned = projects.filter((p) => !p.pinned);
  const groups = [...new Set(unpinned.flatMap((p) => (p.group ? [p.group] : [])))].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );

  const sections: ProjectSection[] = [];
  if (pinned.length) sections.push({ kind: 'pinned', projects: pinned });
  for (const group of groups) {
    sections.push({
      kind: 'group',
      title: group,
      projects: unpinned.filter((p) => p.group === group),
    });
  }
  const ungrouped = unpinned.filter((p) => !p.group);
  if (ungrouped.length) sections.push({ kind: 'projects', projects: ungrouped });
  return sections;
}

/** Projects in sidebar order; index 0 is reachable with Mod+1, and so on. */
export function orderedProjects(projects: readonly Project[]): Project[] {
  return projectSections(projects).flatMap((section) => section.projects);
}

/** All group names in use, sorted. */
export function groupNames(projects: readonly Project[]): string[] {
  return [...new Set(projects.flatMap((p) => (p.group ? [p.group] : [])))].sort();
}

/** What dropping a dragged project on a section changes, or `null` for nothing. */
export interface SectionDrop {
  pinned?: boolean;
  group?: string | null;
}

/**
 * Moving a project by dropping it on a sidebar section: the pinned section
 * pins it, a group section moves it into that group, and the plain projects
 * section takes it out of its group. Leaving the pinned section unpins it.
 */
export function sectionDrop(
  project: Pick<Project, 'pinned' | 'group'>,
  target: Pick<ProjectSection, 'kind' | 'title'>,
): SectionDrop | null {
  const group = project.group ?? null;
  if (target.kind === 'pinned') return project.pinned ? null : { pinned: true };
  const change: SectionDrop = project.pinned ? { pinned: false } : {};
  const wanted = target.kind === 'group' ? (target.title ?? null) : null;
  if (wanted !== group) change.group = wanted;
  return Object.keys(change).length ? change : null;
}

/** Stable id of a section, used to remember that it is folded. */
export function sectionId(section: Pick<ProjectSection, 'kind' | 'title'>): string {
  return section.kind === 'group' ? `group:${section.title ?? ''}` : section.kind;
}

/** The folded section ids after folding or unfolding `id`. */
export function toggleCollapsed(collapsed: readonly string[], id: string): string[] {
  return collapsed.includes(id) ? collapsed.filter((other) => other !== id) : [...collapsed, id];
}

/**
 * Projects listed in a section: all of them, or for a folded section only
 * the active project, so the current project never disappears.
 */
export function visibleProjects(
  section: ProjectSection,
  collapsed: boolean,
  active: string | null,
): Project[] {
  return collapsed ? section.projects.filter((p) => p.path === active) : section.projects;
}
