<script>
  // Help for KMDash on the website (direct mode): what the browser needs to reach the KMD
  import Sheet from '../components/Sheet.svelte';
  import { browserSupport, localNetworkPermission } from '../lib/direct.js';
  import { t } from '../lib/i18n.js';

  let { app } = $props();
  const close = () => (app.sheet = null);

  const support = browserSupport();
  let permission = $state(null);

  $effect(() => {
    let status;
    const update = () => (permission = status.state);
    localNetworkPermission().then((result) => {
      status = result;
      if (!status) return;
      update();
      status.addEventListener('change', update);
    });
    return () => status?.removeEventListener('change', update);
  });

  function retry() {
    app.source.reconnect();
    close();
  }
</script>

<Sheet title={t('connectTitle')} onclose={close}>
  {#if support !== 'ok'}
    <p class="notice">{t(support === 'update' ? 'connectUpdate' : 'connectBrowser')}</p>
  {/if}
  <ol class="steps">
    <li>{t('connectStep1')}</li>
    <li>{t('connectStep2')}</li>
    <li>{t('connectStep3')}</li>
  </ol>
  <!-- The permission only matters where the browser can reach the KMD at all -->
  {#if permission && support === 'ok'}
    <ul class="list">
      <li class="row">
        <span class="grow">{t('localNetwork')}</span>
        <span class="value" class:blocked={permission === 'denied'}>{t(`perm_${permission}`)}</span>
      </li>
    </ul>
    {#if permission === 'denied'}<p class="list-note">{t('connectBlocked')}</p>{/if}
  {/if}
  <p class="guide"><a href="/#install" target="_blank" rel="noopener">{t('connectGuide')}</a></p>

  {#snippet footer()}
    <button class="btn primary block" onclick={retry} disabled={support !== 'ok'}>{t('tryAgain')}</button>
  {/snippet}
</Sheet>

<style>
  .notice {
    margin: 0 0 20px;
    padding: 12px 14px;
    border-left: 2px solid var(--warning);
    background: var(--warning-wash);
    font: 15px/1.45 var(--font);
  }
  .steps {
    margin: 0 0 24px;
    padding-left: 22px;
    font: 15px/1.55 var(--font);
    color: var(--text-2);
  }
  .steps li + li {
    margin-top: 10px;
  }
  .blocked {
    color: var(--critical);
  }
  .guide {
    margin: 0;
    font: 15px var(--font);
  }
  .guide a {
    color: var(--text-1);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
  }
</style>
