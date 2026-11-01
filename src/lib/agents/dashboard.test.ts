import { describe, expect, it } from 'vitest';
import type { Project, SessionInfo } from '$lib/ipc/types';
import { groupCards } from './dashboard';

const session = (id: number, project: string) => ({ id, project }) as SessionInfo;
const project = (path: string, group: string | null) => ({ path, group }) as Project;

describe('groupCards', () => {
  it('puts groups first, alphabetically, then the rest, keeping the order', () => {
    const projects = [project('/a', 'Zeta'), project('/b', 'Alpha'), project('/c', null)];
    const cards = [session(1, '/c'), session(2, '/a'), session(3, '/b'), session(4, '/a')];
    expect(groupCards(cards, projects)).toEqual([
      { group: 'Alpha', sessions: [cards[2]] },
      { group: 'Zeta', sessions: [cards[1], cards[3]] },
      { group: null, sessions: [cards[0]] },
    ]);
  });

  it('keeps a single block without groups', () => {
    const cards = [session(1, '/c')];
    expect(groupCards(cards, [project('/c', null)])).toEqual([{ group: null, sessions: cards }]);
  });
});
