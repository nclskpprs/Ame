<script lang="ts">
  import { PLACEHOLDERS } from '$lib/agents/prompts';
  import { boardTemplates, newId } from '$lib/board/templates';
  import { t } from '$lib/i18n';
  import type { PackageTemplate } from '$lib/ipc/types';
  import { settings } from '$lib/stores/settings.svelte';

  /**
   * Templates for board packages. Without own templates the built-in "Task"
   * template is listed; editing it saves it as an own template.
   */
  let draft = $state<PackageTemplate | null>(null);
  /** Id of the template in the form; `''` for a new one. */
  let editingId = $state<string | null>(null);
  let invalid = $state(false);
  let deleting = $state<string | null>(null);
  const templates = $derived(boardTemplates(settings.value.templates));

  function edit(template: PackageTemplate) {
    invalid = false;
    deleting = null;
    editingId = template.id;
    draft = { ...template, fields: template.fields.map((field) => ({ ...field })) };
  }

  function add() {
    invalid = false;
    editingId = '';
    draft = {
      id: '',
      name: '',
      fields: [{ id: 'field-1', label: '', multiline: true }],
      prompt: '{title}\n\n',
    };
  }

  function cancel() {
    draft = null;
    editingId = null;
  }

  function addField() {
    if (!draft) return;
    const id = newId(
      'field',
      draft.fields.map((field) => field.id),
    );
    draft.fields.push({ id, label: '', multiline: false });
  }

  function removeField(index: number) {
    draft?.fields.splice(index, 1);
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!draft) return;
    const name = draft.name.trim();
    const fields = draft.fields
      .map((field) => ({ ...field, label: field.label.trim() }))
      .filter((field) => field.label);
    if (!name || !draft.prompt.trim()) {
      invalid = true;
      return;
    }
    const id =
      draft.id ||
      newId(
        'template',
        templates.map((template) => template.id),
      );
    const saved: PackageTemplate = { id, name, fields, prompt: draft.prompt.trim() };
    const exists = templates.some((template) => template.id === id);
    cancel();
    await settings.update({
      templates: exists
        ? templates.map((template) => (template.id === id ? saved : template))
        : [...templates, saved],
    });
  }

  async function remove(id: string) {
    deleting = null;
    if (editingId === id) cancel();
    await settings.update({ templates: templates.filter((template) => template.id !== id) });
  }

  function placeholders(template: PackageTemplate): string {
    return [
      '{title}',
      ...template.fields.filter((field) => field.label.trim()).map((f) => `{${f.label.trim()}}`),
      ...PLACEHOLDERS,
    ].join(' ');
  }

  /** Cancel takes the focus, so pressing Enter twice never deletes. */
  function focusNow(node: HTMLElement) {
    node.focus();
  }
</script>

{#snippet form(current: PackageTemplate)}
  <form class="form" onsubmit={save}>
    <label>
      <span>{t('settings.templates.name')}</span>
      <input bind:value={current.name} autocomplete="off" />
    </label>
    <fieldset class="fields">
      <legend>{t('settings.templates.fields')}</legend>
      {#each current.fields as field, index (field.id)}
        <div class="field-row">
          <input
            bind:value={field.label}
            aria-label={t('settings.templates.fieldLabel')}
            placeholder={t('settings.templates.fieldLabel')}
            autocomplete="off"
          />
          <label class="check">
            <input type="checkbox" bind:checked={field.multiline} />
            <span>{t('settings.templates.multiline')}</span>
          </label>
          <button class="btn" type="button" onclick={() => removeField(index)}>
            {t('settings.templates.removeField')}
          </button>
        </div>
      {/each}
      <button type="button" class="btn add-field" onclick={addField}>
        {t('settings.templates.addField')}
      </button>
    </fieldset>
    <label class="text-field">
      <span>{t('settings.templates.prompt')}</span>
      <textarea bind:value={current.prompt} rows="6" spellcheck="false"></textarea>
    </label>
    <p class="hint">
      {t('settings.templates.placeholders', { placeholders: placeholders(current) })}
    </p>
    {#if invalid}
      <p class="invalid" role="alert">{t('settings.templates.invalid')}</p>
    {/if}
    <div class="actions">
      <button class="btn primary" type="submit">{t('settings.templates.save')}</button>
      <button class="btn" type="button" onclick={cancel}>{t('settings.templates.cancel')}</button>
    </div>
  </form>
{/snippet}

<ul class="templates">
  {#each templates as template (template.id)}
    <li>
      <div class="row">
        <div class="text">
          <span class="name">{template.name}</span>
          <span class="detail">
            {[t('board.titleLabel'), ...template.fields.map((field) => field.label)].join(' · ')}
          </span>
        </div>
        <div class="buttons">
          {#if deleting === template.id}
            <button class="btn danger" onclick={() => void remove(template.id)}>
              {t('settings.templates.confirmDelete')}
            </button>
            <button class="btn" use:focusNow onclick={() => (deleting = null)}>
              {t('settings.templates.cancel')}
            </button>
          {:else}
            <button class="btn" onclick={() => edit(template)}
              >{t('settings.templates.edit')}</button
            >
            {#if settings.value.templates.length > 0}
              <button class="btn" onclick={() => (deleting = template.id)}>
                {t('settings.templates.delete')}
              </button>
            {/if}
          {/if}
        </div>
      </div>
      {#if draft && editingId === template.id}
        {@render form(draft)}
      {/if}
    </li>
  {/each}
</ul>

{#if draft && editingId === ''}
  {@render form(draft)}
{:else}
  <button class="btn add" onclick={add}>{t('settings.templates.add')}</button>
{/if}

<style>
  .templates {
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

  .fields {
    display: grid;
    gap: var(--ame-space-2);
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    margin-bottom: var(--ame-space-1);
    padding: 0;
    color: var(--ame-text-muted);
  }

  .field-row {
    display: flex;
    align-items: center;
    gap: var(--ame-space-2);
  }

  .field-row > input {
    flex: 1;
  }

  .check {
    display: flex;
    gap: var(--ame-space-1);
    white-space: nowrap;
  }

  .add-field {
    justify-self: start;
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
