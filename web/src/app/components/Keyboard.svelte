<script>
  import { isBlack, noteName } from '../lib/notes.js';
  import { t } from '../lib/i18n.js';

  // marks: markers on the keys, mapMarks: state in the strip below (measured, hint, warning)
  let { numKeys, startNote, current, target, marks = {}, mapMarks = marks, waiting = false, onselect } = $props();

  // Key widths: 34 px and scrolling on a phone, the whole keyboard when there is room (desktop)
  let avail = $state(0);
  const whites = $derived(Array.from({ length: numKeys }, (_, i) => i + 1).filter((key) => !isBlack(key, startNote)).length);
  const pad = $derived(avail > 700 ? 32 : 16);
  const W = $derived.by(() => {
    const fit = (avail - 2 * pad) / whites;
    return fit >= 16 ? Math.min(34, fit) : 34;
  });
  const fits = $derived(whites * W <= avail - 2 * pad + 0.5);
  const BW = $derived(Math.round(W * 0.64));

  const layout = $derived.by(() => {
    const keys = [];
    let white = 0;
    for (let key = 1; key <= numKeys; key++) {
      const black = isBlack(key, startNote);
      const name = noteName(key, startNote);
      if (black) keys.push({ key, black, x: Math.max(0, white * W - BW / 2), name });
      else keys.push({ key, black, x: white++ * W, name, label: name.startsWith('C') && !name.includes('#') ? name : null });
    }
    return { keys, width: white * W };
  });

  let scroller = $state();

  // Scroll the target key to the center whenever it changes
  $effect(() => {
    const k = layout.keys[target - 1];
    if (!scroller || !k) return;
    const center = k.x + (k.black ? BW : W) / 2;
    scroller.scrollTo({ left: center - scroller.clientWidth / 2, behavior: 'smooth' });
  });

  function mapPick(event) {
    const box = event.currentTarget.getBoundingClientRect();
    onselect(1 + Math.floor(((event.clientX - box.left) / box.width) * numKeys));
  }
</script>

<div class="keyboard" class:fits style="--pad: {pad}px">
  <div class="scroller" bind:this={scroller} bind:clientWidth={avail}>
    <div class="keys" style="width: {layout.width}px; --w: {W}px; --bw: {BW}px">
      {#each layout.keys as k (k.key)}
        <button
          class="key"
          class:black={k.black}
          class:target={k.key === target}
          class:current={k.key === current && k.key !== target}
          class:waiting={waiting && k.key === target}
          style="left: {k.x}px"
          aria-label="{t('key', { n: k.key })} · {k.name}"
          aria-current={k.key === current ? 'true' : undefined}
          onclick={() => onselect(k.key)}
        >
          {#if marks[k.key]}<span class="mark {marks[k.key]}"></span>{/if}
          {#if k.label}<span class="label">{k.label}</span>{/if}
        </button>
      {/each}
    </div>
  </div>
  <button class="map" onclick={mapPick} aria-label={t('keyMap')}>
    {#each { length: numKeys } as _, i}
      <span class="cell {mapMarks[i + 1] ?? ''}" class:on={i + 1 === target}></span>
    {/each}
  </button>
</div>

<style>
  .keyboard {
    padding: 4px 0 0;
  }
  .scroller {
    overflow-x: auto;
    scrollbar-width: none;
    padding: 0 var(--pad);
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 16px, #000 calc(100% - 16px), transparent);
    mask-image: linear-gradient(90deg, transparent, #000 16px, #000 calc(100% - 16px), transparent);
  }
  .fits .scroller {
    -webkit-mask-image: none;
    mask-image: none;
  }
  .scroller::-webkit-scrollbar {
    display: none;
  }
  .keys {
    position: relative;
    height: 100px;
    margin: 0 auto;
  }
  /* The red felt strip that runs along the back of the keys */
  .keys::before {
    content: '';
    position: absolute;
    z-index: 2;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--accent);
    opacity: 0.85;
    pointer-events: none;
  }
  .key {
    position: absolute;
    top: 0;
    width: var(--w);
    height: 100px;
    padding: 0;
    border: 0;
    border-radius: 0 0 3px 3px;
    background: var(--key-white);
    box-shadow: inset -1px 0 0 var(--key-edge), inset 0 -2px 0 var(--key-edge);
    transition: background 0.15s, transform 0.1s;
  }
  .key.black {
    z-index: 1;
    width: var(--bw);
    height: 60px;
    border-radius: 0 0 2px 2px;
    background: var(--key-black);
    box-shadow: inset 0 -4px 0 rgb(255 255 255 / 0.1);
  }
  .key:active {
    transform: translateY(1px);
  }
  @media (hover: hover) {
    .key:not(.target):not(.black):hover {
      background: color-mix(in srgb, var(--key-white) 90%, var(--accent));
    }
    .key.black:not(.target):hover {
      background: color-mix(in srgb, var(--key-black) 70%, var(--accent));
    }
  }
  .key.target,
  .key.black.target {
    background: var(--accent);
    box-shadow: inset -1px 0 0 rgb(0 0 0 / 0.15);
  }
  .key.current {
    box-shadow: inset 0 0 0 2px var(--accent);
  }
  .key.waiting::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 0 0 5px 5px;
    border: 2px solid var(--accent);
    animation: pulse 1.6s ease-out infinite;
  }
  .mark {
    position: absolute;
    left: 50%;
    bottom: 24px;
    width: 7px;
    height: 7px;
    margin-left: -3.5px;
    border-radius: 50%;
    background: var(--text-3);
    box-shadow: 0 0 0 2px var(--key-white);
  }
  .black .mark {
    bottom: 10px;
    box-shadow: 0 0 0 2px var(--key-black);
  }
  .mark.warn {
    background: var(--warning);
  }
  .target .mark {
    box-shadow: 0 0 0 2px var(--accent);
  }
  .label {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 7px;
    font: 600 9.5px/1 var(--font);
    letter-spacing: 0.04em;
    color: var(--text-3);
  }
  .target .label {
    color: #fff;
  }
  /* Below: one tick per key, measured in ink, warnings in amber */
  .map {
    display: flex;
    align-items: flex-end;
    gap: 1px;
    width: calc(100% - 2 * var(--pad));
    height: 26px;
    margin: 4px var(--pad) 0;
    padding: 8px 0;
    border: 0;
    background: none;
  }
  .cell {
    flex: 1;
    height: 6px;
    background: var(--fill-2);
    transition: height 0.2s;
  }
  .cell.ok,
  .cell.info {
    background: var(--text-2);
  }
  .cell.warn {
    background: var(--warning);
  }
  .cell.on {
    height: 10px;
    background: var(--accent);
  }
  @media (min-width: 960px) {
    .keyboard {
      padding-top: 20px;
    }
  }
  @keyframes pulse {
    from {
      opacity: 0.9;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(1.18);
    }
  }
</style>
