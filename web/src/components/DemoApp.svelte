<script>
  // Demo on the website: synthetic readings instead of the device, separate storage
  import App from '../app/App.svelte';
  import { AppState } from '../app/state.svelte.js';
  import { createDemoSource, seedDemo } from '../app/sources/demo.js';
  import { usePrefix, loadPrefs } from '../app/lib/store.js';
  import { setLang } from '../app/lib/i18n.js';

  usePrefix('kmd-demo:');
  setLang(loadPrefs().lang);
  seedDemo();
  const app = new AppState(createDemoSource());
</script>

<App {app} />
