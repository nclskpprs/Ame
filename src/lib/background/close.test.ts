import { describe, expect, it } from 'vitest';
import { closeDecision } from './close';

describe('closeDecision', () => {
  it('hides the window while agents run in background mode', () => {
    expect(closeDecision('background', true, () => true)).toBe('hide');
  });

  it('closes or asks when nothing runs in the background', () => {
    expect(closeDecision('background', false, () => false)).toBe('close');
    expect(closeDecision('background', false, () => true)).toBe('guard');
  });

  it('never hides with the quit setting', () => {
    expect(closeDecision('quit', true, () => true)).toBe('guard');
    expect(closeDecision('quit', false, () => false)).toBe('close');
  });
});
