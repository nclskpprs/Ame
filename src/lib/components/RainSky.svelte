<script lang="ts">
  import { onMount } from 'svelte';
  import { RainCanvas } from '$lib/rain/canvas';
  import { Sky, laneOf, newPrompts } from '$lib/rain/sky';
  import { sessions } from '$lib/terminal/sessions.svelte';

  /**
   * The dashboard header's narrow sky: every prompt sent to any agent falls
   * as a drop (docs/DESIGN.md). Decorative for screen readers; the cards
   * carry the same information.
   */
  let canvas: HTMLCanvasElement;
  let rain: RainCanvas | undefined;
  const sky = new Sky();
  const seen = new Map<number, number>();
  newPrompts(seen, sessions.list);

  onMount(() => {
    rain = new RainCanvas(canvas, sky);
    return () => rain?.dispose();
  });

  $effect(() => {
    const grown = newPrompts(seen, sessions.list);
    if (!rain || grown.length === 0) return;
    for (const id of grown) sky.addDrop(laneOf(id), rain.width);
    rain.wake();
  });
</script>

<canvas class="sky" bind:this={canvas} aria-hidden="true"></canvas>

<style>
  .sky {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
