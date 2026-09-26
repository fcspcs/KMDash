<script>
  import KeysChart from '../components/KeysChart.svelte';
  import HintList from '../components/HintList.svelte';
  import Segmented from '../components/Segmented.svelte';
  import RangeSlider from '../components/RangeSlider.svelte';
  import Icon from '../components/Icon.svelte';
  import { noteName } from '../lib/notes.js';
  import { fmt, fmtDip, fmtPct, fmtSigned, fmtTick, formatOf, unitOf } from '../lib/format.js';
  import { evennessAll, REPORT_METRICS } from '../lib/report.js';
  import { targetsLabel } from '../lib/labels.js';
  import { metricValue } from '../lib/targets.js';
  import { t } from '../lib/i18n.js';

  let { app } = $props();

  const inst = $derived(app.instrument);
  const entries = $derived(Object.values(app.analysis.keys));
  const compare = $derived(app.compareRun);
  const before = $derived(app.compareAnalysis ? Object.values(app.compareAnalysis.keys) : []);
  // Readings with the damper or let-off inside the window are skewed and stay out of the weight charts
  const valuesOf = (list, metric, clean = true) => Object.fromEntries(list.filter((e) => !clean || !e.distorted).map((e) => [e.key, e.m[metric]]));
  const flagged = $derived(new Set(entries.filter((e) => e.level === 'warn').map((e) => e.key)));
  const hidden = $derived(entries.filter((e) => e.distorted).length);
  // Key dip only applies to white keys, the band still runs through
  const range = (metric) => (key) => (metric === 'dip' ? metricValue(inst.targets, 'dip', key, inst.numKeys) : (app.targetsAt(key)?.[metric] ?? null));
  const hasTargets = $derived(!!inst.targets);
  const selected = $derived(app.analysis.keys[app.current]);
  const issues = $derived(entries.filter((e) => e.hints.length).sort((a, b) => (a.level === b.level ? a.key - b.key : a.level === 'warn' ? -1 : 1)));

  let weightMetric = $state('b');
  let allIssues = $state(false);
  const ISSUE_LIMIT = 6;
  const shownIssues = $derived(allIssues ? issues : issues.slice(0, ISSUE_LIMIT));
  const WEIGHTS = [
    { id: 'd', color: 'var(--s-down)' },
    { id: 'b', color: 'var(--s-balance)' },
    { id: 'u', color: 'var(--s-up)' },
  ];
  const colorOf = (metric) => WEIGHTS.find((w) => w.id === metric)?.color;
  const COLORS = { d: 'var(--s-down)', u: 'var(--s-up)', b: 'var(--s-balance)', f: 'var(--s-friction)', dip: 'var(--s-dip)' };

  // Evenness: smooth curve per value, each key's distance from it, share near the curve and inside the targets
  const even = $derived(evennessAll(app.analysis, inst.startNote, app.tolerance));
  const evenBefore = $derived(app.compareAnalysis ? evennessAll(app.compareAnalysis, inst.startNote, app.tolerance) : null);
  const curve = (metric) => (app.showTrend ? even[metric].trend : null);
  const trendItem = $derived({ kind: 'trend', label: t('smoothCurve'), off: !app.showTrend, toggle: () => (app.showTrend = !app.showTrend) });
  const scatter = (metric, value) => (value == null ? '·' : `±${formatOf(metric)(value)}\u00A0${unitOf(metric)}`);
  const hasTargetShare = $derived(REPORT_METRICS.some((m) => even[m].inTarget != null || evenBefore?.[m].inTarget != null));

  // Part of the keyboard in all three charts, kept in the app state while switching tabs
  const keyRange = $derived(app.keysZoom ? [Math.max(1, app.keysZoom[0]), Math.min(inst.numKeys, app.keysZoom[1])] : null);
  function setKeyRange(a, b) {
    app.keysZoom = a <= 1 && b >= inst.numKeys ? null : [a, b];
  }
  // Weight series can be hidden from the legend, one always stays
  const shownWeights = $derived(WEIGHTS.filter((w) => !app.hiddenSeries.includes(w.id)));
  function toggleSeries(id) {
    if (app.hiddenSeries.includes(id)) app.hiddenSeries = app.hiddenSeries.filter((x) => x !== id);
    else if (shownWeights.length > 1) app.hiddenSeries = [...app.hiddenSeries, id];
  }

  function open(key) {
    app.select(key);
    app.view = 'measure';
  }
</script>

{#snippet legend(items)}
  <div class="legend">
    {#each items as item}
      {#if item.toggle}
        <button class="toggle" class:off={item.off} aria-pressed={!item.off} aria-label={t('toggleSeries', { name: item.label })} onclick={item.toggle}><i class={item.kind} style={item.color ? `background: ${item.color}` : ''}></i>{item.label}</button>
      {:else}
        <span><i class={item.kind} style={item.color ? `background: ${item.color}` : ''}></i>{item.label}</span>
      {/if}
    {/each}
  </div>
{/snippet}

{#snippet selection(metrics)}
  {#if selected}
    <button class="selection" class:stack={metrics.length > 1} onclick={() => open(app.current)}>
      <b>{noteName(app.current, inst.startNote)}</b>
      {#each metrics as metric}
        {@const dev = even[metric].deviation[app.current]}
        <span class="pick"><span class="pick-label">{t(`short_${metric}`)}</span> <span class="pick-value"><em>{metric === 'dip' ? fmtDip(selected.m.dip) : fmt(selected.m[metric])}</em>{#if dev != null}<small class="dev" title={t('smoothCurve')}>{fmtSigned(dev, metric === 'dip' ? 2 : 1)}</small>{/if}</span></span>
      {/each}
      <Icon name="right" size={16} />
    </button>
  {/if}
{/snippet}

<div class="page">
  <ul class="list flush settings">
    <li>
      <button class="row" onclick={() => (app.sheet = { type: 'profile' })}>
        <span class="grow">{t('targets')}</span><span class="value">{targetsLabel(inst.targets)}</span><Icon name="right" size={16} />
      </button>
    </li>
    {#if inst.runs.length > 1}
      <li>
        <button class="row" onclick={() => (app.sheet = { type: 'compare' })}>
          <span class="grow">{t('compareWith')}</span><span class="value">{compare ? compare.title : t('compareNone')}</span><Icon name="right" size={16} />
        </button>
      </li>
    {/if}
  </ul>

  <section class="summary">
    <div><b>{entries.length}<small> / {inst.numKeys}</small></b><span>{t('measured')}</span></div>
    <div><b class:warn={flagged.size}>{flagged.size}</b><span>{t('warnings')}</span></div>
  </section>

  {#if app.analysis.global.length}
    <section class="wide">
      <h2 class="section-title">{t('keyboardHints')}</h2>
      <HintList hints={app.analysis.global} />
    </section>
  {/if}

  {#if !entries.length}
    <p class="empty wide">{t('overviewEmpty')}</p>
  {:else}
    <section class="keys-range wide">
      <RangeSlider label={t('keyRange')} min={1} max={inst.numKeys} step={1} lo={keyRange?.[0] ?? 1} hi={keyRange?.[1] ?? inst.numKeys} format={(k) => noteName(k, inst.startNote)} onchange={setKeyRange} />
      {#if keyRange}<button class="all-keys" onclick={() => (app.keysZoom = null)}>{t('allKeys')}</button>{/if}
    </section>

    <section class="card wide">
      <h2>{compare ? t(`metric_${weightMetric}`) : t('chartWeights')} <small>(g)</small></h2>
      {#if compare}
        <div class="metric-switch">
          <Segmented label={t('metric')} value={weightMetric} options={WEIGHTS.map((w) => ({ value: w.id, label: t(`short_${w.id}`) }))} onchange={(v) => (weightMetric = v)} />
        </div>
        {@render legend([{ kind: 'line muted', label: compare.title }, { kind: 'line', color: colorOf(weightMetric), label: app.run.title }, ...(hasTargets ? [{ kind: 'band', color: colorOf(weightMetric), label: t('targetBand') }] : []), trendItem])}
      {:else}
        {@render legend([...WEIGHTS.map((w) => ({ kind: 'dot', color: w.color, label: t(`short_${w.id}`), off: !shownWeights.includes(w), toggle: () => toggleSeries(w.id) })), ...(hasTargets ? [{ kind: 'band', color: 'var(--text-3)', label: t('targetBand') }] : []), trendItem])}
      {/if}
      <KeysChart
        label={t('chartWeights')}
        numKeys={inst.numKeys}
        startNote={inst.startNote}
        current={app.current}
        {flagged}
        onselect={(k) => app.select(k)}
        height={200}
        series={compare
          ? [
              { id: 'before', muted: true, values: valuesOf(before, weightMetric) },
              { id: weightMetric, color: colorOf(weightMetric), values: valuesOf(entries, weightMetric) },
            ]
          : shownWeights.map((w) => ({ id: w.id, color: w.color, values: valuesOf(entries, w.id) }))}
        bands={hasTargets
          ? compare
            ? [{ color: colorOf(weightMetric), range: range(weightMetric) }]
            : ['d', 'b'].filter((id) => shownWeights.some((w) => w.id === id)).map((id) => ({ color: colorOf(id), range: range(id) }))
          : []}
        trends={compare ? [{ color: colorOf(weightMetric), curve: curve(weightMetric) }] : shownWeights.map((w) => ({ color: w.color, curve: curve(w.id) }))}
        range={keyRange}
      />
      {@render selection(['d', 'b', 'u'])}
      {#if hidden}<p class="note">{t('hiddenDistorted', { n: hidden })}</p>{/if}
    </section>

    <section class="card">
      <h2>{t('metric_f')} <small>(g)</small></h2>
      {@render legend([...(compare ? [{ kind: 'line muted', label: compare.title }, { kind: 'line', color: 'var(--s-friction)', label: app.run.title }] : []), { kind: 'band', color: 'var(--s-friction)', label: inst.targets?.metrics?.f?.length ? t('targetBand') : t('guideValue') }, trendItem])}
      <KeysChart
        label={t('metric_f')}
        numKeys={inst.numKeys}
        startNote={inst.startNote}
        current={app.current}
        {flagged}
        onselect={(k) => app.select(k)}
        series={[...(compare ? [{ id: 'before', muted: true, values: valuesOf(before, 'f') }] : []), { id: 'f', color: 'var(--s-friction)', values: valuesOf(entries, 'f') }]}
        bands={[{ color: 'var(--s-friction)', range: range('f') }]}
        trends={[{ color: 'var(--s-friction)', curve: curve('f') }]}
        range={keyRange}
      />
      {@render selection(['f'])}
    </section>

    <section class="card">
      <h2>{t('metric_dip')} <small>(mm)</small></h2>
      {@render legend([...(compare ? [{ kind: 'line muted', label: compare.title }, { kind: 'line', color: 'var(--s-dip)', label: app.run.title }] : []), ...(hasTargets ? [{ kind: 'band', color: 'var(--s-dip)', label: t('targetBand') }] : []), trendItem])}
      <KeysChart
        label={t('metric_dip')}
        numKeys={inst.numKeys}
        startNote={inst.startNote}
        current={app.current}
        {flagged}
        onselect={(k) => app.select(k)}
        series={[...(compare ? [{ id: 'before', muted: true, values: valuesOf(before, 'dip', false) }] : []), { id: 'dip', color: 'var(--s-dip)', values: valuesOf(entries, 'dip', false) }]}
        bands={hasTargets ? [{ color: 'var(--s-dip)', range: range('dip') }] : []}
        trends={[{ color: 'var(--s-dip)', curve: curve('dip') }]}
        range={keyRange}
      />
      {@render selection(['dip'])}
    </section>

    <section class="card wide evenness">
      <h2>{t('evenness')}</h2>
      <table>
        <thead>
          <tr>
            <th scope="col"><span class="sr">{t('metric')}</span></th>
            <th scope="col" class="num">{t('ev_scatter')}</th>
            <th scope="col" class="num">{t('ev_near')}</th>
            {#if hasTargetShare}<th scope="col" class="num">{t('ev_inTarget')}</th>{/if}
          </tr>
        </thead>
        <tbody>
          {#each REPORT_METRICS as metric}
            {@const ev = even[metric]}
            {@const was = evenBefore?.[metric]}
            <tr>
              <th scope="row"><span class="name"><i style="background: {COLORS[metric]}"></i><span>{t(`short_${metric}`)}</span></span></th>
              <td class="num">{scatter(metric, ev.rms)}{#if was?.rms != null}<small>{t('ev_before', { v: scatter(metric, was.rms) })}</small>{/if}</td>
              <td class="num">{fmtPct(ev.within)}{#if was?.within != null}<small>{t('ev_before', { v: fmtPct(was.within) })}</small>{/if}</td>
              {#if hasTargetShare}<td class="num">{fmtPct(ev.inTarget)}{#if was?.inTarget != null}<small>{t('ev_before', { v: fmtPct(was.inTarget) })}</small>{/if}</td>{/if}
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="note">{t('ev_noteShort', { g: fmtTick(app.tolerance.g), mm: fmtTick(app.tolerance.mm) })}</p>
    </section>

    {#if issues.length}
      <section class="wide">
        <h2 class="section-title">{t('issues')} · {issues.length}</h2>
        <ul class="list flush issues">
          {#each shownIssues as e (e.key)}
            <li>
              <button class="row" onclick={() => open(e.key)}>
                <span class="issue-key"><b>{noteName(e.key, inst.startNote)}</b><small>{t('key', { n: e.key })}</small></span>
                <span class="grow"><HintList hints={e.hints.slice(0, 1)} compact /></span>
                {#if e.hints.length > 1}<span class="more">+{e.hints.length - 1}</span>{/if}
                <Icon name="right" size={16} />
              </button>
            </li>
          {/each}
          {#if issues.length > shownIssues.length}
            <li><button class="show-all" onclick={() => (allIssues = true)}>{t('showAll', { n: issues.length })}</button></li>
          {/if}
        </ul>
      </section>
    {/if}
  {/if}
</div>

<style>
  .page {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 28px;
    padding: 16px 20px 36px;
  }
  /* Two figures, set large in the serif */
  .summary {
    display: flex;
    gap: 36px;
  }
  .summary div {
    display: grid;
  }
  .summary b {
    font: var(--w-figure) 48px/1 var(--font);
    letter-spacing: -0.01em;
  }
  .summary b.warn {
    color: var(--warning-ink);
  }
  .summary small {
    margin-left: 2px;
    font: var(--w-figure) 20px var(--font);
    color: var(--text-3);
  }
  .summary span {
    margin-top: 6px;
    font: 600 11px/1.3 var(--font);
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .section-title {
    margin: 0 0 10px;
    font: 500 22px/1.2 var(--font);
  }
  /* Charts: serif title over an ink rule, the legend in small type */
  .card {
    padding-top: 12px;
    border-top: 1px solid var(--rule);
  }
  h2 {
    margin: 0 0 6px;
    font: 500 22px/1.2 var(--font);
  }
  h2 small {
    margin-left: 4px;
    font: 400 13px var(--font);
    color: var(--text-3);
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 18px;
    margin: 0 0 8px;
    font: 13px var(--font);
    color: var(--text-2);
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    max-width: 180px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .legend i {
    display: inline-block;
    flex: none;
    margin-right: 7px;
  }
  .legend i.dot,
  .legend i.line {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .legend i.trend {
    width: 14px;
    height: 0;
    border-top: 1.5px dashed var(--text-2);
  }
  .legend i.muted {
    background: var(--text-3);
  }
  .legend i.band {
    width: 14px;
    height: 9px;
    opacity: 0.25;
  }
  .keys-range {
    display: grid;
    gap: 2px;
  }
  .all-keys {
    justify-self: start;
    min-height: 36px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--text-1);
    font: 600 11px var(--font);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  /* Legend entries that switch a series on and off */
  .legend .toggle {
    position: relative;
    display: inline-flex;
    align-items: center;
    padding: 0;
    border: 0;
    background: none;
    color: var(--text-2);
    font: inherit;
  }
  .legend .toggle::after {
    content: '';
    position: absolute;
    inset: -12px -6px;
  }
  .legend .toggle.off {
    color: var(--text-4);
    text-decoration: line-through;
  }
  .legend .toggle.off i {
    opacity: 0.3;
  }
  .metric-switch {
    margin: 2px 0 12px;
  }
  .selection {
    display: flex;
    align-items: baseline;
    gap: 16px;
    width: 100%;
    min-height: 48px;
    margin-top: 6px;
    padding: 12px 0 8px;
    border: 0;
    border-top: 1px solid var(--border);
    background: none;
    color: var(--text-2);
    font: 14px var(--font);
    text-align: left;
    font-variant-numeric: tabular-nums;
  }
  /* Several values: label above, value below, values on one line even when a label wraps */
  .selection.stack {
    align-items: stretch;
  }
  .selection.stack b {
    align-self: flex-start;
  }
  .stack .pick {
    display: grid;
    grid-template-rows: 1fr auto;
  }
  .stack .pick-label {
    align-self: start;
  }
  .selection b {
    min-width: 40px;
    font: 600 17px/1 var(--font);
    color: var(--text-1);
  }
  .selection em {
    font-style: normal;
    font-weight: 600;
    color: var(--text-1);
  }
  .selection :global(svg) {
    align-self: center;
    margin-left: auto;
    color: var(--text-3);
  }
  .selection .dev {
    margin-left: 5px;
    font-size: 12px;
    color: var(--text-3);
  }
  .evenness table {
    width: 100%;
    margin-top: 4px;
    border-collapse: collapse;
    font: 15px var(--font);
    font-variant-numeric: tabular-nums;
  }
  .evenness th,
  .evenness td {
    padding: 9px 0 8px;
    border-bottom: 1px solid var(--border);
    text-align: left;
    vertical-align: baseline;
  }
  .evenness thead th {
    padding-top: 4px;
    font: 600 11px/1.3 var(--font);
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .evenness tbody th {
    font-weight: 400;
    color: var(--text-1);
    hyphens: manual;
  }
  /* Dot and name stay together, a long name wraps next to its dot */
  .evenness .name {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .evenness .name i {
    flex: none;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    transform: translateY(-1px);
  }
  .evenness .num {
    padding-left: 12px;
    text-align: right;
    white-space: nowrap;
  }
  .evenness small {
    display: block;
    margin-top: 2px;
    font-size: 12px;
    color: var(--text-3);
    white-space: normal;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  .note {
    margin: 4px 0 2px;
    font: 13px/1.45 var(--font);
    color: var(--text-3);
  }
  .empty {
    margin: 32px 0;
    text-align: center;
    font: 400 18px/1.45 var(--font);
    color: var(--text-2);
  }
  .issues .row {
    gap: 14px;
  }
  .issue-key {
    display: grid;
    min-width: 52px;
    line-height: 1.1;
  }
  .issue-key b {
    font: 600 17px/1 var(--font);
  }
  .issue-key small {
    margin-top: 3px;
    font: 600 11px var(--font);
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .more {
    font: 13px var(--font);
    color: var(--text-3);
  }
  .show-all {
    width: 100%;
    min-height: 48px;
    border: 0;
    background: none;
    color: var(--text-1);
    font: 600 11px var(--font);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    text-decoration: underline;
    text-underline-offset: 5px;
  }
  /* Desktop: weights across the full width, friction and key dip side by side */
  @media (min-width: 960px) {
    .page {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 36px 40px;
      max-width: 1280px;
      padding: 32px 40px 48px;
    }
    .wide {
      grid-column: 1 / -1;
    }
    .settings {
      align-self: start;
    }
    .summary {
      align-self: start;
      justify-content: flex-end;
      gap: 48px;
    }
  }
  @media (hover: hover) {
    .selection:hover b {
      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-underline-offset: 4px;
    }
  }
</style>
