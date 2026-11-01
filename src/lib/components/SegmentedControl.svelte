<script lang="ts" generics="T extends string">
  let {
    name,
    label,
    options,
    value,
    onchange,
  }: {
    /** Name of the radio group; unique per page. */
    name: string;
    /** Accessible name of the group (translated). */
    label: string;
    options: readonly { value: T; label: string }[];
    value: T;
    onchange: (value: T) => void;
  } = $props();
</script>

<fieldset class="segmented" style:--count={options.length}>
  <legend class="visually-hidden">{label}</legend>
  {#each options as option (option.value)}
    <label class:selected={value === option.value}>
      <input
        type="radio"
        {name}
        value={option.value}
        checked={value === option.value}
        onchange={() => onchange(option.value)}
      />
      {option.label}
    </label>
  {/each}
</fieldset>

<style>
  .segmented {
    display: grid;
    grid-template-columns: repeat(var(--count), 1fr);
    gap: 2px;
    min-width: 0;
    margin: 0;
    padding: 2px;
    border: 1px solid var(--ame-border);
    border-radius: var(--ame-radius);
  }

  label {
    position: relative;
    padding: var(--ame-space-1) var(--ame-space-2);
    border-radius: calc(var(--ame-radius) - 2px);
    color: var(--ame-text-muted);
    font-size: var(--ame-font-size-small);
    text-align: center;
    white-space: nowrap;
    transition:
      background var(--ame-transition),
      color var(--ame-transition);
  }

  label:hover {
    color: var(--ame-text);
  }

  label.selected {
    background: var(--ame-bg);
    color: var(--ame-text);
  }

  label:has(input:focus-visible) {
    outline: 2px solid var(--ame-accent);
    outline-offset: 1px;
  }

  input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
