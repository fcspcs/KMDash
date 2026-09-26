<script>
  import { niceTicks, niceCeil, fmt, fmtTick } from '../lib/format.js';
  import { downstroke, curveFeatures } from '../lib/analysis.js';
  import { t } from '../lib/i18n.js';
  import { shiftRange } from '../lib/targets.js';

  // ghost: { label, m } grey comparison curve (previous key or the same note in the comparison run)
  // offset: correction from the calibration. The curve shows raw KMD values, so the target band is converted back to raw.
  // zoom: { x: [from, to], y: [from, to] } chosen axis ranges, otherwise automatic. view: the axes currently shown.
  let { m, ghost = null, targets = null, offset = null, showGhost = true, showWindow = true, full = false, zoom = null, view = $bindable(null) } = $props();
  const clipId = `plot-${Math.random().toString(36).slice(2, 9)}`;
  const bandD = $derived(shiftRange(targets?.d, Number(offset?.d) || 0));
  const bandU = $derived(shiftRange(targets?.u, Number(offset?.u) || 0));

  // Drawn at the real width, so text keeps its size on a wide screen; taller when there is room
  let measured = $state(0);
  const WIDTH = $derived(Math.max(280, Math.round(measured) || 360));
  const HEIGHT = $derived(Math.round(Math.min(440, Math.max(230, WIDTH * 0.56))));
  const PAD = { l: 38, r: 10, t: 14, b: 30 };
  const plotW = $derived(WIDTH - PAD.l - PAD.r);
  const plotH = $derived(HEIGHT - PAD.t - PAD.b);

  const split = (meas) => {
    if (!meas?.x?.length) return { down: [], up: [] };
    const down = downstroke(meas);
    const up = meas.x.slice(down.length - 1).map((x, i) => ({ x, y: meas.y[down.length - 1 + i] }));
    return { down, up };
  };

  const cur = $derived(split(m));
  const old = $derived(split(ghost?.m));
  const feat = $derived(m ? curveFeatures(m) : null);
  const hasCurve = $derived(cur.down.length > 0);

  const xMax = $derived(Math.max(10, Math.ceil(Math.max(0, ...(m?.x ?? []), ...(showGhost ? (ghost?.m.x ?? []) : [])) + 0.4)));
  // Default: leave out the force peak at key bottom; full: up to the stop weight
  const yMax = $derived.by(() => {
    const curves = [m, showGhost ? ghost?.m : null].filter((c) => c?.x?.length);
    if (!curves.length) return 100;
    const peak = full
      ? Math.max(...curves.flatMap((c) => c.y))
      : Math.max(...curves.flatMap((c) => c.y.filter((_, i) => c.x[i] < Math.max(...c.x) - 1.2)), bandD?.max ?? 0);
    return niceCeil(peak * 1.08, 5);
  });

  const x0 = $derived(zoom?.x?.[0] ?? 0);
  const x1 = $derived(zoom?.x?.[1] ?? xMax);
  const y0 = $derived(zoom?.y?.[0] ?? 0);
  const y1 = $derived(zoom?.y?.[1] ?? yMax);
  $effect(() => {
    view = { x: [x0, x1], y: [y0, y1] };
  });

  const sx = (v) => PAD.l + ((v - x0) / (x1 - x0)) * plotW;
  // Values far outside are pulled in a little, the clip path cuts them at the plot edge
  const sy = (v) => PAD.t + plotH - ((Math.max(y0 - (y1 - y0) * 0.2, Math.min(v, y1 + (y1 - y0) * 0.2)) - y0) / (y1 - y0)) * plotH;
  const path = (points) => points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join('');

  let probe = $state(null);
  let svg;

  function nearest(points, x) {
    let best = null;
    for (const p of points) if (!best || Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
    return best;
  }

  function onPointer(event) {
    if (!hasCurve) return;
    const box = svg.getBoundingClientRect();
    const x = x0 + ((((event.clientX - box.left) / box.width) * WIDTH - PAD.l) / plotW) * (x1 - x0);
    if (x < x0 || x > x1) return (probe = null);
    probe = { x, down: nearest(cur.down, x), up: nearest(cur.up, x) };
  }
</script>

<div class="plot" bind:clientWidth={measured}>
<svg
  bind:this={svg}
  viewBox="0 0 {WIDTH} {HEIGHT}"
  class="chart"
  role="img"
  aria-label={t('curveAria')}
  onpointerdown={onPointer}
  onpointermove={onPointer}
  onpointerleave={() => (probe = null)}
>
  <defs>
    <clipPath id={clipId}><rect x={PAD.l} y={PAD.t - 1} width={plotW} height={plotH + 2} /></clipPath>
  </defs>
  {#each niceTicks(y0, y1, 5) as v}
    <line class="grid" x1={PAD.l} x2={WIDTH - PAD.r} y1={sy(v)} y2={sy(v)} />
    <text class="tick" x={PAD.l - 6} y={sy(v) + 3.5} text-anchor="end">{fmtTick(v)}</text>
  {/each}
  {#each niceTicks(x0, x1, WIDTH > 560 ? 10 : 6) as v}
    <text class="tick" x={sx(v)} y={PAD.t + plotH + 14} text-anchor="middle">{fmtTick(v)}</text>
  {/each}
  <text class="axis" x={PAD.l + plotW / 2} y={HEIGHT - 3} text-anchor="middle">{t('position')}</text>
  <text class="axis" transform="translate(10 {PAD.t + plotH / 2}) rotate(-90)" text-anchor="middle">{t('weight')}</text>

  <g clip-path="url(#{clipId})">
    {#if hasCurve && showWindow}
      <rect class="window" x={sx(m.twLow)} y={PAD.t} width={sx(m.twHigh) - sx(m.twLow)} height={plotH} />
    {/if}
    {#each [['down', bandD], ['up', bandU]] as [cls, range]}
      {#if range && !full}
        <rect class="band {cls}" x={PAD.l} width={plotW} y={sy(range.max ?? range.min + 6)} height={Math.max(0, sy(range.min ?? 0) - sy(range.max ?? range.min + 6))} />
      {/if}
    {/each}

    {#if showGhost && old.down.length}
      <path class="ghost" d={path([...old.down, ...old.up.slice(1)])} />
    {/if}
    {#if hasCurve}
      <path class="down" d={path(cur.down)} />
      <path class="up" d={path(cur.up)} />
      {#if feat?.damperOnset != null}
        <g class="damper">
          <line x1={sx(feat.damperOnset)} x2={sx(feat.damperOnset)} y1={PAD.t} y2={PAD.t + plotH} />
          <text x={sx(feat.damperOnset) + 4} y={PAD.t + 10}>{t('damperAt', { onset: fmt(feat.damperOnset) })}</text>
        </g>
      {/if}
    {/if}

    {#if probe}
      <line class="probe" x1={sx(probe.x)} x2={sx(probe.x)} y1={PAD.t} y2={PAD.t + plotH} />
      {#if probe.down}<circle class="dot down" cx={sx(probe.down.x)} cy={sy(probe.down.y)} r="4.5" />{/if}
      {#if probe.up}<circle class="dot up" cx={sx(probe.up.x)} cy={sy(probe.up.y)} r="4.5" />{/if}
    {/if}
  </g>
  <line class="baseline" x1={PAD.l} x2={WIDTH - PAD.r} y1={PAD.t + plotH} y2={PAD.t + plotH} />
  {#if !hasCurve}
    <text class="axis" x={PAD.l + plotW / 2} y={PAD.t + plotH / 2} text-anchor="middle">{t('noCurve')}</text>
  {/if}
</svg>
</div>

<div class="readout" aria-live="polite">
  {#if probe}
    <span><b>{fmt(probe.x)} mm</b></span>
    <span><i class="sw down"></i>{fmt(probe.down?.y)} g</span>
    <span><i class="sw up"></i>{fmt(probe.up?.y)} g</span>
  {:else}
    <span><i class="sw down"></i>{t('strokeDown')}</span>
    <span><i class="sw up"></i>{t('strokeUp')}</span>
    {#if !full && (bandD || bandU)}<span><i class="sw band"></i>{t('targetBand')}</span>{/if}
    {#if showGhost && old.down.length}<span><i class="sw ghost"></i>{ghost.label}</span>{/if}
  {/if}
</div>

<style>
  .chart {
    display: block;
    width: 100%;
    height: auto;
    touch-action: pan-y;
    user-select: none;
  }
  .grid {
    stroke: var(--grid);
    stroke-width: 1;
  }
  .baseline {
    stroke: var(--rule);
  }
  .tick {
    fill: var(--text-3);
    font: 11px var(--font);
    font-variant-numeric: tabular-nums;
  }
  .axis {
    fill: var(--text-3);
    font: 11px var(--font);
  }
  .window {
    fill: var(--text-1);
    opacity: 0.05;
  }
  .band {
    opacity: 0.1;
  }
  @media (prefers-color-scheme: dark) {
    .band {
      opacity: 0.22;
    }
  }
  .band.down {
    fill: var(--s-down);
  }
  .band.up {
    fill: var(--s-up);
  }
  path {
    fill: none;
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .down {
    stroke: var(--s-down);
  }
  .up {
    stroke: var(--s-up);
  }
  .ghost {
    stroke: var(--text-3);
    stroke-width: 1.5;
    opacity: 0.6;
  }
  .damper line {
    stroke: var(--warning);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  .damper text {
    fill: var(--text-2);
    font: 600 10px var(--font);
  }
  .probe {
    stroke: var(--text-1);
    stroke-width: 1;
    opacity: 0.5;
  }
  .dot {
    stroke: var(--surface);
    stroke-width: 2;
  }
  .dot.down {
    fill: var(--s-down);
  }
  .dot.up {
    fill: var(--s-up);
  }
  .readout {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 18px;
    min-height: 20px;
    padding: 4px 0 0;
    font: 13px/20px var(--font);
    color: var(--text-2);
    font-variant-numeric: tabular-nums;
  }
  .readout b {
    color: var(--text-1);
  }
  .sw {
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-right: 7px;
    border-radius: 50%;
    vertical-align: middle;
  }
  .sw.down {
    background: var(--s-down);
  }
  .sw.up {
    background: var(--s-up);
  }
  .sw.ghost {
    background: var(--text-3);
  }
  .sw.band {
    width: 14px;
    height: 9px;
    border-radius: 0;
    background: linear-gradient(90deg, var(--s-down) 50%, var(--s-up) 50%);
    opacity: 0.3;
  }
</style>
