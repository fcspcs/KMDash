<script>
  import Sheet from '../components/Sheet.svelte';
  import { t } from '../lib/i18n.js';

  let { app, title, message, confirmLabel, cancelLabel, danger = false, onconfirm } = $props();

  const close = () => (app.sheet = null);
  // Take the action first: the props come from app.sheet, which close() clears
  function confirm() {
    const action = onconfirm;
    close();
    action?.();
  }
</script>

<Sheet {title} onclose={close}>
  <p class="prose">{message}</p>
  {#snippet footer()}
    <div class="buttons">
      <button class="btn" onclick={close}>{cancelLabel ?? t('cancel')}</button>
      <button class="btn" class:danger class:primary={!danger} onclick={confirm}>{confirmLabel ?? t('ok')}</button>
    </div>
  {/snippet}
</Sheet>

<style>
  .buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
</style>
