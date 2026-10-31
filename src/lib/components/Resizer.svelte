<script lang="ts">
  /**
   * A splitter that changes a size by dragging or with arrow keys. Vertical
   * splitters change a width, horizontal ones a height. `invert` is for
   * panels whose size grows when the splitter moves left or up.
   */
  let {
    value,
    min,
    max,
    label,
    orientation = 'vertical',
    invert = false,
    onchange,
  }: {
    value: number;
    min: number;
    max: number;
    label: string;
    orientation?: 'vertical' | 'horizontal';
    invert?: boolean;
    onchange: (value: number) => void;
  } = $props();

  const KEY_STEP = 16;
  let start: { position: number; value: number } | null = null;

  const clamp = (size: number) => Math.round(Math.min(max, Math.max(min, size)));
  const position = (event: PointerEvent) =>
    orientation === 'vertical' ? event.clientX : event.clientY;
  const direction = $derived(invert ? -1 : 1);

  function onpointerdown(event: PointerEvent) {
    start = { position: position(event), value };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onpointermove(event: PointerEvent) {
    if (start) onchange(clamp(start.value + direction * (position(event) - start.position)));
  }

  function onpointerup() {
    start = null;
  }

  function onkeydown(event: KeyboardEvent) {
    const keys: Record<string, number> =
      orientation === 'vertical'
        ? { ArrowLeft: -KEY_STEP, ArrowRight: KEY_STEP }
        : { ArrowUp: -KEY_STEP, ArrowDown: KEY_STEP };
    const step = keys[event.key];
    if (step) {
      event.preventDefault();
      onchange(clamp(value + direction * step));
    }
  }
</script>

<!-- A focusable separator with a value is an interactive widget in WAI-ARIA,
     but Svelte's a11y lint treats every separator as static. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  class="resizer {orientation}"
  role="separator"
  aria-orientation={orientation}
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
    background: var(--ame-border);
    background-clip: content-box;
    touch-action: none;
    transition: background-color var(--ame-transition);
  }

  .vertical {
    width: 1px;
    margin: 0 -2px;
    padding: 0 2px;
    cursor: col-resize;
  }

  .horizontal {
    height: 1px;
    margin: -2px 0;
    padding: 2px 0;
    cursor: row-resize;
  }

  .resizer:hover,
  .resizer:focus-visible {
    background-color: var(--ame-accent);
    outline: none;
  }
</style>
