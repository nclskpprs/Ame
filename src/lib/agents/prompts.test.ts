import { describe, expect, it } from 'vitest';
import { cleanUpBranchesPrompt, fillPlaceholders, libraryPrompts, newPromptId } from './prompts';

describe('cleanUpBranchesPrompt', () => {
  it('names the branch to return to and stays safe', () => {
    const prompt = cleanUpBranchesPrompt('develop');
    expect(prompt).toContain('return to `develop`');
    expect(prompt).toContain('git branch -d');
    expect(prompt).toContain('never `-D`');
    expect(prompt).toContain('ask me');
    expect(prompt).toContain('Never delete `develop`, `main` or `master`.');
    expect(cleanUpBranchesPrompt('trunk')).toContain(
      'Never delete `trunk`, `develop`, `main` or `master`.',
    );
  });

  it('describes the main branch when Ame does not know it', () => {
    expect(cleanUpBranchesPrompt(null)).toContain('`develop` if it exists');
  });
});

describe('user prompts', () => {
  it('fills in the placeholders', () => {
    const context = { project: 'web', branch: 'feature/x', main: 'develop' };
    expect(fillPlaceholders('Review {branch} of {project} against {main}. {other}', context)).toBe(
      'Review feature/x of web against develop. {other}',
    );
    expect(fillPlaceholders('On {branch}', { project: 'web', branch: null, main: null })).toBe(
      'On the current branch',
    );
  });

  it('lists built-in prompts first, skips empty ones and names unnamed ones', () => {
    const entries = libraryPrompts([
      { id: 'a', name: '', text: 'Run the tests\nand fix them' },
      { id: 'b', name: 'Empty', text: '  ' },
    ]);
    expect(entries.map((e) => e.id)).toEqual(['builtin:cleanUpBranches', 'a']);
    expect(entries[1]?.name).toBe('Run the tests');
  });

  it('creates unused ids', () => {
    expect(newPromptId([])).toBe('prompt-1');
    expect(newPromptId(['prompt-1', 'prompt-2'])).toBe('prompt-3');
    expect(newPromptId(['prompt-2'])).toBe('prompt-3');
  });
});
