<script lang="ts">
  import { iconName, iconUrl } from '$lib/fs/file-icons';
  import { basename, dirname } from '$lib/fs/paths';
  import { fileMark, markLetters } from '$lib/git/marks';
  import { t } from '$lib/i18n';
  import type { GitFile } from '$lib/ipc/types';
  import type { ProjectSession } from '$lib/project/session';
  import { settings } from '$lib/stores/settings.svelte';
  import { currentTheme } from '$lib/theme/current.svelte';

  let { session }: { session: ProjectSession } = $props();

  let message = $state('');
  const git = $derived(session.git);

  const status = $derived(session.git.status);
  const staged = $derived(status?.files.filter((file) => file.staged) ?? []);
  const changes = $derived(status?.files.filter((file) => file.unstaged) ?? []);

  async function commit() {
    if (!message.trim() || staged.length === 0 || git.busy) return;
    if (await git.commit(message)) {
      message = '';
      await session.editors.refreshDiffs();
    }
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void commit();
    }
  }

  function open(file: GitFile) {
    if (file.unstaged === 'deleted' || (!file.unstaged && file.staged === 'deleted')) return;
    void session.openDiff(file.path);
  }
</script>

{#snippet list(title: string, files: GitFile[], isStaged: boolean)}
  {#if files.length}
    <div class="section">
      <h3>{title} <span class="count">{files.length}</span></h3>
      <button
        class="action"
        disabled={git.busy}
        title={isStaged ? t('changes.unstageAll') : t('changes.stageAll')}
        aria-label={isStaged ? t('changes.unstageAll') : t('changes.stageAll')}
        onclick={() => {
          const paths = files.map((f) => f.path);
          void (isStaged ? git.unstage(paths) : git.stage(paths));
        }}
      >
        {#if isStaged}
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M3 8h10" />
          </svg>
        {:else}
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M8 3v10M3 8h10" />
          </svg>
        {/if}
      </button>
    </div>
    <ul>
      {#each files as file (file.path)}
        {@const mark = fileMark(file)}
        <li class="row">
          <button
            class="file {mark ? `git-${mark}` : ''}"
            title={file.origPath ? `${file.origPath} → ${file.path}` : file.path}
            onclick={() => open(file)}
          >
            {#if settings.value.fileIcons}
              <img
                class="icon"
                src={iconUrl(iconName(basename(file.path), 'file'), currentTheme.name)}
                alt=""
                width="16"
                height="16"
                draggable="false"
              />
            {/if}
            <span class="name">{basename(file.path)}</span>
            <span class="dir">{dirname(file.path)}</span>
            {#if mark}
              <span class="letter" title={t(`git.${mark}`)}>{markLetters[mark]}</span>
            {/if}
          </button>
          <button
            class="action"
            disabled={git.busy}
            title={isStaged ? t('changes.unstage') : t('changes.stage')}
            aria-label={isStaged ? t('changes.unstage') : t('changes.stage')}
            onclick={() => void (isStaged ? git.unstage([file.path]) : git.stage([file.path]))}
          >
            {#if isStaged}
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                <path d="M3 8h10" />
              </svg>
            {:else}
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                <path d="M8 3v10M3 8h10" />
              </svg>
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
{/snippet}

<div class="changes">
  {#if status}
    <div class="branch" title={t('changes.branch')}>
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <circle cx="5" cy="3.5" r="1.5" />
        <circle cx="5" cy="12.5" r="1.5" />
        <circle cx="11" cy="5.5" r="1.5" />
        <path d="M5 5v6M11 7c0 2.5-3 2.5-6 4" />
      </svg>
      <span>{status.branch ?? t('changes.detached')}</span>
      {#if status.ahead || status.behind}
        <span class="sync"
          >{t('changes.aheadBehind', { ahead: status.ahead, behind: status.behind })}</span
        >
      {/if}
    </div>
    <form
      class="commit"
      onsubmit={(event) => {
        event.preventDefault();
        void commit();
      }}
    >
      <textarea
        bind:value={message}
        rows="2"
        placeholder={t('changes.messagePlaceholder')}
        aria-label={t('changes.message')}
        spellcheck="false"
        {onkeydown}></textarea>
      <button
        type="submit"
        class="primary"
        disabled={!message.trim() || staged.length === 0 || git.busy}
        title={staged.length === 0 ? t('changes.nothingStaged') : t('changes.commitHint')}
      >
        {t('changes.commit')}
      </button>
    </form>
    {#if status.files.length === 0}
      <p class="empty">{t('changes.none')}</p>
    {/if}
    {@render list(t('changes.staged'), staged, true)}
    {@render list(t('changes.unstaged'), changes, false)}
  {/if}
</div>

<style>
  .changes {
    padding: var(--ame-space-2) 0;
  }

  .branch {
    display: flex;
    align-items: center;
    gap: var(--ame-space-2);
    padding: 0 var(--ame-space-3) var(--ame-space-2);
    color: var(--ame-text);
  }

  .branch svg {
    flex: none;
    fill: none;
    stroke: var(--ame-text-muted);
    stroke-width: 1.2;
  }

  .sync {
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
  }

  .empty {
    margin: 0;
    padding: var(--ame-space-2) var(--ame-space-3);
    color: var(--ame-text-muted);
  }

  .commit {
    display: grid;
    gap: var(--ame-space-2);
    padding: 0 var(--ame-space-3) var(--ame-space-2);
  }

  textarea {
    min-height: 44px;
    padding: var(--ame-space-1) var(--ame-space-2);
    border: 1px solid var(--ame-border);
    border-radius: var(--ame-radius);
    background: var(--ame-bg);
    color: var(--ame-text);
    font: inherit;
    resize: vertical;
    user-select: text;
  }

  .commit button {
    padding: 2px var(--ame-space-3);
    border: 1px solid var(--ame-accent);
    border-radius: var(--ame-radius);
    background: var(--ame-bg);
    color: var(--ame-text);
    font: inherit;
  }

  .commit button:disabled {
    border-color: var(--ame-border);
    color: var(--ame-text-muted);
  }

  .section {
    display: flex;
    align-items: center;
    margin: var(--ame-space-2) 0 var(--ame-space-1);
    padding: 0 var(--ame-space-2) 0 var(--ame-space-3);
  }

  .section h3 {
    display: flex;
    flex: 1;
    gap: var(--ame-space-2);
    margin: 0;
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .row {
    display: flex;
    align-items: center;
  }

  .row:hover {
    background: var(--ame-bg);
  }

  .action {
    display: grid;
    flex: none;
    place-items: center;
    margin-right: var(--ame-space-2);
    padding: 2px;
    border: 0;
    border-radius: var(--ame-radius);
    background: transparent;
    color: var(--ame-text-muted);
  }

  .action:hover {
    background: var(--ame-surface);
    color: var(--ame-text);
  }

  .row:not(:hover) .action:not(:focus-visible) {
    opacity: 0;
  }

  .action path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
  }

  .count {
    font-weight: 400;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .file {
    display: flex;
    align-items: center;
    gap: var(--ame-space-1);
    width: 100%;
    padding: 1px var(--ame-space-3);
    border: 0;
    background: transparent;
    color: var(--ame-text);
    font: inherit;
    line-height: 1.7;
    text-align: left;
    white-space: nowrap;
  }

  .file {
    flex: 1;
    min-width: 0;
  }

  .icon {
    flex: none;
  }

  .name {
    flex: none;
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dir {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
    text-overflow: ellipsis;
  }

  .letter {
    flex: none;
    font-family: var(--ame-font-code);
    font-size: var(--ame-font-size-small);
  }

  .git-modified .name,
  .git-modified .letter {
    color: var(--ame-git-modified);
  }

  .git-added .name,
  .git-added .letter,
  .git-renamed .name,
  .git-renamed .letter {
    color: var(--ame-git-added);
  }

  .git-untracked .name,
  .git-untracked .letter {
    color: var(--ame-git-untracked);
  }

  .git-deleted .name,
  .git-deleted .letter {
    color: var(--ame-git-deleted);
    text-decoration: line-through;
  }

  .git-conflicted .name,
  .git-conflicted .letter {
    color: var(--ame-git-conflict);
  }
</style>
