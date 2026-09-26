<script>
  import { untrack } from 'svelte';
  import Sheet from '../components/Sheet.svelte';
  import Toggle from '../components/Toggle.svelte';
  import NumberField from '../components/NumberField.svelte';
  import { HINT_GROUPS } from '../lib/labels.js';
  import { THRESHOLDS, thresholds, validThreshold } from '../lib/limits.js';
  import { fmtTick } from '../lib/format.js';
  import { t } from '../lib/i18n.js';

  let { app } = $props();
  const close = () => (app.sheet = null);

  function set(group, on) {
    app.prefs.hints[group] = on;
    app.savePrefs();
  }

  // Only changed thresholds are stored; a value outside its range stays in the field and is not used
  let draft = $state({ ...untrack(() => app.thresholds) });
  let invalid = $state({});
  let resets = $state(0);
  const changed = $derived(Object.keys(app.prefs.limits ?? {}).length > 0);

  function setThreshold(th, value) {
    invalid[th.id] = !validThreshold(th.id, value);
    if (invalid[th.id]) return;
    const limits = { ...(app.prefs.limits ?? {}) };
    if (value === th.def) delete limits[th.id];
    else limits[th.id] = value;
    app.prefs.limits = limits;
    app.savePrefs();
  }

  function reset() {
    app.prefs.limits = {};
    app.savePrefs();
    draft = thresholds();
    invalid = {};
    resets += 1;
  }

  const groupVars = $derived({
    min: fmtTick(app.thresholds.upweightMin),
    warn: fmtTick(Math.max(0, app.thresholds.upweightMin - app.thresholds.upweightWarnBelow)),
  });
</script>

<Sheet title={t('hints')} onclose={close}>
  <p class="prose">{t('hintsIntro')}</p>
  <ul class="list">
    {#each HINT_GROUPS as group}
      <li class="row">
        <span class="grow">{t(`group_${group}`)}<span class="sub">{t(`group_${group}_sub`, groupVars)}</span></span>
        <Toggle label={t(`group_${group}`)} checked={app.prefs.hints[group] !== false} onchange={(v) => set(group, v)} />
      </li>
    {/each}
  </ul>

  <h3 class="list-title">{t('thresholds')}</h3>
  {#key resets}
    <ul class="list">
      {#each THRESHOLDS as th (th.id)}
        <li class="row threshold">
          <span class="grow">
            {t(`th_${th.id}`)}
            {#if invalid[th.id]}
              <span class="sub error">{t('thresholdInvalid', { min: fmtTick(th.min), max: fmtTick(th.max), unit: th.unit })}</span>
            {:else}
              <span class="sub">{t(`th_${th.id}_sub`)}</span>
            {/if}
          </span>
          <span class="number"><NumberField bind:value={draft[th.id]} unit={th.unit} label={t(`th_${th.id}`)} onchange={(v) => setThreshold(th, v)} /></span>
        </li>
      {/each}
    </ul>
  {/key}
  <p class="list-note">{t('thresholdsIntro')}</p>
  <button class="btn block" onclick={reset} disabled={!changed}>{t('thresholdsReset')}</button>
</Sheet>

<style>
  .number {
    flex: none;
    width: 108px;
  }
  .sub.error {
    color: var(--critical);
  }
</style>
