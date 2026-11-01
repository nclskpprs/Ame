import type { Particle, Sky } from './sky';

/** Frame budget: at most 30 frames per second (AGENTS.md animation budget). */
const FRAME_MS = 1000 / 30;
/** Longest step after a stall, so particles never jump far. */
const MAX_STEP = 0.1;

export type RainMode = 'on' | 'subtle' | 'off';

/** The rain setting as applied to the document, `off` while the window is inactive. */
export function currentRainMode(root: HTMLElement = document.documentElement): RainMode {
  if (root.dataset.windowActive === 'false') return 'off';
  const mode = root.dataset.rain;
  return mode === 'subtle' || mode === 'off' ? mode : 'on';
}

interface Colors {
  drop: string;
  paper: string;
  fold: string;
  edge: string;
}

/**
 * Draws a `Sky` on one canvas. The loop only runs while there are
 * particles, at most at 30 fps, and drops everything as soon as the window
 * is inactive or rain is off.
 */
export class RainCanvas {
  readonly #canvas: HTMLCanvasElement;
  readonly #sky: Sky;
  #frame: number | null = null;
  #last = 0;
  #colors: Colors | null = null;

  constructor(canvas: HTMLCanvasElement, sky: Sky) {
    this.#canvas = canvas;
    this.#sky = sky;
  }

  get width(): number {
    return this.#canvas.clientWidth;
  }

  get height(): number {
    return this.#canvas.clientHeight;
  }

  /** Starts the loop if it is not running; call after adding particles. */
  wake(): void {
    if (this.#frame !== null) return;
    if (currentRainMode() === 'off') {
      this.#sky.clear();
      return;
    }
    this.#colors = readColors(this.#canvas);
    this.#last = performance.now();
    this.#frame = requestAnimationFrame((now) => this.#tick(now));
  }

  dispose(): void {
    if (this.#frame !== null) cancelAnimationFrame(this.#frame);
    this.#frame = null;
    this.#sky.clear();
  }

  #tick(now: number): void {
    this.#frame = null;
    const mode = currentRainMode();
    if (mode === 'off') {
      this.#sky.clear();
      this.#clearCanvas();
      return;
    }
    if (now - this.#last >= FRAME_MS) {
      const dt = Math.min(MAX_STEP, (now - this.#last) / 1000);
      this.#last = now;
      this.#sky.step(dt, this.height);
      this.#draw(mode);
    }
    if (this.#sky.empty) {
      this.#clearCanvas();
      return;
    }
    this.#frame = requestAnimationFrame((next) => this.#tick(next));
  }

  #context(): CanvasRenderingContext2D | null {
    const canvas = this.#canvas;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const context = canvas.getContext('2d');
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);
    return context;
  }

  #clearCanvas(): void {
    this.#context()?.clearRect(0, 0, this.width, this.height);
  }

  #draw(mode: RainMode): void {
    const context = this.#context();
    const colors = this.#colors;
    if (!context || !colors) return;
    context.clearRect(0, 0, this.width, this.height);
    const strength = mode === 'subtle' ? 0.5 : 1;
    for (const particle of this.#sky.particles) {
      drawParticle(context, particle, colors, strength);
    }
    context.globalAlpha = 1;
  }
}

function readColors(element: HTMLElement): Colors {
  const style = getComputedStyle(element);
  const read = (name: string) => style.getPropertyValue(name).trim();
  // Paper is the lightest color of the theme: white in light, pale in dark.
  const dark = document.documentElement.dataset.theme === 'dark';
  return {
    drop: read('--ame-accent'),
    paper: read(dark ? '--ame-text' : '--ame-surface'),
    fold: read(dark ? '--ame-text-muted' : '--ame-bg'),
    edge: read('--ame-border'),
  };
}

function drawParticle(
  context: CanvasRenderingContext2D,
  p: Particle,
  colors: Colors,
  strength: number,
): void {
  const fade = Number.isFinite(p.life) ? Math.max(0, 1 - p.age / p.life) : 1;
  switch (p.kind) {
    case 'drop': {
      // A teardrop: round at the bottom, pointed at the top.
      context.globalAlpha = 0.9 * strength;
      context.fillStyle = colors.drop;
      context.beginPath();
      context.moveTo(p.x, p.y - p.size * 2.2);
      context.quadraticCurveTo(p.x + p.size, p.y - p.size * 0.2, p.x, p.y + p.size);
      context.quadraticCurveTo(p.x - p.size, p.y - p.size * 0.2, p.x, p.y - p.size * 2.2);
      context.fill();
      break;
    }
    case 'ripple': {
      const radius = 2 + (1 - fade) * 12;
      context.globalAlpha = fade * 0.8 * strength;
      context.strokeStyle = colors.drop;
      context.lineWidth = 1;
      context.beginPath();
      context.ellipse(p.x, p.y, radius, radius / 3, 0, 0, Math.PI * 2);
      context.stroke();
      break;
    }
    case 'paper': {
      // A folded square of paper: one half lit, the other in the fold's shade.
      const half = p.size / 2;
      context.save();
      context.translate(p.x, p.y);
      context.rotate(p.angle);
      context.globalAlpha = Math.min(1, fade * 2) * 0.85 * strength;
      context.fillStyle = colors.paper;
      context.beginPath();
      context.moveTo(-half, -half);
      context.lineTo(half, -half);
      context.lineTo(-half, half);
      context.fill();
      context.fillStyle = colors.fold;
      context.beginPath();
      context.moveTo(half, -half);
      context.lineTo(half, half);
      context.lineTo(-half, half);
      context.fill();
      context.strokeStyle = colors.edge;
      context.lineWidth = 1;
      context.strokeRect(-half, -half, p.size, p.size);
      context.beginPath();
      context.moveTo(half, -half);
      context.lineTo(-half, half);
      context.stroke();
      context.restore();
      break;
    }
  }
}
