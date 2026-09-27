<script>
  import Icon from '../components/Icon.svelte';
  import Toggle from '../components/Toggle.svelte';
  import Segmented from '../components/Segmented.svelte';
  import { noteName } from '../lib/notes.js';
  import { download, pickFile, safeFileName, fmtDate, fmtSigned } from '../lib/format.js';
  import { keyCsv, toProjectFile, fromProjectFile, measuredCount, defaultLastDamperKey, clearAll } from '../lib/store.js';
  import { targetsLabel, HINT_GROUPS } from '../lib/labels.js';
  import { t } from '../lib/i18n.js';
  import { KMD_HOST } from '../sources/live.js';

  let { app } = $props();

  const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

  const inst = $derived(app.instrument);
  const live = $derived(app.source.kind === 'live');
  const file = $derived(safeFileName(inst.name));
  const runs = $derived([...inst.runs].reverse());

  function exportKey() {
    const m = app.displayed;
    if (!m?.x?.length) return app.notify(t('noCurveToExport'));
    download(`${file}_key${app.current}.csv`, keyCsv(m));
  }
  function save() {
    download(`${file}.json`, toProjectFile(inst, app.valueOf), 'application/json');
  }
  async function open() {
    const picked = await pickFile();
    if (!picked) return;
    try {
      app.importInstrument(fromProjectFile(picked.text, picked.name, t('runDefault', { n: 1 })));
      app.notify(t('opened', { name: app.instrument.name }));
    } catch {
      app.notify(t('openFailed'));
    }
  }

  function removeInstrument(entry) {
    app.sheet = {
      type: 'confirm',
      title: t('deletePianoTitle'),
      message: t('deletePianoMessage', { name: entry.name }),
      confirmLabel: t('delete'),
      danger: true,
      onconfirm: () => app.deleteInstrument(entry.id),
    };
  }

  function newPiano() {
    app.newInstrument();
    app.sheet = { type: 'instrument', created: true };
  }

  // Userscript: the KMD's own page, stopped by the script, comes back with #original.
  // Website: the KMD's page in this tab, so only one of the two is connected to the KMD.
  function openOriginal() {
    if (app.source.direct) {
      location.href = `http://${KMD_HOST}/`;
      return;
    }
    location.hash = 'original';
    location.reload();
  }
</script>

<div class="page">
  <section class="piano">
    <div class="grow">
      <h1>{inst.name}</h1>
      <p>{t('pianoMeta', { n: inst.numKeys, note: noteName(1, inst.startNote) })} · {targetsLabel(inst.targets)}{#if inst.info?.client} · {inst.info.client}{/if}</p>
    </div>
    <button class="edit" onclick={() => (app.sheet = { type: 'instrument' })}>{t('edit')}</button>
  </section>

  <div>
    <h2 class="list-title">{t('runs')}</h2>
    <ul class="list">
      {#each runs as r (r.id)}
        {@const active = r.id === app.run.id}
        <li class="run-row">
          <button class="row" onclick={() => app.activateRun(r.id)} aria-current={active ? 'true' : undefined}>
            <span class="check" class:on={active}>{#if active}<Icon name="check" size={12} stroke={2.4} />{/if}</span>
            <span class="grow">
              {r.title}
              <span class="sub">{fmtDate(r.createdAt)} · {t('measuredOf', { n: measuredCount(r, inst.numKeys), total: inst.numKeys })}{r.notes ? ` · ${r.notes}` : ''}</span>
            </span>
            {#if app.compareRun?.id === r.id}<span class="tag">{t('compareTag')}</span>{/if}
          </button>
          <button class="icon-btn" onclick={() => (app.sheet = { type: 'run', id: r.id })} aria-label={t('editRun')}><Icon name="edit" size={18} /></button>
        </li>
      {/each}
      <li><button class="row" onclick={() => (app.sheet = { type: 'run' })}><span class="icon"><Icon name="plus" size={18} /></span><span class="grow">{t('newRun')}</span></button></li>
    </ul>
  </div>

  <div>
    <h2 class="list-title">{t('targets')}</h2>
    <ul class="list">
      <li>
        <button class="row" onclick={() => (app.sheet = { type: 'profile' })}>
          <span class="icon"><Icon name="target" size={18} /></span><span class="grow">{t('targetsFrom')}</span><span class="value">{targetsLabel(inst.targets)}</span><Icon name="right" size={16} />
        </button>
      </li>
      <li>
        <button class="row" onclick={() => (app.sheet = { type: 'targets' })}>
          <span class="icon"><Icon name="sliders" size={18} /></span><span class="grow">{t('editTargets')}</span><Icon name="right" size={16} />
        </button>
      </li>
    </ul>
  </div>

  <div>
    <h2 class="list-title">{t('files')}</h2>
    <ul class="list">
      <li><button class="row" onclick={() => (app.sheet = { type: 'export' })}><span class="icon"><Icon name="file" size={18} /></span><span class="grow">{t('exportData')}<span class="sub">{t('exportDataSub')}</span></span><Icon name="right" size={16} /></button></li>
      <li><button class="row" onclick={save}><span class="icon"><Icon name="download" size={18} /></span><span class="grow">{t('savePiano')}<span class="sub">{t('savePianoSub')}</span></span></button></li>
      <li><button class="row" onclick={open}><span class="icon"><Icon name="upload" size={18} /></span><span class="grow">{t('openFile')}<span class="sub">{t('openFileSub')}</span></span></button></li>
      <li><button class="row" onclick={exportKey}><span class="icon"><Icon name="file" size={18} /></span><span class="grow">{t('exportKey', { note: noteName(app.current, inst.startNote) })}</span></button></li>
    </ul>
    <p class="list-note">{t('filesNote')}</p>
  </div>

  <div>
    <h2 class="list-title">{t('pianosOnPhone')}</h2>
    <ul class="list">
      {#each app.instruments as entry (entry.id)}
        {@const active = entry.id === inst.id}
        <li class="run-row">
          <button class="row" onclick={() => app.openInstrument(entry.id)} aria-current={active ? 'true' : undefined}>
            <span class="check" class:on={active}>{#if active}<Icon name="check" size={12} stroke={2.4} />{/if}</span>
            <span class="grow">{entry.name}<span class="sub">{t('pianoListSub', { runs: entry.runs ?? 1, n: entry.measured ?? 0, date: fmtDate(entry.updated) })}</span></span>
          </button>
          <button class="icon-btn danger" onclick={() => removeInstrument(entry)} aria-label={t('delete')}><Icon name="trash" size={18} /></button>
        </li>
      {/each}
      <li><button class="row" onclick={newPiano}><span class="icon"><Icon name="plus" size={18} /></span><span class="grow">{t('newPiano')}</span></button></li>
    </ul>
    <p class="list-note">{t('storageNote')}</p>
  </div>

  <div>
    <h2 class="list-title">{t('measuring')}</h2>
    <ul class="list">
      <li class="row">
        <span class="grow">{t('perKey')}</span>
        <div class="seg-small">
          <Segmented label={t('perKey')} value={app.prefs.perKey} options={[1, 2, 3].map((n) => ({ value: n, label: String(n) }))} onchange={(v) => ((app.prefs.perKey = v), app.savePrefs())} />
        </div>
      </li>
      <li class="row">
        <span class="grow">{t('valueMode')}</span>
        <div class="seg-small">
          <Segmented label={t('valueMode')} value={app.prefs.valueMode} options={[{ value: 'last', label: t('valueLast') }, { value: 'median', label: t('valueMedian') }]} onchange={(v) => ((app.prefs.valueMode = v), app.savePrefs())} />
        </div>
      </li>
      <li class="row">
        <span class="grow">{t('sound')}</span>
        <Toggle label={t('sound')} checked={app.prefs.sound} onchange={(v) => ((app.prefs.sound = v), app.savePrefs())} />
      </li>
    </ul>
  </div>

  <div>
    <h2 class="list-title">{t('device')}</h2>
    <ul class="list">
      <li class="row">
        <span class="icon"><Icon name="wifi" size={18} /></span>
        <span class="grow">{t('connection')}</span>
        <span class="value">{live ? t(`status_${app.status}`) : t('statusDemo')}</span>
      </li>
      <li>
        <button class="row" onclick={() => (app.sheet = { type: 'calibration' })}>
          <span class="icon"><Icon name="target" size={18} /></span>
          <span class="grow">{t('weightCalibration')}<span class="sub">{app.correctionActive ? t('correctionActive', { d: fmtSigned(app.correction.d), u: fmtSigned(app.correction.u) }) : t('correctionOff')}</span></span>
          <Icon name="right" size={16} />
        </button>
      </li>
      <li><button class="row" onclick={() => (app.sheet = { type: 'device', mode: 'settings' })}><span class="icon"><Icon name="sliders" size={18} /></span><span class="grow">{t('deviceSettings')}</span><Icon name="right" size={16} /></button></li>
      <li><button class="row" onclick={() => (app.sheet = { type: 'device', mode: 'calibrate' })}><span class="icon"><Icon name="crosshair" size={18} /></span><span class="grow">{t('calibrateSensor')}</span><Icon name="right" size={16} /></button></li>
      <li><button class="row danger" onclick={() => (app.sheet = { type: 'device', mode: 'defaults' })}><span class="icon"><Icon name="reset" size={18} /></span><span class="grow">{t('restoreDefaults')}</span><Icon name="right" size={16} /></button></li>
      {#if !live}
        <li><button class="row" onclick={() => (clearAll(), location.reload())}><span class="icon"><Icon name="reset" size={18} /></span><span class="grow">{t('resetDemo')}<span class="sub">{t('resetDemoSub')}</span></span></button></li>
      {/if}
      {#if live}
        <li><button class="row" onclick={openOriginal}><span class="icon"><Icon name="external" size={18} /></span><span class="grow">{t('originalUi')}<span class="sub">{t(app.source.direct ? 'originalUiSubDirect' : 'originalUiSub')}</span></span></button></li>
      {/if}
    </ul>
    <p class="list-note">{t('deviceNote')}</p>
  </div>

  <div>
    <h2 class="list-title">{t('appSection')}</h2>
    <ul class="list">
      <li>
        <button class="row" onclick={() => (app.sheet = { type: 'hints' })}>
          <span class="icon"><Icon name="info" size={18} /></span>
          <span class="grow">{t('hints')}</span>
          <span class="value">{t('hintsOn', { n: HINT_GROUPS.filter((g) => app.prefs.hints[g] !== false).length, total: HINT_GROUPS.length })}</span>
          <Icon name="right" size={16} />
        </button>
      </li>
      <li class="row">
        <span class="icon"><Icon name="globe" size={18} /></span>
        <span class="grow">{t('language')}</span>
        <div class="seg-small"><Segmented label={t('language')} value={app.lang} options={[{ value: 'en', label: 'English' }, { value: 'de', label: 'Deutsch' }]} onchange={(v) => app.setLanguage(v)} /></div>
      </li>
    </ul>
  </div>

  <footer class="about">
    <p>{t('about')}</p>
    <p class="version">KMDash {APP_VERSION} · {t('lastDamperInfo', { note: noteName(inst.lastDamperKey ?? defaultLastDamperKey(inst.numKeys), inst.startNote) })}</p>
  </footer>
</div>

<style>
  .page {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
    padding: 20px 20px 40px;
  }
  /* The piano: its name large, the details in small type, "Edit" as a quiet link */
  .piano {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    margin-bottom: 32px;
    padding-bottom: 16px;
    border-bottom: 2px solid var(--accent);
  }
  .piano .grow {
    min-width: 0;
    flex: 1;
  }
  h1 {
    margin: 0;
    font: var(--w-figure) 36px/1.1 var(--font);
    letter-spacing: -0.01em;
  }
  .piano p {
    margin: 8px 0 0;
    font: 600 11px/1.4 var(--font);
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .edit {
    min-height: 44px;
    padding: 0 2px;
    border: 0;
    background: none;
    color: var(--text-1);
    font: 600 11px var(--font);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    text-decoration: underline;
    text-underline-offset: 5px;
  }
  .run-row {
    display: flex;
    align-items: center;
  }
  .run-row .row {
    flex: 1;
    min-width: 0;
  }
  .run-row .grow {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .run-row .sub {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* Radio mark: a ring, filled with ink when chosen */
  .check {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    flex: none;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px var(--text-3);
    color: var(--bg);
  }
  .check.on {
    background: var(--text-1);
    box-shadow: none;
  }
  .tag {
    flex: none;
    padding: 3px 7px;
    border: 1px solid var(--border);
    font: 600 11px/1.4 var(--font);
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .icon-btn {
    display: grid;
    place-items: center;
    width: 44px;
    height: 48px;
    flex: none;
    border: 0;
    background: none;
    color: var(--text-3);
  }
  .icon-btn.danger {
    color: var(--critical);
  }
  .icon-btn:active {
    background: var(--fill-1);
  }
  .seg-small {
    width: 180px;
  }
  .about {
    margin-top: 8px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
    font: 13px/1.55 var(--font);
    color: var(--text-3);
  }
  .about p {
    margin: 0 0 6px;
  }
  .version {
    font-size: 12px;
  }
  /* Desktop: the sections in two columns under the piano */
  @media (min-width: 960px) {
    .page {
      display: block;
      columns: 2 360px;
      column-gap: 48px;
      max-width: 1180px;
      padding: 32px 40px 48px;
    }
    .page > * {
      break-inside: avoid;
    }
    .piano,
    .about {
      column-span: all;
    }
    .piano {
      margin-bottom: 36px;
    }
    h1 {
      font-size: 44px;
    }
  }
  @media (hover: hover) {
    .icon-btn:hover {
      background: var(--fill-1);
      color: var(--text-1);
    }
    .icon-btn.danger:hover {
      color: var(--critical);
    }
    .edit:hover {
      text-decoration-thickness: 2px;
    }
  }
</style>
