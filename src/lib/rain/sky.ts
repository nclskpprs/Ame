/**
 * Particles of the rain canvas (docs/DESIGN.md): drops that fall for sent
 * prompts and end in a ripple, and paper pieces for the origami easter
 * egg. Pure state, advanced by `step`; drawing lives in `draw.ts`.
 * Coordinates are in CSS pixels of the canvas.
 */

export type ParticleKind = 'drop' | 'ripple' | 'paper';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  /** Velocity in px/s. */
  vx: number;
  vy: number;
  /** Seconds since it appeared. */
  age: number;
  /** Seconds it lives; ripples and paper fade out towards the end. */
  life: number;
  /** Rotation in radians and its speed (paper). */
  angle: number;
  spin: number;
  size: number;
}

/** Fall speed of a prompt drop. */
const DROP_SPEED = 90;
const RIPPLE_LIFE = 0.6;
/** Upper bound of live particles, so a burst never costs much. */
export const MAX_PARTICLES = 120;

export class Sky {
  particles: Particle[] = [];
  readonly #random: () => number;

  constructor(random: () => number = Math.random) {
    this.#random = random;
  }

  get empty(): boolean {
    return this.particles.length === 0;
  }

  /** A drop for a sent prompt, at `x` (0…1 of the width). */
  addDrop(x: number, width: number, speedFactor = 1): void {
    this.#add({
      kind: 'drop',
      x: clamp(x, 0.02, 0.98) * width,
      y: -6,
      vx: 0,
      vy: DROP_SPEED * speedFactor,
      age: 0,
      life: Infinity,
      angle: 0,
      spin: 0,
      size: 3,
    });
  }

  /** A swirl of paper pieces drifting down across the whole width. */
  addPaper(count: number, width: number, height: number): void {
    for (let i = 0; i < count; i++) {
      const r = () => this.#random();
      this.#add({
        kind: 'paper',
        x: r() * width,
        y: -20 - r() * height * 0.5,
        vx: (r() - 0.5) * 40,
        vy: 40 + r() * 50,
        age: 0,
        life: (height + 40) / 40 + 2,
        angle: r() * Math.PI * 2,
        spin: (r() - 0.5) * 4,
        size: 6 + r() * 6,
      });
    }
  }

  /** Advances by `dt` seconds; drops that reach `height` turn into ripples. */
  step(dt: number, height: number): void {
    const next: Particle[] = [];
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      if (p.kind === 'paper') {
        // Paper sways sideways while it sinks.
        p.vx += Math.sin(p.age * 2 + p.size) * 20 * dt;
      }
      if (p.kind === 'drop' && p.y >= height - 2) {
        next.push({ ...p, kind: 'ripple', y: height - 2, vy: 0, age: 0, life: RIPPLE_LIFE });
        continue;
      }
      if (p.age < p.life && p.y < height + 40) next.push(p);
    }
    this.particles = next;
  }

  clear(): void {
    this.particles = [];
  }

  #add(particle: Particle): void {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push(particle);
  }
}

/** Horizontal position (0…1) of a session's drops: stable per session. */
export function laneOf(id: number): number {
  // Golden-ratio steps spread consecutive ids evenly.
  return (id * 0.618034) % 1;
}

/** Sessions whose prompt count grew since `previous`; updates `previous`. */
export function newPrompts(
  previous: Map<number, number>,
  sessions: readonly { id: number; prompts: number }[],
): number[] {
  const grown: number[] = [];
  const seen = new Set<number>();
  for (const { id, prompts } of sessions) {
    seen.add(id);
    const before = previous.get(id);
    if (before !== undefined && prompts > before) {
      for (let i = before; i < Math.min(prompts, before + 5); i++) grown.push(id);
    }
    previous.set(id, prompts);
  }
  for (const id of previous.keys()) if (!seen.has(id)) previous.delete(id);
  return grown;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
