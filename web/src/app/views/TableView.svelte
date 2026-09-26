<script>
  import Segmented from '../components/Segmented.svelte';
  import Icon from '../components/Icon.svelte';
  import HintList from '../components/HintList.svelte';
  import { noteName } from '../lib/notes.js';
  import { fmt, fmtDip, fmtSigned, EMPTY } from '../lib/format.js';
  import { t } from '../lib/i18n.js';

  let { app } = $props();
  let filter = $state('measured');
  let show = $state('values');

  const inst = $derived(app.instrument);
  const compare = $derived(app.compareRun);
  const diff = $derived(!!compare && show === 'change');
  const rows = $derived(
    Array.from({ length: inst.numKeys }, (_, i) => i + 1)
      .map((key) => ({ key, r: app.analysis.keys[key], was: app.compareAnalysis?.keys[key] ?? null }))
      .filter(({ r, was }) => {
        if (filter === 'all') return true;
        if (diff) return r && was && (filter === 'measured' || r.level !== 'ok');
        return r && (filter === 'measured' || r.level !== 'ok');
      }),
  );
  const columns = [
    { id: 'd', format: fmt },
    { id: 'u', format: fmt },
    { id: 'b', format: fmt },
    { id: 'f', format: fmt },
    { id: 'dip', format: fmtDip },
  ];
  // Highlight clear changes (KMD repeatability is about 1 g, key dip 0.1 mm)
  const notable = (metric, delta) => Math.abs(delta) >= (metric === 'dip' ? 0.1 : 1);

  function open(key) {
    app.select(key);
    app.view = 'measure';
  }
</script>

<div class="page">
 <div class="controls">
  <Segmented
    label={t('filter')}
    value={filter}
    options={[{ value: 'all', label: t('filterAll') }, { value: 'measured', label: t('filterMeasured') }, { value: 'issues', label: t('filterIssues') }]}
    onchange={(v) => (filter = v)}
  />
  {#if compare}
    <Segmented
      label={t('show')}
      value={show}
      options={[{ value: 'values', label: t('showValues') }, { value: 'change', label: t('showChange', { title: compare.title }) }]}
      onchange={(v) => (show = v)}
    />
  {/if}
 </div>

  <div class="table" role="table" aria-label={t('tab_table')}>
    <div class="trow head" role="row">
      <span role="columnheader" class="num">#</span>
      <span role="columnheader">{t('noteShort')}</span>
      {#each columns as c}<span role="columnheader" class="num">{#if diff}<span class="delta">Δ </span>{/if}{t(`col_${c.id}`)}</span>{/each}
      <span role="columnheader" class="state"></span>
      <span role="columnheader" class="hint-cell">{t('hints')}</span>
    </div>
    {#each rows as { key, r, was } (key)}
      <button class="row-button" class:current={key === app.current} onclick={() => open(key)}>
       <span class="trow" role="row">
        <span class="nr" role="cell">{key}</span>
        <span class="key" role="cell">{noteName(key, inst.startNote)}</span>
        {#each columns as c}
          {#if diff}
            {@const delta = r && was ? r.m[c.id] - was.m[c.id] : null}
            <span role="cell" class="num"><span class:strong={delta != null && notable(c.id, delta)} class:quiet={delta != null && !notable(c.id, delta)}>{delta == null ? EMPTY : fmtSigned(delta, c.id === 'dip' ? 2 : 1)}</span></span>
          {:else}
            {@const st = r?.status[c.id]}
            <span role="cell" class="num"><span class:off={st === 'high' || st === 'low'}>{r ? c.format(r.m[c.id]) : EMPTY}</span></span>
          {/if}
        {/each}
        <span role="cell" class="state">
          {#if r?.level === 'warn'}<span class="warn"><Icon name="warn" size={16} /></span>
          {:else if r?.level === 'info'}<span class="info"><Icon name="info" size={16} /></span>{/if}
        </span>
        <span role="cell" class="hint-cell">{#if r?.hints.length}<HintList hints={r.hints.slice(0, 1)} compact />{/if}</span>
       </span>
      </button>
    {:else}
      <p class="empty">{diff ? t('tableEmptyCompare') : t('tableEmpty')}</p>
    {/each}
  </div>
  <p class="legend">{diff ? t('tableLegendChange', { title: compare.title }) : t('tableLegend')}</p>
</div>

<style>
  .page {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 18px;
    padding: 12px 20px 32px;
  }
  .controls {
    display: grid;
    gap: 8px;
  }
  .hint-cell {
    display: none;
  }
  /* A ruled table: ink line on top, hairlines between rows, figures aligned */
  .table {
    border-top: 1px solid var(--rule);
    border-bottom: 1px solid var(--border);
  }
  .row-button {
    position: relative;
    display: block;
    width: 100%;
    padding: 0;
    border: 0;
    border-top: 1px solid var(--border);
    background: none;
    color: var(--text-1);
    text-align: left;
  }
  .trow {
    display: grid;
    grid-template-columns: 20px 34px repeat(5, minmax(0, 1fr)) 16px;
    align-items: baseline;
    gap: 8px;
    width: 100%;
    padding: 13px 0 12px;
    font: 15px var(--font);
    font-variant-numeric: tabular-nums;
  }
  .trow.head {
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 12px 0 10px;
    background: var(--bg);
    font: 600 11px var(--font);
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .row-button.current {
    background: var(--fill-1);
  }
  .row-button.current::before {
    content: '';
    position: absolute;
    left: -20px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--accent);
  }
  .row-button:active {
    background: var(--fill-1);
  }
  .nr {
    font: 12px var(--font);
    color: var(--text-3);
    text-align: right;
  }
  .key {
    font: 600 15px/1 var(--font);
    white-space: nowrap;
  }
  .num {
    text-align: right;
    white-space: nowrap;
  }
  /* On phones the columns are too narrow for the Δ, the control above and the legend say it */
  .delta {
    display: none;
  }
  .off {
    font-weight: 600;
    color: var(--text-1);
    box-shadow: inset 0 -2px 0 var(--warning);
  }
  .strong {
    font-weight: 700;
  }
  .quiet {
    color: var(--text-3);
  }
  .state {
    display: grid;
    place-items: center;
    align-self: center;
  }
  .warn,
  .info {
    display: grid;
  }
  .warn {
    color: var(--warning-ink);
  }
  .info {
    color: var(--text-3);
  }
  .empty {
    margin: 0;
    padding: 36px 20px;
    text-align: center;
    color: var(--text-2);
    font: 400 18px/1.45 var(--font);
  }
  .legend {
    margin: 0;
    font: 13px/1.45 var(--font);
    color: var(--text-3);
  }
  @media (hover: hover) {
    .row-button:not(.current):hover {
      background: var(--fill-1);
    }
  }
  /* Desktop: wider columns and the first hint of each key instead of the icon */
  @media (min-width: 960px) {
    .delta {
      display: inline;
    }
    .page {
      max-width: 1280px;
      padding: 32px 40px 48px;
    }
    .controls {
      display: flex;
      gap: 32px;
    }
    .controls > :global(*) {
      flex: 0 1 360px;
    }
    .row-button.current::before {
      left: -12px;
    }
    .trow {
      grid-template-columns: 32px 52px repeat(5, minmax(56px, 80px)) minmax(200px, 1fr);
      gap: 12px;
    }
    .state {
      display: none;
    }
    .hint-cell {
      display: block;
      min-width: 0;
      padding-left: 20px;
    }
    .hint-cell :global(strong) {
      font-size: 14px;
    }
  }
</style>
