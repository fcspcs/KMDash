<script>
  import Sheet from '../components/Sheet.svelte';
  import Segmented from '../components/Segmented.svelte';
  import NotePicker from '../components/NotePicker.svelte';
  import Icon from '../components/Icon.svelte';
  import { ORDERS, orderKeys, keyRange } from '../lib/session.js';
  import { t } from '../lib/i18n.js';

  let { app } = $props();

  // svelte-ignore state_referenced_locally
  const inst = app.instrument;
  // svelte-ignore state_referenced_locally
  const warned = Object.values(app.analysis.keys).filter((e) => e.level === 'warn').map((e) => e.key);
  let scope = $state('all');
  let from = $state(1);
  let to = $state(inst.numKeys);
  // svelte-ignore state_referenced_locally
  let perKey = $state(app.prefs.perKey);
  // svelte-ignore state_referenced_locally
  let valueMode = $state(app.prefs.valueMode);
  // svelte-ignore state_referenced_locally
  let order = $state(ORDERS.includes(app.prefs.sessionOrder) ? app.prefs.sessionOrder : 'chromatic');
  // svelte-ignore state_referenced_locally
  let rounds = $state(!!app.prefs.sessionRounds);

  // The keys of the series in the order they come up
  const keys = $derived.by(() => {
    const list = scope === 'warned' ? warned : keyRange(from, to).filter((k) => scope !== 'missing' || !app.run.keys[k]);
    return orderKeys(list, order, inst.startNote);
  });
  const count = $derived(keys.length);

  const close = () => (app.sheet = null);

  function start() {
    app.prefs.perKey = perKey;
    app.prefs.valueMode = valueMode;
    app.prefs.sessionOrder = order;
    app.prefs.sessionRounds = rounds;
    app.savePrefs();
    const ok = app.startSession({ keys, perKey, rounds });
    if (!ok) return app.notify(t('nothingToMeasure'));
    close();
  }
</script>

<Sheet title={t('guidedTitle')} onclose={close}>
  <p class="prose">{t('guidedIntro')}</p>

  <div class="field">
    <span>{t('guidedKeys')}</span>
    <Segmented
      label={t('guidedKeys')}
      value={scope}
      options={[
        { value: 'all', label: t('scopeAll') },
        { value: 'missing', label: t('scopeMissing') },
        ...(warned.length ? [{ value: 'warned', label: t('scopeWarned') }] : []),
      ]}
      onchange={(v) => (scope = v)}
    />
  </div>

  {#if scope !== 'warned'}
    <div class="range">
      <label class="field"><span>{t('fromKey')}</span><NotePicker bind:value={from} numKeys={inst.numKeys} startNote={inst.startNote} label={t('fromKey')} /></label>
      <button class="swap" onclick={() => ([from, to] = [to, from])} aria-label={t('swap')}><Icon name="compare" size={18} /></button>
      <label class="field"><span>{t('toKey')}</span><NotePicker bind:value={to} numKeys={inst.numKeys} startNote={inst.startNote} label={t('toKey')} /></label>
    </div>
  {/if}

  <label class="field">
    <span>{t('order')}</span>
    <select class="input" bind:value={order}>
      {#each ORDERS as o}<option value={o}>{t(`order_${o}`)}</option>{/each}
    </select>
  </label>

  <div class="field">
    <span>{t('perKey')}</span>
    <Segmented label={t('perKey')} value={perKey} options={[1, 2, 3].map((n) => ({ value: n, label: t('perKeyN', { n }) }))} onchange={(v) => (perKey = v)} />
  </div>
  {#if perKey > 1}
    <div class="field">
      <span>{t('repeatMode')}</span>
      <Segmented label={t('repeatMode')} value={rounds ? 'rounds' : 'key'} options={[{ value: 'key', label: t('repeatKey') }, { value: 'rounds', label: t('repeatRounds') }]} onchange={(v) => (rounds = v === 'rounds')} />
    </div>
    <p class="list-note inline gap">{t('repeatNote', { n: perKey })}</p>
    <div class="field">
      <span>{t('valueMode')}</span>
      <Segmented label={t('valueMode')} value={valueMode} options={[{ value: 'last', label: t('valueLast') }, { value: 'median', label: t('valueMedian') }]} onchange={(v) => (valueMode = v)} />
    </div>
    <p class="list-note inline">{t('perKeyNote')}</p>
  {/if}

  {#snippet footer()}
    <button class="btn primary block" onclick={start} disabled={!count}><Icon name="play" size={16} />{t('startGuided', { n: count })}</button>
  {/snippet}
</Sheet>

<style>
  .range {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: end;
    gap: 8px;
  }
  .swap {
    display: grid;
    place-items: center;
    width: 44px;
    height: 46px;
    margin-bottom: 14px;
    border: 1px solid var(--border);
    border-radius: 2px;
    background: none;
    color: var(--text-1);
  }
  .inline {
    margin: -4px 2px 8px;
  }
  .gap {
    margin-bottom: 20px;
  }
</style>
