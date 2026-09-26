<script>
  import Sheet from '../components/Sheet.svelte';
  import HintList from '../components/HintList.svelte';
  import Icon from '../components/Icon.svelte';
  import { noteName } from '../lib/notes.js';
  import { t } from '../lib/i18n.js';

  let { app } = $props();

  const session = $derived(app.session);
  const inst = $derived(app.instrument);
  const keys = $derived([...new Set(session?.keys ?? [])]); // in rounds a key comes up more than once
  const measured = $derived(keys.filter((k) => session?.taken[k]));
  // Skipped = deliberately moved past, open = not reached yet
  const skipped = $derived(keys.filter((k) => !session?.taken[k] && session?.skipped.includes(k)));
  const open = $derived(keys.filter((k) => !session?.taken[k] && !session?.skipped.includes(k)));
  const warned = $derived(measured.filter((k) => app.analysis.keys[k]?.level === 'warn'));
  const done = $derived(session && session.index >= session.keys.length);
  const minutes = $derived(session?.startedAt ? Math.max(1, Math.round((Date.now() - session.startedAt) / 60000)) : null);

  function finish() {
    app.endSession();
    app.sheet = null;
    app.view = 'overview';
  }

  function remeasure(list) {
    app.endSession();
    app.startSession({ keys: list });
    app.sheet = null;
  }

  function resume() {
    app.sheet = null;
  }
</script>

<Sheet title={done ? t('summaryTitle') : t('summaryPaused')} onclose={done ? finish : resume}>
  <section class="stats">
    <div><b>{measured.length}</b><span>{t('summaryMeasured')}</span></div>
    <div><b class:warn={warned.length}>{warned.length}</b><span>{t('warnings')}</span></div>
    {#if skipped.length}<div><b>{skipped.length}</b><span>{t('summarySkipped')}</span></div>{/if}
    {#if open.length}<div><b>{open.length}</b><span>{t('summaryOpen')}</span></div>{/if}
    {#if minutes}<div><b>{minutes}</b><span>{minutes === 1 ? t('summaryMinute') : t('summaryMinutes')}</span></div>{/if}
  </section>

  {#if app.analysis.global.length}
    <h3 class="list-title">{t('keyboardHints')}</h3>
    <div class="hints"><HintList hints={app.analysis.global} /></div>
  {/if}

  {#if warned.length}
    <h3 class="list-title">{t('summaryWarned')}</h3>
    <ul class="list">
      {#each warned as k (k)}
        <li>
          <button class="row" onclick={() => { app.select(k); app.sheet = null; }}>
            <span class="key"><b>{noteName(k, inst.startNote)}</b><small>{k}</small></span>
            <span class="grow"><HintList hints={app.analysis.keys[k].hints.filter((h) => h.level === 'warn').slice(0, 1)} compact /></span>
            <Icon name="right" size={16} />
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#snippet footer()}
    <div class="buttons">
      {#if !done}<button class="btn block" onclick={resume}>{t('summaryResume')}</button>{/if}
      {#if warned.length}<button class="btn block" onclick={() => remeasure(warned)}><Icon name="repeat" size={16} />{t('remeasureWarned', { n: warned.length })}</button>{/if}
      {#if skipped.length && done}<button class="btn block" onclick={() => remeasure(skipped)}><Icon name="repeat" size={16} />{t('measureSkipped', { n: skipped.length })}</button>{/if}
      <button class="btn primary block" onclick={finish}>{t('summaryFinish')}</button>
    </div>
  {/snippet}
</Sheet>

<style>
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 16px 32px;
    margin: 0 0 28px;
  }
  .stats div {
    display: grid;
  }
  .stats b {
    font: var(--w-figure) 40px/1 var(--font);
  }
  .stats b.warn {
    color: var(--warning-ink);
  }
  .stats span {
    margin-top: 6px;
    font: 600 11px var(--font);
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .hints {
    margin-bottom: 20px;
  }
  .key {
    display: grid;
    min-width: 44px;
    line-height: 1.1;
  }
  .key b {
    font: 600 16px/1 var(--font);
  }
  .key small {
    font-size: 11px;
    color: var(--text-3);
  }
  .row :global(ul li) {
    padding: 0;
    background: none;
    box-shadow: none;
  }
  .buttons {
    display: grid;
    gap: 8px;
  }
</style>
