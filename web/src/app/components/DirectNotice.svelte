<script>
  // Direct mode (website): a line under the header when the KMD cannot be reached, with a way to the help
  import Icon from './Icon.svelte';
  import { browserSupport, localNetworkPermission } from '../lib/direct.js';
  import { t } from '../lib/i18n.js';

  let { app } = $props();

  const support = browserSupport();
  let permission = $state(null);
  // Only after a few seconds without a connection, so connecting normally never flashes a warning.
  // Counted from losing the connection: the retries in between (connecting, offline) do not restart it.
  const connected = $derived(app.status === 'connected');
  let waited = $state(false);

  $effect(() => {
    if (connected) {
      waited = false;
      return;
    }
    const timer = setTimeout(() => (waited = true), 4000);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    let status;
    const update = () => {
      permission = status.state;
      if (permission === 'granted' && !connected) app.source.reconnect();
    };
    localNetworkPermission().then((result) => {
      status = result;
      if (!status) return;
      permission = status.state;
      status.addEventListener('change', update);
    });
    return () => status?.removeEventListener('change', update);
  });

  const message = $derived(
    support !== 'ok' ? `direct_${support}` : permission === 'denied' ? 'direct_blocked' : waited && !connected ? 'direct_offline' : null,
  );
</script>

{#if message}
  <div class="notice" role="status">
    <Icon name="warn" size={16} />
    <span class="grow">{t(message)}</span>
    <button onclick={() => (app.sheet = { type: 'connect' })}>{t('direct_help')}</button>
  </div>
{/if}

<style>
  .notice {
    grid-area: banner;
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 6px 12px 6px 20px;
    border-bottom: 1px solid var(--warning-edge);
    background: var(--warning-wash);
    font: 13px/1.4 var(--font);
  }
  .notice :global(svg) {
    flex: none;
    color: var(--warning-ink);
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  button {
    flex: none;
    min-height: 44px;
    padding: 0 8px;
    border: 0;
    background: none;
    color: var(--text-1);
    font: 600 13px var(--font);
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  @media (min-width: 960px) {
    .notice {
      padding: 6px 16px 6px 24px;
      border-right: 1px solid var(--border);
    }
  }
</style>
