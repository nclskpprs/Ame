import { describe, expect, it } from 'vitest';
import { describeUsage, formatMemory, sumUsage } from './usage';

describe('usage', () => {
  it('sums sessions', () => {
    expect(sumUsage([])).toBeNull();
    expect(
      sumUsage([
        { cpu: 10, memory: 1 },
        { cpu: 5.5, memory: 2 },
      ]),
    ).toEqual({ cpu: 15.5, memory: 3 });
  });

  it('formats memory in MB below a gigabyte, else in GB', () => {
    expect(formatMemory(412 * 1024 * 1024)).toBe('412 MB');
    expect(formatMemory(1.44 * 1024 * 1024 * 1024)).toBe('1.4 GB');
  });

  it('describes CPU and memory', () => {
    expect(describeUsage({ cpu: 12.4, memory: 300 * 1024 * 1024 })).toBe('CPU 12 % · RAM 300 MB');
  });
});
