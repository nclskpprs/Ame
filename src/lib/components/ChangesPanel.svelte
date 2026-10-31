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

  const status = $derived(session.git.status);
  const staged = $derived(status?.files.filter((file) => file.staged) ?? []);
  const changes = $derived(status?.files.filter((file) => file.unstaged) ?? []);

  function open(file: GitFile) {
    if (file.unstaged === 'deleted' || (!file.unstaged && file.staged === 'deleted')) return;
    void session.openDiff(file.path);
  }
</script>

{#snippet list(title: string, files: GitFile[])}
  {#if files.length}
    <h3 class="section">{title} <span class="count">{files.length}</span></h3>
    <ul>
      {#each files as file (file.path)}
        {@const mark = fileMark(file)}
        <li>
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
    {#if status.files.length === 0}
      <p class="empty">{t('changes.none')}</p>
    {/if}
    {@render list(t('changes.staged'), staged)}
    {@render list(t('changes.unstaged'), changes)}
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

  .section {
    display: flex;
    gap: var(--ame-space-2);
    margin: var(--ame-space-2) 0 var(--ame-space-1);
    padding: 0 var(--ame-space-3);
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
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

  .file:hover {
    background: var(--ame-bg);
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
