<script lang="ts">
  import { t } from '$lib/i18n';
  import type { FileTreeState, TreeRow } from '$lib/project/file-tree.svelte';
  import { treeClick } from '$lib/project/tree-click';
  import { iconName, iconUrl } from '$lib/fs/file-icons';
  import { markLetters, type GitMark } from '$lib/git/marks';
  import { currentTheme } from '$lib/theme/current.svelte';

  let {
    tree,
    unsaved = new Set(),
    git = new Map(),
    recent = new Set(),
    icons = true,
    singleClick = false,
    onopen,
  }: {
    tree: FileTreeState;
    /** Files with unsaved changes and the folders that contain them. */
    unsaved?: ReadonlySet<string>;
    /** Git marks of changed files and the folders that contain them. */
    git?: ReadonlyMap<string, GitMark>;
    /** Files an agent just changed, and their folders. */
    recent?: ReadonlySet<string>;
    /** Show file type icons. */
    icons?: boolean;
    /** Open files with a single click instead of a double click. */
    singleClick?: boolean;
    /** Called when a file is activated (click or Enter, see `singleClick`). */
    onopen: (path: string) => void;
  } = $props();

  const rows = $derived(tree.rows());
  const root = $derived(tree.children.get(''));
  let container: HTMLElement | undefined = $state();

  function activate(row: TreeRow) {
    tree.selected = row.entry.path;
    if (row.entry.kind === 'dir') void tree.toggle(row.entry.path);
    else onopen(row.entry.path);
  }

  function onclick(event: MouseEvent, row: TreeRow) {
    tree.selected = row.entry.path;
    const action = treeClick(row.entry.kind, event.detail, singleClick);
    if (action === 'toggle') void tree.toggle(row.entry.path);
    else if (action === 'open') onopen(row.entry.path);
  }

  function select(index: number) {
    const row = rows[Math.max(0, Math.min(rows.length - 1, index))];
    if (!row) return;
    tree.selected = row.entry.path;
    queueMicrotask(() =>
      container?.querySelector<HTMLElement>(`[data-path="${CSS.escape(row.entry.path)}"]`)?.focus(),
    );
  }

  function onkeydown(event: KeyboardEvent) {
    const index = rows.findIndex((row) => row.entry.path === tree.selected);
    const row = rows[index];
    switch (event.key) {
      case 'ArrowDown':
        select(index + 1);
        break;
      case 'ArrowUp':
        select(index - 1);
        break;
      case 'Home':
        select(0);
        break;
      case 'End':
        select(rows.length - 1);
        break;
      case 'ArrowRight':
        if (row?.entry.kind === 'dir') {
          if (row.expanded) select(index + 1);
          else void tree.expand(row.entry.path);
        }
        break;
      case 'ArrowLeft': {
        if (row?.expanded) {
          void tree.toggle(row.entry.path);
        } else if (row) {
          const parent = rows.findLastIndex(
            (other, i) => i < index && other.depth === row.depth - 1,
          );
          if (parent >= 0) select(parent);
        }
        break;
      }
      case 'Enter':
      case ' ':
        if (row) activate(row);
        break;
      default:
        return;
    }
    event.preventDefault();
  }
</script>

<div
  class="file-tree"
  role="tree"
  tabindex="-1"
  aria-label={t('fileTree.label')}
  bind:this={container}
  {onkeydown}
>
  {#if root?.status === 'error'}
    <p class="message">{t('fileTree.loadFailed', { message: root.message })}</p>
  {:else if root?.status === 'loaded' && rows.length === 0}
    <p class="message">{t('fileTree.empty')}</p>
  {/if}
  {#each rows as row, index (row.entry.path)}
    {@const mark = git.get(row.entry.path)}
    <div
      class="row {mark ? `git-${mark}` : ''}"
      class:selected={row.entry.path === tree.selected}
      class:recent={recent.has(row.entry.path)}
      class:ignored={row.ignored}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-expanded={row.entry.kind === 'dir' ? row.expanded : undefined}
      aria-selected={row.entry.path === tree.selected}
      tabindex={row.entry.path === tree.selected || (tree.selected === null && index === 0)
        ? 0
        : -1}
      data-path={row.entry.path}
      style:padding-left="calc({row.depth} * var(--ame-tree-indent) + var(--ame-space-2))"
      title={row.entry.path}
      onclick={(event) => onclick(event, row)}
      onkeydown={() => {}}
    >
      {#if row.entry.kind === 'dir'}
        <svg class="chevron" class:open={row.expanded} viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 4l4 4-4 4" />
        </svg>
      {:else}
        <span class="spacer"></span>
      {/if}
      {#if icons}
        <img
          class="icon"
          src={iconUrl(iconName(row.entry.name, row.entry.kind), currentTheme.name)}
          alt=""
          width="16"
          height="16"
          draggable="false"
        />
      {/if}
      <span class="name">{row.entry.name}</span>
      {#if mark && row.entry.kind === 'file'}
        <span class="git-letter" title={t(`git.${mark}`)}>{markLetters[mark]}</span>
      {/if}
      {#if unsaved.has(row.entry.path) && !row.expanded}
        <span class="unsaved" title={t('fileTree.unsaved')}>
          <span class="visually-hidden">{t('fileTree.unsaved')}</span>
        </span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .file-tree {
    --ame-tree-indent: 12px;
    padding: var(--ame-space-1) 0;
    font-size: var(--ame-font-size);
  }

  .message {
    margin: 0;
    padding: var(--ame-space-2) var(--ame-space-3);
    color: var(--ame-text-muted);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--ame-space-1);
    padding-right: var(--ame-space-2);
    color: var(--ame-text-muted);
    line-height: 1.7;
    white-space: nowrap;
  }

  .row:hover {
    color: var(--ame-text);
  }

  /* Changed by an agent a moment ago. */
  .row.recent {
    box-shadow: inset 2px 0 0 var(--ame-accent);
  }

  /* Excluded by .gitignore, listed only when ignored files are shown. */
  .row.ignored .name {
    opacity: 0.6;
  }

  .row.selected {
    background: var(--ame-bg);
    color: var(--ame-text);
  }

  .row:focus-visible {
    outline-offset: -2px;
  }

  .chevron,
  .spacer {
    flex: none;
    width: 14px;
    height: 14px;
  }

  .chevron path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  .icon {
    flex: none;
    width: 16px;
    height: 16px;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .git-letter {
    flex: none;
    margin-left: auto;
    font-family: var(--ame-font-code);
    font-size: var(--ame-font-size-small);
  }

  .git-letter + .unsaved {
    margin-left: var(--ame-space-1);
  }

  .git-modified .name,
  .git-modified .git-letter {
    color: var(--ame-git-modified);
  }

  .git-added .name,
  .git-added .git-letter,
  .git-renamed .name,
  .git-renamed .git-letter {
    color: var(--ame-git-added);
  }

  .git-untracked .name,
  .git-untracked .git-letter {
    color: var(--ame-git-untracked);
  }

  .git-deleted .name,
  .git-deleted .git-letter {
    color: var(--ame-git-deleted);
  }

  .git-conflicted .name,
  .git-conflicted .git-letter {
    color: var(--ame-git-conflict);
  }

  .unsaved {
    flex: none;
    width: 7px;
    height: 7px;
    margin-left: auto;
    border-radius: 50%;
    background: var(--ame-text);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
