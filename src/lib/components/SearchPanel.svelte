<script lang="ts">
  import { basename, dirname } from '$lib/fs/paths';
  import { t, type MessageKey } from '$lib/i18n';
  import type { SearchOptions } from '$lib/ipc/bindings';
  import { rangeSegments } from '$lib/palette/highlight';
  import type { ProjectSession } from '$lib/project/session';

  let { session }: { session: ProjectSession } = $props();

  const search = $derived(session.search);
  const DEBOUNCE_MS = 250;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let input: HTMLInputElement | undefined = $state();

  const toggles: { key: keyof SearchOptions; label: MessageKey; text: string }[] = [
    { key: 'caseSensitive', label: 'search.caseSensitive', text: 'Aa' },
    { key: 'wholeWord', label: 'search.wholeWord', text: 'ab' },
    { key: 'regex', label: 'search.regex', text: '.*' },
  ];

  $effect(() => {
    void search.focusRequest;
    input?.focus();
    input?.select();
  });

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => void search.run(), DEBOUNCE_MS);
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      clearTimeout(timer);
      void search.run();
    }
  }

  function toggle(key: keyof SearchOptions) {
    search.options = { ...search.options, [key]: !search.options[key] };
    void search.run();
  }

  function toggleFile(path: string) {
    if (search.collapsed.has(path)) search.collapsed.delete(path);
    else search.collapsed.add(path);
  }
</script>

<div class="search">
  <div class="field">
    <input
      class="input"
      placeholder={t('search.placeholder')}
      aria-label={t('search.placeholder')}
      spellcheck="false"
      autocomplete="off"
      bind:this={input}
      bind:value={search.query}
      oninput={schedule}
      {onkeydown}
    />
    <div class="toggles">
      {#each toggles as toggleOption (toggleOption.key)}
        <button
          class="toggle"
          aria-pressed={search.options[toggleOption.key]}
          aria-label={t(toggleOption.label)}
          title={t(toggleOption.label)}
          onclick={() => toggle(toggleOption.key)}
        >
          <span aria-hidden="true">{toggleOption.text}</span>
        </button>
      {/each}
    </div>
  </div>

  <p class="status" role="status">
    {#if search.status === 'searching'}
      {t('search.searching')}
    {:else if search.status === 'error'}
      {t('search.invalid', { message: search.error })}
    {:else if search.summary && search.summary.matches === 0}
      {t('search.noResults')}
    {:else if search.summary?.truncated}
      {t('search.truncated', { matches: search.summary.matches })}
    {:else if search.summary}
      {t('search.summary', { matches: search.summary.matches, files: search.summary.files })}
    {/if}
  </p>

  <ul class="results">
    {#each search.results as file (file.path)}
      {@const collapsed = search.collapsed.has(file.path)}
      <li>
        <button
          class="file"
          aria-expanded={!collapsed}
          title={file.path}
          onclick={() => toggleFile(file.path)}
        >
          <svg class="chevron" class:open={!collapsed} viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 4l4 4-4 4" />
          </svg>
          <span class="name">{basename(file.path)}</span>
          <span class="dir">{dirname(file.path)}</span>
          <span class="count">{file.lines.length}</span>
        </button>
        {#if !collapsed}
          <ul>
            {#each file.lines as line, index (index)}
              <li>
                <button
                  class="line"
                  onclick={() =>
                    void session.openLocation(
                      file.path,
                      line.line,
                      line.offset + (line.ranges[0]?.start ?? 0),
                      line.offset + (line.ranges[0]?.end ?? 0),
                    )}
                >
                  <span class="number">{line.line}</span>
                  <span class="text">
                    {#each rangeSegments(line.text, line.ranges) as segment, i (i)}
                      {#if segment.match}<mark>{segment.text}</mark>{:else}{segment.text}{/if}
                    {/each}
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </li>
    {/each}
  </ul>
</div>

<style>
  .search {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: var(--ame-space-2);
  }

  .field {
    display: flex;
    align-items: center;
    border: 1px solid var(--ame-border);
    border-radius: var(--ame-radius);
    background: var(--ame-bg);
  }

  .field:focus-within {
    border-color: var(--ame-accent);
  }

  .input {
    flex: 1;
    min-width: 0;
    padding: var(--ame-space-1) var(--ame-space-2);
    border: 0;
    background: transparent;
    color: var(--ame-text);
    font: inherit;
    outline: none;
  }

  .toggles {
    display: flex;
    gap: 2px;
    padding-right: 2px;
  }

  .toggle {
    min-width: 22px;
    padding: 0 3px;
    border: 1px solid transparent;
    border-radius: calc(var(--ame-radius) - 2px);
    background: transparent;
    color: var(--ame-text-muted);
    font-family: var(--ame-font-code);
    font-size: var(--ame-font-size-small);
  }

  .toggle[aria-pressed='true'] {
    border-color: var(--ame-accent);
    color: var(--ame-text);
  }

  .status {
    min-height: 1.5em;
    margin: var(--ame-space-2) var(--ame-space-1) var(--ame-space-1);
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  button.file,
  button.line {
    display: flex;
    align-items: center;
    gap: var(--ame-space-1);
    width: 100%;
    padding: 1px var(--ame-space-1);
    border: 0;
    border-radius: var(--ame-radius);
    background: transparent;
    color: var(--ame-text);
    font: inherit;
    text-align: left;
    white-space: nowrap;
  }

  button.file:hover,
  button.line:hover {
    background: var(--ame-bg);
  }

  .chevron {
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

  .dir {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
    text-overflow: ellipsis;
  }

  .count {
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
  }

  button.line {
    padding-left: calc(14px + var(--ame-space-2));
    color: var(--ame-text-muted);
    font-family: var(--ame-font-code);
    font-size: var(--ame-font-size-small);
  }

  .number {
    flex: none;
    min-width: 3ch;
    color: var(--ame-text-muted);
    text-align: right;
  }

  .text {
    overflow: hidden;
    color: var(--ame-text);
    text-overflow: ellipsis;
  }

  mark {
    border-radius: 2px;
    background: color-mix(in srgb, var(--ame-needs-input) 35%, transparent);
    color: inherit;
  }
</style>
