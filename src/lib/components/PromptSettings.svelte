<script lang="ts">
  import { PLACEHOLDERS, cleanUpBranchesPrompt, newPromptId } from '$lib/agents/prompts';
  import { t } from '$lib/i18n';
  import type { LibraryPrompt_Serialize as LibraryPrompt } from '$lib/ipc/bindings';
  import { settings } from '$lib/stores/settings.svelte';

  /** The user's prompt library; built-in prompts are shown read-only. */
  interface Draft {
    /** Empty for a new prompt. */
    id: string;
    name: string;
    text: string;
  }

  let draft = $state<Draft | null>(null);
  let invalid = $state(false);
  let deleting = $state<string | null>(null);
  const prompts = $derived(settings.value.prompts);

  function edit(prompt: LibraryPrompt) {
    invalid = false;
    deleting = null;
    draft = { id: prompt.id, name: prompt.name, text: prompt.text };
  }

  function add() {
    invalid = false;
    draft = { id: '', name: '', text: '' };
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!draft) return;
    const name = draft.name.trim();
    const text = draft.text.trim();
    if (!name || !text) {
      invalid = true;
      return;
    }
    const id = draft.id || newPromptId(prompts.map((p) => p.id));
    const saved = { id, name, text };
    const exists = prompts.some((p) => p.id === id);
    draft = null;
    await settings.update({
      prompts: exists ? prompts.map((p) => (p.id === id ? saved : p)) : [...prompts, saved],
    });
  }

  async function remove(id: string) {
    deleting = null;
    if (draft?.id === id) draft = null;
    await settings.update({ prompts: prompts.filter((p) => p.id !== id) });
  }

  /** Cancel takes the focus, so pressing Enter twice never deletes. */
  function focusNow(node: HTMLElement) {
    node.focus();
  }

  function preview(text: string): string {
    return text.split('\n')[0] ?? '';
  }
</script>

{#snippet form(current: Draft)}
  <form class="form" onsubmit={save}>
    <label>
      <span>{t('settings.prompts.name')}</span>
      <input bind:value={current.name} autocomplete="off" />
    </label>
    <label class="text-field">
      <span>{t('settings.prompts.text')}</span>
      <textarea
        bind:value={current.text}
        rows="6"
        placeholder={t('settings.prompts.textHint')}
        spellcheck="false"></textarea>
    </label>
    <p class="hint">
      {t('settings.prompts.placeholders', { placeholders: PLACEHOLDERS.join(' ') })}
    </p>
    {#if invalid}
      <p class="invalid" role="alert">{t('settings.prompts.invalid')}</p>
    {/if}
    <div class="actions">
      <button class="btn primary" type="submit">{t('settings.prompts.save')}</button>
      <button class="btn" type="button" onclick={() => (draft = null)}
        >{t('settings.prompts.cancel')}</button
      >
    </div>
  </form>
{/snippet}

<ul class="prompts">
  <li>
    <div class="row">
      <div class="text">
        <span class="name">
          {t('prompts.cleanUpBranches')}
          <span class="badge">{t('prompts.builtIn')}</span>
        </span>
        <span class="detail" title={cleanUpBranchesPrompt(null)}
          >{preview(cleanUpBranchesPrompt(null))}</span
        >
      </div>
    </div>
  </li>
  {#each prompts as prompt (prompt.id)}
    <li>
      <div class="row">
        <div class="text">
          <span class="name">{prompt.name}</span>
          <span class="detail" title={prompt.text}>{preview(prompt.text)}</span>
        </div>
        <div class="buttons">
          {#if deleting === prompt.id}
            <button class="btn danger" onclick={() => void remove(prompt.id)}>
              {t('settings.prompts.confirmDelete')}
            </button>
            <button class="btn" use:focusNow onclick={() => (deleting = null)}
              >{t('settings.prompts.cancel')}</button
            >
          {:else}
            <button class="btn" onclick={() => edit(prompt)}>{t('settings.prompts.edit')}</button>
            <button class="btn" onclick={() => (deleting = prompt.id)}
              >{t('settings.prompts.delete')}</button
            >
          {/if}
        </div>
      </div>
      {#if draft && draft.id === prompt.id}
        {@render form(draft)}
      {/if}
    </li>
  {/each}
</ul>

{#if draft && draft.id === ''}
  {@render form(draft)}
{:else}
  <button class="btn add" onclick={add}>{t('settings.prompts.add')}</button>
{/if}

<style>
  .prompts {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ame-space-2) var(--ame-space-4);
    padding: var(--ame-space-2) 0;
    border-bottom: 1px solid var(--ame-border);
  }

  .text {
    display: flex;
    flex: 1 1 240px;
    flex-direction: column;
    min-width: 0;
  }

  .name {
    display: flex;
    align-items: center;
    gap: var(--ame-space-2);
  }

  .badge {
    padding: 0 var(--ame-space-1);
    border: 1px solid var(--ame-border);
    border-radius: var(--ame-radius);
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
  }

  .detail {
    overflow: hidden;
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .buttons,
  .actions {
    display: flex;
    flex: none;
    gap: var(--ame-space-2);
  }

  .add {
    margin-top: var(--ame-space-3);
  }

  .form {
    display: grid;
    gap: var(--ame-space-2);
    padding: var(--ame-space-3) 0;
    border-bottom: 1px solid var(--ame-border);
  }

  label {
    display: grid;
    grid-template-columns: minmax(120px, 160px) 1fr;
    align-items: center;
    gap: var(--ame-space-3);
    color: var(--ame-text-muted);
  }

  .text-field {
    align-items: start;
  }

  input,
  textarea {
    min-width: 0;
    padding: var(--ame-space-1) var(--ame-space-2);
    border: 1px solid var(--ame-border);
    border-radius: var(--ame-radius);
    background: var(--ame-bg);
    color: var(--ame-text);
    font: inherit;
    user-select: text;
  }

  textarea {
    font-family: var(--ame-font-code);
    font-size: var(--ame-font-size-small);
    resize: vertical;
  }

  .hint {
    margin: 0;
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
  }

  .invalid {
    margin: 0;
    color: var(--ame-text);
  }

  .invalid::before {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: var(--ame-space-2);
    border-radius: 50%;
    background: var(--ame-error);
    content: '';
  }
</style>
