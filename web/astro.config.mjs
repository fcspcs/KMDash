import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

export default defineConfig({
  integrations: [svelte()],
  devToolbar: { enabled: false },
  vite: {
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  },
});
