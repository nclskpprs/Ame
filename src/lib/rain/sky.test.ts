import { describe, expect, it } from 'vitest';
import { MAX_PARTICLES, Sky, laneOf, newPrompts } from './sky';

describe('Sky', () => {
  it('lets a drop fall and end in a ripple that fades', () => {
    const sky = new Sky();
    sky.addDrop(0.5, 200);
    expect(sky.particles[0]).toMatchObject({ kind: 'drop', x: 100 });
    sky.step(0.2, 30);
    expect(sky.particles[0]?.kind).toBe('drop');
    sky.step(0.3, 30);
    expect(sky.particles[0]).toMatchObject({ kind: 'ripple', y: 28 });
    sky.step(1, 30);
    expect(sky.empty).toBe(true);
  });

  it('lets paper drift down and leave', () => {
    const sky = new Sky(() => 0.5);
    sky.addPaper(3, 400, 300);
    expect(sky.particles).toHaveLength(3);
    for (let i = 0; i < 200; i++) sky.step(0.1, 300);
    expect(sky.empty).toBe(true);
  });

  it('keeps the number of particles bounded', () => {
    const sky = new Sky();
    sky.addPaper(MAX_PARTICLES + 20, 100, 100);
    expect(sky.particles).toHaveLength(MAX_PARTICLES);
  });
});

describe('newPrompts', () => {
  it('reports sessions whose prompt count grew', () => {
    const previous = new Map<number, number>();
    expect(newPrompts(previous, [{ id: 1, prompts: 3 }])).toEqual([]);
    expect(
      newPrompts(previous, [
        { id: 1, prompts: 5 },
        { id: 2, prompts: 1 },
      ]),
    ).toEqual([1, 1]);
    expect(newPrompts(previous, [{ id: 2, prompts: 2 }])).toEqual([2]);
    expect(previous.has(1)).toBe(false);
  });
});

describe('laneOf', () => {
  it('stays inside the sky', () => {
    for (let id = 0; id < 50; id++) {
      expect(laneOf(id)).toBeGreaterThanOrEqual(0);
      expect(laneOf(id)).toBeLessThan(1);
    }
  });
});
