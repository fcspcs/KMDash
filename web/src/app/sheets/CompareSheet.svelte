<script>
  import Sheet from '../components/Sheet.svelte';
  import Icon from '../components/Icon.svelte';
  import { fmtDate } from '../lib/format.js';
  import { measuredCount } from '../lib/store.js';
  import { t } from '../lib/i18n.js';

  let { app } = $props();
  const others = $derived([...app.instrument.runs].reverse().filter((r) => r.id !== app.run.id));
  const close = () => (app.sheet = null);

  function pick(id) {
    app.compareId = id;
    close();
  }
</script>

<Sheet title={t('compareWith')} onclose={close}>
  <p class="prose">{t('compareIntro', { title: app.run.title })}</p>
  <ul class="list">
    <li>
      <button class="row" onclick={() => pick(null)}>
        <span class="grow">{t('compareNone')}</span>
        {#if !app.compareRun}<Icon name="check" size={18} />{/if}
      </button>
    </li>
    {#each others as r (r.id)}
      <li>
        <button class="row" onclick={() => pick(r.id)}>
          <span class="grow">{r.title}<span class="sub">{fmtDate(r.createdAt)} · {t('measuredOf', { n: measuredCount(r, app.instrument.numKeys), total: app.instrument.numKeys })}</span></span>
          {#if app.compareRun?.id === r.id}<Icon name="check" size={18} />{/if}
        </button>
      </li>
    {/each}
  </ul>
</Sheet>
