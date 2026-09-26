<script>
  import Sheet from '../components/Sheet.svelte';
  import { fmtTick, fmtDate, parseNumber } from '../lib/format.js';
  import { t } from '../lib/i18n.js';

  // Create a run (without id) or edit one
  let { app, id = null } = $props();

  const run = $derived(id ? app.instrument.runs.find((r) => r.id === id) : null);
  // svelte-ignore state_referenced_locally
  let title = $state(id ? (app.instrument.runs.find((r) => r.id === id)?.title ?? '') : t('runDefault', { n: app.instrument.runs.length + 1 }));
  // svelte-ignore state_referenced_locally
  let notes = $state(id ? (app.instrument.runs.find((r) => r.id === id)?.notes ?? '') : '');
  // Conditions: a new run starts with the measuring point of the current one
  // svelte-ignore state_referenced_locally
  const start = (id ? app.instrument.runs.find((r) => r.id === id)?.conditions : { point: app.run.conditions?.point }) ?? {};
  let point = $state(start.point ?? '');
  let humidity = $state(start.humidity != null ? fmtTick(start.humidity) : '');
  let temperature = $state(start.temperature != null ? fmtTick(start.temperature) : '');
  const number = (v) => {
    const n = parseNumber(v);
    return Number.isFinite(n) ? n : null;
  };
  const conditions = () => ({ point: point.trim(), humidity: number(humidity), temperature: number(temperature) });

  // KMD settings: only for the active run (or a new one), reading them is the read-only send_settings
  const active = $derived(!run || run.id === app.run.id);
  const kmd = $derived(run ? run.kmd : null);
  const canRead = $derived(active && app.status === 'connected');

  const close = () => (app.sheet = null);

  function save() {
    const clean = title.trim() || t('runDefault', { n: app.instrument.runs.length + (run ? 0 : 1) });
    if (run) {
      app.editRun(run.id, { title: clean, notes: notes.trim(), conditions: conditions() });
    } else {
      app.newRun(clean, notes.trim(), conditions());
      app.notify(t('runCreated', { title: clean }));
      app.view = 'measure';
    }
    close();
  }

  function remove() {
    const target = run;
    app.sheet = {
      type: 'confirm',
      title: t('deleteRunTitle'),
      message: t('deleteRunMessage', { title: target.title }),
      confirmLabel: t('delete'),
      danger: true,
      onconfirm: () => app.deleteRun(target.id),
    };
  }
</script>

<Sheet title={run ? t('editRun') : t('newRun')} onclose={close}>
  {#if !run}<p class="prose">{t('newRunIntro')}</p>{/if}
  <label class="field">
    <span>{t('runTitle')}</span>
    <input class="input" bind:value={title} maxlength="60" placeholder={t('runTitlePlaceholder')} />
  </label>
  <label class="field">
    <span>{t('runNotes')}</span>
    <textarea class="input notes" bind:value={notes} rows="4" placeholder={t('runNotesPlaceholder')}></textarea>
  </label>

  <h3 class="part">{t('conditions')}</h3>
  <label class="field">
    <span>{t('measurePoint')}</span>
    <input class="input" bind:value={point} maxlength="60" placeholder={t('measurePointPlaceholder')} />
  </label>
  <div class="two">
    <label class="field">
      <span>{t('humidity')}</span>
      <input class="input" bind:value={humidity} inputmode="decimal" maxlength="5" />
    </label>
    <label class="field">
      <span>{t('temperature')}</span>
      <input class="input" bind:value={temperature} inputmode="decimal" maxlength="5" />
    </label>
  </div>
  {#if run}
    <p class="kmd">
      {kmd ? t('kmdSettingsRead', { stop: fmtTick(kmd.stopWeight), cal: fmtTick(kmd.calibrationWeight), date: fmtDate(kmd.at) }) : t('kmdSettingsNone')}
      {#if canRead}<button class="read" onclick={() => app.loadDeviceSettings()} disabled={app.device.loading}>{t('readFromKmd')}</button>{/if}
    </p>
  {/if}
  <p class="list-note inline">{t('conditionsNote')}</p>

  {#if run && app.instrument.runs.length > 1}
    <button class="btn block ghost-danger" onclick={remove}>{t('deleteRun')}</button>
  {/if}
  {#snippet footer()}
    <button class="btn primary block" onclick={save}>{run ? t('save') : t('createRun')}</button>
  {/snippet}
</Sheet>

<style>
  .notes {
    min-height: 104px;
    padding: 12px;
    font: 16px/1.45 var(--font);
    resize: vertical;
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .part {
    margin: 28px 0 14px;
    padding-top: 16px;
    border-top: 1px solid var(--rule);
    font: var(--w-figure) 18px/1.3 var(--font);
    color: var(--text-1);
  }
  .kmd {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px 16px;
    margin: 0 0 8px;
    font: 14px/1.45 var(--font);
    color: var(--text-2);
    font-variant-numeric: tabular-nums;
  }
  .read {
    min-height: 44px;
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
  .read:disabled {
    color: var(--text-4);
  }
  .inline {
    margin: 0 2px 20px;
  }
  .ghost-danger {
    border-color: transparent;
    background: none;
    color: var(--critical);
  }
</style>
