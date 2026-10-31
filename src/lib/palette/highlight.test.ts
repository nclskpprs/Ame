import { describe, expect, it } from 'vitest';
import { rangeSegments, segments } from './highlight';

describe('segments', () => {
  it('groups consecutive matches', () => {
    expect(segments('sidebar', [0, 1, 2])).toEqual([
      { text: 'sid', match: true },
      { text: 'ebar', match: false },
    ]);
  });

  it('supports an offset and non-BMP characters', () => {
    expect(segments('a😀b', [5], 3)).toEqual([
      { text: 'a😀', match: false },
      { text: 'b', match: true },
    ]);
  });
});

describe('rangeSegments', () => {
  it('splits by ranges', () => {
    expect(
      rangeSegments('let foo = foo', [
        { start: 4, end: 7 },
        { start: 10, end: 13 },
      ]),
    ).toEqual([
      { text: 'let ', match: false },
      { text: 'foo', match: true },
      { text: ' = ', match: false },
      { text: 'foo', match: true },
    ]);
  });
});
