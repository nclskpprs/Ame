<script lang="ts">
  import { t } from '$lib/i18n';
  import { closeGuard, type CloseRequest } from '$lib/project/close-guard.svelte';
  import { workspace } from '$lib/stores/workspace.svelte';

  let { request }: { request: CloseRequest } = $props();

  /** File names shown in the prompt; longer lists are shortened. */
  const MAX_NAMES = 3;

  let primary: HTMLButtonElement | undefined = $state();
  const files = $derived(closeGuard.unsaved.flatMap((entry) => entry.files));
  const names = $derived(
    files.length > MAX_NAMES
      ? t('closeGuard.moreFiles', {
          files: files
            .slice(0, MAX_NAMES)
            .map((file) => file.name)
            .join(', '),
          count: files.length - MAX_NAMES,
        })
      : files.map((file) => file.name).join(', '),
  );
  const project = $derived(
    request.kind === 'project'
      ? (workspace.projects.find((p) => p.path === request.path)?.name ?? request.path)
      : '',
  );
  const prompt = $derived(
    request.kind === 'app'
      ? t('closeGuard.quitPrompt', { files: names })
      : t('closeGuard.closeProjectPrompt', { files: names, project }),
  );

  $effect(() => primary?.focus());

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    closeGuard.cancel();
  }
</script>

<div class="bar" role="alertdialog" aria-label={prompt} tabindex="-1" {onkeydown}>
  <span>{prompt}</span>
  <button class="primary" bind:this={primary} onclick={() => void closeGuard.saveAndClose()}>
    {request.kind === 'app' ? t('closeGuard.saveAndQuit') : t('closeGuard.saveAndClose')}
  </button>
  <button onclick={() => void closeGuard.discardAndClose()}>
    {request.kind === 'app'
      ? t('closeGuard.quitWithoutSaving')
      : t('closeGuard.closeWithoutSaving')}
  </button>
  <button onclick={() => closeGuard.cancel()}>{t('closeGuard.cancel')}</button>
</div>

<style>
  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--ame-space-2);
    padding: var(--ame-space-2) var(--ame-space-3);
    background: var(--ame-surface);
    border-bottom: 1px solid var(--ame-needs-input);
  }

  .bar span {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
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
</style>
