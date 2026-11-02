import { describe, expect, it } from 'vitest';
import { nextZoom, validZoom } from './zoom';

describe('nextZoom', () => {
  it('moves one step in and out', () => {
    expect(nextZoom(100, 1)).toBe(110);
    expect(nextZoom(100, -1)).toBe(90);
  });

  it('stops at the ends', () => {
    expect(nextZoom(200, 1)).toBe(200);
    expect(nextZoom(50, -1)).toBe(50);
  });

  it('snaps values between steps to the next step', () => {
    expect(nextZoom(105, 1)).toBe(110);
    expect(nextZoom(105, -1)).toBe(100);
  });
});

describe('validZoom', () => {
  it('keeps values in range and resets others', () => {
    expect(validZoom(125)).toBe(125);
    expect(validZoom(0)).toBe(100);
    expect(validZoom(500)).toBe(100);
    expect(validZoom(Number.NaN)).toBe(100);
  });
});
