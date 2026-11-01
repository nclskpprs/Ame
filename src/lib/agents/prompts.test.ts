import { describe, expect, it } from 'vitest';
import { cleanUpBranchesPrompt } from './prompts';

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
