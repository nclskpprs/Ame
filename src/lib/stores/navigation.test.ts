import { describe, expect, it } from 'vitest';
import { currentPage, pageProject } from './navigation';

describe('currentPage', () => {
  it('prefers the dashboard and the settings over the project', () => {
    expect(currentPage('dashboard', '/a')).toEqual({ kind: 'dashboard' });
    expect(currentPage('settings', null)).toEqual({ kind: 'settings' });
  });

  it('shows the board or the active project', () => {
    expect(currentPage('board', '/a')).toEqual({ kind: 'board', path: '/a' });
    expect(currentPage(null, '/a')).toEqual({ kind: 'project', path: '/a' });
  });

  it('has no page without a project', () => {
    expect(currentPage(null, null)).toEqual({ kind: 'none' });
    expect(currentPage('board', null)).toEqual({ kind: 'none' });
  });
});

describe('pageProject', () => {
  it('belongs to the project for its page and its board', () => {
    expect(pageProject({ kind: 'project', path: '/a' })).toBe('/a');
    expect(pageProject({ kind: 'board', path: '/a' })).toBe('/a');
    expect(pageProject({ kind: 'dashboard' })).toBeNull();
  });
});
