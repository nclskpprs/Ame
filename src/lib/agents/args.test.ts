import { describe, expect, it } from 'vitest';
import { joinArgs, profileId, splitArgs } from './args';

describe('splitArgs', () => {
  it('splits on whitespace and keeps quoted parts', () => {
    expect(splitArgs('  --model opus  ')).toEqual(['--model', 'opus']);
    expect(splitArgs(`--name "my agent" --x 'a b'`)).toEqual(['--name', 'my agent', '--x', 'a b']);
    expect(splitArgs('a\\ b "c\\"d" ""')).toEqual(['a b', 'c"d', '']);
    expect(splitArgs('')).toEqual([]);
  });

  it('round-trips with joinArgs', () => {
    const args = ['--flag', 'two words', 'quote"d', 'back\\slash', ''];
    expect(splitArgs(joinArgs(args))).toEqual(args);
    expect(joinArgs(['resume', '--last'])).toBe('resume --last');
  });
});

describe('profileId', () => {
  it('derives a unique slug', () => {
    expect(profileId('My Agent!', [])).toBe('my-agent');
    expect(profileId('My Agent', ['my-agent', 'my-agent-2'])).toBe('my-agent-3');
    expect(profileId('***', [])).toBe('agent');
  });
});
