<script>
  let { options, value, onchange, label } = $props();
  const index = $derived(Math.max(0, options.findIndex((o) => o.value === value)));
</script>

<div class="segmented" role="radiogroup" aria-label={label} style="--count: {options.length}; --index: {index}">
  <span class="thumb"></span>
  {#each options as option (option.value)}
    <button role="radio" aria-checked={option.value === value} onclick={() => onchange(option.value)}>{option.label}</button>
  {/each}
</div>

<style>
  /* Choices on a hairline, the chosen one in ink with a line under it */
  .segmented {
    position: relative;
    display: grid;
    grid-template-columns: repeat(var(--count), minmax(0, 1fr));
    border-bottom: 1px solid var(--border);
  }
  .thumb {
    position: absolute;
    bottom: -1px;
    left: 0;
    width: calc(100% / var(--count));
    height: 2px;
    background: var(--text-1);
    transform: translateX(calc(100% * var(--index)));
    transition: transform 0.3s cubic-bezier(0.3, 0.9, 0.3, 1);
  }
  button {
    position: relative;
    min-height: 44px;
    min-width: 0;
    overflow: hidden;
    border: 0;
    background: none;
    color: var(--text-3);
    font: 500 15px/1.15 var(--font);
    padding: 4px 4px;
    transition: color 0.2s;
  }
  button[aria-checked='true'] {
    color: var(--text-1);
    font-weight: 600;
  }
  @media (hover: hover) {
    button[aria-checked='false']:hover {
      color: var(--text-1);
    }
  }
</style>
