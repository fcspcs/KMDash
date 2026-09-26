// Builds the app as a single userscript (IIFE, CSS inside the JS) into public/kmdash.user.js.
// Usage: npm run build:userscript (also runs before every site build)
import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const out = new URL('../public/kmdash.user.js', import.meta.url);

// Only the KMD's page, nothing else. @inject-into page: the script has to reach the page's window.onload.
const header = `// ==UserScript==
// @name         KMDash
// @namespace    kmdash
// @version      ${pkg.version}
// @description  Mobile interface for the Renner Key Measuring Device (KMD). Runs on the KMD's own page.
// @match        http://192.168.1.67/*
// @run-at       document-end
// @inject-into  page
// @grant        none
// @noframes
// ==/UserScript==
// Includes the font Geist, SIL Open Font License 1.1 (https://openfontlicense.org)
`;

const result = await build({
  configFile: false,
  root,
  logLevel: 'warn',
  mode: 'production',
  plugins: [svelte({ configFile: false, emitCss: false, compilerOptions: { css: 'injected' } })],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    write: false,
    minify: true,
    target: 'safari15',
    lib: { entry: 'src/userscript/main.js', formats: ['iife'], name: 'KMDash', fileName: () => 'kmdash.user.js' },
  },
});

const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output);
const chunk = outputs.find((o) => o.type === 'chunk');
if (!chunk) throw new Error('Userscript build produced no output');
mkdirSync(new URL('../public/', import.meta.url), { recursive: true });
writeFileSync(out, header + chunk.code);
console.log(`Userscript ${pkg.version}: ${(chunk.code.length / 1024).toFixed(0)} KB -> public/kmdash.user.js`);
