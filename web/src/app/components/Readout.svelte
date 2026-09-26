<script>
  import { fmt, fmtDip, fmtSigned, fmtRange } from '../lib/format.js';
  import { t } from '../lib/i18n.js';

  // Readings for one key: Down and Up large, below them Balance, friction, key dip.
  // At most one extra line per value: deviation from the target, otherwise change from the comparison run.
  // ref: { m, label } comparison value (the same note in the comparison run)
  let { m, ref = null, targets = null, status = {}, pulse = 0 } = $props();

  // Only light up on new readings, not when switching tabs
  // svelte-ignore state_referenced_locally
  const startPulse = pulse;

  const MAIN = [
    { id: 'd', unit: 'g', format: fmt },
    { id: 'u', unit: 'g', format: fmt },
  ];
  const MORE = [
    { id: 'b', unit: 'g', format: fmt },
    { id: 'f', unit: 'g', format: fmt },
    { id: 'dip', unit: 'mm', format: fmtDip },
  ];

  function note(metric) {
    const value = m?.[metric];
    const range = targets?.[metric];
    const digits = metric === 'dip' ? 2 : 1;
    const unit = metric === 'dip' ? 'mm' : 'g';
    const guide = range?.derived && metric === 'f';
    if (status[metric] === 'high' && range?.max != null) return { warn: true, text: t(guide ? 'overGuide' : 'overBy', { v: fmtSigned(value - range.max, digits).slice(1), unit }) };
    if (status[metric] === 'low' && range?.min != null) return { warn: true, text: t(guide ? 'underGuide' : 'underBy', { v: fmtSigned(range.min - value, digits).slice(1), unit }) };
    if (ref?.m?.[metric] != null && value != null) return { warn: false, text: `${fmtSigned(value - ref.m[metric], digits)} ${ref.label}` };
    return null;
  }

  // Target range under each value: a band on a thin line with a mark for the reading, and the range in words.
  // Friction without own targets shows the guide value, starting at 0.
  function rangeOf(metric) {
    const r = targets?.[metric];
    if (!r || (r.min == null && r.max == null)) return null;
    return metric === 'f' ? { min: r.min ?? 0, max: r.max, guide: !!r.derived } : { min: r.min, max: r.max, guide: false };
  }
  function scale(range, value) {
    const lo = Math.min(range.min ?? value, value);
    const hi = Math.max(range.max ?? value, value);
    const pad = (hi - lo) * 0.35 || 1;
    const pos = (v) => ((v - (lo - pad)) / (hi - lo + 2 * pad)) * 100;
    return { from: pos(range.min ?? lo - pad), to: pos(range.max ?? hi + pad), at: pos(value) };
  }

  const mainNotes = $derived(MAIN.some((v) => note(v.id)));
  const moreNotes = $derived(MORE.some((v) => note(v.id)));
  const mainRanges = $derived(MAIN.some((v) => rangeOf(v.id)));
  const moreRanges = $derived(MORE.some((v) => rangeOf(v.id)));
  const footer = $derived([m?.n ? t('medianOf', { n: m.n }) : null, m?.raw ? t('convertedFrom', { d: fmt(m.raw.d), u: fmt(m.raw.u) }) : null].filter(Boolean).join(' · '));
</script>

{#snippet rangeLine(metric)}
  {@const range = rangeOf(metric)}
  {@const value = m?.[metric]}
  <span class="range">
    {#if range && value != null}
      {@const s = scale(range, value)}
      <span class="track" aria-hidden="true">
        <span class="band {metric}" style="left: {s.from}%; width: {s.to - s.from}%"></span>
        <span class="mark" class:off={status[metric] === 'high' || status[metric] === 'low'} style="left: {s.at}%"></span>
      </span>
      <span class="range-text">{range.guide ? t('guideValue') : t('targetBand')} {fmtRange({ min: metric === 'f' && range.guide ? null : range.min, max: range.max }, metric)}</span>
    {/if}
  </span>
{/snippet}

{#key pulse}
  <section class="values" class:flash={pulse > startPulse}>
    <div class="main">
      {#each MAIN as v (v.id)}
        {@const n = note(v.id)}
        <div class="value big">
          <span class="label"><i class="sw {v.id}"></i>{t(`metric_${v.id}`)}</span>
          <span class="number">{v.format(m?.[v.id])}<small>{v.unit}</small></span>
          {#if mainRanges}{@render rangeLine(v.id)}{/if}
          {#if mainNotes}<span class="note" class:warn={n?.warn}>{n?.text ?? ''}</span>{/if}
        </div>
      {/each}
    </div>
    <div class="more">
      {#each MORE as v (v.id)}
        {@const n = note(v.id)}
        <div class="value">
          <span class="label" title={t(`metric_${v.id}`)}><i class="sw {v.id}"></i>{t(`short_${v.id}`)}</span>
          <span class="number">{v.format(m?.[v.id])}<small>{v.unit}</small></span>
          {#if moreRanges}{@render rangeLine(v.id)}{/if}
          {#if moreNotes}<span class="note" class:warn={n?.warn}>{n?.text ?? ''}</span>{/if}
        </div>
      {/each}
    </div>
    {#if footer}<p class="footer">{footer}</p>{/if}
  </section>
{/key}

<style>
  /* Like a spec sheet: ink rule on top, cells split by hairlines, numbers set in the serif */
  .values {
    border-top: 1px solid var(--rule);
    border-bottom: 1px solid var(--border);
  }
  .flash {
    animation: flash 1.1s ease-out;
  }
  .main,
  .more {
    display: grid;
  }
  .main {
    grid-template-columns: 1fr 1fr;
  }
  .more {
    grid-template-columns: 1fr 1fr 1fr;
    border-top: 1px solid var(--border);
  }
  .value {
    display: grid;
    align-content: start;
    min-width: 0;
    padding: 14px 0 12px 16px;
  }
  .value:first-child {
    padding-left: 0;
  }
  .value + .value {
    border-left: 1px solid var(--border);
  }
  .label {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
    font: 600 11px/1.3 var(--font);
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    white-space: nowrap;
    overflow: hidden;
  }
  .sw {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex: none;
  }
  .sw.d { background: var(--s-down); }
  .sw.u { background: var(--s-up); }
  .sw.b { background: var(--s-balance); }
  .sw.f { background: var(--s-friction); }
  .sw.dip { background: var(--s-dip); }
  .number {
    margin-top: 8px;
    font: var(--w-figure) 28px/1 var(--font);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
    color: var(--text-1);
    white-space: nowrap;
  }
  .big .number {
    font-size: 56px;
    font-weight: var(--w-figure);
    letter-spacing: -0.03em;
  }
  .number small {
    margin-left: 3px;
    font: 400 13px var(--font);
    letter-spacing: 0;
    color: var(--text-3);
  }
  /* Target range: band in the series color, a mark for the reading (amber when outside) */
  .range {
    display: grid;
    gap: 5px;
    min-height: 30px;
    margin-top: 10px;
  }
  .track {
    position: relative;
    height: 8px;
    margin-right: 12px;
    background: linear-gradient(var(--border), var(--border)) 0 50% / 100% 1px no-repeat;
  }
  .band {
    position: absolute;
    top: 1px;
    bottom: 1px;
    opacity: 0.3;
  }
  .band.d { background: var(--s-down); }
  .band.u { background: var(--s-up); }
  .band.b { background: var(--s-balance); }
  .band.f { background: var(--s-friction); }
  .band.dip { background: var(--s-dip); }
  .mark {
    position: absolute;
    top: -2px;
    bottom: -2px;
    width: 2px;
    margin-left: -1px;
    background: var(--text-1);
  }
  .mark.off {
    width: 3px;
    background: var(--warning);
  }
  .range-text {
    font: 12px/1.35 var(--font);
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
  }
  /* Deviation from the target or change against the comparison run. Wraps instead of being cut off */
  .note {
    min-height: 18px;
    margin-top: 6px;
    font: 13px/17px var(--font);
    color: var(--text-2);
  }
  .note.warn {
    font-weight: 600;
    color: var(--warning-ink);
  }
  .footer {
    margin: 0;
    padding: 9px 0 10px;
    border-top: 1px solid var(--border);
    font: 13px/1.4 var(--font);
    color: var(--text-3);
  }
  @keyframes flash {
    0% {
      background: var(--fill-2);
    }
    100% {
      background: transparent;
    }
  }
</style>
