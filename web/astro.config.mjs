import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

// Writes dist/sw.js from src/sw/service-worker.js: the files the app page needs offline, and a version that
// changes with their content, so a new build replaces the stored copy.
function serviceWorker() {
  return {
    name: 'kmd-service-worker',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const root = fileURLToPath(dir);
        const built = readdirSync(`${root}/_astro`).map((name) => `/_astro/${name}`);
        const files = ['/app/', '/favicon.svg', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png', ...built];
        const hash = createHash('sha256');
        for (const file of files) hash.update(file).update(readFileSync(`${root}${file === '/app/' ? '/app/index.html' : file}`));
        const version = hash.digest('hex').slice(0, 12);
        const template = readFileSync(new URL('./src/sw/service-worker.js', import.meta.url), 'utf8');
        writeFileSync(`${root}/sw.js`, template.replace('__VERSION__', version).replace('__FILES__', JSON.stringify(files)));
      },
    },
  };
}

export default defineConfig({
  integrations: [svelte(), serviceWorker()],
  devToolbar: { enabled: false },
  vite: {
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  },
});
