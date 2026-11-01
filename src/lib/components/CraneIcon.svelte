<script lang="ts">
  /**
   * A paper crane: a queued prompt is folded paper waiting to fall as a
   * drop. Also a quiet nod to the paper ninja of the hidden rain village.
   */
  let { size = 14 }: { size?: number } = $props();
</script>

<svg class="crane" viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
  <path d="M8 1.5L5.5 9h5Z" />
  <path d="M1 6.5l1.5-1.5L4.5 9h7l3-4" />
  <path d="M4.5 9L8 12.5 11.5 9" />
</svg>

<style>
  path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>
