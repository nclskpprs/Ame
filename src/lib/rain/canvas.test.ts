import { describe, expect, it } from 'vitest';
import { currentRainMode } from './canvas';

describe('currentRainMode', () => {
  it('follows the setting and turns off while the window is inactive', () => {
    const root = { dataset: {} as DOMStringMap } as HTMLElement;
    expect(currentRainMode(root)).toBe('on');
    root.dataset.rain = 'subtle';
    expect(currentRainMode(root)).toBe('subtle');
    root.dataset.windowActive = 'false';
    expect(currentRainMode(root)).toBe('off');
  });
});
