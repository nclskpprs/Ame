import { describe, expect, it } from 'vitest';
import type { Project } from '$lib/ipc/types';
import { groupNames, orderedProjects, projectSections } from './sections';

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
