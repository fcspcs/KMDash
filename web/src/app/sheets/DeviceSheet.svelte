<script>
  import Sheet from '../components/Sheet.svelte';
  import NumberField from '../components/NumberField.svelte';
  import Icon from '../components/Icon.svelte';
  import { fmt, fmtTick } from '../lib/format.js';
  import { t } from '../lib/i18n.js';

  // Device settings, sensor calibration, factory defaults.
  // Safety rules (CLAUDE.md): changes only after freshly loaded settings, only changed values,
  // always with a review step. Calibration and factory defaults need two confirmations.
  let { app, mode = 'settings' } = $props();

  // Same limits as the input fields on the KMD's own page
  const FIELDS = [
    { id: 'calibration_weight', label: 'calibrationWeight', unit: 'g', min: 10, max: 400, step: 0.1 },
    { id: 'touchweight_window_low', label: 'twLow', unit: 'mm', min: 0, max: 12.5, step: 0.5 },
    { id: 'touchweight_window_high', label: 'twHigh', unit: 'mm', min: 0.5, max: 13, step: 0.5 },
    { id: 'stop_weight_val', label: 'stopWeight', unit: 'g', min: 10, max: 400, step: 1 },
  ];

  let step = $state('start'); // settings: form | review | sent · calibrate/defaults: start | confirm | sent
  let form = $state(null);
  let expected = $state(null);
  let sendFailed = $state(false);

  const connected = $derived(app.status === 'connected');
  const device = $derived(app.device);

  // svelte-ignore state_referenced_locally
  if (mode === 'settings') {
    step = 'form';
    app.loadDeviceSettings();
  }

  // Fill the form with the freshly read values (the KMD sends e.g. 211.6900024)
  const shown = (field, value) => Math.round(value / Math.min(field.step, 0.01)) * Math.min(field.step, 0.01);
  const differs = (a, b) => Math.abs(a - b) > 0.004;
  $effect(() => {
    if (mode === 'settings' && step === 'form' && device.settings && !form) form = Object.fromEntries(FIELDS.map((f) => [f.id, Number(shown(f, device.settings[f.id]).toFixed(2))]));
  });

  const errors = $derived.by(() => {
    if (!form) return {};
    const out = {};
    for (const f of FIELDS) {
      const v = form[f.id];
      if (v == null || !Number.isFinite(v)) out[f.id] = t('errNumber');
      else if (v < f.min || v > f.max) out[f.id] = t('errRange', { min: fmtTick(f.min), max: fmtTick(f.max), unit: f.unit });
      else if (f.step >= 0.5 && Math.abs(v / f.step - Math.round(v / f.step)) > 1e-9) out[f.id] = t('errStep', { step: fmtTick(f.step), unit: f.unit });
    }
    if (!out.touchweight_window_high && !out.touchweight_window_low && form.touchweight_window_low >= form.touchweight_window_high) out.touchweight_window_high = t('errWindow');
    return out;
  });
  const valid = $derived(form && !Object.keys(errors).length);
  const changes = $derived(form && device.settings ? FIELDS.filter((f) => differs(form[f.id], device.settings[f.id])) : []);
  const messages = $derived(valid ? app.settingsMessages(form) : []);
  const confirmed = $derived(step === 'sent' && expected && device.settings && !device.pending && FIELDS.every((f) => Math.abs(device.settings[f.id] - expected[f.id]) < 0.01));
  const mismatch = $derived(step === 'sent' && expected && device.settings && !device.pending && !device.loading && !confirmed);

  const close = () => (app.sheet = null);

  function reload() {
    form = null;
    app.loadDeviceSettings();
  }

  function send() {
    sendFailed = false;
    expected = { ...form };
    if (!app.applySettings(form)) {
      sendFailed = true;
      return;
    }
    step = 'sent';
  }

  function runCommand() {
    sendFailed = false;
    const ok = mode === 'calibrate' ? app.startCalibration() : app.restoreDefaults();
    if (!ok) sendFailed = true;
    else step = 'sent';
  }

  const title = $derived(mode === 'calibrate' ? t('calibrateSensor') : mode === 'defaults' ? t('restoreDefaults') : t('deviceSettings'));
</script>

<Sheet {title} onclose={close}>
  {#if !connected && step !== 'sent'}
    <div class="notice"><Icon name="wifi" size={18} /><p>{t('deviceOffline')}</p></div>
  {/if}

  {#if mode === 'settings'}
    {#if step === 'form'}
      {#if device.loading}
        <p class="prose center">{t('loadingSettings')}</p>
      {:else if device.error}
        <div class="notice"><Icon name="warn" size={18} /><p>{device.error === 'offline' ? t('deviceOffline') : t('settingsNoAnswer')}</p></div>
        <button class="btn block" onclick={reload} disabled={!connected}><Icon name="repeat" size={16} />{t('tryAgain')}</button>
      {:else if form}
        <p class="prose">{t('settingsIntro')}</p>
        {#each FIELDS as f (f.id)}
          <div class="field">
            <span>{t(f.label)}</span>
            <NumberField bind:value={form[f.id]} unit={f.unit} label={t(f.label)} />
            {#if errors[f.id]}<small class="error">{errors[f.id]}</small>{:else if differs(form[f.id], device.settings[f.id])}<small class="changed">{t('onDevice', { value: fmt(device.settings[f.id]), unit: f.unit })}</small>{/if}
          </div>
        {/each}
        <p class="list-note inline">{t('settingsNote')}</p>
      {/if}
    {:else if step === 'review'}
      <p class="prose">{t('reviewIntro')}</p>
      <ul class="list">
        {#each changes as f (f.id)}
          <li class="row">
            <span class="grow">{t(f.label)}</span>
            <span class="value">{fmt(device.settings[f.id])} → <b>{fmt(form[f.id])}</b> {f.unit}</span>
          </li>
        {/each}
      </ul>
      <p class="list-note">{t('reviewNote', { n: messages.length })}</p>
      {#if changes.some((f) => f.id === 'calibration_weight')}<div class="notice warn"><Icon name="warn" size={18} /><p>{t('calibrationWeightWarning')}</p></div>{/if}
    {:else}
      {#if confirmed}
        <div class="done"><Icon name="check" size={28} /><p>{t('settingsSaved')}</p></div>
      {:else if mismatch}
        <div class="notice warn"><Icon name="warn" size={18} /><p>{t('settingsMismatch')}</p></div>
        <button class="btn block" onclick={reload}><Icon name="repeat" size={16} />{t('readAgain')}</button>
      {:else}
        <p class="prose center">{t('settingsChecking')}</p>
      {/if}
    {/if}
  {:else if step === 'start'}
    <p class="prose">{mode === 'calibrate' ? t('calibrateIntro') : t('defaultsIntro')}</p>
    <ul class="steps">
      {#each (mode === 'calibrate' ? ['calibrateStep1', 'calibrateStep2', 'calibrateStep3'] : ['defaultsStep1', 'defaultsStep2']) as key}
        <li>{t(key)}</li>
      {/each}
    </ul>
  {:else if step === 'confirm'}
    <div class="notice warn"><Icon name="warn" size={18} /><p>{mode === 'calibrate' ? t('calibrateConfirm') : t('defaultsConfirm')}</p></div>
  {:else}
    <div class="done"><Icon name="check" size={28} /><p>{mode === 'calibrate' ? t('calibrateSent') : t('defaultsSent')}</p></div>
  {/if}

  {#if sendFailed}<p class="error block">{t('sendFailed')}</p>{/if}

  {#snippet footer()}
    {#if mode === 'settings'}
      {#if step === 'form'}
        <button class="btn primary block" onclick={() => (step = 'review')} disabled={!connected || !valid || !changes.length}>{changes.length ? t('reviewChanges', { n: changes.length }) : t('noChanges')}</button>
      {:else if step === 'review'}
        <div class="buttons">
          <button class="btn" onclick={() => (step = 'form')}>{t('back')}</button>
          <button class="btn danger" onclick={send} disabled={!connected}>{t('sendToKmd')}</button>
        </div>
      {:else}
        <button class="btn primary block" onclick={close}>{t('done')}</button>
      {/if}
    {:else if step === 'start'}
      <div class="buttons">
        <button class="btn" onclick={close}>{t('cancel')}</button>
        <button class="btn primary" onclick={() => (step = 'confirm')} disabled={!connected}>{t('continue')}</button>
      </div>
    {:else if step === 'confirm'}
      <div class="buttons">
        <button class="btn" onclick={close}>{t('cancel')}</button>
        <button class="btn danger" onclick={runCommand} disabled={!connected}>{mode === 'calibrate' ? t('calibrateYes') : t('defaultsYes')}</button>
      </div>
    {:else}
      <button class="btn primary block" onclick={close}>{t('done')}</button>
    {/if}
  {/snippet}
</Sheet>

<style>
  .center {
    text-align: center;
    padding: 20px 0;
  }
  /* Notices: a rule on the left, amber when it is a warning */
  .notice {
    display: flex;
    gap: 12px;
    margin-bottom: 20px;
    padding: 2px 0 2px 14px;
    border-left: 2px solid var(--text-1);
    color: var(--text-2);
  }
  .notice.warn {
    border-left-color: var(--warning);
  }
  .notice :global(svg) {
    flex: none;
    margin-top: 1px;
  }
  .notice.warn :global(svg) {
    color: var(--warning-ink);
  }
  .notice p {
    margin: 0;
    font: 14px/1.45 var(--font);
    color: var(--text-1);
  }
  .error {
    font: 13px var(--font);
    color: var(--critical);
  }
  .error.block {
    display: block;
    margin: 8px 0 0;
  }
  .changed {
    font: 13px var(--font);
    color: var(--text-2);
  }
  .inline {
    margin: 4px 2px 0;
  }
  .steps {
    margin: 0 0 18px;
    padding-left: 20px;
    font: 15px/1.55 var(--font);
    color: var(--text-2);
  }
  .steps li + li {
    margin-top: 6px;
  }
  .done {
    display: grid;
    justify-items: center;
    gap: 8px;
    padding: 24px 12px;
    color: var(--good);
    text-align: center;
  }
  .done p {
    margin: 0;
    font: 400 18px/1.45 var(--font);
    color: var(--text-1);
  }
  .buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
</style>
