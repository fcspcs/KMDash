<script>
  // Number input with decimal keypad, empty = null. Reads comma and point in both languages,
  // shows the number in the app language once the field is left (German "0.5" becomes "0,5").
  import { untrack } from 'svelte';
  import { lang, t } from '../lib/i18n.js';
  import { parseNumber as parse } from '../lib/format.js';

  // signed: a ± button for fields that take negative values (phone number pads have no minus key on iPhone)
  let { value = $bindable(null), step = 0.1, min, max, label, unit = '', placeholder = '', signed = false, onchange } = $props();
  const show = (v) => (v == null ? '' : lang() === 'de' ? String(v).replace('.', ',') : String(v));
  let text = $state(show(value));
  let field;

  // Follows changes from outside (reset, a correction applied). While typing, the text stays as typed,
  // also halfway values like "-" or "0,".
  $effect(() => {
    const v = value;
    untrack(() => {
      if (field && document.activeElement === field) return;
      if (parse(text) !== v) text = show(v);
    });
  });

  function blur() {
    text = show(value);
  }

  function input(event) {
    text = event.currentTarget.value;
    emit();
  }

  function emit() {
    const parsed = parse(text);
    if (!Number.isNaN(parsed)) {
      value = parsed;
      onchange?.(parsed);
    }
  }

  // Flips the sign of the number. Without a number yet it starts one with "-" and opens the keypad.
  function flip() {
    const n = parse(text);
    if (Number.isFinite(n) && n !== 0) text = show(-n);
    else {
      text = text.trim().startsWith('-') ? '' : '-';
      field.focus();
    }
    emit();
  }
</script>

<label class="number" class:signed>
  <input bind:this={field} class="input" type="text" inputmode="decimal" aria-label={label} {placeholder} value={text} oninput={input} onblur={blur} data-step={step} data-min={min} data-max={max} />
  {#if unit}<span class="unit">{unit}</span>{/if}
  <!-- After the input, so a surrounding label still points at the input. Pointer down keeps the focus (and the keypad) in the field. -->
  {#if signed}<button type="button" class="sign" aria-label={t('changeSign')} onpointerdown={(e) => e.preventDefault()} onclick={flip}>±</button>{/if}
</label>

<style>
  .number {
    position: relative;
    display: block;
    min-width: 0;
  }
  .number input {
    padding-right: 34px;
    font-variant-numeric: tabular-nums;
  }
  .signed input {
    padding-left: 56px;
  }
  .sign {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 44px;
    border: 0;
    border-right: 1px solid var(--border);
    background: none;
    color: var(--text-1);
    font: 500 19px var(--font);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  .sign:active {
    background: var(--fill-1);
  }
  .unit {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    font: 13px var(--font);
    color: var(--text-3);
    pointer-events: none;
  }
</style>
