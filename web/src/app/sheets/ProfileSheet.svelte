<script>
  import Sheet from '../components/Sheet.svelte';
  import Icon from '../components/Icon.svelte';
  import { profileGroups, profileName } from '../lib/profiles.js';
  import { targetsLabel, profileSummary } from '../lib/labels.js';
  import { t, lang } from '../lib/i18n.js';

  let { app } = $props();

  const targets = $derived(app.instrument.targets);
  const close = () => (app.sheet = null);

  // Never silently overwrite the user's own edits
  function choose(id) {
    if (id === targets?.source && !targets?.edited) return close();
    const apply = () => {
      app.loadProfile(id);
      app.notify(t('targetsLoaded', { name: targetsLabel(app.instrument.targets) }));
    };
    if (targets?.edited) {
      app.sheet = { type: 'confirm', title: t('replaceTargetsTitle'), message: t('replaceTargetsMessage'), confirmLabel: t('replace'), danger: true, onconfirm: apply };
    } else {
      apply();
      close();
    }
  }

  const confidence = (p) => t(`confidence_${p.confidence ?? 'consensus'}`);
</script>

<Sheet title={t('targets')} onclose={close}>
  <p class="prose">{t('profileIntro')}</p>
  {#if targets?.edited}
    <ul class="list">
      <li>
        <button class="row" onclick={() => (app.sheet = { type: 'targets' })}>
          <span class="grow">{targetsLabel(targets)}<span class="sub">{t('ownTargetsSub')}</span></span>
          <Icon name="check" size={18} />
        </button>
      </li>
    </ul>
  {/if}
  {#each profileGroups() as [group, profiles]}
    {@const common = profiles.every((p) => p.confidence === profiles[0].confidence) ? confidence(profiles[0]) : null}
    <h3 class="list-title">{group}{common ? ` · ${common}` : ''}</h3>
    <ul class="list">
      {#each profiles as p (p.id)}
        <li>
          <button class="row" onclick={() => choose(p.id)}>
            <span class="grow">{profileName(p, lang())}<span class="sub">{[profileSummary(p), common ? '' : confidence(p)].filter(Boolean).join(' · ')}</span></span>
            {#if targets?.source === p.id && !targets.edited}<Icon name="check" size={18} />{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/each}
  <ul class="list">
    <li>
      <button class="row" onclick={() => choose(null)}>
        <span class="grow">{t('targetsNone')}<span class="sub">{t('targetsNoneSub')}</span></span>
        {#if !targets}<Icon name="check" size={18} />{/if}
      </button>
    </li>
  </ul>
  <p class="list-note">{t('profileNote')}</p>
  {#snippet footer()}
    <button class="btn primary block" onclick={() => (app.sheet = { type: 'targets' })}><Icon name="sliders" size={16} />{t('editTargets')}</button>
  {/snippet}
</Sheet>
