<script lang="ts">
  import { onMount } from 'svelte';
  import { formatShortcut } from '$lib/commands/shortcuts';
  import { shortcutOf } from '$lib/commands/registry';
  import { formatDuration } from '$lib/agents/duration';
  import { showSession } from '$lib/agents/show';
  import { describeUsage } from '$lib/agents/usage';
  import { usage } from '$lib/agents/usage.svelte';
  import { combinedRain, combinedState, stateLabels } from '$lib/agents/state';
  import { groupCards } from '$lib/agents/dashboard';
  import { basename } from '$lib/fs/paths';
  import { t } from '$lib/i18n';
  import { commands, type AgentState } from '$lib/ipc/bindings';
  import type { SessionInfo } from '$lib/ipc/types';
  import { view } from '$lib/stores/view.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';
  import { sessions } from '$lib/terminal/sessions.svelte';
  import DropMark from './DropMark.svelte';
  import RainSky from './RainSky.svelte';
  import StatusDot from './StatusDot.svelte';
  import UnreadMark from './UnreadMark.svelte';
  import { unread } from '$lib/agents/unread.svelte';
  import { contextMenu } from '$lib/menu/context-menu.svelte';

  /** Last output lines are polled while the dashboard is visible. */
  const PREVIEW_INTERVAL_MS = 1000;
  /** Order of the cards: what needs the user first. */
  const ORDER: AgentState[] = ['needsInput', 'error', 'working', 'starting', 'idle', 'exited'];

  let root: HTMLElement | undefined = $state();
  let previews = $state.raw(new Map<number, string>());
  let now = $state(Date.now());
  const startShortcut = shortcutOf('agents.start');

  const cards = $derived(
    [...sessions.list].sort(
      (a, b) =>
        ORDER.indexOf(a.state) - ORDER.indexOf(b.state) ||
        projectName(a.project).localeCompare(projectName(b.project)) ||
        a.id - b.id,
    ),
  );
  const summary = $derived(
    ORDER.flatMap((state) => {
      const count = sessions.list.filter((s) => s.state === state).length;
      return count ? [t(`dashboard.count.${state}`, { n: count })] : [];
    }).join(' · '),
  );
  const overall = $derived(combinedState(sessions.list));
  const rain = $derived(combinedRain(sessions.list));
  /** Cards per project group (M5b); a single block without groups. */
  const blocks = $derived(groupCards(cards, workspace.projects));

  onMount(() => {
    root?.focus();
    const refresh = async () => {
      const list = await commands.sessionPreviews();
      previews = new Map(list.map((preview) => [preview.id, preview.lastLine]));
      now = Date.now();
    };
    void refresh();
    const timer = setInterval(() => void refresh(), PREVIEW_INTERVAL_MS);
    return () => clearInterval(timer);
  });

  function projectName(path: string): string {
    return workspace.projects.find((p) => p.path === path)?.name ?? basename(path);
  }

  function open(session: SessionInfo) {
    showSession(session.project, session.id);
  }

  function showMenu(event: MouseEvent, session: SessionInfo) {
    const isUnread = unread.has(session.id);
    contextMenu.show(event, session.title, [
      {
        kind: 'action',
        label: t(isUnread ? 'unread.markRead' : 'unread.markUnread'),
        run: () => (isUnread ? unread.markRead(session.id) : unread.markUnread(session.id)),
      },
    ]);
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    view.close();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  class="dashboard"
  aria-labelledby="dashboard-title"
  tabindex="-1"
  bind:this={root}
  {onkeydown}
>
  <header class="header">
    <RainSky />
    <div class="heading">
      {#if overall}<StatusDot state={overall} intensity={rain.intensity} />{/if}
      <h1 id="dashboard-title">{t('dashboard.title')}</h1>
      <span class="summary">{summary}</span>
    </div>
    <button
      class="icon-btn close"
      aria-label={t('dashboard.close')}
      title={t('dashboard.close')}
      onclick={() => view.close()}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" stroke-width="1.5" />
      </svg>
    </button>
  </header>

  <div class="content">
    {#if cards.length === 0}
      <div class="empty">
        <DropMark size={48} />
        <p>{t('dashboard.empty')}</p>
        {#if startShortcut}
          <p class="hint">
            {t('dashboard.emptyHint', { shortcut: formatShortcut(startShortcut) })}
          </p>
        {/if}
      </div>
    {:else}
      {#each blocks as block (block.group)}
        {#if blocks.length > 1 || block.group !== null}
          {@const blockState = combinedState(block.sessions)}
          <h2 class="group">
            {#if blockState}<StatusDot state={blockState} />{/if}
            {block.group ?? t('groups.ungrouped')}
          </h2>
        {/if}
        <ul class="grid">
          {#each block.sessions as session (session.id)}
            <li>
              <button
                class="card"
                class:waiting={session.state === 'needsInput'}
                class:unread={unread.has(session.id)}
                onclick={() => open(session)}
                oncontextmenu={(event) => showMenu(event, session)}
              >
                <span class="top">
                  <StatusDot
                    state={session.state}
                    intensity={session.intensity}
                    prompts={session.prompts}
                  />
                  <span class="title">{session.title}</span>
                  {#if unread.has(session.id)}<UnreadMark />{/if}
                  <span class="project">{projectName(session.project)}</span>
                </span>
                <span class="state">
                  {session.attention ?? t(stateLabels[session.state])}
                  · {formatDuration(now - (session.startedAt ?? now))}
                  {#if session.queue.length > 0}
                    · {t('queue.count', { count: session.queue.length })}
                  {/if}
                  {#if usage.forSession(session.id)}
                    · {describeUsage(usage.forSession(session.id) ?? { cpu: 0, memory: 0 })}
                  {/if}
                </span>
                <span class="line">{previews.get(session.id) || ' '}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/each}
    {/if}
  </div>
</section>

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    outline: none;
  }

  .header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ame-space-3);
    padding: var(--ame-space-3) var(--ame-space-6);
    border-bottom: 1px solid var(--ame-border);
  }

  .heading,
  .close {
    position: relative;
  }

  .heading {
    display: flex;
    align-items: center;
    gap: var(--ame-space-3);
    min-width: 0;
  }

  h1 {
    margin: 0;
    font-size: var(--ame-font-size-title);
    font-weight: 600;
  }

  .summary {
    overflow: hidden;
    color: var(--ame-text-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--ame-space-4) var(--ame-space-6) var(--ame-space-6);
  }

  .group {
    display: flex;
    align-items: center;
    gap: var(--ame-space-2);
    margin: var(--ame-space-4) 0 var(--ame-space-2);
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .group:first-child {
    margin-top: 0;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--ame-space-3);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: var(--ame-space-1);
    width: 100%;
    min-width: 0;
    padding: var(--ame-space-3);
    border: 1px solid var(--ame-border);
    border-radius: var(--ame-radius);
    background: var(--ame-surface);
    color: var(--ame-text);
    font: inherit;
    text-align: left;
  }

  .card:hover {
    border-color: var(--ame-text-muted);
  }

  .card.waiting {
    border-color: var(--ame-needs-input);
  }

  .top {
    display: flex;
    align-items: center;
    gap: var(--ame-space-2);
    min-width: 0;
  }

  .title {
    font-weight: 600;
    white-space: nowrap;
  }

  .project {
    overflow: hidden;
    color: var(--ame-text-muted);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .state {
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
  }

  .line {
    overflow: hidden;
    color: var(--ame-text-muted);
    font-family: var(--ame-font-code);
    font-size: var(--ame-font-size-small);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty {
    display: grid;
    justify-items: center;
    gap: var(--ame-space-2);
    margin-top: 10vh;
    color: var(--ame-text-muted);
    text-align: center;
  }

  .empty p {
    margin: 0;
  }

  .hint {
    font-size: var(--ame-font-size-small);
  }
</style>
