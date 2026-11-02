import { describe, expect, it } from 'vitest';
import { isNewlineKey, NEWLINE_SEQUENCE } from './keys';

const key = (init: Partial<KeyboardEvent>) => ({
  key: 'Enter',
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...init,
});

describe('isNewlineKey', () => {
  it('matches Shift+Enter only', () => {
    expect(isNewlineKey(key({ shiftKey: true }))).toBe(true);
    expect(isNewlineKey(key({}))).toBe(false);
    expect(isNewlineKey(key({ shiftKey: true, metaKey: true }))).toBe(false);
    expect(isNewlineKey(key({ shiftKey: true, ctrlKey: true }))).toBe(false);
    expect(isNewlineKey(key({ key: 'a', shiftKey: true }))).toBe(false);
  });

  it('sends Escape + carriage return', () => {
    expect(NEWLINE_SEQUENCE).toBe('\x1b\r');
  });
});
