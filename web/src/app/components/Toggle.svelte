<script>
  let { checked = $bindable(false), label, onchange } = $props();
</script>

<button class="toggle" role="switch" aria-checked={checked} aria-label={label} onclick={() => { checked = !checked; onchange?.(checked); }}>
  <span class="knob"></span>
</button>

<style>
  /* An outlined track; on, it fills with ink */
  .toggle {
    position: relative;
    flex: none;
    width: 48px;
    height: 28px;
    padding: 0;
    border: 1px solid var(--text-1);
    border-radius: 999px;
    background: transparent;
    transition: background 0.2s;
  }
  .toggle[aria-checked='true'] {
    background: var(--text-1);
  }
  .knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--text-1);
    transition: transform 0.25s cubic-bezier(0.3, 1.2, 0.5, 1), background 0.2s;
  }
  .toggle[aria-checked='true'] .knob {
    background: var(--bg);
    transform: translateX(20px);
  }
</style>
