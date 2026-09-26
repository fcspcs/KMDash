<script module>
  // The report is mounted outside the app, only print shows it (see Report.svelte). One at a time.
  let printed = null;
  function clearPrinted() {
    if (!printed) return;
    printed.unmount();
    printed.target.remove();
    printed = null;
  }
</script>

<script>
  import { mount, unmount, flushSync } from 'svelte';
  import Sheet from '../components/Sheet.svelte';
  import Segmented from '../components/Segmented.svelte';
  import Toggle from '../components/Toggle.svelte';
  import Icon from '../components/Icon.svelte';
  import Report from '../report/Report.svelte';
  import { download, safeFileName, fmtDate } from '../lib/format.js';
  import { effective, measuredCount, overviewCsv, allCurvesCsv } from '../lib/store.js';
  import { zipFiles } from '../lib/zip.js';
  import { detailsCsv } from '../lib/report.js';
  import { t } from '../lib/i18n.js';

  let { app } = $props();
  const close = () => (app.sheet = null);

  const inst = $derived(app.instrument);
  // Oldest first in the report, newest first in the list like everywhere else
  const byDate = $derived([...inst.runs].sort((a, b) => a.createdAt - b.createdAt));
  const listed = $derived([...byDate].reverse());

  let format = $state('pdf');
  // svelte-ignore state_referenced_locally
  let chosen = $state(app.instrument.runs.map((r) => r.id));
  let parts = $state({ charts: true, table: true, hints: true, compare: true, curves: false });
  let tables = $state({ values: true, details: false, curves: false });

  const runs = $derived(byDate.filter((r) => chosen.includes(r.id)));
  const canCompare = $derived(runs.length > 1);

  const PDF_PARTS = ['charts', 'table', 'hints', 'compare', 'curves'];
  const CSV_PARTS = ['values', 'details', 'curves'];

  function toggleRun(id) {
    chosen = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
  }

  // --- CSV: one file per run and kind, in the format of the KMD's own page. Several files go into one ZIP.
  const base = $derived(safeFileName(inst.name));
  const csvFiles = $derived(
    runs.flatMap((run) => {
      const name = inst.runs.length > 1 ? `${base}_${safeFileName(run.title)}` : base;
      const files = [];
      if (tables.values) files.push({ name: `${name}_overview.csv`, run, kind: 'values' });
      if (tables.details) files.push({ name: `${name}_details.csv`, run, kind: 'details' });
      if (tables.curves) files.push({ name: `${name}_curves.csv`, run, kind: 'curves' });
      return files;
    }),
  );

  function csvText(file) {
    if (file.kind === 'curves') return allCurvesCsv(file.run, inst.numKeys);
    if (file.kind === 'details') return detailsCsv(app.analyze(file.run), { numKeys: inst.numKeys, startNote: inst.startNote, targetsAt: app.targetsAt, tolerance: app.tolerance });
    return overviewCsv(inst.numKeys, (key) => effective(file.run.keys[key], app.valueMode));
  }

  function saveCsv() {
    if (!csvFiles.length) return;
    if (csvFiles.length === 1) download(csvFiles[0].name, csvText(csvFiles[0]));
    else download(`${base}.zip`, zipFiles(csvFiles.map((f) => ({ name: f.name, text: csvText(f) }))), 'application/zip');
  }

  // --- PDF: the report goes into the page and the browser prints it, "Save as PDF" in the print dialog
  function createPdf() {
    if (!runs.length) return;
    clearPrinted();
    const target = Object.assign(document.createElement('div'), { className: 'kmd-print' });
    document.body.append(target);
    const component = mount(Report, { target, props: { app, runs, parts: { ...parts, compare: parts.compare && canCompare } } });
    flushSync();
    printed = { target, unmount: () => unmount(component) };
    const done = () => {
      window.removeEventListener('afterprint', done);
      setTimeout(clearPrinted, 0);
    };
    window.addEventListener('afterprint', done);
    window.print();
  }
</script>

<Sheet title={t('exportData')} onclose={close}>
  <div class="field">
    <Segmented
      label={t('exportData')}
      value={format}
      options={[
        { value: 'pdf', label: t('formatPdf') },
        { value: 'csv', label: t('formatCsv') },
      ]}
      onchange={(v) => (format = v)}
    />
  </div>

  <h3 class="list-title">{t('runs')}</h3>
  <ul class="list">
    {#each listed as r (r.id)}
      {@const on = chosen.includes(r.id)}
      <li>
        <button class="row" role="checkbox" aria-checked={on} onclick={() => toggleRun(r.id)}>
          <span class="box" class:on>{#if on}<Icon name="check" size={12} stroke={2.4} />{/if}</span>
          <span class="grow">
            {r.title}
            <span class="sub">{fmtDate(r.createdAt)} · {t('measuredOf', { n: measuredCount(r, inst.numKeys), total: inst.numKeys })}</span>
          </span>
        </button>
      </li>
    {/each}
  </ul>

  <h3 class="list-title">{t('exportContent')}</h3>
  <ul class="list">
    {#if format === 'pdf'}
      {#each PDF_PARTS as part}
        {@const off = part === 'compare' && !canCompare}
        <li class="row" class:disabled={off}>
          <span class="grow">{t(`part_${part}`)}<span class="sub">{off ? t('part_compare_needsTwo') : t(`part_${part}_sub`)}</span></span>
          <Toggle label={t(`part_${part}`)} checked={parts[part] && !off} onchange={(v) => (parts[part] = v)} />
        </li>
      {/each}
    {:else}
      {#each CSV_PARTS as part}
        <li class="row">
          <span class="grow">{t(`csv_${part}`)}<span class="sub">{t(`csv_${part}_sub`)}</span></span>
          <Toggle label={t(`csv_${part}`)} checked={tables[part]} onchange={(v) => (tables[part] = v)} />
        </li>
      {/each}
    {/if}
  </ul>
  <p class="list-note">{format === 'pdf' ? t('pdfNote') : t('csvNote')}</p>

  {#snippet footer()}
    {#if !runs.length}
      <p class="missing">{t('chooseRun')}</p>
    {:else if format === 'pdf'}
      <button class="btn primary block" onclick={createPdf}><Icon name="file" size={16} />{t('createPdf')}</button>
    {:else}
      <button class="btn primary block" onclick={saveCsv} disabled={!csvFiles.length}>
        <Icon name="download" size={16} />{csvFiles.length > 1 ? t('saveZip', { n: csvFiles.length }) : t('saveCsv')}
      </button>
    {/if}
  {/snippet}
</Sheet>

<style>
  .field {
    margin-bottom: 24px;
  }
  .box {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    flex: none;
    border-radius: 2px;
    box-shadow: inset 0 0 0 1px var(--text-3);
    color: var(--bg);
  }
  .box.on {
    background: var(--text-1);
    box-shadow: none;
  }
  .disabled {
    color: var(--text-4);
  }
  .disabled .sub {
    color: var(--text-4);
  }
  .disabled :global(.toggle) {
    opacity: 0.35;
    pointer-events: none;
  }
  .missing {
    margin: 0;
    min-height: 48px;
    display: grid;
    place-items: center;
    font: 15px var(--font);
    color: var(--text-2);
  }
</style>
