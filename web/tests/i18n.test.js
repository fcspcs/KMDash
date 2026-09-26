import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dictionaries } from '../src/app/lib/i18n.js';

const ROOT = fileURLToPath(new URL('../src/app/', import.meta.url));
const files = (dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? files(join(dir, name)) : [join(dir, name)]));
const sources = files(ROOT).filter((f) => /\.(svelte|js)$/.test(f) && !f.endsWith('i18n.js'));

test('All text keys in use exist', () => {
  const missing = [];
  for (const file of sources) {
    const text = readFileSync(file, 'utf8');
    for (const [, key] of text.matchAll(/\bt\('([a-zA-Z_]+)'/g)) if (!(key in dictionaries.en)) missing.push(`${file.replace(ROOT, '')}: ${key}`);
  }
  assert.deepEqual(missing, []);
});

test('German has the same keys as English', () => {
  const en = Object.keys(dictionaries.en);
  const de = Object.keys(dictionaries.de);
  assert.deepEqual(en.filter((k) => !de.includes(k)), [], 'missing in German');
  assert.deepEqual(de.filter((k) => !en.includes(k)), [], 'only in German');
});

test('No em or en dashes in the texts', () => {
  for (const [lang, dict] of Object.entries(dictionaries)) {
    for (const [key, text] of Object.entries(dict)) assert.ok(!/[–—]/.test(text), `${lang}.${key}: ${text}`);
  }
});

test('Dynamic keys for hints, metrics and groups', () => {
  const en = dictionaries.en;
  for (const m of ['d', 'u', 'b', 'f', 'dip']) for (const p of ['metric_', 'short_', 'col_']) assert.ok(en[p + m], p + m);
  for (const g of ['damper', 'curve', 'friction', 'upweight', 'outliers', 'targets', 'dip', 'spread']) assert.ok(en[`group_${g}`] && en[`group_${g}_sub`], g);
  const analysis = readFileSync(join(ROOT, 'lib/analysis.js'), 'utf8');
  const ids = new Set([...analysis.matchAll(/'(?:warn|info)'|add\(e, '[a-z]+', '([a-zA-Z]+)'/g)].map((m) => m[1]).filter(Boolean));
  ids.add('pedalUp').add('pedalMixed').add('uneven');
  for (const id of ids) {
    const variants = ['targetMiss', 'balanceMiss', 'dipMiss'].includes(id) ? [`${id}_high`, `${id}_low`] : [id];
    for (const v of variants) assert.ok(en[`hint_${v}`] && en[`hint_${v}_detail`], `hint_${v}`);
    if (!['pedalUp', 'pedalMixed', 'uneven'].includes(id)) assert.ok(en[`name_${id}`], `name_${id}`);
  }
});
