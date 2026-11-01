<script lang="ts">
  import { onMount } from 'svelte';
  import { RainCanvas } from '$lib/rain/canvas';
  import { paper } from '$lib/rain/paper.svelte';
  import { Sky } from '$lib/rain/sky';

  /** Paper pieces per burst. */
  const PIECES = 60;

  let canvas: HTMLCanvasElement;
  let rain: RainCanvas | undefined;
  const sky = new Sky();
  // Mounted by the first burst, so that one is still to be handled.
  let handled = 0;

  onMount(() => {
    rain = new RainCanvas(canvas, sky);
    return () => rain?.dispose();
  });

  $effect(() => {
    const bursts = paper.bursts;
    if (!rain || bursts === handled) return;
    handled = bursts;
    sky.addPaper(PIECES, rain.width, rain.height);
    rain.wake();
  });
</script>

<canvas class="paper" bind:this={canvas} aria-hidden="true"></canvas>

<style>
  .paper {
    position: fixed;
    inset: 0;
    z-index: 1000;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
  }
</style>
