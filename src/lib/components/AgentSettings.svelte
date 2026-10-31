<script lang="ts">
  import { SHELL_PROFILE, agents } from '$lib/agents/agents.svelte';
  import { joinArgs, profileId, splitArgs } from '$lib/agents/args';
  import { t } from '$lib/i18n';
  import type { AgentInfo } from '$lib/ipc/types';
  import { settings } from '$lib/stores/settings.svelte';

  type Profile = AgentInfo['profile'];

  interface Draft {
    /** Empty for a new profile; the id is derived from the name on save. */
    id: string;
    name: string;
    command: string;
    args: string;
    resumeArgs: string;
  }

  let draft = $state<Draft | null>(null);
  let invalid = $state(false);
  const custom = $derived(settings.value.agents);

  $effect(() => {
    void agents.load();
  });

  function edit(profile: Profile) {
    invalid = false;
    draft = {
      id: profile.id,
      name: profile.name,
      command: profile.command,
      args: joinArgs(profile.args),
      resumeArgs: joinArgs(profile.resumeArgs),
    };
  }

  function add() {
    invalid = false;
    draft = { id: '', name: '', command: '', args: '', resumeArgs: '' };
  }

  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!draft) return;
    const name = draft.name.trim();
    const command = draft.command.trim();
    const isShell = draft.id === SHELL_PROFILE;
    if (!name || (!command && !isShell)) {
      invalid = true;
      return;
    }
    const id =
      draft.id ||
      profileId(
        name,
        agents.list.map((agent) => agent.profile.id),
      );
    const previous = agents.find(id)?.profile;
    const profile: Profile = {
      id,
      name,
      command: isShell ? '' : command,
      args: splitArgs(draft.args),
      env: previous?.env ?? {},
      resumeArgs: splitArgs(draft.resumeArgs),
    };
    draft = null;
    await settings.update({ agents: [...custom.filter((p) => p.id !== id), profile] });
    await agents.load();
  }

  async function reset(id: string) {
    if (draft?.id === id) draft = null;
    await settings.update({ agents: custom.filter((p) => p.id !== id) });
    await agents.load();
  }
</script>

{#snippet form(current: Draft)}
  <form class="form" onsubmit={save}>
    <label>
      <span>{t('settings.agents.name')}</span>
      <input bind:value={current.name} autocomplete="off" spellcheck="false" />
    </label>
    <label>
      <span>{t('settings.agents.command')}</span>
      <input
        bind:value={current.command}
        disabled={current.id === SHELL_PROFILE}
        placeholder={current.id === SHELL_PROFILE
          ? t('settings.agents.shellCommand')
          : t('settings.agents.commandHint')}
        autocomplete="off"
        spellcheck="false"
      />
    </label>
    <label>
      <span>{t('settings.agents.args')}</span>
      <input bind:value={current.args} autocomplete="off" spellcheck="false" />
    </label>
    <label>
      <span>{t('settings.agents.resumeArgs')}</span>
      <input
        bind:value={current.resumeArgs}
        placeholder={t('settings.agents.resumeHint')}
        autocomplete="off"
        spellcheck="false"
      />
    </label>
    {#if invalid}
      <p class="invalid" role="alert">{t('settings.agents.invalid')}</p>
    {/if}
    <div class="actions">
      <button class="primary" type="submit">{t('settings.agents.save')}</button>
      <button type="button" onclick={() => (draft = null)}>{t('settings.agents.cancel')}</button>
    </div>
  </form>
{/snippet}

<ul class="agents">
  {#each agents.list as agent (agent.profile.id)}
    {@const changed = custom.some((p) => p.id === agent.profile.id)}
    <li>
      <div class="row">
        <div class="text">
          <span class="name">
            {agent.profile.name}
            {#if changed}
              <span class="badge">
                {agent.builtin ? t('settings.agents.changed') : t('settings.agents.custom')}
              </span>
            {/if}
          </span>
          <span class="detail" class:missing={!agent.path}>
            {agent.path ?? t('agents.notInstalled')}
          </span>
        </div>
        <div class="buttons">
          <button onclick={() => edit(agent.profile)}>
            {changed ? t('settings.agents.edit') : t('settings.agents.customize')}
          </button>
          {#if changed}
            <button onclick={() => void reset(agent.profile.id)}>
              {agent.builtin ? t('settings.agents.reset') : t('settings.agents.remove')}
            </button>
          {/if}
        </div>
      </div>
      {#if draft && draft.id === agent.profile.id}
        {@render form(draft)}
      {/if}
    </li>
  {/each}
</ul>

{#if draft && draft.id === ''}
  {@render form(draft)}
{:else}
  <button class="add" onclick={add}>{t('settings.agents.add')}</button>
{/if}

<style>
  .agents {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--ame-space-2) var(--ame-space-4);
    padding: var(--ame-space-2) 0;
    border-bottom: 1px solid var(--ame-border);
  }

  .text {
    display: flex;
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
    font-family: var(--ame-font-code);
    font-size: var(--ame-font-size-small);
    text-overflow: ellipsis;
    white-space: nowrap;
    user-select: text;
  }

  .detail.missing {
    font-family: inherit;
  }

  .buttons,
  .actions {
    display: flex;
    gap: var(--ame-space-2);
  }

  button {
    padding: 2px var(--ame-space-3);
    border: 1px solid var(--ame-border);
    border-radius: var(--ame-radius);
    background: var(--ame-bg);
    color: var(--ame-text);
    font: inherit;
  }

  button.primary {
    border-color: var(--ame-accent);
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

  input {
    min-width: 0;
    padding: var(--ame-space-1) var(--ame-space-2);
    border: 1px solid var(--ame-border);
    border-radius: var(--ame-radius);
    background: var(--ame-bg);
    color: var(--ame-text);
    font-family: var(--ame-font-code);
    font-size: var(--ame-font-size-small);
    user-select: text;
  }

  input:disabled {
    color: var(--ame-text-muted);
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
