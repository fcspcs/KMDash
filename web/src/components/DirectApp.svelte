<script>
  // KMDash on the website, connected straight to the KMD (Chrome and Edge 147+, see app/lib/direct.js).
  // Pianos are stored for this site in this browser, separate from the demo and from the userscript on the phone.
  import App from '../app/App.svelte';
  import { AppState } from '../app/state.svelte.js';
  import { createLiveSource, KMD_HOST } from '../app/sources/live.js';
  import { loadPrefs } from '../app/lib/store.js';
  import { setLang } from '../app/lib/i18n.js';

  setLang(loadPrefs().lang);
  document.documentElement.lang = loadPrefs().lang || 'en';
  const app = new AppState(createLiveSource(`ws://${KMD_HOST}:81/`, { direct: true }));
</script>

<App {app} />
