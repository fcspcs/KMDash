<script>
  import Icon from './Icon.svelte';
  import { hintTitle as title, hintDetail as detail } from '../lib/hints.js';
  import { t } from '../lib/i18n.js';

  // Hints as a plain list: title only, the explanation shows on tap.
  // limit: how many are visible, the rest sits behind "more". compact: title only, no frame (for lists).
  let { hints, compact = false, limit = Infinity } = $props();
  let open = $state(null);
  let all = $state(false);
  const shown = $derived(all ? hints : hints.slice(0, limit));
</script>

{#if hints.length}
  <ul class:compact>
    {#each shown as hint, i (hint.id + (hint.vars.metric ?? '') + (hint.vars.status ?? '') + i)}
      <li class={hint.level}>
        {#if compact}
          <span class="hint-icon"><Icon name={hint.level === 'warn' ? 'warn' : 'info'} size={16} /></span>
          <strong>{title(hint)}</strong>
        {:else}
          <button class="hint" aria-expanded={open === i} onclick={() => (open = open === i ? null : i)}>
            <span class="hint-icon"><Icon name={hint.level === 'warn' ? 'warn' : 'info'} size={18} stroke={1.5} /></span>
            <span class="text">
              <strong>{title(hint)}</strong>
              {#if open === i}<span class="detail">{detail(hint)}</span>{/if}
            </span>
            <span class="chevron" class:up={open === i}><Icon name="down" size={16} stroke={1.5} /></span>
          </button>
        {/if}
      </li>
    {/each}
    {#if !compact && hints.length > shown.length}
      <li><button class="more" onclick={() => (all = true)}>{t('moreHints', { n: hints.length - shown.length })}</button></li>
    {/if}
  </ul>
{/if}

<style>
  /* Hints between hairlines. Warnings carry an amber mark, the text stays in ink */
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }
  li + li {
    border-top: 1px solid var(--border);
  }
  .hint {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
    min-height: 48px;
    padding: 13px 0;
    border: 0;
    background: none;
    color: var(--text-1);
    text-align: left;
  }
  .warn .hint::before {
    content: '';
    position: absolute;
    left: -20px;
    top: 12px;
    bottom: 12px;
    width: 2px;
    background: var(--warning);
  }
  .hint:active {
    background: var(--fill-1);
  }
  .hint-icon {
    flex: none;
    display: grid;
    margin-top: 1px;
    color: var(--text-3);
  }
  .warn .hint-icon {
    color: var(--warning-ink);
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  strong {
    display: block;
    font: 500 15px/1.4 var(--font);
    color: var(--text-1);
  }
  .detail {
    display: block;
    margin-top: 6px;
    font: 14px/1.55 var(--font);
    color: var(--text-2);
  }
  .chevron {
    flex: none;
    margin-top: 2px;
    color: var(--text-3);
    transition: transform 0.2s;
  }
  .chevron.up {
    transform: rotate(180deg);
  }
  .more {
    width: 100%;
    min-height: 44px;
    border: 0;
    background: none;
    color: var(--text-1);
    font: 600 11px var(--font);
    text-transform: uppercase;
    letter-spacing: 0.07em;
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  @media (hover: hover) {
    .hint:hover strong {
      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-underline-offset: 3px;
    }
  }
  .compact {
    border: 0;
  }
  .compact li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
    border: 0;
  }
  .compact .hint-icon {
    margin: 0;
  }
  .compact strong {
    overflow: hidden;
    font: 15px/1.35 var(--font);
    white-space: nowrap;
    text-overflow: ellipsis;
  }
</style>
