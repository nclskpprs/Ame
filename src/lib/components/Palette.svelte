<script lang="ts">
  import type { Segment } from '$lib/palette/highlight';
  import { palette, type PaletteConfig, type PaletteItem } from '$lib/palette/palette.svelte';

  let { config }: { config: PaletteConfig } = $props();

  // svelte-ignore state_referenced_locally
  let query = $state(config.initialQuery ?? '');
  let items = $state.raw<PaletteItem[]>([]);
  let selected = $state(0);
  let loaded = $state(false);
  let request = 0;
  let list: HTMLUListElement | undefined = $state();

  $effect(() => {
    const id = ++request;
    const source = config.source;
    void Promise.resolve(source(query)).then((result) => {
      if (id !== request) return;
      items = result;
      selected = 0;
      loaded = true;
    });
  });

  $effect(() => {
    list?.querySelector(`[data-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' });
  });

  function run(item: PaletteItem | undefined) {
    if (!item) return;
    palette.close();
    void item.run();
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') selected = Math.min(items.length - 1, selected + 1);
    else if (event.key === 'ArrowUp') selected = Math.max(0, selected - 1);
    else if (event.key === 'Enter') run(items[selected]);
    else if (event.key === 'Escape') palette.close();
    else return;
    event.preventDefault();
    event.stopPropagation();
  }

  function focus(node: HTMLInputElement) {
    node.focus();
    node.select();
  }
</script>

{#snippet text(segments: Segment[])}
  {#each segments as segment, index (index)}
    {#if segment.match}<mark>{segment.text}</mark>{:else}{segment.text}{/if}
  {/each}
{/snippet}

<div class="backdrop" role="presentation" onpointerdown={() => palette.close()}>
  <div
    class="palette"
    role="dialog"
    aria-modal="true"
    aria-label={config.label}
    tabindex="-1"
    onpointerdown={(event) => event.stopPropagation()}
  >
    <input
      class="input"
      role="combobox"
      aria-expanded="true"
      aria-controls="palette-list"
      aria-activedescendant={items.length ? `palette-item-${selected}` : undefined}
      aria-label={config.label}
      placeholder={config.placeholder}
      spellcheck="false"
      autocomplete="off"
      bind:value={query}
      use:focus
      {onkeydown}
    />
    <ul class="list" id="palette-list" role="listbox" bind:this={list}>
      {#each items as item, index (item.id)}
        <li
          id="palette-item-{index}"
          class="item"
          class:selected={index === selected}
          role="option"
          aria-selected={index === selected}
          data-index={index}
          onpointermove={() => (selected = index)}
          onclick={() => run(item)}
          onkeydown={() => {}}
        >
          <span class="label">{@render text(item.label)}</span>
          {#if item.detail}<span class="detail">{@render text(item.detail)}</span>{/if}
          {#if item.hint}<kbd class="hint">{item.hint}</kbd>{/if}
        </li>
      {/each}
      {#if loaded && items.length === 0}
        <li class="empty" role="presentation">{config.empty}</li>
      {/if}
    </ul>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    justify-content: center;
    padding-top: 12vh;
  }

  .palette {
    display: flex;
    flex-direction: column;
    width: min(640px, calc(100vw - 32px));
    max-height: 60vh;
    overflow: hidden;
    background: var(--ame-surface);
    border: 1px solid var(--ame-border);
    border-radius: calc(var(--ame-radius) + 2px);
    box-shadow: 0 16px 48px color-mix(in srgb, var(--ame-bg) 60%, transparent);
  }

  .input {
    padding: var(--ame-space-3) var(--ame-space-4);
    border: 0;
    border-bottom: 1px solid var(--ame-border);
    background: transparent;
    color: var(--ame-text);
    font: inherit;
    font-size: calc(var(--ame-font-size) + 1px);
    outline: none;
  }

  .list {
    margin: 0;
    padding: var(--ame-space-1);
    overflow-y: auto;
    list-style: none;
  }

  .item {
    display: flex;
    align-items: baseline;
    gap: var(--ame-space-2);
    padding: var(--ame-space-1) var(--ame-space-3);
    border-radius: var(--ame-radius);
    color: var(--ame-text);
    white-space: nowrap;
  }

  .item.selected {
    background: color-mix(in srgb, var(--ame-accent) 18%, transparent);
  }

  .label {
    flex: none;
  }

  .detail {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
    text-overflow: ellipsis;
  }

  .hint {
    margin-left: auto;
    color: var(--ame-text-muted);
    font-family: inherit;
    font-size: var(--ame-font-size-small);
  }

  mark {
    background: transparent;
    color: var(--ame-accent);
    font-weight: 600;
  }

  .empty {
    padding: var(--ame-space-3);
    color: var(--ame-text-muted);
    text-align: center;
  }
</style>
