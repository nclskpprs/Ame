<script lang="ts">
  import { t } from '$lib/i18n';
  import type { FileOps, FileTreeState, TreeRow } from '$lib/project/file-tree.svelte';
  import { treeClick } from '$lib/project/tree-click';
  import { iconName, iconUrl } from '$lib/fs/file-icons';
  import { markLetters, type GitMark } from '$lib/git/marks';
  import { currentTheme } from '$lib/theme/current.svelte';
  import { basename, cleanPath, dirname, isWithin } from '$lib/fs/paths';
  import { contextMenu } from '$lib/menu/context-menu.svelte';
  import type { MenuEntry } from '$lib/menu/menu';
  import { copyPath, revealEntry, revealLabel } from '$lib/fs/reveal';
  import { isMac } from '$lib/commands/shortcuts';

  let {
    tree,
    unsaved = new Set(),
    git = new Map(),
    recent = new Set(),
    icons = true,
    singleClick = false,
    ops,
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
    /** Create, move and trash; without it the tree is read-only. */
    ops?: FileOps;
    /** Called when a file is activated (click or Enter, see `singleClick`). */
    onopen: (path: string) => void;
  } = $props();

  const rows = $derived(tree.rows());
  const root = $derived(tree.children.get(''));
  let container: HTMLElement | undefined = $state();

  function editLabel(): string {
    if (!edit) return '';
    switch (edit.kind) {
      case 'newFile':
        return t('fileTree.newFilePrompt');
      case 'newFolder':
        return t('fileTree.newFolderPrompt');
      case 'move':
        return t('fileTree.movePrompt', { name: basename(edit.path) });
      case 'trash':
        return t(edit.isDir ? 'fileTree.trashFolderPrompt' : 'fileTree.trashPrompt', {
          name: basename(edit.path),
        });
    }
  }

  function focusButton(node: HTMLButtonElement) {
    node.focus();
  }

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

  const edit = $derived(tree.edit);
  let busy = $state(false);
  /** Path of the entry being dragged, and the folder it would land in. */
  let dragging: string | null = null;
  let dropTarget = $state<string | null>(null);

  function focusInput(node: HTMLInputElement) {
    node.focus();
    // Select the name, so typing renames and the folder stays.
    const start = node.value.endsWith('/') ? node.value.length : node.value.lastIndexOf('/') + 1;
    const dot = node.value.lastIndexOf('.');
    node.setSelectionRange(start, dot > start ? dot : node.value.length);
  }

  async function submit() {
    if (!edit || !ops || busy) return;
    busy = true;
    let done = false;
    if (edit.kind === 'trash') {
      done = await ops.trashEntry(edit.path);
    } else {
      const path = cleanPath(edit.value);
      if (path && edit.kind === 'move') done = await ops.moveEntry(edit.path, path);
      else if (path) done = await ops.createEntry(path, edit.kind === 'newFile' ? 'file' : 'dir');
    }
    busy = false;
    if (done) {
      tree.edit = null;
      if (edit.kind !== 'newFile') focusSelected();
    }
  }

  function cancel() {
    tree.edit = null;
    focusSelected();
  }

  function oneditkeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') void submit();
    else if (event.key === 'Escape') cancel();
    else return;
    event.preventDefault();
    event.stopPropagation();
  }

  function focusSelected() {
    queueMicrotask(() => {
      const path = tree.selected;
      const row = path
        ? container?.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`)
        : null;
      (row ?? container)?.focus();
    });
  }

  function menuFor(row: TreeRow | null): MenuEntry[] {
    const items: MenuEntry[] = [
      { kind: 'action', label: t('fileTree.newFile'), run: () => tree.startNew('newFile') },
      { kind: 'action', label: t('fileTree.newFolder'), run: () => tree.startNew('newFolder') },
    ];
    const path = row?.entry.path ?? '';
    const project = tree.project;
    items.push(
      { kind: 'separator' },
      { kind: 'action', label: revealLabel(path), run: () => revealEntry(project, path) },
      { kind: 'action', label: t('reveal.copyPath'), run: () => copyPath(project, path) },
    );
    if (row) {
      items.push(
        {
          kind: 'action',
          label: t('reveal.copyRelativePath'),
          run: () => copyPath(project, path, true),
        },
        { kind: 'separator' },
        { kind: 'action', label: t('fileTree.move'), run: () => tree.startMove(path) },
        { kind: 'action', label: t('fileTree.trash'), run: () => tree.startTrash(path) },
      );
    }
    return items;
  }

  function oncontextmenu(event: MouseEvent, row: TreeRow | null) {
    if (!ops) return;
    event.stopPropagation();
    tree.selected = row?.entry.path ?? null;
    contextMenu.show(event, row?.entry.name ?? t('fileTree.label'), menuFor(row));
  }

  /** The folder a dragged entry would be dropped into, if it may go there. */
  function dropDir(row: TreeRow | null): string | null {
    if (!dragging) return null;
    const dir = row ? (row.entry.kind === 'dir' ? row.entry.path : dirname(row.entry.path)) : '';
    if (isWithin(dir, dragging) && dir !== '') return null;
    return dir === dirname(dragging) ? null : dir;
  }

  function ondragstart(event: DragEvent, row: TreeRow) {
    if (!ops || !event.dataTransfer) return;
    dragging = row.entry.path;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', row.entry.path);
  }

  function ondragover(event: DragEvent, row: TreeRow | null) {
    const dir = dropDir(row);
    if (dir === null) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    dropTarget = dir;
  }

  function ondrop(event: DragEvent, row: TreeRow | null) {
    const dir = dropDir(row);
    const from = dragging;
    ondragend();
    if (dir === null || from === null || !ops) return;
    event.preventDefault();
    event.stopPropagation();
    void ops.moveEntry(from, dir ? `${dir}/${basename(from)}` : basename(from));
  }

  function ondragend() {
    dragging = null;
    dropTarget = null;
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
      case 'F2':
        if (row && ops) tree.startMove(row.entry.path);
        break;
      case 'Delete':
      case 'Backspace':
        // Backspace alone types in other places; it needs Cmd on macOS.
        if (event.key === 'Backspace' && !(isMac && event.metaKey)) return;
        if (row && ops) tree.startTrash(row.entry.path);
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
  oncontextmenu={(event) => oncontextmenu(event, null)}
  ondragover={(event) => ondragover(event, null)}
  ondrop={(event) => ondrop(event, null)}
  class:drop-root={dropTarget === ''}
>
  {#if edit}
    <div
      class="edit"
      role={edit.kind === 'trash' ? 'alertdialog' : 'group'}
      aria-label={editLabel()}
    >
      {#if edit.kind === 'trash'}
        <span>{editLabel()}</span>
        <div class="buttons">
          <button class="primary" disabled={busy} onclick={() => void submit()} use:focusButton>
            {t('fileTree.trash')}
          </button>
          <button onclick={cancel}>{t('fileTree.cancel')}</button>
        </div>
      {:else}
        <label for="file-tree-edit">{editLabel()}</label>
        <input
          id="file-tree-edit"
          type="text"
          spellcheck="false"
          autocomplete="off"
          title={t('fileTree.pathHint')}
          bind:value={edit.value}
          disabled={busy}
          use:focusInput
          onkeydown={oneditkeydown}
          onblur={() => {
            if (!busy) tree.edit = null;
          }}
        />
      {/if}
    </div>
  {/if}
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
      draggable={ops ? 'true' : 'false'}
      class:drop={dropTarget !== null && dropTarget !== '' && row.entry.path === dropTarget}
      onclick={(event) => onclick(event, row)}
      oncontextmenu={(event) => oncontextmenu(event, row)}
      ondragstart={(event) => ondragstart(event, row)}
      ondragover={(event) => ondragover(event, row)}
      ondrop={(event) => ondrop(event, row)}
      {ondragend}
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

  .row.drop,
  .file-tree.drop-root {
    background: var(--ame-bg);
    outline: 1px dashed var(--ame-accent);
    outline-offset: -1px;
  }

  .edit {
    display: grid;
    gap: var(--ame-space-1);
    margin: 0 var(--ame-space-2) var(--ame-space-2);
    padding: var(--ame-space-2);
    border: 1px solid var(--ame-border);
    border-radius: var(--ame-radius);
    background: var(--ame-bg);
    font-size: var(--ame-font-size-small);
    color: var(--ame-text-muted);
  }

  .edit[role='alertdialog'] {
    border-color: var(--ame-needs-input);
  }

  .edit input {
    min-width: 0;
    padding: 2px var(--ame-space-1);
    border: 1px solid var(--ame-accent);
    border-radius: var(--ame-radius);
    background: var(--ame-surface);
    color: var(--ame-text);
    font: inherit;
    font-family: var(--ame-font-code);
  }

  .edit .buttons {
    display: flex;
    gap: var(--ame-space-2);
  }

  .edit button {
    padding: 2px var(--ame-space-3);
    border: 1px solid var(--ame-border);
    border-radius: var(--ame-radius);
    background: var(--ame-surface);
    color: var(--ame-text);
    font: inherit;
  }

  .edit button.primary {
    border-color: var(--ame-accent);
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
