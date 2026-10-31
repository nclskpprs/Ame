<script lang="ts">
  /** A vertical splitter that changes a width by dragging or with arrow keys. */
  let {
    value,
    min,
    max,
    label,
    onchange,
  }: {
    value: number;
    min: number;
    max: number;
    label: string;
    onchange: (value: number) => void;
  } = $props();

  const KEY_STEP = 16;
  let start: { x: number; value: number } | null = null;

  const clamp = (width: number) => Math.round(Math.min(max, Math.max(min, width)));

  function onpointerdown(event: PointerEvent) {
    start = { x: event.clientX, value };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onpointermove(event: PointerEvent) {
    if (start) onchange(clamp(start.value + event.clientX - start.x));
  }

  function onpointerup() {
    start = null;
  }

  function onkeydown(event: KeyboardEvent) {
    const step = { ArrowLeft: -KEY_STEP, ArrowRight: KEY_STEP }[event.key];
    if (step) {
      event.preventDefault();
      onchange(clamp(value + step));
    }
  }
</script>

<!-- A focusable separator with a value is an interactive widget in WAI-ARIA,
     but Svelte's a11y lint treats every separator as static. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="resizer"
  role="separator"
  aria-orientation="vertical"
  aria-label={label}
  aria-valuenow={value}
  aria-valuemin={min}
  aria-valuemax={max}
  tabindex="0"
  {onpointerdown}
  {onpointermove}
  {onpointerup}
  {onkeydown}
></div>

<style>
  .resizer {
    position: relative;
    z-index: 1;
    width: 1px;
    margin: 0 -2px;
    padding: 0 2px;
    background: var(--ame-border);
    background-clip: content-box;
    cursor: col-resize;
    touch-action: none;
    transition: background-color var(--ame-transition);
  }

  .resizer:hover,
  .resizer:focus-visible {
    background-color: var(--ame-accent);
    outline: none;
  }
</style>
