<script>
  import Icon from './Icon.svelte';
  import { t } from '../lib/i18n.js';

  let { title, onclose, children, footer } = $props();
  let startY = 0;
  let dragY = $state(0);

  function onKey(event) {
    if (event.key === 'Escape') onclose();
  }
  // Dragging down closes the sheet, like on iOS
  const touchStart = (event) => (startY = event.touches[0].clientY);
  const touchMove = (event) => (dragY = Math.max(0, event.touches[0].clientY - startY));
  function touchEnd() {
    if (dragY > 90) onclose();
    dragY = 0;
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="backdrop" onclick={onclose} role="presentation"></div>
<div class="sheet" role="dialog" aria-modal="true" aria-label={title} style="transform: translateY({dragY}px)" class:dragging={dragY > 0}>
  <!-- Dragging down closes the sheet. Keyboard users have Escape and the close button -->
  <header role="presentation" ontouchstart={touchStart} ontouchmove={touchMove} ontouchend={touchEnd}>
    <span class="grabber"></span>
    <h2>{title}</h2>
    <button class="close" onclick={onclose} aria-label={t('close')}><Icon name="close" size={20} stroke={1.4} /></button>
  </header>
  <div class="body">{@render children()}</div>
  {#if footer}<footer>{@render footer()}</footer>{/if}
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: rgb(10 10 9 / 0.38);
    animation: fade 0.2s ease-out;
  }
  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 41;
    display: flex;
    flex-direction: column;
    max-height: calc(100dvh - 44px - env(safe-area-inset-top));
    margin: 0 auto;
    max-width: 640px;
    border-radius: 12px 12px 0 0;
    background: var(--bg);
    box-shadow: 0 -12px 48px rgb(0 0 0 / 0.2);
    animation: rise 0.34s cubic-bezier(0.2, 0.9, 0.3, 1);
    transition: transform 0.25s ease-out;
  }
  .sheet.dragging {
    transition: none;
  }
  header {
    position: relative;
    padding: 26px 64px 14px 20px;
    border-bottom: 1px solid var(--border);
    touch-action: none;
  }
  .grabber {
    position: absolute;
    top: 8px;
    left: 50%;
    width: 32px;
    height: 3px;
    margin-left: -16px;
    border-radius: 2px;
    background: var(--text-4);
  }
  h2 {
    margin: 0;
    font: 500 22px/1.2 var(--font);
    letter-spacing: -0.005em;
  }
  .close {
    position: absolute;
    top: 18px;
    right: 10px;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 2px;
    background: none;
    color: var(--text-2);
  }
  .body {
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 18px 20px 20px;
  }
  footer {
    padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--border);
    background: var(--bg);
  }
  .body:last-child {
    padding-bottom: calc(28px + env(safe-area-inset-bottom));
  }

  /* Desktop: a centered dialog instead of a sheet from the bottom */
  @media (min-width: 960px) {
    .sheet {
      top: 50%;
      left: 50%;
      right: auto;
      bottom: auto;
      width: min(580px, calc(100vw - 64px));
      max-height: min(86vh, 880px);
      border-radius: 4px;
      translate: -50% -50%;
      box-shadow: 0 30px 90px rgb(0 0 0 / 0.26), 0 0 0 1px var(--border);
      animation: pop 0.2s ease-out;
    }
    .grabber {
      display: none;
    }
    header {
      padding: 24px 64px 14px 28px;
    }
    .body {
      padding: 20px 28px 24px;
    }
    footer {
      padding: 14px 28px;
      border-radius: 0 0 4px 4px;
    }
    .body:last-child {
      padding-bottom: 28px;
    }
  }
  @media (hover: hover) {
    .close:hover {
      background: var(--fill-1);
      color: var(--text-1);
    }
  }
  @keyframes pop {
    from {
      opacity: 0;
      transform: scale(0.98);
    }
  }
  @keyframes rise {
    from {
      transform: translateY(100%);
    }
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
</style>
