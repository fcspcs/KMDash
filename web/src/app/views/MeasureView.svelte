<script>
  import Keyboard from '../components/Keyboard.svelte';
  import Readout from '../components/Readout.svelte';
  import HintList from '../components/HintList.svelte';
  import CurveChart from '../components/CurveChart.svelte';
  import RangeSlider from '../components/RangeSlider.svelte';
  import Segmented from '../components/Segmented.svelte';
  import Icon from '../components/Icon.svelte';
  import { noteName } from '../lib/notes.js';
  import { fmt } from '../lib/format.js';
  import { corrected } from '../lib/calibration.js';
  import { t } from '../lib/i18n.js';

  let { app } = $props();

  const inst = $derived(app.instrument);
  const run = $derived(app.run);
  const note = (key) => noteName(key, inst.startNote);
  const result = $derived(app.result);
  const count = $derived(run.keys[app.current]?.length ?? 0);
  // Only mark warnings on the keyboard, the strip below shows measured keys
  const marks = $derived(Object.fromEntries(Object.entries(app.analysis.keys).map(([k, r]) => [k, r.level])));
  const keyMarks = $derived(Object.fromEntries(Object.entries(marks).filter(([, level]) => level === 'warn')));
  const session = $derived(app.session);
  const sessionDone = $derived(session && session.index >= session.keys.length);
  const taken = $derived(session ? session.taken[app.target] || 0 : 0);
  const connected = $derived(app.status === 'connected');
  const newest = $derived(inst.runs.at(-1));
  // Waiting for the next reading while the target key has no fresh value yet
  const awaiting = $derived(connected && (app.target !== app.current || !app.displayed || (session && !session.blocked && !sessionDone)));

  // Comparison: the same note in the comparison run, otherwise the last viewed key
  const compareKey = $derived(app.compareAnalysis?.keys[app.current] ?? null);
  const ghost = $derived(
    compareKey
      ? { label: app.compareRun.title, m: compareKey.last }
      : app.ghost && app.ghost.m !== app.displayed
        ? { label: app.ghost.key === app.current ? t('previousReading') : `${note(app.ghost.key)} · ${t('key', { n: app.ghost.key })}`, m: app.ghost.m }
        : null,
  );
  // Changes: against the same note in the comparison run when comparing
  // Otherwise the change against the previous reading of this key (not with the median, that mixes readings)
  const readings = $derived(run.keys[app.current] ?? []);
  const ref = $derived(
    compareKey
      ? { m: compareKey.m, label: t('vsRun', { title: app.compareRun.title }) }
      : readings.length > 1 && app.prefs.valueMode !== 'median'
        ? { m: corrected(readings.at(-2), app.correction), label: t('vsPrevious') }
        : null,
  );
  // svelte-ignore state_referenced_locally
  const demo = app.source.kind === 'demo';

  let showGhost = $state(true);
  let full = $state(false);
  let curveView = $state(null); // axes the curve shows right now, the zoom starts from there

  // Zoom: free axis ranges, starting from what is shown now. Full curve goes back to automatic axes
  function toggleZoom() {
    if (app.curveZoom || !curveView) return (app.curveZoom = null);
    const { x, y } = curveView;
    app.curveZoom = {
      x: [Math.max(0, Math.floor(x[0] * 2) / 2), Math.min(14, Math.ceil(x[1] * 2) / 2)],
      y: [Math.max(0, Math.floor(y[0] / 5) * 5), Math.min(400, Math.ceil(y[1] / 5) * 5)],
    };
  }
  function toggleFull() {
    full = !full;
    app.curveZoom = null;
  }
  let confirmUndo = $state(false);
  let undoTimer;

  // Guided opens the setup first, Single and Continuous end a running session
  function setMode(mode) {
    if (mode === 'guided') {
      app.sheet = { type: 'session' };
      return;
    }
    if (app.session) app.endSession();
    app.setMode(mode);
  }

  // Arrow keys pick the previous or next key (desktop). Not while typing or while a sheet is open
  function onKey(event) {
    if (app.sheet || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const el = event.target;
    if (el?.closest?.('input, textarea, select, [contenteditable="true"], [role="radiogroup"]')) return;
    if (event.key === 'ArrowLeft' && app.current > 1) app.select(app.current - 1);
    else if (event.key === 'ArrowRight' && app.current < inst.numKeys) app.select(app.current + 1);
    else return;
    event.preventDefault();
  }

  function undo() {
    if (!confirmUndo) {
      confirmUndo = true;
      clearTimeout(undoTimer);
      undoTimer = setTimeout(() => (confirmUndo = false), 3000);
      return;
    }
    confirmUndo = false;
    app.undo();
  }
</script>

<svelte:window onkeydown={onKey} />

<Keyboard numKeys={inst.numKeys} startNote={inst.startNote} current={app.current} target={app.target} marks={keyMarks} mapMarks={marks} waiting={awaiting} onselect={(k) => app.select(k)} />

<div class="page">
 <!-- Two columns on desktop: controls and values left, the curve right. On a phone both are one list -->
 <div class="main-col">
  <section class="head">
    <button class="nav" onclick={() => app.select(app.current - 1)} disabled={app.current <= 1} aria-label={t('prevKey')}>
      <Icon name="left" size={28} stroke={1.3} />
    </button>
    <div class="title">
      <h1>{note(app.current)}</h1>
      <p>{t('key', { n: app.current })}{count > 1 ? ` · ${t('count', { n: count })}` : ''}</p>
    </div>
    <button class="nav" onclick={() => app.select(app.current + 1)} disabled={app.current >= inst.numKeys} aria-label={t('nextKey')}>
      <Icon name="right" size={28} stroke={1.3} />
    </button>
  </section>

  {#if run.id !== newest.id}
    <section class="older">
      <Icon name="layers" size={16} />
      <span>{t('olderRun', { title: run.title })}</span>
      <button class="chip" onclick={() => app.activateRun(newest.id)}>{t('switchToNewest')}</button>
    </section>
  {/if}

  <div class="mode">
  <Segmented
    label={t('mode')}
    value={session ? 'guided' : app.mode}
    options={[
      { value: 'single', label: t('single') },
      { value: 'continuous', label: t('continuous') },
      { value: 'guided', label: t('guided') },
    ]}
    onchange={setMode}
  />
  </div>

  {#if session}
    <section class="session">
      <div class="progress-row">
        <span class="progress-label">{t('sessionProgress', { n: Math.min(session.index + 1, session.keys.length), total: session.keys.length })}</span>
        <div class="session-actions">
          <button class="chip" onclick={() => app.skip()} disabled={sessionDone}><Icon name="skip" size={13} />{t('skip')}</button>
          <button class="chip" onclick={() => (app.sheet = { type: 'summary' })}><Icon name="stop" size={13} />{t('finish')}</button>
        </div>
      </div>
      <div class="progress"><span style="width: {(Math.min(session.index, session.keys.length) / session.keys.length) * 100}%"></span></div>
      {#if sessionDone}
        <p class="instruction">{t('sessionDone')}</p>
      {:else if session.blocked}
        <p class="instruction warn"><Icon name="warn" size={16} />{t('sessionBlocked', { note: note(app.current) })}</p>
        <div class="button-row">
          <button class="btn" onclick={() => app.repeat()}><Icon name="repeat" size={16} />{t('measureAgain')}</button>
          <button class="btn primary" onclick={() => app.continueAnyway()}>{t('continueAnyway')}<Icon name="right" size={16} /></button>
        </div>
      {:else}
        <p class="instruction">
          {t('sessionInstruction', { note: note(app.target) })}
          {#if session.perKey > 1}<span class="reading">{t('readingOf', { n: taken + 1, total: session.perKey })}</span>{/if}
          {#if session.rounds > 1}<span class="reading">{t('roundOf', { n: Math.min(session.rounds, Math.floor(session.index / session.roundSize) + 1), total: session.rounds })}</span>{/if}
        </p>
      {/if}
    </section>
  {/if}

  {#if demo}
    <button class="btn primary block demo-measure" onclick={() => app.source.measure(app.target, inst.numKeys)}><Icon name="bolt" size={16} />{t('simulate')}</button>
  {:else}
    <section class="status" class:offline={!connected}>
      {#if !connected}
        <span class="dot"></span>{app.status === 'connecting' ? t('status_connecting') : t('offlineHint')}
      {:else if app.target !== app.current}
        <span class="dot live"></span><span>{t('nextMeasurement', { note: note(app.target), key: app.target })}</span>
      {:else}
        <span class="dot live"></span>{t('readyHint')}
      {/if}
    </section>
  {/if}

  {#if result}
    <Readout m={result.m} {ref} targets={result.targets} status={result.status} pulse={app.pulse} />

    {#if result.hints.length}
      <HintList hints={result.hints} limit={1} />
    {/if}

    <section class="actions">
      {#if app.target !== app.current}
        <button class="text-btn" onclick={() => app.repeat()}><Icon name="repeat" size={16} />{t('measureAgain')}</button>
      {/if}
      <button class="text-btn danger" class:armed={confirmUndo} onclick={undo} disabled={!run.history.length}>
        <Icon name="undo" size={16} />{confirmUndo ? t('undoConfirm') : t('undo')}
      </button>
    </section>
  {/if}
 </div>

 <div class="side-col">
  {#if result}
    <section class="chart-card">
      <div class="card-head">
        <h2>{t('curve')}</h2>
        <div class="chips">
          {#if ghost}<button class="chip" class:on={showGhost} onclick={() => (showGhost = !showGhost)}>{compareKey ? t('compareShort') : t('ghost')}</button>{/if}
          <button class="chip" class:on={app.curveWindow} onclick={() => (app.curveWindow = !app.curveWindow)}>{t('window')}</button>
          <button class="chip" class:on={full && !app.curveZoom} onclick={toggleFull}>{t('fullCurve')}</button>
          <button class="chip" class:on={!!app.curveZoom} onclick={toggleZoom}>{t('zoom')}</button>
        </div>
      </div>
      <CurveChart m={app.displayed} {ghost} targets={result.targets} offset={app.correction} {showGhost} showWindow={app.curveWindow} {full} zoom={app.curveZoom} bind:view={curveView} />
      {#if app.curveZoom}
        <div class="zoom">
          <RangeSlider label={t('zoomTravel')} min={0} max={14} step={0.5} lo={app.curveZoom.x[0]} hi={app.curveZoom.x[1]} format={(v) => `${fmt(v)} mm`} onchange={(a, b) => (app.curveZoom = { ...app.curveZoom, x: [a, b] })} />
          <RangeSlider label={t('zoomForce')} min={0} max={400} step={5} lo={app.curveZoom.y[0]} hi={app.curveZoom.y[1]} format={(v) => `${v} g`} onchange={(a, b) => (app.curveZoom = { ...app.curveZoom, y: [a, b] })} />
          <button class="text-btn" onclick={() => (app.curveZoom = null)}>{t('zoomReset')}</button>
        </div>
      {/if}
    </section>
  {:else}
    <section class="empty">
      <Icon name="target" size={30} stroke={1.4} />
      <p>{t('emptyKey', { note: note(app.current) })}</p>
      {#if compareKey}<p class="hint">{t('emptyKeyCompare', { title: app.compareRun.title })}</p>{/if}
    </section>
  {/if}
 </div>
</div>

<style>
  .page {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    padding: 8px 20px 28px;
  }
  /* Phone: both columns flow into one list, the actions go last */
  .main-col,
  .side-col {
    display: contents;
  }
  .actions {
    order: 2;
  }

  /* The key: its name large in the serif, arrows either side */
  .head {
    display: grid;
    grid-template-columns: 48px 1fr 48px;
    align-items: center;
  }
  .nav {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 0;
    border-radius: 2px;
    background: none;
    color: var(--text-1);
  }
  .nav:disabled {
    color: var(--text-4);
  }
  .nav:active:not(:disabled) {
    background: var(--fill-1);
  }
  .title {
    text-align: center;
  }
  h1 {
    margin: 0;
    font: var(--w-figure) 72px/1 var(--font);
    letter-spacing: -0.02em;
  }
  .title p {
    margin: 6px 0 0;
    font: 600 11px/1.3 var(--font);
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .older {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    font: 13.5px/1.4 var(--font);
    color: var(--text-2);
  }
  .older span {
    flex: 1;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 22px;
    font: 14px/1.4 var(--font);
    color: var(--text-2);
  }
  .dot {
    flex: none;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--text-4);
  }
  .dot.live {
    background: var(--good);
    box-shadow: 0 0 0 0 var(--good);
    animation: live 2s infinite;
  }

  /* Curve: title in the serif over an ink rule, switches as small capitals */
  .chart-card {
    padding-top: 12px;
    border-top: 1px solid var(--rule);
  }
  .card-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 4px 8px;
    margin-bottom: 8px;
  }
  h2 {
    margin: 0;
    font: 500 22px/1.2 var(--font);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
  }
  .zoom {
    display: grid;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }
  .zoom .text-btn {
    justify-self: start;
    padding: 0;
  }
  .chip {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 32px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--text-2);
    font: 600 11px/1 var(--font);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    white-space: nowrap;
  }
  /* Tap target at least 44 px, even if the chip looks smaller */
  .chip::after {
    content: '';
    position: absolute;
    inset: -6px -8px;
  }
  .chip.on {
    color: var(--text-1);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 5px;
  }
  .chip:disabled {
    opacity: 0.4;
  }
  .btn.demo-measure {
    min-height: 52px;
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px 24px;
  }
  .text-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 4px;
    border: 0;
    background: none;
    color: var(--text-1);
    font: 600 11px var(--font);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .text-btn.danger {
    color: var(--critical);
  }
  .text-btn.armed {
    text-decoration: underline;
    text-underline-offset: 5px;
  }
  .text-btn:disabled {
    opacity: 0.4;
  }
  .button-row {
    display: flex;
    gap: 8px;
  }
  .button-row > .btn {
    flex: 1;
  }
  .btn:active:not(:disabled),
  .chip:active:not(:disabled) {
    transform: scale(0.97);
  }

  /* Guided series: a line of progress under the count */
  .session {
    display: grid;
    gap: 10px;
    padding: 12px 0 14px;
    border-top: 1px solid var(--rule);
    border-bottom: 1px solid var(--border);
  }
  .progress-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .progress-label {
    font: 600 11px/1 var(--font);
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    font-variant-numeric: tabular-nums;
  }
  .session-actions {
    display: flex;
    gap: 18px;
  }
  .progress {
    height: 2px;
    background: var(--fill-2);
    overflow: hidden;
  }
  .progress span {
    display: block;
    height: 100%;
    background: var(--accent);
    transition: width 0.4s ease;
  }
  .instruction {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    align-items: center;
    margin: 0;
    font: 400 19px/1.35 var(--font);
    color: var(--text-1);
  }
  .instruction.warn {
    flex-wrap: nowrap;
    align-items: flex-start;
    font: 15px/1.45 var(--font);
  }
  .instruction.warn :global(svg) {
    flex: none;
    margin-top: 2px;
    color: var(--warning-ink);
  }
  .reading {
    padding: 3px 8px;
    border: 1px solid var(--border);
    font: 600 11px/1.4 var(--font);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--text-2);
  }
  .empty {
    display: grid;
    justify-items: center;
    gap: 12px;
    color: var(--text-3);
    padding: 36px 20px;
    border-top: 1px solid var(--rule);
    border-bottom: 1px solid var(--border);
    text-align: center;
  }
  .empty p {
    margin: 0;
    max-width: 300px;
    font: 400 18px/1.45 var(--font);
    color: var(--text-2);
  }
  .empty p.hint {
    font: 13.5px/1.45 var(--font);
    color: var(--text-3);
  }

  @media (min-width: 960px) {
    .page {
      grid-template-columns: clamp(330px, 34%, 400px) minmax(0, 1fr);
      align-items: start;
      gap: 32px;
      padding: 20px 40px 40px;
    }
    .main-col,
    .side-col {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
    }
    .side-col {
      position: sticky;
      top: 20px;
    }
    .empty {
      min-height: 360px;
      align-content: center;
    }
    .actions {
      justify-content: flex-start;
    }
  }
  @media (hover: hover) {
    .nav:not(:disabled):hover {
      background: var(--fill-1);
    }
    .chip:not(.on):not(:disabled):hover,
    .text-btn:not(:disabled):hover {
      color: var(--text-1);
      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-underline-offset: 5px;
    }
    .text-btn.danger:not(:disabled):hover {
      color: var(--critical);
    }
  }
  @keyframes live {
    0% {
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--good) 60%, transparent);
    }
    70% {
      box-shadow: 0 0 0 6px transparent;
    }
  }
</style>
