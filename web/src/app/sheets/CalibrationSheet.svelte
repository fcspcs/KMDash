<script>
  import Sheet from '../components/Sheet.svelte';
  import NotePicker from '../components/NotePicker.svelte';
  import NumberField from '../components/NumberField.svelte';
  import Icon from '../components/Icon.svelte';
  import Toggle from '../components/Toggle.svelte';
  import { noteName } from '../lib/notes.js';
  import { fmt, fmtSigned } from '../lib/format.js';
  import { computeCorrection, kmdReference, CALIBRATION } from '../lib/calibration.js';
  import { t } from '../lib/i18n.js';

  // Calibration with test weights: compares the KMD against brass weights on a few keys.
  // The result is a correction of the displayed values. Nothing is changed on the KMD.
  let { app } = $props();

  const inst = $derived(app.instrument);
  // svelte-ignore state_referenced_locally
  let key = $state(app.current);
  let weightD = $state(null);
  let weightU = $state(null);

  const kmd = $derived(kmdReference(app.run.keys[key]));
  const entries = $derived(app.prefs.calibration.entries);
  const result = $derived(computeCorrection(entries));
  const canAdd = $derived(kmd && Number.isFinite(weightD) && Number.isFinite(weightU) && weightD > weightU && weightU > 0);
  const applied = $derived(result && Math.abs(app.prefs.offset.d - Math.round(result.d * 10) / 10) < 0.05 && Math.abs(app.prefs.offset.u - Math.round(result.u * 10) / 10) < 0.05 && app.prefs.correctionOn !== false);

  const close = () => (app.sheet = null);
  const direction = (value) => (value >= 0 ? t('readsHigher', { v: fmt(Math.abs(value)) }) : t('readsLower', { v: fmt(Math.abs(value)) }));

  function add() {
    app.addCalibrationEntry({
      piano: inst.name,
      key,
      note: noteName(key, inst.startNote),
      kmd: { d: kmd.d, u: kmd.u, n: kmd.n },
      weights: { d: weightD, u: weightU },
    });
    weightD = null;
    weightU = null;
  }

  function setOffset(metric, value) {
    app.prefs.offset[metric] = value ?? 0;
    app.savePrefs();
  }

  function apply() {
    app.applyCorrection(result);
    app.notify(t('correctionApplied'));
    close();
  }
</script>

<Sheet title={t('weightCalibration')} onclose={close}>
  <p class="prose">{t('calibrationIntro')}</p>
  <ol class="steps">
    <li>{t('calStep1')}</li>
    <li>{t('calStep2')}</li>
    <li>{t('calStep3')}</li>
  </ol>

  <section class="card add">
    <div class="field">
      <span>{t('calKey')}</span>
      <NotePicker bind:value={key} numKeys={inst.numKeys} startNote={inst.startNote} label={t('calKey')} />
    </div>
    {#if kmd}
      <p class="kmd">{t('calKmdValues', { d: fmt(kmd.d), u: fmt(kmd.u) })}<span>{kmd.n > 1 ? t('calMedianOf', { n: kmd.n }) : t('calOneReading')}</span></p>
    {:else}
      <p class="kmd missing">{t('calNoReading', { note: noteName(key, inst.startNote) })}</p>
    {/if}
    <div class="two">
      <label class="field"><span>{t('calWeightDown')}</span><NumberField bind:value={weightD} unit="g" label={t('calWeightDown')} /></label>
      <label class="field"><span>{t('calWeightUp')}</span><NumberField bind:value={weightU} unit="g" label={t('calWeightUp')} /></label>
    </div>
    <button class="btn block" onclick={add} disabled={!canAdd}><Icon name="plus" size={16} />{t('calAdd')}</button>
  </section>

  {#if entries.length}
    <h3 class="list-title">{t('calEntries')}</h3>
    <p class="columns"><span>{t('calColumns')}</span><span>{t('calDiff')}</span></p>
    <ul class="list">
      {#each entries as e (e.id)}
        <li class="entry">
          <span class="entry-key"><b>{e.note}</b><small>{e.key}</small></span>
          <span class="grow">
            <span class="line">{t('calEntryKmd', { d: fmt(e.kmd.d), u: fmt(e.kmd.u) })}</span>
            <span class="line muted">{t('calEntryWeights', { d: fmt(e.weights.d), u: fmt(e.weights.u) })}{e.piano !== inst.name ? ` · ${e.piano}` : ''}</span>
          </span>
          <span class="diff">{fmtSigned(e.kmd.d - e.weights.d)}<br />{fmtSigned(e.kmd.u - e.weights.u)}</span>
          <button class="icon-btn" onclick={() => app.removeCalibrationEntry(e.id)} aria-label={t('delete')}><Icon name="trash" size={18} /></button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if result}
    <section class="card result" class:unsure={!result.reliable}>
      <h3>{t('calResult', { n: result.n })}</h3>
      <dl>
        <div><dt>{t('metric_d')}</dt><dd>{direction(result.d)}</dd></div>
        <div><dt>{t('metric_u')}</dt><dd>{direction(result.u)}</dd></div>
        <div><dt>{t('metric_b')}</dt><dd>{fmtSigned(result.balance)} g</dd></div>
        <div><dt>{t('metric_f')}</dt><dd>{fmtSigned(result.friction)} g</dd></div>
      </dl>
      {#each result.notes as note}
        <p class="note"><Icon name="warn" size={16} />{t(`calNote_${note}`, { min: CALIBRATION.minKeys, spread: fmt(result.spread), balance: fmt(Math.abs(result.balance)) })}</p>
      {/each}
      {#if result.reliable}<p class="note ok"><Icon name="check" size={16} />{t('calNote_ok')}</p>{/if}
    </section>
  {/if}
  <h3 class="list-title">{t('correctionInUseTitle')}</h3>
  <ul class="list">
    <li class="row">
      <span class="grow">{t('correctionOn')}<span class="sub">{t('correctionOnSub')}</span></span>
      <Toggle label={t('correctionOn')} checked={app.prefs.correctionOn !== false} onchange={(v) => ((app.prefs.correctionOn = v), app.savePrefs())} />
    </li>
    <li class="manual">
      <label><span>{t('correctionDownShort')}</span><NumberField value={app.prefs.offset.d} unit="g" signed label={t('correctionDown')} onchange={(v) => setOffset('d', v)} /></label>
      <label><span>{t('correctionUpShort')}</span><NumberField value={app.prefs.offset.u} unit="g" signed label={t('correctionUp')} onchange={(v) => setOffset('u', v)} /></label>
    </li>
  </ul>
  <p class="list-note">{t('calibrationNote')}</p>

  {#snippet footer()}
    <button class="btn primary block" onclick={apply} disabled={!result || applied}>{applied ? t('correctionInUse') : t('applyCorrection')}</button>
  {/snippet}
</Sheet>

<style>
  /* Numbered steps with the numbers set in the serif */
  .steps {
    margin: 0 0 24px;
    padding: 0;
    list-style: none;
    counter-reset: step;
    font: 14.5px/1.5 var(--font);
    color: var(--text-2);
  }
  .steps li {
    position: relative;
    padding-left: 30px;
    counter-increment: step;
  }
  .steps li::before {
    content: counter(step);
    position: absolute;
    left: 0;
    top: 0;
    font: 600 15px/1.5 var(--font);
    color: var(--text-1);
  }
  .steps li + li {
    margin-top: 8px;
  }
  .card {
    margin-bottom: 28px;
    padding-top: 16px;
    border-top: 1px solid var(--rule);
  }
  .kmd {
    margin: -6px 0 16px;
    font: 14px/1.45 var(--font);
    color: var(--text-1);
  }
  .kmd span {
    display: block;
    font-size: 13px;
    color: var(--text-3);
  }
  .kmd.missing {
    color: var(--text-3);
  }
  /* Labels may take two lines (German), the fields still line up */
  .two {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: end;
    gap: 10px;
  }
  .entry {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    font: 14px/1.4 var(--font);
  }
  .entry-key {
    display: grid;
    min-width: 44px;
    line-height: 1.1;
  }
  .entry-key b {
    font: 600 16px/1 var(--font);
  }
  .entry-key small {
    margin-top: 2px;
    font-size: 11px;
    color: var(--text-3);
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  .line {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-variant-numeric: tabular-nums;
  }
  .line.muted {
    color: var(--text-2);
  }
  .diff {
    font: 600 14px/1.4 var(--font);
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .columns {
    display: flex;
    justify-content: space-between;
    margin: 0 56px 8px 0;
    font: 12px var(--font);
    color: var(--text-3);
  }
  .icon-btn {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    flex: none;
    border: 0;
    background: none;
    color: var(--critical);
  }
  .result h3 {
    margin: 0 0 14px;
    font: 500 20px/1.2 var(--font);
  }
  dl {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 14px 16px;
    margin: 0 0 12px;
  }
  dt {
    font: 600 11px var(--font);
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  dd {
    margin: 4px 0 0;
    font: 500 15px/1.35 var(--font);
  }
  .note {
    display: flex;
    gap: 10px;
    margin: 8px 0 0;
    font: 13.5px/1.45 var(--font);
    color: var(--text-1);
  }
  .note :global(svg) {
    flex: none;
    margin-top: 1px;
    color: var(--warning-ink);
  }
  .note.ok :global(svg) {
    color: var(--good);
  }
  .manual {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 10px;
    padding: 12px 0 16px;
  }
  .manual label {
    display: grid;
    gap: 6px;
  }
  .manual span {
    font: 600 11px var(--font);
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
</style>
