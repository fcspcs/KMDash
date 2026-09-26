<script>
  import { niceTicks, fmtTick } from '../lib/format.js';
  import { noteName } from '../lib/notes.js';

  /**
   * series: [{ id, color, values: { [key]: number }, muted }]  muted = comparison run (grey, thin, no warning rings)
   * bands:  [{ color, range: (key) => ({ min, max }) | null }]  target ranges per key as a stepped area
   * limits: [{ color, value: (key) => number | null }]          limits per key as a stepped line
   * trends: [{ color, curve }]     smooth curve per series (lib/trend.js), dashed, only where there are readings
   * flagged: Set<number>          keys with a warning (ring)
   * One scale per chart: never grams and millimeters together.
   */
  // range: [first key, last key] to show a part of the keyboard, otherwise all keys. The value axis fits what is shown
  // width: fixed drawing width (print), then height is used as given
  let { numKeys, startNote, series, bands = [], limits = [], trends = [], flagged = new Set(), current, onselect, label, height = 170, range = null, width = null } = $props();
  const lo = $derived(Math.max(1, Math.min(numKeys, range?.[0] ?? 1)));
  const hi = $derived(Math.max(lo, Math.min(numKeys, range?.[1] ?? numKeys)));
  const span = $derived(hi - lo + 1);
  const inRange = (k) => k >= lo && k <= hi;

  // Drawn at the real width, so text keeps its size on a wide screen; taller when there is room
  let measured = $state(0);
  const WIDTH = $derived(width ?? Math.max(280, Math.round(measured) || 360));
  const H = $derived(width ? height : Math.max(height, Math.min(320, Math.round(WIDTH * 0.3))));
  const PAD = { l: 34, r: 8, t: 10, b: 22 };
  const plotW = $derived(WIDTH - PAD.l - PAD.r);
  const plotH = $derived(H - PAD.t - PAD.b);

  const domain = $derived.by(() => {
    const values = series.flatMap((s) => Object.entries(s.values).filter(([k]) => inRange(Number(k))).map(([, v]) => v)).filter((v) => v != null && Number.isFinite(v));
    for (let key = lo; key <= hi; key++) {
      for (const b of bands) {
        const r = b.range(key);
        if (r?.min != null) values.push(r.min);
        if (r?.max != null) values.push(r.max);
      }
      for (const l of limits) {
        const v = l.value(key);
        if (v != null) values.push(v);
      }
    }
    if (!values.length) return [0, 1];
    const vMin = Math.min(...values);
    const vMax = Math.max(...values);
    const pad = Math.max((vMax - vMin) * 0.12, 0.5);
    const ticks = niceTicks(vMin - pad, vMax + pad, H > 220 ? 6 : 5);
    return [Math.min(ticks[0], vMin - pad), Math.max(ticks.at(-1), vMax + pad)];
  });

  const sx = (key) => PAD.l + ((key - lo + 0.5) / span) * plotW;
  const sy = (v) => PAD.t + plotH - ((v - domain[0]) / (domain[1] - domain[0])) * plotH;

  // Lines only between directly adjacent measured keys, so gaps stay visible
  function segments(values) {
    const out = [];
    let run = [];
    for (let key = lo; key <= hi; key++) {
      if (values[key] == null || !Number.isFinite(values[key])) {
        if (run.length > 1) out.push(run);
        run = [];
      } else run.push(key);
    }
    if (run.length > 1) out.push(run);
    return out.map((keys) => keys.map((k, i) => `${i ? 'L' : 'M'}${sx(k).toFixed(1)} ${sy(values[k]).toFixed(1)}`).join(''));
  }

  const edge = (key) => PAD.l + ((key - lo) / span) * plotW;

  // Open sides (only min or only max) run to the edge of the chart
  function bandPath(range) {
    const parts = [];
    let top = [];
    let bottom = [];
    const flush = () => {
      if (top.length) parts.push(`M${[...top, ...bottom.reverse()].join('L')}Z`);
      top = [];
      bottom = [];
    };
    for (let key = lo; key <= hi; key++) {
      const r = range(key);
      if (!r || (r.min == null && r.max == null)) {
        flush();
        continue;
      }
      const yTop = sy(r.max ?? domain[1]).toFixed(1);
      const yBottom = sy(r.min ?? domain[0]).toFixed(1);
      top.push(`${edge(key).toFixed(1)},${yTop}`, `${edge(key + 1).toFixed(1)},${yTop}`);
      bottom.push(`${edge(key).toFixed(1)},${yBottom}`, `${edge(key + 1).toFixed(1)},${yBottom}`);
    }
    flush();
    return parts.join('');
  }

  function stepPath(value) {
    let d = '';
    let open = false;
    for (let key = lo; key <= hi; key++) {
      const v = value(key);
      if (v == null) {
        open = false;
        continue;
      }
      d += `${open ? 'L' : 'M'}${edge(key).toFixed(1)} ${sy(v).toFixed(1)}L${edge(key + 1).toFixed(1)} ${sy(v).toFixed(1)}`;
      open = true;
    }
    return d;
  }

  function trendPath(curve) {
    const from = Math.max(lo, curve.lo);
    const to = Math.min(hi, curve.hi);
    if (to <= from) return '';
    const steps = Math.max(2, Math.round((to - from) * 2));
    return Array.from({ length: steps + 1 }, (_, i) => from + ((to - from) * i) / steps)
      .map((k, i) => `${i ? 'L' : 'M'}${sx(k).toFixed(1)} ${sy(curve.at(k)).toFixed(1)}`)
      .join('');
  }

  // Labels: every C, on a short range every key, and at least the first and last key
  const cKeys = $derived.by(() => {
    const keys = Array.from({ length: span }, (_, i) => lo + i);
    if (span <= 13) return keys;
    const cs = keys.filter((k) => /^C\d/.test(noteName(k, startNote)));
    return cs.length >= 2 ? cs : [lo, hi];
  });
  const points = (s) => Object.entries(s.values).map(([k, v]) => [Number(k), v]).filter(([k, v]) => inRange(k) && v != null && Number.isFinite(v));

  let svg;
  function pick(event) {
    if (!onselect) return;
    const box = svg.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * WIDTH;
    onselect(Math.min(hi, Math.max(lo, lo + Math.floor(((px - PAD.l) / plotW) * span))));
  }
</script>

<!-- Tapping picks the nearest key. Keyboard users get there via the piano keyboard and the arrow keys -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div bind:clientWidth={measured}>
<svg bind:this={svg} viewBox="0 0 {WIDTH} {H}" role="img" aria-label={label} onclick={pick}>
  {#each niceTicks(domain[0], domain[1], H > 220 ? 6 : 5) as v}
    <line class="grid" x1={PAD.l} x2={WIDTH - PAD.r} y1={sy(v)} y2={sy(v)} />
    <text class="tick" x={PAD.l - 5} y={sy(v) + 3.5} text-anchor="end">{fmtTick(v)}</text>
  {/each}
  {#each cKeys as k}
    <text class="tick" x={sx(k)} y={H - 6} text-anchor="middle">{noteName(k, startNote)}</text>
  {/each}
  {#each bands as b}
    <path class="band" d={bandPath(b.range)} style="fill: {b.color}" />
  {/each}
  {#each limits as l}
    <path class="limit" d={stepPath(l.value)} style="stroke: {l.color}" />
  {/each}
  {#if current && inRange(current)}<line class="cursor" x1={sx(current)} x2={sx(current)} y1={PAD.t} y2={PAD.t + plotH} />{/if}
  {#each series.filter((s) => s.muted) as s (s.id)}
    {#each segments(s.values) as d}<path class="line muted" {d} />{/each}
    {#each points(s) as [k, v] (k)}<circle class="dot muted" cx={sx(k)} cy={sy(v)} r="2.5" />{/each}
  {/each}
  {#each series.filter((s) => !s.muted) as s (s.id)}
    {#each segments(s.values) as d}
      <path class="line" {d} style="stroke: {s.color}" />
    {/each}
    {#each points(s) as [k, v] (k)}
      {#if flagged.has(k)}<circle class="flag" cx={sx(k)} cy={sy(v)} r="6" />{/if}
      <circle class="dot" cx={sx(k)} cy={sy(v)} r={k === current ? 5 : 3} style="fill: {s.color}" />
    {/each}
  {/each}
  <!-- Smooth curves on top of the dots, dashed so the readings stay visible -->
  {#each trends.filter((tr) => tr.curve) as tr}
    <path class="trend" d={trendPath(tr.curve)} style="stroke: {tr.color}" />
  {/each}
</svg>
</div>

<style>
  svg {
    display: block;
    width: 100%;
    height: auto;
    touch-action: pan-y;
    user-select: none;
    -webkit-user-select: none;
  }
  .grid {
    stroke: var(--grid);
  }
  .tick {
    fill: var(--text-3);
    font: 11px var(--font);
    font-variant-numeric: tabular-nums;
  }
  .band {
    stroke: none;
    opacity: 0.12;
  }
  @media (prefers-color-scheme: dark) {
    .band {
      opacity: 0.24;
    }
  }
  .limit {
    fill: none;
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  .trend {
    fill: none;
    stroke-width: 1.5;
    stroke-dasharray: 6 4;
    stroke-linecap: round;
  }
  .cursor {
    stroke: var(--text-1);
    stroke-width: 1;
    opacity: 0.45;
  }
  .line {
    fill: none;
    stroke-width: 1.5;
    stroke-linejoin: round;
    opacity: 0.55;
  }
  .line.muted {
    stroke: var(--text-3);
    stroke-width: 1.25;
    opacity: 0.6;
  }
  .dot {
    stroke: var(--surface);
    stroke-width: 1.5;
  }
  .dot.muted {
    fill: var(--text-3);
    stroke-width: 1;
    opacity: 0.8;
  }
  .flag {
    fill: none;
    stroke: var(--warning);
    stroke-width: 2;
  }
</style>
