import { describe, expect, it } from 'vitest';
import type { Project } from '$lib/ipc/types';
import {
  groupNames,
  orderedProjects,
  projectSections,
  sectionDrop,
  sectionId,
  toggleCollapsed,
  visibleProjects,
} from './sections';

function project(name: string, extra: Partial<Project> = {}): Project {
  return {
    path: `/p/${name}`,
    name,
    group: null,
    pinned: false,
    muted: false,
    layout: {
      openFiles: [],
      activeFile: null,
      expandedDirs: [],
      sidePanel: 'files',
      sidePanelWidth: 260,
      terminalOpen: false,
      terminalHeight: 300,
      sessions: [],
      activeSession: null,
      follow: false,
    },
    ...extra,
  };
}

describe('projectSections', () => {
  it('puts pinned first, then groups alphabetically, then ungrouped', () => {
    const projects = [
      project('a'),
      project('b', { group: 'Zeta' }),
      project('c', { pinned: true, group: 'Zeta' }),
      project('d', { group: 'alpha' }),
      project('e'),
    ];
    const sections = projectSections(projects);
    expect(sections.map((s) => [s.kind, s.title, s.projects.map((p) => p.name)])).toEqual([
      ['pinned', undefined, ['c']],
      ['group', 'alpha', ['d']],
      ['group', 'Zeta', ['b']],
      ['projects', undefined, ['a', 'e']],
    ]);
  });

  it('omits empty sections', () => {
    expect(projectSections([])).toEqual([]);
    expect(projectSections([project('a')]).map((s) => s.kind)).toEqual(['projects']);
  });
});

describe('orderedProjects', () => {
  it('flattens the sections', () => {
    const projects = [project('a'), project('b', { pinned: true })];
    expect(orderedProjects(projects).map((p) => p.name)).toEqual(['b', 'a']);
  });
});

describe('groupNames', () => {
  it('lists each group once', () => {
    const projects = [
      project('a', { group: 'B' }),
      project('b', { group: 'A' }),
      project('c', { group: 'B' }),
    ];
    expect(groupNames(projects)).toEqual(['A', 'B']);
  });
});

describe('sectionDrop', () => {
  const free = { pinned: false, group: null };
  const grouped = { pinned: false, group: 'Client A' };
  const pinned = { pinned: true, group: 'Client A' };
  const groupA = { kind: 'group' as const, title: 'Client A' };
  const groupB = { kind: 'group' as const, title: 'Client B' };

  it('moves projects into, between and out of groups', () => {
    expect(sectionDrop(free, groupA)).toEqual({ group: 'Client A' });
    expect(sectionDrop(grouped, groupB)).toEqual({ group: 'Client B' });
    expect(sectionDrop(grouped, { kind: 'projects' })).toEqual({ group: null });
  });

  it('pins and unpins', () => {
    expect(sectionDrop(grouped, { kind: 'pinned' })).toEqual({ pinned: true });
    expect(sectionDrop(pinned, groupA)).toEqual({ pinned: false });
    expect(sectionDrop(pinned, { kind: 'projects' })).toEqual({ pinned: false, group: null });
  });

  it('ignores drops on the own section', () => {
    expect(sectionDrop(free, { kind: 'projects' })).toBeNull();
    expect(sectionDrop(grouped, groupA)).toBeNull();
    expect(sectionDrop(pinned, { kind: 'pinned' })).toBeNull();
  });
});

describe('folding sections', () => {
  it('gives every section a stable id', () => {
    expect(sectionId({ kind: 'pinned' })).toBe('pinned');
    expect(sectionId({ kind: 'projects' })).toBe('projects');
    expect(sectionId({ kind: 'group', title: 'Work' })).toBe('group:Work');
  });

  it('toggles a section in the folded list', () => {
    expect(toggleCollapsed([], 'pinned')).toEqual(['pinned']);
    expect(toggleCollapsed(['pinned', 'group:A'], 'pinned')).toEqual(['group:A']);
  });

  it('keeps only the active project in a folded section', () => {
    const section = { kind: 'group' as const, title: 'A', projects: [project('a'), project('b')] };
    expect(visibleProjects(section, false, null)).toHaveLength(2);
    expect(visibleProjects(section, true, '/p/b').map((p) => p.name)).toEqual(['b']);
    expect(visibleProjects(section, true, '/p/x')).toEqual([]);
  });
});
