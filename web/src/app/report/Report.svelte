<script>
  // Printable report of a piano: the runs you chose, each with charts, averages by section, hints and a table,
  // and the changes from one run to the next. Mounted outside the app and shown only in print (A4, always light).
  import KeysChart from '../components/KeysChart.svelte';
  import { noteName } from '../lib/notes.js';
  import { fmt, fmtSigned, fmtDate, fmtPct, fmtTick, formatOf, unitOf, niceCeil, niceTicks } from '../lib/format.js';
  import { targetsLabel } from '../lib/labels.js';
  import { metricValue } from '../lib/targets.js';
  import { downstroke } from '../lib/analysis.js';
  import { hintTitle, hintDetail, hintName } from '../lib/hints.js';
  import { summarize, changes, pairs, evennessAll, findings, REPORT_METRICS } from '../lib/report.js';
  import { t, lang } from '../lib/i18n.js';

  let { app, runs, parts } = $props();

  // 182 mm: an A4 page minus the margins. Charts are drawn at this width, so their text prints at its real size
  const WIDTH = 688;
  const HALF = 332;
  const COLOR = { d: 'var(--s-down)', u: 'var(--s-up)', b: 'var(--s-balance)', f: 'var(--s-friction)', dip: 'var(--s-dip)' };
  const WEIGHTS = ['d', 'b', 'u'];

  const inst = $derived(app.instrument);
  const note = (key) => noteName(key, inst.startNote);
  const items = $derived(
    runs.map((run) => {
      const analysis = app.analyze(run);
      const entries = Object.values(analysis.keys).sort((a, b) => a.key - b.key);
      const even = evennessAll(analysis, inst.startNote, app.tolerance);
      return { run, analysis, entries, even, summary: summarize(analysis, inst.numKeys), flagged: new Set(entries.filter((e) => e.level === 'warn').map((e) => e.key)) };
    }),
  );
  const compared = $derived(parts.compare ? pairs(items).map(([a, b]) => ({ a, b, change: changes(a.analysis, b.analysis) })) : []);
  const hasTargets = $derived(!!inst.targets);
  const ownFriction = $derived(!!inst.targets?.metrics?.f?.length);
  const created = fmtDate(Date.now());
  const info = $derived(inst.info ?? {});
  // Findings for the newest run; with several runs the oldest one gives the "before" numbers
  const newest = $derived(items.at(-1));
  const oldest = $derived(items.length > 1 ? items[0] : null);
  const found = $derived(newest ? findings(newest, oldest, { startNote: inst.startNote, tolerance: app.tolerance, upweightMin: app.thresholds.upweightMin }) : []);

  const keyList = (keys) => keys.slice(0, 8).map(note).join(', ') + (keys.length > 8 ? ` +${keys.length - 8}` : '');
  const before = (value) => (value == null ? '' : ` ${t('f_before', { v: fmtPct(value) })}`);
  function findingText(f) {
    const v = f.vars;
    const title = t(`f_${f.id}_${f.ok ? 'ok' : 'no'}`);
    if (f.id === 'even') return { title, detail: t('f_even_detail', { within: fmtPct(v.within), tol: `${fmtTick(app.tolerance.g)} g`, rms: `±${fmt(v.rms)} g`, span: `${fmt(v.span)} g` }) + before(v.before) };
    if (f.id === 'target') return { title, detail: t('f_target_detail', { n: v.n, total: v.total, offset: `${fmtSigned(v.offset)} g` }) + before(v.before) };
    if (f.id === 'friction') {
      const high = v.high.length ? ` ${t('f_friction_high', { keys: keyList(v.high) })}` : '';
      return { title, detail: t('f_friction_detail', { n: v.n, total: v.total, kind: t(ownFriction ? 'f_kindTarget' : 'f_kindGuide'), avg: `${fmt(v.avg)} g` }) + high + before(v.before) };
    }
    if (f.id === 'upweight') {
      return { title, detail: f.ok ? t('f_upweight_detail_ok', { min: fmtTick(v.min), lowest: `${fmt(v.lowest)} g` }) : t('f_upweight_detail_no', { n: v.low.length, min: fmtTick(v.min), keys: keyList(v.low) }) };
    }
    if (f.id === 'dip') {
      if (v.mode === 'even') return { title, detail: t('f_dip_detail_even', { within: fmtPct(v.within), tol: `${fmtTick(app.tolerance.mm)} mm` }) };
      return { title, detail: t('f_dip_detail_target', { n: v.n, total: v.total }) + (v.off.length ? ` ${t('f_dip_detail_off', { keys: keyList(v.off) })}` : '') };
    }
    const parts = [v.pedal ? t(`f_pedal_${v.pedal}`) : '', v.distorted ? t('f_distorted', { n: v.distorted }) : t('f_clean')];
    return { title, detail: parts.filter(Boolean).join(' ') };
  }

  // Measuring conditions of a run: entered by hand, KMD settings when they were read, pedal from the curves
  function conditionsOf(item) {
    const c = item.run.conditions ?? {};
    const out = [];
    if (c.point) out.push(t('rep_measurePoint', { v: c.point }));
    if (c.humidity != null) out.push(t('rep_humidity', { v: fmtTick(c.humidity) }));
    if (c.temperature != null) out.push(t('rep_temperature', { v: fmtTick(c.temperature) }));
    if (item.run.kmd?.stopWeight != null) out.push(t('rep_stopWeight', { v: fmtTick(item.run.kmd.stopWeight) }));
    const pedal = item.analysis.pedal?.state;
    if (pedal) out.push(t(`rep_pedal_${pedal}`));
    return out;
  }

  const scatter = (metric, value) => (value == null ? '·' : `±${formatOf(metric)(value)}`);
  const trendsOf = (even, metrics) => metrics.map((metric) => ({ color: COLOR[metric], curve: even[metric].trend }));

  // Averages over the runs, oldest on the left, evenly spaced
  const HIST = { w: WIDTH, h: 190, l: 34, r: 16, t: 12, b: 40 };
  const history = $derived.by(() => {
    if (items.length < 2) return null;
    const metrics = ['d', 'b', 'u', 'f'];
    const values = items.flatMap((i) => metrics.map((m) => i.summary.avg[m])).filter((v) => v != null);
    if (!values.length) return null;
    const pad = Math.max((Math.max(...values) - Math.min(...values)) * 0.08, 1);
    const ticks = niceTicks(Math.min(...values) - pad, Math.max(...values) + pad, 5);
    const y0 = Math.min(ticks[0], Math.min(...values) - pad);
    const y1 = Math.max(ticks.at(-1), Math.max(...values) + pad);
    const plotW = HIST.w - HIST.l - HIST.r;
    const x = (i) => HIST.l + (items.length === 1 ? plotW / 2 : (plotW * (i + 0.5)) / items.length);
    const y = (v) => HIST.t + (HIST.h - HIST.t - HIST.b) * (1 - (v - y0) / (y1 - y0));
    const series = metrics.map((m) => ({ id: m, points: items.map((it, i) => (it.summary.avg[m] == null ? null : [x(i), y(it.summary.avg[m])])) }));
    return { ticks: ticks.filter((v) => v >= y0 && v <= y1), x, y, series, labels: items.map((it, i) => ({ x: x(i), title: it.run.title, date: fmtDate(it.run.createdAt) })) };
  });

  // Readings with the damper or let-off in the window stay out of the weight charts, like in the app
  const valuesOf = (entries, metric) => Object.fromEntries(entries.filter((e) => metric === 'dip' || !e.distorted).map((e) => [e.key, e.m[metric]]));
  const range = (metric) => (key) => (metric === 'dip' ? metricValue(inst.targets, 'dip', key, inst.numKeys) : (app.targetsAt(key)?.[metric] ?? null));
  const showsBand = (metric) => metric === 'f' || hasTargets;
  const bandLabel = (metric) => (metric === 'f' && !ownFriction ? t('guideValue') : t('targetBand'));
  const off = (e, metric) => e.status[metric] === 'high' || e.status[metric] === 'low';
  const avg = (value, metric) => (value == null ? '·' : formatOf(metric)(value));
  const sectionName = ([from, to]) => `${note(from)} ${t('to')} ${note(to)}`;

  const valueText = $derived(app.valueMode.valueMode === 'median' && app.valueMode.perKey > 1 ? t('rep_valueMedian', { n: app.valueMode.perKey }) : t('rep_valueLast'));
  const scaleText = $derived(app.correctionActive ? t('rep_scaleWeights', { d: fmt(app.correction.d), u: fmt(app.correction.u) }) : t('rep_scaleRaw'));

  // Small force curves: one scale for all keys of a run, without the force peak at key bottom
  function curveScale(entries) {
    let x = 10;
    let y = 60;
    for (const e of entries) {
      const m = e.last;
      if (!m?.x?.length) continue;
      const bottom = Math.max(...m.x);
      x = Math.max(x, bottom);
      m.x.forEach((v, i) => v < bottom - 1.2 && (y = Math.max(y, m.y[i])));
    }
    return { x: Math.ceil(x + 0.2), y: niceCeil(y * 1.05, 4) };
  }
  const MINI = { w: 104, h: 58 };
  function miniPath(points, scale) {
    return points.map((p, i) => `${i ? 'L' : 'M'}${((p.x / scale.x) * MINI.w).toFixed(1)} ${(MINI.h - (p.y / scale.y) * MINI.h).toFixed(1)}`).join('');
  }
  function strokes(m) {
    const down = downstroke(m);
    const up = m.x.slice(down.length - 1).map((x, i) => ({ x, y: m.y[down.length - 1 + i] }));
    return { down, up };
  }
</script>

{#snippet legend(list)}
  <div class="legend">
    {#each list as item}
      <span><i class={item.kind} style={item.color ? `background: ${item.color}` : ''}></i>{item.label}</span>
    {/each}
  </div>
{/snippet}

{#snippet chartHead(title, unit, list)}
  <!-- Rendered as the first child of a figure -->
  <!-- svelte-ignore a11y_figcaption_parent -->
  <figcaption>
    <h3>{title} <small>({unit})</small></h3>
    {@render legend(list)}
  </figcaption>
{/snippet}

<article class="kmd-report" lang={lang()}>
  <header class="cover">
    <p class="kicker">KMDashboard · {t('report')}</p>
    <h1>{inst.name}</h1>
    <dl class="facts">
      <div><dt>{t('rep_keyboard')}</dt><dd>{t('pianoMeta', { n: inst.numKeys, note: note(1) })}</dd></div>
      <div><dt>{t('targets')}</dt><dd>{targetsLabel(inst.targets)}</dd></div>
      <div><dt>{t('rep_values')}</dt><dd>{valueText}</dd></div>
      <div><dt>{t('rep_scale')}</dt><dd>{scaleText}</dd></div>
      <div><dt>{t('rep_created')}</dt><dd>{created}</dd></div>
      {#if info.client}<div><dt>{t('clientName')}</dt><dd>{info.client}</dd></div>{/if}
      {#if info.place}<div><dt>{t('place')}</dt><dd>{info.place}</dd></div>{/if}
      {#if info.serial}<div><dt>{t('serialNumber')}</dt><dd>{info.serial}</dd></div>{/if}
      {#if info.technician}<div><dt>{t('technician')}</dt><dd>{info.technician}</dd></div>{/if}
    </dl>
  </header>

  {#if found.length}
    <section class="block findings">
      <h2 class="section-title">{t('findings')}</h2>
      <p class="meta">{oldest ? t('findingsFor', { run: newest.run.title, before: oldest.run.title }) : newest.run.title}</p>
      <ul>
        {#each found as f (f.id)}
          {@const text = findingText(f)}
          <li class:check={!f.ok}>
            <span class="state">{f.ok ? t('f_ok') : t('f_check')}</span>
            <span><b>{text.title}.</b> {text.detail}</span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="block">
    <h2 class="section-title">{t('runs')}</h2>
    <table class="runs">
      <thead>
        <tr>
          <th>{t('rep_run')}</th>
          <th>{t('rep_date')}</th>
          <th class="num">{t('rep_keys')}</th>
          {#each REPORT_METRICS as metric}<th class="num">Ø {t(`col_${metric}`)}</th>{/each}
          <th class="num">{t('warnings')}</th>
        </tr>
      </thead>
      <tbody>
        {#each items as { run, summary } (run.id)}
          <tr>
            <td class="run-title">{run.title}{#if run.notes}<small>{run.notes}</small>{/if}</td>
            <td class="date">{fmtDate(run.createdAt)}</td>
            <td class="num">{summary.measured}<small> / {inst.numKeys}</small></td>
            {#each REPORT_METRICS as metric}<td class="num">{avg(summary.avg[metric], metric)}</td>{/each}
            <td class="num" class:warn-count={summary.warnings}>{summary.warnings}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="note">{t('rep_avgNote')}</p>

    {#if history}
      <figure class="chart">
        {@render chartHead(t('history'), 'g', ['d', 'b', 'u', 'f'].map((metric) => ({ kind: 'dot', color: COLOR[metric], label: t(`short_${metric}`) })))}
        <svg class="history" viewBox="0 0 {HIST.w} {HIST.h}" role="img" aria-label={t('history')}>
          {#each history.ticks as v}
            <line class="grid" x1={HIST.l} x2={HIST.w - HIST.r} y1={history.y(v)} y2={history.y(v)} />
            <text class="tick" x={HIST.l - 5} y={history.y(v) + 3.5} text-anchor="end">{fmtTick(v)}</text>
          {/each}
          {#each history.series as s (s.id)}
            <path class="hist-line" d={s.points.filter(Boolean).map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('')} style="stroke: {COLOR[s.id]}" />
            {#each s.points.filter(Boolean) as p}<circle cx={p[0]} cy={p[1]} r="3.5" style="fill: {COLOR[s.id]}" />{/each}
          {/each}
          {#each history.labels as l}
            <text class="tick" x={l.x} y={HIST.h - 22} text-anchor="middle">{l.date}</text>
            {#if items.length <= 5}<text class="tick strong" x={l.x} y={HIST.h - 8} text-anchor="middle">{l.title}</text>{/if}
          {/each}
        </svg>
      </figure>
      <p class="note">{t('historyNote')}</p>
    {/if}
  </section>

  <!-- The first part after the cover continues on page one, every further part starts a new page -->
  {#each compared as { a, b, change }, i (a.run.id + b.run.id)}
    <section class="block" class:page={i > 0}>
      <p class="kicker">{t('rep_compare')}</p>
      <h2>{a.run.title} → {b.run.title}</h2>
      <p class="meta">{fmtDate(a.run.createdAt)} → {fmtDate(b.run.createdAt)} · {t('rep_commonKeys', { n: change.rows.length })}</p>
      {#if !change.rows.length}
        <p class="note">{t('rep_noCommon')}</p>
      {:else}
        <div class="grid">
          {#each REPORT_METRICS as metric}
            <figure class="chart">
              {@render chartHead(t(`metric_${metric}`), unitOf(metric), [
                { kind: 'dot muted', label: a.run.title },
                { kind: 'dot', color: COLOR[metric], label: b.run.title },
                ...(showsBand(metric) ? [{ kind: 'band', color: COLOR[metric], label: bandLabel(metric) }] : []),
                { kind: 'trend', label: t('smoothCurve') },
              ])}
              <KeysChart
                label={t(`metric_${metric}`)}
                numKeys={inst.numKeys}
                startNote={inst.startNote}
                width={HALF}
                height={150}
                series={[
                  { id: 'before', muted: true, values: valuesOf(a.entries, metric) },
                  { id: metric, color: COLOR[metric], values: valuesOf(b.entries, metric) },
                ]}
                bands={showsBand(metric) ? [{ color: COLOR[metric], range: range(metric) }] : []}
                trends={trendsOf(b.even, [metric])}
              />
            </figure>
          {/each}
        </div>

        <h3>{t('rep_evenChange')}</h3>
        <table class="even">
          <thead>
            <tr>
              <th></th>
              <th class="num">{t('ev_scatter')}</th>
              <th class="num">{t('ev_near')}</th>
              <th class="num">{t('ev_inTarget')}</th>
            </tr>
          </thead>
          <tbody>
            {#each REPORT_METRICS as metric}
              {@const x = a.even[metric]}
              {@const y = b.even[metric]}
              <tr>
                <td>{t(`metric_${metric}`)}</td>
                <td class="num">{scatter(metric, x.rms)} → {scatter(metric, y.rms)} {unitOf(metric)}</td>
                <td class="num">{fmtPct(x.within)} → {fmtPct(y.within)}</td>
                <td class="num">{fmtPct(x.inTarget)} → {fmtPct(y.inTarget)}</td>
              </tr>
            {/each}
          </tbody>
        </table>

        <table class="keys changes">
          <thead>
            <tr>
              <th class="num">#</th>
              <th>{t('noteShort')}</th>
              {#each REPORT_METRICS as metric}<th class="num">Δ {t(`col_${metric}`)}</th>{/each}
            </tr>
          </thead>
          <tbody>
            <tr class="mean">
              <td></td>
              <td>{t('rep_mean')}</td>
              {#each REPORT_METRICS as metric}<td class="num">{change.avg[metric] == null ? '·' : fmtSigned(change.avg[metric], metric === 'dip' ? 2 : 1)}</td>{/each}
            </tr>
            {#each change.rows as row (row.key)}
              <tr>
                <td class="num nr">{row.key}</td>
                <td class="key">{note(row.key)}</td>
                {#each REPORT_METRICS as metric}
                  {@const v = row.delta[metric]}
                  <td class="num" class:strong={Math.abs(v) >= (metric === 'dip' ? 0.1 : 1)} class:skewed={metric === 'dip' ? !row.dipOk : row.skewed}>{fmtSigned(v, metric === 'dip' ? 2 : 1)}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
        <p class="note">{t('rep_changeNote', { from: a.run.title, to: b.run.title })}</p>
      {/if}
    </section>
  {/each}

  {#each items as { run, analysis, entries, summary, flagged, even }, i (run.id)}
    {@const conditions = conditionsOf(items[i])}
    <section class="block" class:page={i > 0 || compared.length > 0}>
      <p class="kicker">{t('rep_runOf', { n: i + 1, total: items.length })}</p>
      <h2>{run.title}</h2>
      <p class="meta">
        {fmtDate(run.createdAt)} · {t('measuredOf', { n: summary.measured, total: inst.numKeys })} · {t('rep_warnCount', { n: summary.warnings })}{#if summary.window} · {t('rep_window', { low: fmt(summary.window.low), high: fmt(summary.window.high) })}{/if}
      </p>
      {#if conditions.length}<p class="meta">{conditions.join(' · ')}</p>{/if}
      {#if run.notes}<p class="notes">{run.notes}</p>{/if}

      {#if !entries.length}
        <p class="note">{t('overviewEmpty')}</p>
      {:else}
        {#if parts.charts}
          <figure class="chart">
            {@render chartHead(t('chartWeights'), 'g', [
              ...WEIGHTS.map((metric) => ({ kind: 'dot', color: COLOR[metric], label: t(`short_${metric}`) })),
              ...(hasTargets ? [{ kind: 'band', color: 'var(--text-3)', label: t('targetBand') }] : []),
              { kind: 'trend', label: t('smoothCurve') },
              ...(flagged.size ? [{ kind: 'ring', label: t('rep_warning') }] : []),
            ])}
            <KeysChart
              label={t('chartWeights')}
              numKeys={inst.numKeys}
              startNote={inst.startNote}
              width={WIDTH}
              height={220}
              {flagged}
              series={WEIGHTS.map((metric) => ({ id: metric, color: COLOR[metric], values: valuesOf(entries, metric) }))}
              bands={hasTargets ? ['d', 'b'].map((metric) => ({ color: COLOR[metric], range: range(metric) })) : []}
              trends={trendsOf(even, WEIGHTS)}
            />
          </figure>
          <div class="grid">
            {#each ['f', 'dip'] as metric}
              <figure class="chart">
                {@render chartHead(t(`metric_${metric}`), unitOf(metric), [...(showsBand(metric) ? [{ kind: 'band', color: COLOR[metric], label: bandLabel(metric) }] : []), { kind: 'trend', label: t('smoothCurve') }])}
                <KeysChart
                  label={t(`metric_${metric}`)}
                  numKeys={inst.numKeys}
                  startNote={inst.startNote}
                  width={HALF}
                  height={150}
                  {flagged}
                  series={[{ id: metric, color: COLOR[metric], values: valuesOf(entries, metric) }]}
                  bands={showsBand(metric) ? [{ color: COLOR[metric], range: range(metric) }] : []}
                  trends={trendsOf(even, [metric])}
                />
              </figure>
            {/each}
          </div>
          {#if summary.distorted}<p class="note">{t('hiddenDistorted', { n: summary.distorted })}</p>{/if}

          <h3>{t('evenness')}</h3>
          <table class="even">
            <thead>
              <tr>
                <th></th>
                <th class="num">{t('rep_keys')}</th>
                <th class="num">{t('ev_span')}</th>
                <th class="num">{t('ev_scatter')}</th>
                <th class="num">{t('ev_near')}</th>
                <th class="num">{t('ev_inTarget')}</th>
              </tr>
            </thead>
            <tbody>
              {#each REPORT_METRICS as metric}
                {@const ev = even[metric]}
                <tr>
                  <td>{t(`metric_${metric}`)}</td>
                  <td class="num">{ev.n}</td>
                  <td class="num">{ev.span == null ? '·' : `${formatOf(metric)(ev.span)} ${unitOf(metric)}`}<small> {formatOf(metric)(ev.min)} {t('to')} {formatOf(metric)(ev.max)}</small></td>
                  <td class="num">{scatter(metric, ev.rms)} {unitOf(metric)}</td>
                  <td class="num">{fmtPct(ev.within)}</td>
                  <td class="num">{fmtPct(ev.inTarget)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
          <p class="note">{t('ev_note', { g: fmtTick(app.tolerance.g), mm: fmtTick(app.tolerance.mm) })}</p>

          <h3>{t('rep_sections')}</h3>
          <table class="sections">
            <thead>
              <tr>
                <th>{t('rep_section')}</th>
                <th class="num">{t('rep_keys')}</th>
                {#each REPORT_METRICS as metric}<th class="num">Ø {t(`col_${metric}`)}</th>{/each}
              </tr>
            </thead>
            <tbody>
              {#each summary.sections as section}
                <tr>
                  <td>{sectionName([section.from, section.to])}<small>{t('keysRange', { from: section.from, to: section.to })}</small></td>
                  <td class="num">{section.n}</td>
                  {#each REPORT_METRICS as metric}<td class="num">{avg(section.avg[metric], metric)}</td>{/each}
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}

        {#if parts.hints}
          {@const keyed = entries.filter((e) => e.hints.length)}
          <h3>{t('hints')}</h3>
          {#if !analysis.global.length && !keyed.length}
            <p class="note">{t('rep_noHints')}</p>
          {/if}
          {#if analysis.global.length}
            <h4>{t('keyboardHints')}</h4>
            <ul class="hints">
              {#each analysis.global as hint}
                <li class={hint.level}><b>{hintTitle(hint)}</b> {hintDetail(hint)}</li>
              {/each}
            </ul>
          {/if}
          {#if keyed.length}
            <h4>{t('rep_keyHints')}</h4>
            <div class="key-hints">
              {#each keyed as e (e.key)}
                <div class="key-hint">
                  <p class="key-label"><b>{note(e.key)}</b> {t('key', { n: e.key })}</p>
                  <ul class="hints">
                    {#each e.hints as hint}
                      <li class={hint.level}><b>{hintTitle(hint)}</b> {hintDetail(hint)}</li>
                    {/each}
                  </ul>
                </div>
              {/each}
            </div>
          {/if}
        {/if}

        {#if parts.table}
          <h3>{t('tab_table')}</h3>
          <table class="keys">
            <thead>
              <tr>
                <th class="num">#</th>
                <th>{t('noteShort')}</th>
                {#each REPORT_METRICS as metric}<th class="num">{t(`col_${metric}`)}</th>{/each}
                <th class="num">{t('col_trend')}</th>
                <th class="hint-col">{t('hints')}</th>
              </tr>
            </thead>
            <tbody>
              {#each entries as e (e.key)}
                <tr class:warn={e.level === 'warn'}>
                  <td class="num nr">{e.key}</td>
                  <td class="key">{note(e.key)}</td>
                  {#each REPORT_METRICS as metric}
                    <td class="num" class:off={off(e, metric)} class:skewed={metric !== 'dip' && e.distorted}>{formatOf(metric)(e.m[metric])}</td>
                  {/each}
                  <td class="num" class:strong={Math.abs(even.b.deviation[e.key] ?? 0) > even.b.tolerance}>{even.b.deviation[e.key] == null ? '' : fmtSigned(even.b.deviation[e.key])}</td>
                  <td class="hint-col">{e.hints.map(hintName).join(', ')}</td>
                </tr>
              {/each}
            </tbody>
          </table>
          <p class="note">{t('rep_tableNote')}</p>
        {/if}

        {#if parts.curves}
          {@const scale = curveScale(entries)}
          <h3>{t('part_curves')}</h3>
          {@render legend([
            { kind: 'dot', color: 'var(--s-down)', label: t('strokeDown') },
            { kind: 'dot', color: 'var(--s-up)', label: t('strokeUp') },
          ])}
          <div class="curves">
            {#each entries.filter((e) => e.last?.x?.length) as e (e.key)}
              {@const s = strokes(e.last)}
              <figure class="mini" class:warn={e.level === 'warn'}>
                <figcaption><b>{note(e.key)}</b> {e.key}</figcaption>
                <svg viewBox="0 0 {MINI.w} {MINI.h}" role="img" aria-label="{note(e.key)}, {t('curveAria')}">
                  <rect class="window" x={(e.last.twLow / scale.x) * MINI.w} y="0" width={((e.last.twHigh - e.last.twLow) / scale.x) * MINI.w} height={MINI.h} />
                  <path class="stroke" d={miniPath(s.down, scale)} style="stroke: var(--s-down)" />
                  <path class="stroke" d={miniPath(s.up, scale)} style="stroke: var(--s-up)" />
                </svg>
              </figure>
            {/each}
          </div>
          <p class="note">{t('rep_curvesNote', { x: fmt(scale.x), y: fmt(scale.y) })}</p>
        {/if}
      {/if}
    </section>
  {/each}
</article>

<style>
  /* Paper: always the light tokens, whatever the phone is set to */
  .kmd-report {
    --font: 'KMDashboard Sans', -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', Roboto, sans-serif;
    --w-figure: 500;
    --bg: #ffffff;
    --surface: #ffffff;
    --text-1: #141414;
    --text-2: #55544f;
    --text-3: #6f6d66;
    --text-4: #a9a69d;
    --grid: #e4e2da;
    --border: rgb(20 20 20 / 0.14);
    --rule: #141414;
    --s-down: #2a78d6;
    --s-balance: #1baf7a;
    --s-up: #eb6834;
    --s-friction: #4a3aa7;
    --s-dip: #008300;
    --warning: #d99a0b;
    --warning-ink: #8a5a00;

    width: 182mm;
    color: var(--text-1);
    background: var(--bg);
    font: 12px/1.45 var(--font);
    font-feature-settings: 'kern';
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-scheme: light;
  }
  .kmd-report :global(*) {
    box-sizing: border-box;
  }
  /* The charts' dark mode tint does not belong on paper */
  .kmd-report :global(path.band) {
    opacity: 0.13;
  }

  /* Hidden in the page until the browser prints */
  :global(.kmd-print) {
    position: fixed;
    left: 0;
    top: 0;
    width: 182mm;
    height: 0;
    overflow: hidden;
    visibility: hidden;
    pointer-events: none;
  }
  @page {
    size: A4;
    margin: 14mm 14mm 16mm;
  }
  @media print {
    :global(html:has(> body > .kmd-print)),
    :global(body:has(> .kmd-print)) {
      height: auto !important;
      overflow: visible !important;
      background: #fff !important;
    }
    :global(body:has(> .kmd-print) > :not(.kmd-print)) {
      display: none !important;
    }
    :global(.kmd-print) {
      position: static;
      width: auto;
      height: auto;
      overflow: visible;
      visibility: visible;
    }
    .kmd-report {
      width: auto;
    }
  }

  /* The page-break-* forms for older Safari */
  .page {
    break-before: page;
    page-break-before: always;
  }
  .block + .block:not(.page) {
    margin-top: 28px;
  }
  figure,
  tr,
  .key-hint,
  .hints li,
  .mini {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  h1,
  h2,
  h3,
  h4,
  .kicker,
  figcaption {
    break-after: avoid;
    page-break-after: avoid;
  }

  /* Type: one family, medium weight for titles, small capitals for labels */
  .kicker,
  .section-title,
  dt,
  th {
    font: 600 11px/1.3 var(--font);
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .kicker {
    margin: 0 0 6px;
  }
  h1 {
    margin: 0 0 18px;
    font: var(--w-figure) 30px/1.15 var(--font);
    letter-spacing: -0.01em;
  }
  h2 {
    margin: 0 0 4px;
    font: var(--w-figure) 22px/1.2 var(--font);
    letter-spacing: -0.005em;
  }
  .section-title {
    margin: 0 0 8px;
  }
  h3 {
    margin: 22px 0 6px;
    font: var(--w-figure) 15px/1.3 var(--font);
  }
  h3 small {
    font-size: 12px;
    font-weight: 400;
    color: var(--text-3);
  }
  h4 {
    margin: 12px 0 4px;
    font: 600 12px/1.3 var(--font);
    color: var(--text-2);
  }
  .meta {
    margin: 0;
    color: var(--text-2);
    font-variant-numeric: tabular-nums;
  }
  .notes {
    margin: 6px 0 0;
    color: var(--text-1);
  }
  .note {
    margin: 6px 0 0;
    font-size: 11px;
    color: var(--text-3);
  }
  small {
    color: var(--text-3);
  }

  /* Cover */
  .cover {
    padding-bottom: 16px;
    margin-bottom: 22px;
    border-bottom: 1px solid var(--rule);
  }
  .facts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px 20px;
    margin: 0;
  }
  .facts div {
    min-width: 0;
  }
  dt {
    margin-bottom: 2px;
  }
  dd {
    margin: 0;
    font-size: 12.5px;
  }

  /* Tables: rows between hairlines, ink rule on top */
  table {
    width: 100%;
    border-collapse: collapse;
    border-top: 1px solid var(--rule);
    font-variant-numeric: tabular-nums;
  }
  th {
    padding: 7px 6px 5px;
    text-align: left;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  td {
    padding: 4px 6px;
    border-bottom: 1px solid var(--border);
    vertical-align: baseline;
  }
  th:first-child,
  td:first-child {
    padding-left: 0;
  }
  th:last-child,
  td:last-child {
    padding-right: 0;
  }
  .num {
    text-align: right;
    white-space: nowrap;
  }
  td small {
    font-size: 11px;
  }
  .run-title small {
    display: block;
    font-weight: 400;
  }
  .runs .run-title {
    font-weight: 500;
  }
  .runs .date {
    white-space: nowrap;
  }
  .warn-count {
    font-weight: 600;
    color: var(--warning-ink);
  }
  .keys {
    margin-top: 4px;
    font-size: 11.5px;
  }
  .keys td {
    padding-top: 3px;
    padding-bottom: 3px;
  }
  .nr {
    width: 22px;
    color: var(--text-3);
  }
  .key {
    font-weight: 600;
    white-space: nowrap;
  }
  .keys tr.warn .nr {
    box-shadow: inset 2px 0 0 var(--warning);
    padding-left: 5px;
  }
  .hint-col {
    width: 36%;
    padding-left: 14px;
    color: var(--text-2);
  }
  .off {
    font-weight: 600;
    text-decoration: underline;
    text-decoration-color: var(--warning);
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
  }
  .strong {
    font-weight: 600;
  }
  .skewed {
    color: var(--text-4);
    font-weight: 400;
    text-decoration: none;
  }
  .changes {
    margin-top: 18px;
  }
  .mean td {
    font-weight: 600;
  }
  .sections td small {
    margin-left: 8px;
  }

  /* Findings: a state in small capitals, then the answer */
  .findings ul {
    margin: 10px 0 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--rule);
  }
  .findings li {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 12px;
    padding: 6px 0;
    border-bottom: 1px solid var(--border);
    color: var(--text-2);
    break-inside: avoid;
  }
  .findings b {
    font-weight: 600;
    color: var(--text-1);
  }
  .state {
    padding-top: 1px;
    font: 600 11px/1.45 var(--font);
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .check .state {
    color: var(--warning-ink);
  }
  .even td small {
    margin-left: 6px;
  }
  .history {
    display: block;
    width: 100%;
    height: auto;
  }
  .history .grid {
    stroke: var(--grid);
  }
  .history .tick {
    fill: var(--text-3);
    font: 11px var(--font);
    font-variant-numeric: tabular-nums;
  }
  .history .tick.strong {
    fill: var(--text-1);
  }
  .hist-line {
    fill: none;
    stroke-width: 1.5;
  }
  .history circle {
    stroke: var(--surface);
    stroke-width: 1.5;
  }

  /* Charts */
  .chart {
    margin: 18px 0 0;
  }
  figcaption {
    display: grid;
    gap: 3px;
    margin-bottom: 4px;
  }
  figcaption h3 {
    margin: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 24px;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 2px 14px;
    font-size: 11px;
    color: var(--text-2);
  }
  .legend span {
    display: inline-flex;
    align-items: center;
  }
  .legend i {
    display: inline-block;
    flex: none;
    margin-right: 6px;
  }
  .legend i.dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .legend i.muted {
    background: var(--text-3);
  }
  .legend i.band {
    width: 12px;
    height: 8px;
    opacity: 0.25;
  }
  .legend i.trend {
    width: 14px;
    height: 0;
    border-top: 1.5px dashed var(--text-2);
  }
  .legend i.ring {
    width: 9px;
    height: 9px;
    border: 2px solid var(--warning);
    border-radius: 50%;
  }

  /* Hints */
  .hints {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .hints li {
    position: relative;
    padding: 3px 0 3px 12px;
    color: var(--text-2);
  }
  .hints li b {
    font-weight: 600;
    color: var(--text-1);
  }
  .hints li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 9px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--text-4);
  }
  .hints li.warn::before {
    background: var(--warning);
  }
  .key-hints {
    border-top: 1px solid var(--border);
  }
  .key-hint {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 12px;
    padding: 5px 0;
    border-bottom: 1px solid var(--border);
  }
  .key-label {
    margin: 3px 0 0;
    color: var(--text-3);
    white-space: nowrap;
  }
  .key-label b {
    color: var(--text-1);
  }

  /* Small force curves, six per row */
  .curves {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 10px 12px;
    margin-top: 8px;
  }
  .mini {
    margin: 0;
  }
  .mini figcaption {
    display: block;
    margin: 0 0 2px;
    font-size: 11px;
    color: var(--text-3);
  }
  .mini figcaption b {
    color: var(--text-1);
  }
  .mini.warn figcaption b {
    text-decoration: underline;
    text-decoration-color: var(--warning);
    text-decoration-thickness: 2px;
    text-underline-offset: 2px;
  }
  .mini svg {
    display: block;
    width: 100%;
    height: auto;
    border-bottom: 1px solid var(--border);
  }
  .window {
    fill: var(--text-1);
    opacity: 0.06;
  }
  .stroke {
    fill: none;
    stroke-width: 1;
    stroke-linejoin: round;
  }
</style>
