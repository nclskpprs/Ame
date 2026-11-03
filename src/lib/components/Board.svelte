<script lang="ts">
  import { onMount } from 'svelte';
  import { formatDuration } from '$lib/agents/duration';
  import { showSession } from '$lib/agents/show';
  import { board, COLUMNS, emptyPackage } from '$lib/board/board.svelte';
  import { templateOf } from '$lib/board/templates';
  import { formatShortcut, parseShortcut } from '$lib/commands/shortcuts';
  import { t } from '$lib/i18n';
  import type { PackageState } from '$lib/ipc/bindings';
  import type { Package, Project } from '$lib/ipc/types';
  import { contextMenu } from '$lib/menu/context-menu.svelte';
  import type { MenuEntry } from '$lib/menu/menu';
  import { view } from '$lib/stores/view.svelte';
  import DropMark from './DropMark.svelte';
  import StatusDot from './StatusDot.svelte';

  let { project }: { project: Project } = $props();

  let root: HTMLElement | undefined = $state();
  let deleting = $state<string | null>(null);
  let now = $state(Date.now());
  /** The package in the form (a copy, saved on submit). */
  let draft = $state<Package | null>(null);
  let invalid = $state(false);

  const saveShortcut = formatShortcut(parseShortcut('Mod+Enter'));
  const templates = $derived(board.templates);
  const counts = $derived(
    Object.fromEntries(COLUMNS.map((state) => [state, board.column(state).length])) as Record<
      PackageState,
      number
    >,
  );

  $effect(() => {
    void board.load(project.path);
  });

  // A "New Work Package" command can ask for the form before the board shows.
  $effect(() => {
    if (board.editing === 'new' && draft === null) startNew();
  });

  onMount(() => {
    root?.focus();
    const timer = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(timer);
  });

  function startNew() {
    invalid = false;
    deleting = null;
    draft = emptyPackage(project.path, templates[0]?.id ?? '');
    board.editing = 'new';
  }

  function edit(item: Package) {
    invalid = false;
    deleting = null;
    draft = { ...item, fields: { ...item.fields } };
    board.editing = item.id;
  }

  function cancel() {
    draft = null;
    board.editing = null;
    queueMicrotask(() => root?.focus());
  }

  async function submit(event?: SubmitEvent) {
    event?.preventDefault();
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) {
      invalid = true;
      return;
    }
    const item = { ...draft, title };
    draft = null;
    board.editing = null;
    await board.save(item);
    queueMicrotask(() => root?.focus());
  }

  function onFormKey(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || draft || deleting) return;
    event.preventDefault();
    view.close();
  }

  function menuFor(item: Package): MenuEntry[] {
    const entries: MenuEntry[] = [];
    if (item.state !== 'done') {
      entries.push({ kind: 'action', label: t('board.start'), run: () => board.pickAgent(item) });
    }
    entries.push(
      { kind: 'action', label: t('board.edit'), run: () => edit(item) },
      { kind: 'action', label: t('board.copyPrompt'), run: () => board.copyPrompt(item) },
      { kind: 'separator' },
    );
    if (item.state === 'done') {
      entries.push({
        kind: 'action',
        label: t('board.reopen'),
        run: () => board.setState(item, 'open'),
      });
    } else {
      entries.push({
        kind: 'action',
        label: t('board.markDone'),
        run: () => board.setState(item, 'done'),
      });
    }
    entries.push({ kind: 'action', label: t('board.delete'), run: () => (deleting = item.id) });
    return entries;
  }

  function preview(item: Package): string {
    const template = templateOf(templates, item.template);
    const first = template?.fields.find((field) => item.fields[field.id]?.trim());
    return first ? ((item.fields[first.id] ?? '').trim().split('\n')[0] ?? '') : '';
  }

  function focus(node: HTMLElement) {
    node.focus();
  }
</script>

{#snippet form(item: Package)}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <form class="form" onsubmit={submit} onkeydown={onFormKey}>
    {#if board.editing === 'new' && templates.length > 1}
      <label class="field">
        <span>{t('board.template')}</span>
        <select bind:value={item.template}>
          {#each templates as template (template.id)}
            <option value={template.id}>{template.name}</option>
          {/each}
        </select>
      </label>
    {/if}
    <label class="field">
      <span>{t('board.titleLabel')}</span>
      <input
        bind:value={item.title}
        placeholder={t('board.titlePlaceholder')}
        aria-invalid={invalid}
        use:focus
      />
    </label>
    {#each templateOf(templates, item.template)?.fields ?? [] as field (field.id)}
      <label class="field">
        <span>{field.label}</span>
        {#if field.multiline}
          <textarea rows="5" bind:value={item.fields[field.id]}></textarea>
        {:else}
          <input bind:value={item.fields[field.id]} />
        {/if}
      </label>
    {/each}
    {#if invalid}<p class="error" role="alert">{t('board.titleRequired')}</p>{/if}
    <div class="form-actions">
      <span class="hint">{t('board.formHint', { shortcut: saveShortcut })}</span>
      <button type="button" class="button" onclick={cancel}>{t('board.cancel')}</button>
      <button type="submit" class="button primary">{t('board.save')}</button>
    </div>
  </form>
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section class="board" aria-labelledby="board-title" tabindex="-1" bind:this={root} {onkeydown}>
  <header class="header">
    <div class="heading">
      <h1 id="board-title">{t('board.title')}</h1>
      <span class="project">{project.name}</span>
      <span class="summary">{t('board.summary', counts)}</span>
    </div>
    <button
      class="close"
      aria-label={t('board.close')}
      title={t('board.close')}
      onclick={() => view.close()}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </button>
  </header>

  {#if board.packages.length === 0 && !draft}
    <div class="empty">
      <DropMark size={48} />
      <p>{t('board.empty')}</p>
      <button class="button primary" onclick={startNew}>{t('board.newPackage')}</button>
    </div>
  {:else}
    <div class="columns">
      {#each COLUMNS as state (state)}
        <section class="column" aria-labelledby="board-column-{state}">
          <h2 id="board-column-{state}" class="column-title">
            {t(`board.column.${state}`)}
            <span class="count">{counts[state]}</span>
          </h2>
          {#if state === 'open'}
            {#if draft && board.editing === 'new'}
              {@render form(draft)}
            {:else}
              <button class="add" onclick={startNew}>+ {t('board.newPackage')}</button>
            {/if}
          {/if}
          <ul class="cards">
            {#each board.column(state) as item (item.id)}
              {@const session = board.sessionOf(item)}
              <li>
                {#if draft && board.editing === item.id}
                  {@render form(draft)}
                {:else if deleting === item.id}
                  <div class="card confirm" role="alertdialog" aria-label={t('board.delete')}>
                    <span>{t('board.deletePrompt', { title: item.title })}</span>
                    <div class="form-actions">
                      <button class="button" onclick={() => (deleting = null)} use:focus>
                        {t('board.cancel')}
                      </button>
                      <button
                        class="button danger"
                        onclick={() => {
                          deleting = null;
                          void board.remove(item);
                        }}>{t('board.delete')}</button
                      >
                    </div>
                  </div>
                {:else}
                  <div
                    class="card"
                    role="group"
                    aria-label={item.title}
                    oncontextmenu={(event) => contextMenu.show(event, item.title, menuFor(item))}
                  >
                    <button class="card-main" onclick={() => edit(item)}>
                      <span class="card-title">{item.title}</span>
                      {#if preview(item)}<span class="card-preview">{preview(item)}</span>{/if}
                    </button>
                    {#if item.state === 'started' && item.agent}
                      <span class="sent">
                        {#if session}<StatusDot state={session.state} />{/if}
                        {#if session}
                          <button
                            class="link"
                            title={t('board.showAgent', { agent: item.agent })}
                            onclick={() => showSession(item.project, session.id)}
                          >
                            {t('board.sentTo', {
                              agent: item.agent,
                              time: formatDuration(now - (item.startedAt ?? now)),
                            })}
                          </button>
                        {:else}
                          {t('board.sentTo', {
                            agent: item.agent,
                            time: formatDuration(now - (item.startedAt ?? now)),
                          })}
                        {/if}
                      </span>
                    {/if}
                    <div class="card-actions">
                      {#if item.state === 'open'}
                        <button class="button primary" onclick={() => board.pickAgent(item)}>
                          {t('board.start')}
                        </button>
                      {:else if item.state === 'started'}
                        <button class="button" onclick={() => board.setState(item, 'done')}>
                          {t('board.markDone')}
                        </button>
                      {:else}
                        <button class="button" onclick={() => board.setState(item, 'open')}>
                          {t('board.reopen')}
                        </button>
                      {/if}
                      <button
                        class="more"
                        aria-label={t('board.menu')}
                        title={t('board.menu')}
                        onclick={(event) => contextMenu.show(event, item.title, menuFor(item))}
                      >
                        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                          <circle cx="3.5" cy="8" r="1.2" />
                          <circle cx="8" cy="8" r="1.2" />
                          <circle cx="12.5" cy="8" r="1.2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                {/if}
              </li>
            {:else}
              {#if state !== 'open'}<li class="empty-column">{t('board.emptyColumn')}</li>{/if}
            {/each}
          </ul>
        </section>
      {/each}
    </div>
  {/if}
</section>

<style>
  .board {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    outline: none;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ame-space-3);
    padding: var(--ame-space-3) var(--ame-space-6);
    border-bottom: 1px solid var(--ame-border);
  }

  .heading {
    display: flex;
    align-items: baseline;
    gap: var(--ame-space-3);
    min-width: 0;
  }

  h1 {
    margin: 0;
    font-size: var(--ame-font-size-title);
    font-weight: 600;
  }

  .project {
    font-weight: 600;
  }

  .summary,
  .project {
    overflow: hidden;
    color: var(--ame-text-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .close,
  .more {
    display: grid;
    place-items: center;
    padding: var(--ame-space-1);
    border: 0;
    border-radius: var(--ame-radius);
    background: transparent;
    color: var(--ame-text-muted);
  }

  .close:hover,
  .more:hover {
    background: var(--ame-bg);
    color: var(--ame-text);
  }

  .close path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
  }

  .more circle {
    fill: currentColor;
  }

  .columns {
    display: grid;
    flex: 1;
    grid-template-columns: repeat(3, minmax(220px, 1fr));
    gap: var(--ame-space-4);
    min-height: 0;
    overflow: auto;
    padding: var(--ame-space-4) var(--ame-space-6) var(--ame-space-6);
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: var(--ame-space-2);
    min-width: 0;
  }

  .column-title {
    display: flex;
    align-items: center;
    gap: var(--ame-space-2);
    margin: 0;
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .count {
    font-variant-numeric: tabular-nums;
    font-weight: 400;
  }

  .cards {
    display: flex;
    flex-direction: column;
    gap: var(--ame-space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .card,
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--ame-space-2);
    padding: var(--ame-space-3);
    border: 1px solid var(--ame-border);
    border-radius: var(--ame-radius);
    background: var(--ame-surface);
  }

  .card:hover {
    border-color: var(--ame-text-muted);
  }

  .form {
    border-color: var(--ame-accent);
  }

  .card-main {
    display: flex;
    flex-direction: column;
    gap: var(--ame-space-1);
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ame-text);
    font: inherit;
    text-align: left;
  }

  .card-title {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .card-preview,
  .sent,
  .empty-column,
  .hint {
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
  }

  .card-preview {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sent {
    display: flex;
    align-items: center;
    gap: var(--ame-space-2);
  }

  .link {
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    text-decoration: underline;
    text-decoration-color: var(--ame-border);
  }

  .link:hover {
    color: var(--ame-text);
  }

  .card-actions,
  .form-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--ame-space-2);
  }

  .card-actions .more {
    margin-left: auto;
    order: 2;
  }

  .form-actions .hint {
    margin-right: auto;
  }

  .add {
    padding: var(--ame-space-2);
    border: 1px dashed var(--ame-border);
    border-radius: var(--ame-radius);
    background: transparent;
    color: var(--ame-text-muted);
    font: inherit;
    text-align: left;
  }

  .add:hover {
    border-color: var(--ame-accent);
    color: var(--ame-text);
  }

  .button {
    padding: var(--ame-space-1) var(--ame-space-3);
    border: 1px solid var(--ame-border);
    border-radius: var(--ame-radius);
    background: transparent;
    color: var(--ame-text);
    font: inherit;
  }

  .button:hover {
    border-color: var(--ame-text-muted);
  }

  .button.primary {
    border-color: var(--ame-accent);
    color: var(--ame-accent);
  }

  .button.danger {
    border-color: var(--ame-error);
    color: var(--ame-error);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--ame-space-1);
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
  }

  .field input,
  .field textarea,
  .field select {
    padding: var(--ame-space-1) var(--ame-space-2);
    border: 1px solid var(--ame-border);
    border-radius: var(--ame-radius);
    background: var(--ame-bg);
    color: var(--ame-text);
    font: inherit;
    font-size: var(--ame-font-size);
  }

  .field textarea {
    resize: vertical;
  }

  .field input[aria-invalid='true'] {
    border-color: var(--ame-error);
  }

  .error {
    margin: 0;
    color: var(--ame-error);
    font-size: var(--ame-font-size-small);
  }

  .empty {
    display: grid;
    justify-items: center;
    gap: var(--ame-space-3);
    margin-top: 10vh;
    padding: 0 var(--ame-space-6);
    color: var(--ame-text-muted);
    text-align: center;
  }

  .empty p {
    margin: 0;
  }
</style>
