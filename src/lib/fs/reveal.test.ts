import { describe, expect, it } from 'vitest';
import { fileManager } from './reveal';

describe('fileManager', () => {
  it('names the file manager of the platform', () => {
    expect(fileManager('MacIntel')).toBe('finder');
    expect(fileManager('Win32')).toBe('explorer');
    expect(fileManager('Linux x86_64')).toBe('fileManager');
  });
});
