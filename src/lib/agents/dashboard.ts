import type { Project, SessionInfo } from '$lib/ipc/types';

/** One block of dashboard cards: a project group, or the ungrouped rest. */
export interface CardGroup {
  /** `null` for projects without a group. */
  group: string | null;
  sessions: SessionInfo[];
}

/**
 * Splits the already ordered cards into project groups (alphabetical), then
 * the ungrouped ones; the order within a group is kept. Without any group
 * there is a single block.
 */
export function groupCards(
  cards: readonly SessionInfo[],
  projects: readonly Project[],
): CardGroup[] {
  const groupOf = (session: SessionInfo) =>
    projects.find((p) => p.path === session.project)?.group ?? null;
  const names = [...new Set(cards.flatMap((s) => groupOf(s) ?? []))].sort((a, b) =>
    a.localeCompare(b),
  );
  const blocks: CardGroup[] = names.map((group) => ({
    group,
    sessions: cards.filter((s) => groupOf(s) === group),
  }));
  const rest = cards.filter((s) => groupOf(s) === null);
  if (rest.length) blocks.push({ group: null, sessions: rest });
  return blocks;
}
