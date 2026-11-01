import { describe, expect, it } from 'vitest';
import { formatDuration } from './duration';

describe('formatDuration', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatDuration(-5)).toBe('0 s');
    expect(formatDuration(45_900)).toBe('45 s');
    expect(formatDuration(12 * 60_000 + 30_000)).toBe('12 min');
    expect(formatDuration(125 * 60_000)).toBe('2 h 5 min');
  });
});
