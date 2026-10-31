import { describe, expect, it } from 'vitest';
import { minimalChange } from './diff';

function apply(text: string, change: ReturnType<typeof minimalChange>): string {
  return change ? text.slice(0, change.from) + change.insert + text.slice(change.to) : text;
}

describe('minimalChange', () => {
  it('returns null for equal texts', () => {
    expect(minimalChange('abc', 'abc')).toBeNull();
  });

  it('keeps common prefix and suffix', () => {
    expect(minimalChange('hello world', 'hello brave world')).toEqual({
      from: 6,
      to: 6,
      insert: 'brave ',
    });
    expect(minimalChange('aaa', 'aa')).toEqual({ from: 2, to: 3, insert: '' });
  });

  it('always produces the target text', () => {
    const cases = [
      ['', 'new'],
      ['old', ''],
      ['abcabc', 'abc'],
      ['line1\nline2\n', 'line1\nchanged\nline2\n'],
    ] as const;
    for (const [before, after] of cases) {
      expect(apply(before, minimalChange(before, after))).toBe(after);
    }
  });
});
