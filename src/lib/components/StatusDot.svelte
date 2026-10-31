<script lang="ts">
  import type { AgentState } from '$lib/ipc/bindings';
  import { t } from '$lib/i18n';
  import { stateLabels } from '$lib/agents/state';

  /**
   * A status indicator in the rain style (docs/DESIGN.md): falling drops while
   * working, a resting amber drop when input is needed, one ripple when done.
   * Drops are pseudo-elements animated with transforms only.
   */
  let { state, label }: { state: AgentState; label?: string } = $props();
</script>

<span class="dot {state}" role="img" aria-label={label ?? t(stateLabels[state])}></span>

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

  .error {
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
  :global(:root[data-rain='off']) .working::after {
    display: none;
  }
</style>
