<script lang="ts">
  import { untrack } from 'svelte';
  import type { AgentState } from '$lib/ipc/bindings';
  import { t } from '$lib/i18n';
  import { stateLabels } from '$lib/agents/state';

  /**
   * A status indicator in the rain style (docs/DESIGN.md): falling drops while
   * working, a resting amber drop when input is needed, one ripple when done.
   * Drops are pseudo-elements animated with transforms only. `intensity`
   * (1–3) makes the rain denser when the agent prints a lot; whenever
   * `prompts` grows, one drop falls into the dot (a prompt was sent).
   */
  let {
    state: agentState,
    label,
    intensity = 1,
    prompts,
  }: { state: AgentState; label?: string; intensity?: number; prompts?: number } = $props();

  let seen = untrack(() => prompts);
  let landing = $state(0);

  $effect(() => {
    if (prompts === undefined) return;
    if (seen !== undefined && prompts > seen) landing += 1;
    seen = prompts;
  });
</script>

<span
  class="dot {agentState} rain-{Math.min(3, Math.max(1, intensity))}"
  role="img"
  aria-label={label ?? t(stateLabels[agentState])}
>
  {#key landing}
    {#if landing > 0}
      <span class="land" aria-hidden="true" onanimationend={() => (landing = 0)}></span>
    {/if}
  {/key}
</span>

<style>
  .dot {
    position: relative;
    display: inline-block;
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ame-text-muted);
  }

  .dot::before,
  .dot::after {
    position: absolute;
    content: '';
    pointer-events: none;
  }

  .starting {
    background: var(--ame-accent);
    opacity: 0.6;
  }

  /* It is raining: the dot is a cloud, two fine drops fall from it. */
  .working {
    background: var(--ame-accent);
  }

  .working::before,
  .working::after {
    top: 2px;
    left: 3px;
    width: 1.5px;
    height: 4px;
    border-radius: 1px;
    background: var(--ame-accent);
    animation: fall 1.1s linear infinite;
  }

  .working::after {
    left: 1px;
    animation-delay: 0.55s;
  }

  /* Light output: a single slow drop. Heavy output: a faster downpour. */
  .working.rain-1::before {
    animation-duration: 1.6s;
  }

  .working.rain-1::after {
    display: none;
  }

  .working.rain-3::before,
  .working.rain-3::after {
    animation-duration: 0.7s;
  }

  .working.rain-3::after {
    animation-delay: 0.35s;
  }

  /* A prompt was sent: one drop falls from above into the dot. */
  .land {
    position: absolute;
    top: -10px;
    left: 2.5px;
    width: 3px;
    height: 4px;
    border-radius: 50% 50% 50% 50% / 30% 30% 70% 70%;
    background: var(--ame-accent);
    pointer-events: none;
    animation: land 0.6s ease-in 1 forwards;
  }

  /* A drop hangs on the window: amber, gently pulsing. */
  .needsInput {
    border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
    background: var(--ame-needs-input);
    animation: hang 2.4s ease-in-out infinite;
  }

  /* A puddle with a ripple: one ring, then still. */
  .idle {
    background: var(--ame-done);
  }

  .idle::before {
    inset: -1px;
    border: 1px solid var(--ame-done);
    border-radius: 50%;
    opacity: 0;
    animation: ripple 1.2s ease-out 1;
  }

  .exited {
    background: var(--ame-text-muted);
  }

  /* A subtle thunderstorm: a red drop, without animation noise. */
  .error {
    border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
    background: var(--ame-error);
  }

  @keyframes fall {
    from {
      opacity: 0.9;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(9px);
    }
  }

  @keyframes land {
    from {
      opacity: 0;
      transform: translateY(0);
    }
    30% {
      opacity: 1;
    }
    to {
      opacity: 0.4;
      transform: translateY(10px);
    }
  }

  @keyframes hang {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(0.8);
    }
  }

  @keyframes ripple {
    from {
      opacity: 0.9;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(2.4);
    }
  }

  /* Rain effects setting; prefers-reduced-motion resolves to "off". */
  :global(:root[data-rain='subtle']) .dot,
  :global(:root[data-rain='subtle']) .dot::before,
  :global(:root[data-rain='subtle']) .dot::after {
    animation-duration: 2.4s;
  }

  :global(:root[data-rain='off']) .dot,
  :global(:root[data-rain='off']) .dot::before,
  :global(:root[data-rain='off']) .dot::after,
  :global(:root[data-window-active='false']) .dot,
  :global(:root[data-window-active='false']) .dot::before,
  :global(:root[data-window-active='false']) .dot::after {
    animation-play-state: paused;
  }

  :global(:root[data-rain='off']) .working::before,
  :global(:root[data-rain='off']) .working::after,
  :global(:root[data-rain='off']) .land,
  :global(:root[data-window-active='false']) .land {
    display: none;
  }
</style>
