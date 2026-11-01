/**
 * The prompt library: ready-made prompts that ship with Ame plus the user's
 * own (`settings.prompts`). Prompts are instructions for agents, so the
 * built-in ones are written in English; their names are translated.
 */
import type { LibraryPrompt_Serialize as LibraryPrompt } from '$lib/ipc/bindings';
import type { MessageKey } from '$lib/i18n';

/** What placeholders in a prompt are filled with. */
export interface PromptContext {
  /** Project name. */
  project: string;
  /** Current branch, `null` outside git or when detached. */
  branch: string | null;
  /** Main branch (`develop`, `main`, …), `null` if unknown. */
  main: string | null;
}

/** A prompt as offered in the picker. */
export interface PromptEntry {
  id: string;
  /** Display name; built-in prompts use `nameKey` instead. */
  name: string;
  nameKey?: MessageKey;
  builtIn: boolean;
  /** The prompt with its placeholders filled in. */
  render: (context: PromptContext) => string;
}

/** Placeholders a user prompt may contain. */
export const PLACEHOLDERS = ['{project}', '{branch}', '{main}'] as const;

/**
 * Fills in `{project}`, `{branch}` and `{main}`. Unknown values become a
 * description the agent understands; other braces stay as they are.
 */
export function fillPlaceholders(text: string, context: PromptContext): string {
  return text
    .replaceAll('{project}', context.project)
    .replaceAll('{branch}', context.branch ?? 'the current branch')
    .replaceAll('{main}', context.main ?? 'the main branch');
}

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

/** Id of the built-in "clean up branches" prompt. */
export const CLEAN_UP_BRANCHES = 'builtin:cleanUpBranches';

const BUILT_IN: readonly PromptEntry[] = [
  {
    id: CLEAN_UP_BRANCHES,
    name: '',
    nameKey: 'prompts.cleanUpBranches',
    builtIn: true,
    render: (context) => cleanUpBranchesPrompt(context.main),
  },
];

/** Built-in prompts first, then the user's in their order. */
export function libraryPrompts(custom: readonly LibraryPrompt[]): PromptEntry[] {
  return [
    ...BUILT_IN,
    ...custom
      .filter((prompt) => prompt.text.trim())
      .map((prompt): PromptEntry => ({
        id: prompt.id,
        name: prompt.name.trim() || prompt.text.trim().split('\n')[0] || prompt.id,
        builtIn: false,
        render: (context) => fillPlaceholders(prompt.text, context),
      })),
  ];
}

/** A new id for a user prompt that is not taken yet. */
export function newPromptId(taken: readonly string[]): string {
  let n = taken.length + 1;
  while (taken.includes(`prompt-${n}`)) n++;
  return `prompt-${n}`;
}
