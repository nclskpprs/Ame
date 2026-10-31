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
