/**
 * Ready-made prompts that Ame sends to agents (a small prompt library).
 * Prompts are instructions for the agent, so they are written in English
 * like everything sent to agents; the command titles are translated.
 */

/** Branches an agent must never delete while cleaning up. */
const PROTECTED = ['develop', 'main', 'master'];

/** `a`, `a or b`, `a, b or c` with code quotes. */
function either(names: readonly string[]): string {
  const quoted = names.map((name) => `\`${name}\``);
  return quoted.length < 2
    ? (quoted[0] ?? '')
    : `${quoted.slice(0, -1).join(', ')} or ${quoted.at(-1)}`;
}

/** Asks an agent to clean up the git branches and return to the main branch. */
export function cleanUpBranchesPrompt(main: string | null): string {
  const target = main
    ? `\`${main}\``
    : 'the main branch (`develop` if it exists, otherwise the default branch)';
  const keep = either([...new Set([...(main ? [main] : []), ...PROTECTED])]);
  return [
    `Please clean up the git branches of this repository and return to ${target}:`,
    '1. Check for uncommitted changes first. If there are any, stop and ask me what to do with them.',
    '2. Run `git fetch --prune` to drop remote-tracking branches that no longer exist.',
    `3. Delete local branches that are fully merged into ${target} with \`git branch -d\` (never \`-D\`). Never delete ${keep}.`,
    '4. List branches that are not fully merged and ask me before touching them.',
    `5. Switch to ${target} and update it with \`git pull --ff-only\`.`,
    'Finish with a short summary of what you deleted and what is left.',
  ].join('\n');
}
