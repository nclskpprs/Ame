<script lang="ts">
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import {
    applyAppearance,
    resolveRainEffects,
    resolveTheme,
    systemPrefersDark,
    systemPrefersReducedMotion,
    watchSystemPreferences,
  } from '$lib/theme/theme';

  let prefersDark = $state(systemPrefersDark());
  let reducedMotion = $state(systemPrefersReducedMotion());

  $effect(() =>
    watchSystemPreferences(() => {
      prefersDark = systemPrefersDark();
      reducedMotion = systemPrefersReducedMotion();
    }),
  );

  $effect(() => {
    applyAppearance(document.documentElement, {
      theme: resolveTheme(settings.value.theme, prefersDark),
      density: settings.value.density,
      rainEffects: resolveRainEffects(settings.value.rainEffects, reducedMotion),
    });
  });
</script>

<div class="shell">
  <Sidebar />
  <main class="main">
    <EmptyState />
  </main>
</div>

<style>
  .shell {
    display: grid;
    grid-template-columns: var(--ame-sidebar-width) 1fr;
    height: 100%;
  }

  .main {
    display: grid;
    place-items: center;
    min-width: 0;
    background: var(--ame-bg);
  }
</style>
