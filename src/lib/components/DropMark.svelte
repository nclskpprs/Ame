<script lang="ts">
  // The Ame mark: a rain drop that is also a text cursor. Decorative only.
  let { size = 48 }: { size?: number } = $props();
</script>

<svg
  class="drop"
  width={size}
  height={size}
  viewBox="0 0 48 48"
  aria-hidden="true"
  focusable="false"
>
  <path
    class="outline"
    d="M24 5C24 5 11 20.5 11 29a13 13 0 0 0 26 0C37 20.5 24 5 24 5Z"
    fill="none"
    stroke-width="2.5"
    stroke-linejoin="round"
  />
  <rect class="cursor" x="22.75" y="22" width="2.5" height="14" rx="1.25" />
</svg>

<style>
  .outline {
    stroke: var(--ame-accent);
  }

  .cursor {
    fill: var(--ame-accent);
  }
</style>
