<script>
  import { t } from '../lib/i18n.js';

  // A range with two handles on a hairline, the chosen part in ink. Used to zoom the charts.
  let { label, min, max, step = 1, lo, hi, format = (v) => String(v), onchange } = $props();

  const pct = (v) => ((v - min) / (max - min || 1)) * 100;
  const snap = (v) => Math.round(Number(v) / step) * step;

  // The handles cannot cross: the input is set back to the clamped value
  function setLo(input) {
    const v = Math.max(min, Math.min(snap(input.value), hi - step));
    input.value = String(v);
    onchange?.(v, hi);
  }
  function setHi(input) {
    const v = Math.min(max, Math.max(snap(input.value), lo + step));
    input.value = String(v);
    onchange?.(lo, v);
  }
</script>

<div class="range-slider">
  <div class="head">
    <span class="label">{label}</span>
    <span class="value">{format(lo)} {t('to')} {format(hi)}</span>
  </div>
  <div class="track" style="--a: {pct(lo)}; --b: {pct(hi)}">
    <span class="line outside-lo" aria-hidden="true"></span>
    <span class="line inside" aria-hidden="true"></span>
    <span class="line outside-hi" aria-hidden="true"></span>
    <input type="range" {min} {max} {step} value={lo} aria-label="{label}, {format(lo)}" oninput={(e) => setLo(e.currentTarget)} />
    <input type="range" {min} {max} {step} value={hi} aria-label="{label}, {format(hi)}" oninput={(e) => setHi(e.currentTarget)} />
  </div>
</div>

<style>
  .range-slider {
    display: grid;
    gap: 2px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font: 13px/1.3 var(--font);
    color: var(--text-2);
    font-variant-numeric: tabular-nums;
  }
  .label {
    font: 600 11px/1.3 var(--font);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .value {
    color: var(--text-1);
  }
  .track {
    position: relative;
    height: 36px;
  }
  /* The lines end at the rim of the handles: hairline outside the chosen part, ink between the handles.
     Handle centres sit at r + (100% - 2r) * value, r = 11px (22px handle). */
  .line {
    position: absolute;
    top: 50%;
    height: 1px;
    background: var(--border);
    pointer-events: none;
  }
  .outside-lo {
    left: 0;
    width: calc((100% - 22px) * var(--a) / 100);
  }
  .inside {
    left: calc(22px + (100% - 22px) * var(--a) / 100);
    width: max(0px, calc((100% - 22px) * (var(--b) - var(--a)) / 100 - 22px));
    height: 2px;
    margin-top: -0.5px;
    background: var(--text-1);
  }
  .outside-hi {
    left: calc(22px + (100% - 22px) * var(--b) / 100);
    right: 0;
  }
  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 36px;
    margin: 0;
    background: none;
    pointer-events: none;
    -webkit-appearance: none;
    appearance: none;
  }
  input::-webkit-slider-runnable-track {
    height: 36px;
    background: none;
  }
  input::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 22px;
    height: 22px;
    margin-top: 7px;
    border: 2px solid var(--text-1);
    border-radius: 50%;
    background: transparent;
    pointer-events: auto;
    cursor: grab;
  }
  input::-moz-range-track {
    background: none;
  }
  input::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border: 2px solid var(--text-1);
    border-radius: 50%;
    background: transparent;
    pointer-events: auto;
    cursor: grab;
  }
  input:focus-visible {
    outline: none;
  }
  :global(.keyboard) input:focus-visible::-webkit-slider-thumb {
    outline: 2px solid var(--text-1);
    outline-offset: 2px;
  }
  :global(.keyboard) input:focus-visible::-moz-range-thumb {
    outline: 2px solid var(--text-1);
    outline-offset: 2px;
  }
</style>
