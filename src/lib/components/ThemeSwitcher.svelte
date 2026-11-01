<script lang="ts">
  import type { ThemePreference } from '$lib/ipc/bindings';
  import { t } from '$lib/i18n';
  import { settings } from '$lib/stores/settings.svelte';
  import { themeOptions } from '$lib/settings/options';
  import SegmentedControl from './SegmentedControl.svelte';

  let { name = 'theme' }: { name?: string } = $props();
</script>

<SegmentedControl
  {name}
  label={t('settings.theme.label')}
  options={themeOptions()}
  value={settings.value.theme}
  onchange={(theme: ThemePreference) => void settings.update({ theme })}
/>
