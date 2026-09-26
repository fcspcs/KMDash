<script>
  import MeasureView from './views/MeasureView.svelte';
  import OverviewView from './views/OverviewView.svelte';
  import TableView from './views/TableView.svelte';
  import ProjectView from './views/ProjectView.svelte';
  import SessionSheet from './sheets/SessionSheet.svelte';
  import SummarySheet from './sheets/SummarySheet.svelte';
  import ProfileSheet from './sheets/ProfileSheet.svelte';
  import TargetsSheet from './sheets/TargetsSheet.svelte';
  import ProjectSheet from './sheets/ProjectSheet.svelte';
  import RunSheet from './sheets/RunSheet.svelte';
  import CompareSheet from './sheets/CompareSheet.svelte';
  import InstrumentSheet from './sheets/InstrumentSheet.svelte';
  import DeviceSheet from './sheets/DeviceSheet.svelte';
  import ConfirmSheet from './sheets/ConfirmSheet.svelte';
  import CalibrationSheet from './sheets/CalibrationSheet.svelte';
  import HintsSheet from './sheets/HintsSheet.svelte';
  import ExportSheet from './sheets/ExportSheet.svelte';
  import Icon from './components/Icon.svelte';
  import { unlockAudio } from './state.svelte.js';
  import { t } from './lib/i18n.js';
  import { loadFonts } from './fonts/fonts.js';

  loadFonts();

  let { app } = $props();

  const TABS = [
    { id: 'measure', icon: 'measure' },
    { id: 'overview', icon: 'overview' },
    { id: 'table', icon: 'table' },
    { id: 'project', icon: 'piano' },
  ];

  let content = $state();
  // svelte-ignore state_referenced_locally
  const demo = app.source.kind === 'demo';

  $effect(() => {
    app.view;
    content?.scrollTo({ top: 0 });
  });

  // Reads app.lang so the label follows a language change (it sits outside the {#key app.lang} block)
  // Focus rings only while navigating with the Tab key, never after a tap or a click
  let keyboard = $state(false);
  function onPointer() {
    keyboard = false;
    unlockAudio();
  }
  const onKey = (event) => event.key === 'Tab' && (keyboard = true);

  const statusLabel = $derived.by(() => (app.lang, demo ? t('statusDemo') : t(`status_${app.status}`)));
</script>

<svelte:window onpointerdown={onPointer} onkeydown={onKey} />

{#key app.lang}
  <div class="kmd-app" class:keyboard>
    <header class="topbar">
      <p class="wordmark" aria-hidden="true">KMD<span>ashboard</span></p>
      <button class="project-name" onclick={() => (app.sheet = { type: 'project' })} aria-label={t('switchPiano')}>
        <span class="names">
          <span class="name">{app.instrument.name}</span>
          <span class="run">{app.run.title}{app.compareRun ? ` · ${t('vsShort', { title: app.compareRun.title })}` : ''}</span>
        </span>
        <Icon name="down" size={16} stroke={1.5} />
      </button>
      <span class="status {demo ? 'demo' : app.status}" role="status"><i></i>{statusLabel}</span>
    </header>

    {#if !app.storageOk}
      <div class="banner" role="alert"><Icon name="warn" size={16} />{t('storageFull')}</div>
    {/if}

    <main class="content" bind:this={content}>
      {#if app.view === 'measure'}
        <MeasureView {app} />
      {:else if app.view === 'overview'}
        <OverviewView {app} />
      {:else if app.view === 'table'}
        <TableView {app} />
      {:else}
        <ProjectView {app} />
      {/if}
    </main>

    <nav class="tabbar" aria-label={t('navigation')}>
      {#each TABS as tab (tab.id)}
        <button class:active={app.view === tab.id} aria-current={app.view === tab.id ? 'page' : undefined} onclick={() => (app.view = tab.id)}>
          <Icon name={tab.icon} size={22} stroke={1.5} />
          <span>{t(`tab_${tab.id}`)}</span>
        </button>
      {/each}
    </nav>

    {#if app.toast}
      {#key app.toast.id}<div class="toast" role="status">{app.toast.text}</div>{/key}
    {/if}

    {#if app.sheet?.type === 'session'}<SessionSheet {app} />
    {:else if app.sheet?.type === 'summary'}<SummarySheet {app} />
    {:else if app.sheet?.type === 'profile'}<ProfileSheet {app} />
    {:else if app.sheet?.type === 'targets'}<TargetsSheet {app} />
    {:else if app.sheet?.type === 'project'}<ProjectSheet {app} />
    {:else if app.sheet?.type === 'run'}{#key app.sheet}<RunSheet {app} id={app.sheet.id} />{/key}
    {:else if app.sheet?.type === 'compare'}<CompareSheet {app} />
    {:else if app.sheet?.type === 'instrument'}<InstrumentSheet {app} created={app.sheet.created} />
    {:else if app.sheet?.type === 'device'}{#key app.sheet}<DeviceSheet {app} mode={app.sheet.mode} />{/key}
    {:else if app.sheet?.type === 'calibration'}<CalibrationSheet {app} />
    {:else if app.sheet?.type === 'hints'}<HintsSheet {app} />
    {:else if app.sheet?.type === 'export'}<ExportSheet {app} />
    {:else if app.sheet?.type === 'confirm'}{#key app.sheet}<ConfirmSheet {app} {...app.sheet} />{/key}
    {/if}
  </div>
{/key}

<style>
  /*
   * Ivory and ink: paper white, black type, hairlines instead of boxes.
   * One accent, the red of the felt strip above the keys, marks where you are.
   * Series colors only live in the charts.
   */
  .kmd-app {
    /* Weight of large figures and titles: never thin, they have to read from arm's length */
    --w-figure: 500;
    --font: 'KMDashboard Sans', -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', Roboto, sans-serif;
    --bg: #f6f5f0;
    --surface: #fbfaf7;
    --surface-raised: #ffffff;
    --text-1: #141414;
    --text-2: #55544f;
    --text-3: #6f6d66;
    --text-4: #b9b6ad;
    --grid: #e4e2da;
    --axis: #b9b6ad;
    --border: rgb(20 20 20 / 0.13);
    --rule: #141414;
    --fill-1: rgb(20 20 20 / 0.045);
    --fill-2: rgb(20 20 20 / 0.09);
    --accent: #b8322a;
    --accent-wash: rgb(184 50 42 / 0.08);
    /* Data series in validated order (dataviz): Down, Balance, Up; friction and key dip each get their own chart */
    --s-down: #2a78d6;
    --s-balance: #1baf7a;
    --s-up: #eb6834;
    --s-friction: #4a3aa7;
    --s-dip: #008300;
    --good: #2f7d4f;
    --warning: #d99a0b;
    --warning-ink: #8a5a00;
    --warning-wash: rgb(217 154 11 / 0.14);
    --warning-edge: rgb(217 154 11 / 0.5);
    --critical: #b8322a;
    --key-white: #fdfdfa;
    --key-black: #161616;
    --key-edge: rgb(20 20 20 / 0.2);

    position: fixed;
    inset: 0;
    display: grid;
    grid-template-rows: auto auto 1fr auto;
    /* Named rows: without the banner the tab bar must still sit in the last row, not in the stretching one */
    grid-template-areas: 'top' 'banner' 'content' 'nav';
    background: var(--bg);
    color: var(--text-1);
    font: 16px/1.4 var(--font);
    font-feature-settings: 'kern';
    -webkit-font-smoothing: antialiased;
    -webkit-tap-highlight-color: transparent;
    -webkit-text-size-adjust: 100%;
    color-scheme: light;
  }
  @media (prefers-color-scheme: dark) {
    .kmd-app {
      --bg: #0f0f0e;
      --surface: #181817;
      --surface-raised: #242422;
      --text-1: #f1efe8;
      --text-2: #b8b5ac;
      --text-3: #8f8d85;
      --text-4: #4a4945;
      --grid: #242422;
      --axis: #3a3936;
      --border: rgb(241 239 232 / 0.13);
      --rule: #f1efe8;
      --fill-1: rgb(241 239 232 / 0.06);
      --fill-2: rgb(241 239 232 / 0.12);
      --accent: #e2584c;
      --accent-wash: rgb(226 88 76 / 0.14);
      --s-down: #3987e5;
      --s-balance: #199e70;
      --s-up: #d95926;
      --s-friction: #9085e9;
      --s-dip: #0ca30c;
      --good: #4cad78;
      --warning: #f0b429;
      --warning-ink: #f0b429;
      --warning-wash: rgb(240 180 41 / 0.12);
      --warning-edge: rgb(240 180 41 / 0.4);
      --critical: #e2584c;
      --key-white: #e9e6de;
      --key-black: #0a0a0a;
      --key-edge: rgb(0 0 0 / 0.6);
      color-scheme: dark;
    }
  }
  :where(.kmd-app) :global(*) {
    box-sizing: border-box;
  }
  :where(.kmd-app) :global(button) {
    font-family: var(--font);
    cursor: pointer;
    touch-action: manipulation;
    -webkit-user-select: none;
    user-select: none;
  }
  :where(.kmd-app) :global(input),
  :where(.kmd-app) :global(select),
  :where(.kmd-app) :global(textarea) {
    font: 16px var(--font);
    color: var(--text-1);
  }
  :where(.kmd-app) :global(:focus) {
    outline: none;
  }
  :where(.kmd-app.keyboard) :global(:focus-visible) {
    outline: 2px solid var(--text-1);
    outline-offset: 2px;
  }

  /* Shared building blocks for views and sheets */

  /* Buttons: outlined by default, solid ink for the one main action */
  :where(.kmd-app) :global(.btn) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    padding: 0 18px;
    border: 1px solid var(--text-1);
    border-radius: 2px;
    background: transparent;
    color: var(--text-1);
    font: 500 15px/1 var(--font);
    letter-spacing: 0.01em;
    transition: background 0.15s, color 0.15s, transform 0.1s;
  }
  :where(.kmd-app) :global(.btn.primary) {
    background: var(--text-1);
    color: var(--bg);
  }
  :where(.kmd-app) :global(.btn.danger) {
    border-color: var(--critical);
    background: var(--critical);
    color: #fff;
  }
  :where(.kmd-app) :global(.btn.quiet) {
    border-color: var(--border);
  }
  :where(.kmd-app) :global(.btn.block) {
    width: 100%;
  }
  :where(.kmd-app) :global(.btn:disabled) {
    border-color: var(--border);
    background: transparent;
    color: var(--text-4);
  }
  :where(.kmd-app) :global(.btn:active:not(:disabled)) {
    transform: scale(0.985);
  }

  /* Lists: rows between hairlines, no boxes */
  :where(.kmd-app) :global(.list) {
    margin: 0 0 28px;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--rule);
    border-bottom: 1px solid var(--border);
  }
  :where(.kmd-app) :global(.list.flush) {
    margin-bottom: 0;
  }
  :where(.kmd-app) :global(.list-title) {
    margin: 0 0 8px;
    padding: 0;
    font: 600 11px/1.3 var(--font);
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  :where(.kmd-app) :global(.list-note) {
    margin: -20px 0 28px;
    font: 13px/1.45 var(--font);
    color: var(--text-3);
  }
  :where(.kmd-app) :global(.list > li + li) {
    border-top: 1px solid var(--border);
  }
  :where(.kmd-app) :global(.row) {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    min-height: 52px;
    padding: 10px 0;
    border: 0;
    background: none;
    color: var(--text-1);
    font: 16px/1.3 var(--font);
    text-align: left;
  }
  :where(.kmd-app) :global(button.row:active) {
    background: var(--fill-1);
  }
  :where(.kmd-app) :global(.row .grow) {
    flex: 1;
    min-width: 0;
  }
  :where(.kmd-app) :global(.row .value) {
    /* Long values are cut with an ellipsis, the label keeps its room */
    min-width: 0;
    max-width: 55%;
    color: var(--text-2);
    text-align: right;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-variant-numeric: tabular-nums;
  }
  :where(.kmd-app) :global(.row .sub) {
    display: block;
    margin-top: 2px;
    font-size: 13px;
    color: var(--text-3);
  }
  :where(.kmd-app) :global(.row.danger) {
    color: var(--critical);
  }
  :where(.kmd-app) :global(.row .icon) {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    color: var(--text-2);
    flex: none;
  }
  :where(.kmd-app) :global(.row.danger .icon) {
    color: var(--critical);
  }
  :where(.kmd-app) :global(.row > .i-right) {
    flex: none;
    color: var(--text-3);
  }
  :where(.kmd-app) :global(.row > .i-check) {
    flex: none;
    color: var(--text-1);
  }

  /* Form fields: a label in small capitals above a plain outlined field */
  :where(.kmd-app) :global(.field) {
    display: grid;
    gap: 8px;
    margin-bottom: 18px;
  }
  :where(.kmd-app) :global(.field > span) {
    font: 600 11px/1.3 var(--font);
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  :where(.kmd-app) :global(.input) {
    width: 100%;
    min-height: 48px;
    padding: 0 12px;
    border: 1px solid var(--border);
    border-radius: 2px;
    background: var(--surface);
    outline: none;
    transition: border-color 0.15s;
  }
  :where(.kmd-app) :global(select.input) {
    appearance: none;
    -webkit-appearance: none;
    padding-right: 32px;
    background-image: linear-gradient(45deg, transparent 50%, var(--text-2) 50%), linear-gradient(135deg, var(--text-2) 50%, transparent 50%);
    background-position: calc(100% - 17px) 52%, calc(100% - 12px) 52%;
    background-size: 5px 5px;
    background-repeat: no-repeat;
  }
  :where(.kmd-app) :global(.input:focus) {
    border-color: var(--text-1);
  }
  :where(.kmd-app) :global(.prose) {
    margin: 0 0 18px;
    font: 15px/1.55 var(--font);
    color: var(--text-2);
  }
  :where(.kmd-app) :global(.prose b) {
    font-weight: 600;
    color: var(--text-1);
  }

  @media (hover: hover) {
    :where(.kmd-app) :global(button.row:hover) {
      background: var(--fill-1);
    }
    :where(.kmd-app) :global(.btn:not(.primary):not(.danger):not(:disabled):hover) {
      background: var(--fill-1);
    }
    :where(.kmd-app) :global(.btn.primary:not(:disabled):hover) {
      background: color-mix(in srgb, var(--text-1) 86%, var(--bg));
    }
    :where(.kmd-app) :global(.btn.danger:not(:disabled):hover) {
      filter: brightness(1.08);
    }
    .project-name:hover .name {
      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-underline-offset: 4px;
    }
    .tabbar button:not(.active):hover {
      color: var(--text-1);
    }
  }

  /* Top bar: piano and run on the left, connection on the right */
  .topbar {
    grid-area: top;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: calc(6px + env(safe-area-inset-top)) 20px 8px;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    z-index: 5;
  }
  .wordmark {
    display: none;
  }
  .project-name {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--text-1);
    text-align: left;
  }
  .project-name :global(svg) {
    flex: none;
    color: var(--text-3);
  }
  .names {
    display: grid;
    min-width: 0;
  }
  .name,
  .run {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .name {
    font: 600 19px/1.2 var(--font);
    letter-spacing: -0.005em;
  }
  .run {
    margin-top: 3px;
    font: 600 11px/1.3 var(--font);
    color: var(--text-2);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    flex: none;
    font: 500 12px/1 var(--font);
    color: var(--text-2);
  }
  .status i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-4);
  }
  .status.connected i,
  .status.demo i {
    background: var(--good);
  }
  .status.disconnected i {
    background: var(--critical);
  }
  .status.connecting i {
    animation: blink 1s infinite;
  }
  .banner {
    grid-area: banner;
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 10px 20px;
    border-bottom: 1px solid var(--warning-edge);
    background: var(--warning-wash);
    font: 13px/1.4 var(--font);
  }
  .banner :global(svg) {
    flex: none;
    color: var(--warning-ink);
  }
  .content {
    grid-area: content;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 8px;
  }

  /* Tab bar: thin icons, small capitals, a red mark over the open section */
  .tabbar {
    grid-area: nav;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    padding: 0 8px env(safe-area-inset-bottom);
    background: var(--bg);
    border-top: 1px solid var(--border);
    z-index: 5;
  }
  .tabbar button {
    position: relative;
    display: grid;
    justify-items: center;
    gap: 4px;
    min-height: 56px;
    padding: 9px 0 6px;
    border: 0;
    background: none;
    color: var(--text-2);
    font: 600 11px/1.2 var(--font);
    text-transform: uppercase;
    letter-spacing: 0.07em;
  }
  .tabbar button::before {
    content: '';
    position: absolute;
    top: -1px;
    left: 50%;
    width: 0;
    height: 2px;
    background: var(--accent);
    transform: translateX(-50%);
    transition: width 0.25s ease;
  }
  .tabbar button.active {
    color: var(--text-1);
  }
  .tabbar button.active::before {
    width: 28px;
  }

  .toast {
    position: fixed;
    left: 50%;
    bottom: calc(88px + env(safe-area-inset-bottom));
    z-index: 50;
    max-width: calc(100% - 40px);
    padding: 12px 18px;
    border-radius: 2px;
    background: var(--text-1);
    color: var(--bg);
    font: 500 14px/1.35 var(--font);
    transform: translateX(-50%);
    animation: toast 2.6s ease both;
    pointer-events: none;
  }

  /* Tablet: the phone layout, kept to a readable width */
  @media (min-width: 700px) and (max-width: 959px) {
    .content {
      padding-inline: calc((100% - 680px) / 2);
    }
  }

  /* Desktop: a sidebar with the piano and the sections, content to the right */
  @media (min-width: 960px) {
    .kmd-app {
      grid-template-columns: 256px minmax(0, 1fr);
      grid-template-rows: auto auto 1fr;
      grid-template-areas:
        'top content'
        'banner content'
        'nav content';
    }
    .topbar,
    .banner,
    .tabbar {
      border-right: 1px solid var(--border);
    }
    .topbar {
      grid-area: top;
      flex-direction: column;
      align-items: stretch;
      gap: 14px;
      padding: 26px 24px 18px;
      border-bottom: 0;
    }
    .wordmark {
      display: flex;
      align-items: baseline;
      gap: 6px;
      margin: 0 0 18px;
      padding-bottom: 14px;
      border-bottom: 2px solid var(--accent);
      font: 600 19px/1 var(--font);
    }
    .wordmark span {
      font: 600 11px/1 var(--font);
      color: var(--text-3);
      text-transform: uppercase;
      letter-spacing: 0.2em;
    }
    .name {
      font-size: 20px;
      white-space: normal;
    }
    .status {
      align-self: flex-start;
    }
    .banner {
      grid-area: banner;
      padding: 10px 24px;
    }
    .content {
      grid-area: content;
      padding-bottom: 0;
    }
    .tabbar {
      grid-area: nav;
      display: flex;
      flex-direction: column;
      gap: 0;
      padding: 8px 24px;
      border-top: 0;
    }
    .tabbar button {
      display: flex;
      align-items: center;
      gap: 14px;
      min-height: 46px;
      padding: 0;
      border-top: 1px solid var(--border);
      color: var(--text-2);
      font: 500 15px/1.2 var(--font);
      text-transform: none;
      letter-spacing: 0;
    }
    .tabbar button:last-child {
      border-bottom: 1px solid var(--border);
    }
    .tabbar button::before {
      top: 50%;
      left: -24px;
      width: 2px;
      height: 0;
      transform: translateY(-50%);
      transition: height 0.25s ease;
    }
    .tabbar button.active {
      color: var(--text-1);
      font-weight: 600;
    }
    .tabbar button.active::before {
      width: 2px;
      height: 28px;
    }
    .toast {
      left: calc(50% + 128px);
      bottom: 28px;
    }
  }

  @keyframes blink {
    50% {
      opacity: 0.3;
    }
  }
  @keyframes toast {
    0% {
      opacity: 0;
      transform: translate(-50%, 8px);
    }
    8%,
    88% {
      opacity: 1;
      transform: translate(-50%, 0);
    }
    100% {
      opacity: 0;
    }
  }
</style>
