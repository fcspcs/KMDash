<script>
  import Sheet from '../components/Sheet.svelte';
  import NotePicker from '../components/NotePicker.svelte';
  import { NOTES } from '../lib/notes.js';
  import { defaultLastDamperKey } from '../lib/store.js';
  import { t } from '../lib/i18n.js';

  let { app, created = false } = $props();

  // svelte-ignore state_referenced_locally
  const inst = app.instrument;
  // svelte-ignore state_referenced_locally
  let name = $state(created ? '' : inst.name);
  let numKeys = $state(String(inst.numKeys));
  let startNote = $state(inst.startNote);
  let lastDamper = $state(inst.lastDamperKey ?? defaultLastDamperKey(inst.numKeys));
  let customDamper = $state(inst.lastDamperKey != null);
  // Job data for the report; the technician is taken over from the last piano
  let client = $state(inst.info?.client ?? '');
  let place = $state(inst.info?.place ?? '');
  let serial = $state(inst.info?.serial ?? '');
  // svelte-ignore state_referenced_locally
  let technician = $state(inst.info?.technician || app.prefs.technician || '');

  const keys = $derived(Math.min(108, Math.max(1, Math.round(Number(numKeys)) || 88)));
  const validKeys = $derived(Number.isFinite(Number(numKeys)) && Number(numKeys) >= 1 && Number(numKeys) <= 108);

  const close = () => (app.sheet = null);

  function save() {
    app.editInstrument({
      name: name.trim() || inst.name || t('unnamed'),
      numKeys: keys,
      startNote: Number(startNote),
      lastDamperKey: customDamper ? Math.min(lastDamper, keys) : null,
      info: { client: client.trim(), place: place.trim(), serial: serial.trim(), technician: technician.trim() },
    });
    if (technician.trim()) {
      app.prefs.technician = technician.trim();
      app.savePrefs();
    }
    close();
  }
</script>

<Sheet title={created ? t('newPiano') : t('editPiano')} onclose={close}>
  <label class="field">
    <span>{t('pianoName')}</span>
    <input class="input" bind:value={name} maxlength="40" placeholder={t('pianoNamePlaceholder')} />
  </label>
  <div class="two">
    <label class="field">
      <span>{t('numKeys')}</span>
      <input class="input" type="number" inputmode="numeric" min="1" max="108" bind:value={numKeys} />
    </label>
    <label class="field">
      <span>{t('startNote')}</span>
      <select class="input" bind:value={startNote}>
        {#each NOTES as n, i}<option value={i}>{n}</option>{/each}
      </select>
    </label>
  </div>
  {#if !validKeys}<p class="error">{t('numKeysInvalid')}</p>{/if}
  <label class="field">
    <span>{t('lastDamper')}</span>
    <select class="input" bind:value={customDamper}>
      <option value={false}>{t('lastDamperAuto')}</option>
      <option value={true}>{t('lastDamperCustom')}</option>
    </select>
  </label>
  {#if customDamper}
    <div class="field"><NotePicker bind:value={lastDamper} numKeys={keys} startNote={Number(startNote)} label={t('lastDamper')} /></div>
  {/if}
  <p class="list-note inline">{t('lastDamperNote')}</p>

  <h3 class="part">{t('jobData')}</h3>
  <label class="field">
    <span>{t('clientName')}</span>
    <input class="input" bind:value={client} maxlength="60" autocomplete="off" />
  </label>
  <label class="field">
    <span>{t('place')}</span>
    <input class="input" bind:value={place} maxlength="80" placeholder={t('placePlaceholder')} autocomplete="off" />
  </label>
  <div class="two">
    <label class="field">
      <span>{t('serialNumber')}</span>
      <input class="input" bind:value={serial} maxlength="30" autocomplete="off" />
    </label>
    <label class="field">
      <span>{t('technician')}</span>
      <input class="input" bind:value={technician} maxlength="40" autocomplete="off" />
    </label>
  </div>
  {#snippet footer()}
    <button class="btn primary block" onclick={save} disabled={!validKeys}>{t('save')}</button>
  {/snippet}
</Sheet>

<style>
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .error {
    margin: -6px 0 12px;
    font: 13px var(--font);
    color: var(--critical);
  }
  .inline {
    margin: 0;
    padding: 0 2px;
  }
  .part {
    margin: 28px 0 14px;
    padding-top: 16px;
    border-top: 1px solid var(--rule);
    font: var(--w-figure) 18px/1.3 var(--font);
    color: var(--text-1);
  }
</style>
