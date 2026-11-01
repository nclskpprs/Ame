<script lang="ts">
  import { contextMenu, type ContextMenuConfig } from '$lib/menu/context-menu.svelte';
  import { placeMenu, pointRect, step, typeahead, type MenuEntry, type Rect } from '$lib/menu/menu';

  let { config }: { config: ContextMenuConfig } = $props();

  interface Panel {
    entries: MenuEntry[];
    /** The pointer for the root menu, the parent item for a submenu. */
    anchor: Rect;
    label: string;
  }

  // svelte-ignore state_referenced_locally
  let panels = $state.raw<Panel[]>([
    { entries: config.items, anchor: pointRect(config.at), label: config.label },
  ]);
  /** Highlighted entry per panel, -1 for none. */
  // svelte-ignore state_referenced_locally
  let active = $state<number[]>([config.keyboard ? step(config.items, -1, 1) : -1]);
  /** The panel that has the keyboard focus. */
  let depth = $state(0);
  let menus = $state<(HTMLElement | undefined)[]>([]);
  let root: HTMLElement | undefined = $state();

  $effect(() => {
    const menu = menus[depth];
    const index = active[depth] ?? -1;
    const target = index >= 0 ? menu?.querySelector<HTMLElement>(`[data-index="${index}"]`) : menu;
    target?.focus();
  });

  function place(node: HTMLElement, anchor: Rect) {
    const size = { width: node.offsetWidth, height: node.offsetHeight };
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const { x, y } = placeMenu(anchor, size, viewport);
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
  }

  /** Keeps panels up to `level` and highlights `index` there. */
  function highlight(level: number, index: number) {
    if (panels.length > level + 1) {
      panels = panels.slice(0, level + 1);
      active = active.slice(0, level + 1);
    }
    active[level] = index;
    depth = level;
  }

  /**
   * A submenu opens beside its parent menu, with its first item level with
   * the parent item.
   */
  function submenuAnchor(menu: HTMLElement, item: Element): Rect {
    const outer = menu.getBoundingClientRect();
    const row = item.getBoundingClientRect();
    const inset = parseFloat(getComputedStyle(menu).paddingTop) + menu.clientTop;
    return {
      left: outer.left,
      right: outer.right,
      top: row.top - inset,
      bottom: row.bottom + inset,
    };
  }

  function openSubmenu(level: number, index: number, focusFirst: boolean) {
    const entry = panels[level]?.entries[index];
    const menu = menus[level];
    const item = menu?.querySelector(`[data-index="${index}"]`);
    if (entry?.kind !== 'submenu' || !menu || !item) return;
    highlight(level, index);
    const anchor = submenuAnchor(menu, item);
    panels = [...panels, { entries: entry.items, anchor, label: entry.label }];
    active.push(focusFirst ? step(entry.items, -1, 1) : -1);
    if (focusFirst) depth = level + 1;
  }

  function closeSubmenu(level: number) {
    panels = panels.slice(0, level);
    active = active.slice(0, level);
    depth = level - 1;
  }

  function activate(level: number, index: number, fromKeyboard: boolean) {
    const entry = panels[level]?.entries[index];
    if (entry?.kind === 'action') {
      contextMenu.close();
      void entry.run();
    } else if (entry?.kind === 'submenu') {
      if (panels.length > level + 1 && active[level] === index && !fromKeyboard) return;
      openSubmenu(level, index, fromKeyboard);
    }
  }

  function hover(level: number, index: number) {
    if (active[level] === index && depth === level) return;
    if (active[level] === index && panels.length > level + 1) {
      depth = level;
      return;
    }
    highlight(level, index);
    openSubmenu(level, index, false);
  }

  function leave(level: number) {
    // Keep the parent item highlighted while its submenu is open.
    if (panels.length === level + 1) active[level] = -1;
  }

  function onkeydown(event: KeyboardEvent, level: number) {
    const entries = panels[level]?.entries ?? [];
    const index = active[level] ?? -1;
    switch (event.key) {
      case 'ArrowDown':
        highlight(level, step(entries, index, 1));
        break;
      case 'ArrowUp':
        highlight(level, step(entries, index, -1));
        break;
      case 'Home':
        highlight(level, step(entries, -1, 1));
        break;
      case 'End':
        highlight(level, step(entries, -1, -1));
        break;
      case 'ArrowRight':
        openSubmenu(level, index, true);
        break;
      case 'ArrowLeft':
        if (level > 0) closeSubmenu(level);
        break;
      case 'Escape':
        if (level > 0) closeSubmenu(level);
        else contextMenu.close();
        break;
      case 'Enter':
      case ' ':
        if (index >= 0) activate(level, index, true);
        break;
      case 'Tab':
        // Focus returns to the menu's origin; the default action moves it on.
        contextMenu.close();
        return;
      default: {
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
        const match = typeahead(entries, index, event.key);
        if (match >= 0) highlight(level, match);
      }
    }
    event.preventDefault();
    event.stopPropagation();
  }

  /** Clicks and scrolling outside close the menu; the click itself still goes through. */
  function onOutside(event: Event) {
    if (!root?.contains(event.target as Node)) contextMenu.close(false);
  }
</script>

<svelte:window
  onpointerdowncapture={onOutside}
  onwheelcapture={onOutside}
  onblur={() => contextMenu.close(false)}
  onresize={() => contextMenu.close(false)}
/>

<div class="context-menu" bind:this={root}>
  {#each panels as panel, level (panel)}
    <div
      class="menu"
      role="menu"
      tabindex="-1"
      aria-label={panel.label}
      bind:this={menus[level]}
      use:place={panel.anchor}
      onkeydown={(event) => onkeydown(event, level)}
      onpointerleave={() => leave(level)}
      oncontextmenu={(event) => event.preventDefault()}
    >
      {#each panel.entries as entry, index (index)}
        {#if entry.kind === 'separator'}
          <div class="separator" role="separator"></div>
        {:else}
          <button
            type="button"
            class="item"
            class:active={active[level] === index}
            role="menuitem"
            tabindex="-1"
            data-index={index}
            aria-haspopup={entry.kind === 'submenu' ? 'menu' : undefined}
            aria-expanded={entry.kind === 'submenu'
              ? active[level] === index && panels.length > level + 1
              : undefined}
            onpointermove={() => hover(level, index)}
            onclick={(event) => activate(level, index, event.detail === 0)}
          >
            <span class="label">{entry.label}</span>
            {#if entry.kind === 'submenu'}
              <svg class="chevron" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M6 4l4 4-4 4" />
              </svg>
            {/if}
          </button>
        {/if}
      {/each}
    </div>
  {/each}
</div>

<style>
  .menu {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    min-width: 180px;
    max-width: 320px;
    max-height: calc(100vh - 8px);
    padding: var(--ame-space-1);
    overflow-y: auto;
    background: var(--ame-surface);
    border: 1px solid var(--ame-border);
    border-radius: calc(var(--ame-radius) + 2px);
    box-shadow: 0 8px 24px color-mix(in srgb, var(--ame-bg) 60%, transparent);
  }

  .menu:focus {
    outline: none;
  }

  .item {
    display: flex;
    align-items: center;
    gap: var(--ame-space-2);
    width: 100%;
    padding: var(--ame-space-1) var(--ame-space-3);
    border: 0;
    border-radius: var(--ame-radius);
    background: transparent;
    color: var(--ame-text);
    font: inherit;
    text-align: left;
    white-space: nowrap;
  }

  .item.active {
    background: color-mix(in srgb, var(--ame-accent) 18%, transparent);
  }

  .item:focus-visible {
    outline-offset: -2px;
  }

  .label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chevron {
    flex: none;
    width: 14px;
    height: 14px;
    margin-right: calc(-1 * var(--ame-space-1));
    color: var(--ame-text-muted);
  }

  .chevron path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .separator {
    height: 1px;
    margin: var(--ame-space-1) var(--ame-space-2);
    background: var(--ame-border);
  }
</style>
