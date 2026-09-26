<script>
  import { noteName } from '../lib/notes.js';

  // Key selection by note name (native picker wheel on iPhone)
  let { value = $bindable(1), numKeys, startNote, min = 1, max = numKeys, label, onchange } = $props();
  const keys = $derived(Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i));
</script>

<select class="input picker" aria-label={label} bind:value onchange={() => onchange?.(value)}>
  {#each keys as k (k)}<option value={k}>{noteName(k, startNote)} · {k}</option>{/each}
</select>

<style>
  /* Arrow and frame come from the shared select.input style in App.svelte */
  .picker {
    font-variant-numeric: tabular-nums;
  }
</style>
