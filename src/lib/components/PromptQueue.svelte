<script lang="ts">
  import {
    clearPromptQueue,
    moveQueuedPrompt,
    promptPreview,
    queuePrompt,
    removeQueuedPrompt,
  } from '$lib/agents/queue';
  import { t } from '$lib/i18n';
  import type { SessionInfo } from '$lib/ipc/types';
  import type { TerminalGroup } from '$lib/project/terminals.svelte';
  import CraneIcon from './CraneIcon.svelte';

  let { session, group }: { session: SessionInfo; group: TerminalGroup } = $props();

  let text = $state('');
  let input = $state<HTMLTextAreaElement>();

  $effect(() => {
    if (group.composing) input?.focus();
  });

  function close() {
    group.composing = false;
    text = '';
    group.focusPending = true;
  }

  async function submit() {
    if (!text.trim()) return;
    if (await queuePrompt(session, text)) text = '';
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void submit();
    }
  }
</script>

<div class="queue" role="region" aria-label={t('queue.label', { title: session.title })}>
  {#if session.queue.length > 0}
    <div class="head">
      <CraneIcon size={12} />
      <span>{t('queue.waiting', { count: session.queue.length })}</span>
      {#if session.queue.length > 1}
        <button class="text" onclick={() => void clearPromptQueue(session)}>
          {t('queue.clear')}
        </button>
      {/if}
      {#if !group.composing}
        <button class="text" onclick={() => (group.composing = true)}>
          {t('queue.add')}
        </button>
      {/if}
    </div>
    <ol>
      {#each session.queue as prompt, index (prompt.id)}
        <li>
          <span class="text-preview" title={prompt.text}>{promptPreview(prompt.text)}</span>
          <button
            class="icon"
            aria-label={t('queue.moveUp')}
            title={t('queue.moveUp')}
            disabled={index === 0}
            onclick={() => void moveQueuedPrompt(session, prompt.id, -1)}
          >
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path d="M4 10l4-4 4 4" />
            </svg>
          </button>
          <button
            class="icon"
            aria-label={t('queue.moveDown')}
            title={t('queue.moveDown')}
            disabled={index === session.queue.length - 1}
            onclick={() => void moveQueuedPrompt(session, prompt.id, 1)}
          >
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path d="M4 6l4 4 4-4" />
            </svg>
          </button>
          <button
            class="icon"
            aria-label={t('queue.remove')}
            title={t('queue.remove')}
            onclick={() => void removeQueuedPrompt(session, prompt.id)}
          >
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
            </svg>
          </button>
        </li>
      {/each}
    </ol>
  {/if}
  {#if group.composing}
    <div class="composer">
      <textarea
        bind:this={input}
        bind:value={text}
        rows="2"
        aria-label={t('queue.inputLabel', { title: session.title })}
        placeholder={t('queue.placeholder', { title: session.title })}
        {onkeydown}></textarea>
      <div class="actions">
        <span class="hint">{t('queue.hint')}</span>
        <button class="primary" disabled={!text.trim()} onclick={() => void submit()}>
          {t('queue.submit')}
        </button>
        <button onclick={close}>{t('queue.done')}</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .queue {
    display: flex;
    flex-direction: column;
    flex: none;
    gap: var(--ame-space-1);
    padding: var(--ame-space-1) var(--ame-space-3);
    background: var(--ame-surface);
    border-bottom: 1px solid var(--ame-border);
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--ame-space-2);
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
  }

  .head span {
    flex: 1;
  }

  ol {
    max-height: 7.5em;
    margin: 0;
    padding: 0 0 0 var(--ame-space-4);
    overflow-y: auto;
  }

  li {
    padding: 1px 0;
    color: var(--ame-text-muted);
  }

  li > * {
    vertical-align: middle;
  }

  .text-preview {
    display: inline-block;
    max-width: calc(100% - 72px);
    overflow: hidden;
    color: var(--ame-text);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon {
    display: inline-grid;
    place-items: center;
    padding: 2px;
    border: 0;
    border-radius: var(--ame-radius);
    background: transparent;
    color: var(--ame-text-muted);
  }

  .icon:hover:not(:disabled) {
    background: var(--ame-bg);
    color: var(--ame-text);
  }

  .icon:disabled {
    opacity: 0.3;
  }

  svg path {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .composer {
    display: flex;
    flex-direction: column;
    gap: var(--ame-space-1);
  }

  textarea {
    width: 100%;
    padding: var(--ame-space-1) var(--ame-space-2);
    border: 1px solid var(--ame-border);
    border-radius: var(--ame-radius);
    background: var(--ame-bg);
    color: var(--ame-text);
    font: inherit;
    resize: vertical;
  }

  textarea:focus-visible {
    border-color: var(--ame-accent);
    outline: none;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--ame-space-2);
  }

  .hint {
    flex: 1;
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
  }

  .actions button,
  .text {
    padding: 2px var(--ame-space-3);
    border: 1px solid var(--ame-border);
    border-radius: var(--ame-radius);
    background: var(--ame-bg);
    color: var(--ame-text);
    font: inherit;
  }

  .text {
    padding: 0 var(--ame-space-2);
    font-size: var(--ame-font-size-small);
  }

  button.primary {
    border-color: var(--ame-accent);
  }
</style>
