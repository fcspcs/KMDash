<script>
  import Sheet from '../components/Sheet.svelte';
  import Icon from '../components/Icon.svelte';
  import { fmtDate } from '../lib/format.js';
  import { measuredCount } from '../lib/store.js';
  import { t } from '../lib/i18n.js';

  // Quick switch from the header: run and piano
  let { app } = $props();

  const inst = $derived(app.instrument);
  const runs = $derived([...inst.runs].reverse());
  const others = $derived(app.instruments.filter((e) => e.id !== inst.id));
  const close = () => (app.sheet = null);

  function activate(id) {
    app.activateRun(id);
    close();
  }
  function openPiano(id) {
    app.openInstrument(id);
    close();
  }
  function newPiano() {
    app.newInstrument();
    app.sheet = { type: 'instrument', created: true };
  }
</script>

<Sheet title={inst.name} onclose={close}>
  <h3 class="list-title">{t('runs')}</h3>
  <ul class="list">
    {#each runs as r (r.id)}
      <li>
        <button class="row" onclick={() => activate(r.id)}>
          <span class="grow">{r.title}<span class="sub">{fmtDate(r.createdAt)} · {t('measuredOf', { n: measuredCount(r, inst.numKeys), total: inst.numKeys })}</span></span>
          {#if r.id === app.run.id}<Icon name="check" size={18} />{/if}
        </button>
      </li>
    {/each}
    <li><button class="row" onclick={() => (app.sheet = { type: 'run' })}><span class="icon"><Icon name="plus" size={18} /></span><span class="grow">{t('newRun')}</span></button></li>
  </ul>

  <h3 class="list-title">{t('otherPianos')}</h3>
  <ul class="list">
    {#each others as entry (entry.id)}
      <li>
        <button class="row" onclick={() => openPiano(entry.id)}>
          <span class="grow">{entry.name}<span class="sub">{t('pianoListSub', { runs: entry.runs ?? 1, n: entry.measured ?? 0, date: fmtDate(entry.updated) })}</span></span>
          <Icon name="right" size={16} />
        </button>
      </li>
    {/each}
    <li><button class="row" onclick={newPiano}><span class="icon"><Icon name="plus" size={18} /></span><span class="grow">{t('newPiano')}</span></button></li>
  </ul>

  {#snippet footer()}
    <button class="btn block" onclick={() => ((app.view = 'project'), close())}><Icon name="piano" size={16} />{t('pianoSettings')}</button>
  {/snippet}
</Sheet>
