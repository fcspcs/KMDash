<script>
  import Sheet from '../components/Sheet.svelte';
  import Segmented from '../components/Segmented.svelte';
  import NotePicker from '../components/NotePicker.svelte';
  import NumberField from '../components/NumberField.svelte';
  import KeysChart from '../components/KeysChart.svelte';
  import Icon from '../components/Icon.svelte';
  import { metricValue, splitIntoSections, newSegment, emptyTargets, TARGET_METRICS } from '../lib/targets.js';
  import { isBlack } from '../lib/notes.js';
  import { targetsLabel } from '../lib/labels.js';
  import { noteName } from '../lib/notes.js';
  import { fmt, fmtDip, fmtRange } from '../lib/format.js';
  import { t } from '../lib/i18n.js';

  let { app } = $props();

  // svelte-ignore state_referenced_locally
  const inst = app.instrument;
  const numKeys = inst.numKeys;
  const original = JSON.stringify(normalize(inst.targets ?? emptyTargets()));
  let draft = $state(inst.targets ? structuredClone($state.snapshot(inst.targets)) : emptyTargets());
  let metric = $state('d');
  let editing = $state(null); // index of the expanded range

  const num = (v) => (metric === 'dip' ? fmtDip(v) : fmt(v));
  function summary(s) {
    if (s.kind === 'slope') {
      if (s.start == null) return t('open');
      const values = s.end == null || s.end === s.start ? num(s.start) : `${num(s.start)} → ${num(s.end)}`;
      return `${values} ± ${num(s.tol ?? 0)} ${unit}`;
    }
    return fmtRange({ min: s.min ?? null, max: s.max ?? null }, metric) || t('open');
  }

  const COLORS = { d: 'var(--s-down)', u: 'var(--s-up)', b: 'var(--s-balance)', f: 'var(--s-friction)', dip: 'var(--s-dip)' };
  const unit = $derived(metric === 'dip' ? 'mm' : 'g');
  const segments = $derived(draft.metrics[metric]);
  const dirty = $derived(JSON.stringify(normalize($state.snapshot(draft))) !== original);

  // Preview without the KMD correction, showing values as they are entered
  const band = $derived.by(() => {
    const snapshot = $state.snapshot(draft);
    const m = metric;
    return (key) => metricValue(snapshot, m, key, numKeys);
  });
  const values = $derived.by(() => {
    const out = {};
    for (const e of Object.values(app.analysis.keys)) {
      if (e.distorted && metric !== 'dip') continue;
      if (metric === 'dip' && isBlack(e.key, inst.startNote)) continue;
      out[e.key] = e.m[metric];
    }
    return out;
  });
  const derivedNote = $derived(!segments.length ? (metric === 'b' ? t('targetsDerivedBalance') : metric === 'f' ? t('targetsDefaultFriction') : t('targetsEmpty')) : '');

  const close = () => (app.sheet = null);
  // Unsaved changes: closing asks first, inside this sheet so the edits stay when you go on
  let asking = $state(false);
  function requestClose() {
    if (dirty && !asking) asking = true;
    else close();
  }

  function add() {
    draft.metrics[metric].push(newSegment($state.snapshot(draft), metric, numKeys));
    editing = draft.metrics[metric].length - 1;
  }
  function split() {
    draft.metrics[metric] = splitIntoSections($state.snapshot(draft), metric, numKeys);
    editing = null;
  }
  function clear() {
    draft.metrics[metric] = [];
    editing = null;
  }
  function remove(index) {
    draft.metrics[metric].splice(index, 1);
    editing = null;
  }
  function setKind(s, kind) {
    if (s.kind === kind) return;
    // When switching, carry over the middle of the previous range
    if (kind === 'slope') {
      const mid = s.min != null && s.max != null ? (s.min + s.max) / 2 : (s.max ?? s.min);
      Object.assign(s, { kind, start: mid, end: mid, tol: s.min != null && s.max != null ? (s.max - s.min) / 2 : 2 });
      delete s.min;
      delete s.max;
    } else {
      const lo = Math.min(s.start ?? 0, s.end ?? s.start ?? 0) - (s.tol ?? 0);
      const hi = Math.max(s.start ?? 0, s.end ?? s.start ?? 0) + (s.tol ?? 0);
      Object.assign(s, { kind, min: s.start != null ? lo : null, max: s.start != null ? hi : null });
      delete s.start;
      delete s.end;
      delete s.tol;
    }
  }

  function normalize(targets) {
    const metrics = {};
    for (const id of TARGET_METRICS) {
      metrics[id] = (targets.metrics[id] || []).map((s) => {
        const from = Math.max(1, Math.min(numKeys, Math.min(s.from, s.to)));
        const to = Math.max(1, Math.min(numKeys, Math.max(s.from, s.to)));
        return s.kind === 'slope' ? { from, to, kind: 'slope', start: s.start ?? null, end: s.end ?? null, tol: s.tol ?? 0 } : { from, to, kind: 'range', min: s.min ?? null, max: s.max ?? null };
      });
    }
    return { source: targets.source ?? null, edited: targets.edited, metrics };
  }

  function save() {
    const next = normalize($state.snapshot(draft));
    const empty = TARGET_METRICS.every((id) => !next.metrics[id].length);
    app.setTargets(empty ? null : { ...next, edited: true });
    app.notify(t('targetsSaved'));
    close();
  }

  function loadProfile() {
    if (!dirty) return (app.sheet = { type: 'profile' });
    app.sheet = { type: 'confirm', title: t('discardTitle'), message: t('discardMessage'), confirmLabel: t('discard'), danger: true, onconfirm: () => setTimeout(() => (app.sheet = { type: 'profile' })) };
  }
</script>

<Sheet title={t('editTargets')} onclose={requestClose}>
  <p class="prose">{t('targetsIntro', { name: targetsLabel(inst.targets) })}</p>

  <Segmented label={t('metric')} value={metric} options={TARGET_METRICS.map((id) => ({ value: id, label: t(`short_${id}`) }))} onchange={(v) => ((metric = v), (editing = null))} />

  <section class="preview">
    <div class="preview-head">
      <b>{t(`metric_${metric}`)} <small>({unit})</small></b>
      <span class="legend"><i style="background: {COLORS[metric]}"></i>{t('targetBand')}</span>
    </div>
    <KeysChart label={t(`metric_${metric}`)} numKeys={numKeys} startNote={inst.startNote} series={[{ id: metric, color: COLORS[metric], values }]} bands={[{ color: COLORS[metric], range: band }]} height={150} />
    {#if derivedNote}<p class="note">{derivedNote}</p>{/if}
    {#if metric === 'dip'}<p class="note">{t('targetsDipNote')}</p>{/if}
  </section>

  {#if segments.length}
    <ul class="list segments">
      {#each segments as s, i (i)}
        <li class:open={editing === i}>
          <button class="row seg-row" onclick={() => (editing = editing === i ? null : i)} aria-expanded={editing === i}>
            <span class="grow">{noteName(s.from, inst.startNote)} {t('to')} {noteName(s.to, inst.startNote)}<span class="sub">{t('keysRange', { from: s.from, to: s.to })}</span></span>
            <span class="value">{summary(s)}</span>
            <span class="chevron" class:up={editing === i}><Icon name="down" size={16} stroke={1.5} /></span>
          </button>
          {#if editing === i}
            <div class="editor">
              <div class="keys">
                <NotePicker bind:value={s.from} {numKeys} startNote={inst.startNote} label={t('fromKey')} />
                <span>{t('to')}</span>
                <NotePicker bind:value={s.to} {numKeys} startNote={inst.startNote} label={t('toKey')} />
              </div>
              <Segmented label={t('kind')} value={s.kind} options={[{ value: 'range', label: t('kindRange') }, { value: 'slope', label: t('kindSlope') }]} onchange={(v) => setKind(s, v)} />
              {#if s.kind === 'slope'}
                <div class="values three">
                  <label><span>{t('startValue')}</span><NumberField bind:value={s.start} {unit} label={t('startValue')} /></label>
                  <label><span>{t('endValue')}</span><NumberField bind:value={s.end} {unit} label={t('endValue')} /></label>
                  <label><span>{t('tolerance')}</span><NumberField bind:value={s.tol} {unit} label={t('tolerance')} /></label>
                </div>
              {:else}
                <div class="values">
                  <label><span>{t('min')}</span><NumberField bind:value={s.min} {unit} label={t('min')} placeholder={t('open')} /></label>
                  <label><span>{t('max')}</span><NumberField bind:value={s.max} {unit} label={t('max')} placeholder={t('open')} /></label>
                </div>
              {/if}
              <button class="remove" onclick={() => remove(i)}><Icon name="trash" size={16} />{t('removeRange')}</button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  <div class="actions">
    <button class="btn" onclick={add}><Icon name="plus" size={16} />{t('addRange')}</button>
    <button class="btn" onclick={split}><Icon name="layers" size={16} />{t('standardSections')}</button>
  </div>
  {#if segments.length}<button class="btn block subtle" onclick={clear}>{t('clearMetric', { metric: t(`metric_${metric}`) })}</button>{/if}
  <p class="list-note inline">{t('targetsOverlapNote')}</p>
  <button class="link" onclick={loadProfile}>{t('loadProfileInstead')}</button>

  {#snippet footer()}
    {#if asking}
      <p class="asking" role="alert"><b>{t('discardTitle')}</b> {t('discardMessage')}</p>
      <div class="buttons">
        <button class="btn" onclick={() => (asking = false)}>{t('keepEditing')}</button>
        <button class="btn danger" onclick={close}>{t('discard')}</button>
      </div>
    {:else}
      <div class="buttons">
        <button class="btn" onclick={requestClose}>{t('cancel')}</button>
        <button class="btn primary" onclick={save} disabled={!dirty}>{t('save')}</button>
      </div>
    {/if}
  {/snippet}
</Sheet>

<style>
  .preview {
    margin: 20px 0 24px;
  }
  .preview-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .preview-head b {
    font: 500 19px/1.2 var(--font);
  }
  .preview-head small {
    margin-left: 2px;
    font: 400 13px var(--font);
    color: var(--text-3);
  }
  .legend {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font: 12px var(--font);
    color: var(--text-2);
  }
  .legend i {
    width: 14px;
    height: 9px;
    opacity: 0.3;
  }
  .note {
    margin: 6px 2px 0;
    font: 12px/1.4 var(--font);
    color: var(--text-3);
  }
  .segments {
    margin-bottom: 12px;
  }
  .seg-row .value {
    font-variant-numeric: tabular-nums;
  }
  .chevron {
    display: grid;
    color: var(--text-3);
    transition: transform 0.2s;
  }
  .chevron.up {
    transform: rotate(180deg);
  }
  li.open .seg-row {
    font-weight: 600;
  }
  .editor {
    display: grid;
    gap: 14px;
    padding: 4px 0 18px;
  }
  .remove {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 44px;
    border: 0;
    background: none;
    color: var(--critical);
    font: 500 15px var(--font);
  }
  .keys {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    font: 14px var(--font);
    color: var(--text-2);
  }
  .values {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 8px;
  }
  .values.three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .values label {
    display: grid;
    gap: 4px;
    min-width: 0;
  }
  .values label > span {
    font: 600 11px var(--font);
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 4px 0 8px;
  }
  .actions .btn {
    padding: 0 10px;
    font-size: 14px;
  }
  .subtle {
    margin-bottom: 8px;
    border-color: transparent;
    background: none;
    color: var(--critical);
    font-size: 14px;
  }
  .inline {
    margin: 4px 0 8px;
    padding: 0 2px;
  }
  .link {
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--text-1);
    font: 600 11px var(--font);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    text-decoration: underline;
    text-underline-offset: 5px;
  }
  .buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .asking {
    margin: 0 0 12px;
    font: 14px/1.45 var(--font);
    color: var(--text-2);
  }
  .asking b {
    font-weight: 600;
    color: var(--text-1);
  }
</style>
