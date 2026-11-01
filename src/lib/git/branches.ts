import { formatDuration } from '$lib/agents/duration';
import { t } from '$lib/i18n';
import { commands, type Branch } from '$lib/ipc/bindings';
import { describeError } from '$lib/ipc/types';
import { fuzzyMatch } from '$lib/palette/fuzzy';
import { segments } from '$lib/palette/highlight';
import { palette, type PaletteItem } from '$lib/palette/palette.svelte';
import type { ProjectSession } from '$lib/project/session';
import { notices } from '$lib/stores/notices.svelte';

/** Detail line of a branch: its upstream and the age of its last commit. */
export function branchDetail(branch: Branch, now: number): string {
  const age = t('branches.age', { duration: formatDuration(now - (branch.committedAt ?? now)) });
  return branch.upstream ? `${branch.upstream} · ${age}` : age;
}

/** Lists the project's branches in the palette; picking one switches to it. */
export function openBranchPicker(session: ProjectSession): void {
  const loaded = commands.gitBranches(session.path);
  palette.open({
    label: t('branches.pickerLabel'),
    placeholder: t('branches.pickerPlaceholder'),
    empty: t('branches.pickerEmpty'),
    source: async (query) => {
      const result = await loaded;
      if (result.status === 'error' || !result.data) return [];
      const now = Date.now();
      return result.data.branches.flatMap((branch): PaletteItem[] => {
        const match = fuzzyMatch(query, branch.name);
        if (!match) return [];
        return [
          {
            id: `branch:${branch.name}`,
            label: segments(branch.name, match.indices),
            detail: [{ text: branchDetail(branch, now), match: false }],
            hint: branch.current ? t('branches.current') : undefined,
            run: () => (branch.current ? undefined : switchBranch(session, branch.name)),
          },
        ];
      });
    },
  });
}

async function switchBranch(session: ProjectSession, name: string): Promise<void> {
  const result = await commands.gitSwitch(session.path, name);
  if (result.status === 'error') {
    notices.push(t('branches.switchFailed', { message: describeError(result.error) }));
    return;
  }
  notices.push(t('branches.switched', { branch: name }), 'info');
  session.git.refreshSoon(0);
  await session.editors.refreshDiffs();
}
