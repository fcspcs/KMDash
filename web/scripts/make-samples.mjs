// Writes src/app/sources/samples.json: synthetic readings for the simulator (tools/simulate_kmd.py).
// 20 clean keys from A0 up, then 4 keys with the damper picked up (pedal not pressed).
import { writeFileSync } from 'node:fs';
import { pianoKey, SETTINGS } from '../src/app/sources/synthetic.js';

const keys = [];
for (let key = 1; key <= 20; key++) keys.push(pianoKey(key, 88, { seed: 7 }));
for (let key = 21; key <= 24; key++) keys.push(pianoKey(key, 88, { seed: 7, damper: true }));

const file = new URL('../src/app/sources/samples.json', import.meta.url);
writeFileSync(file, JSON.stringify({ note: 'Synthetic readings made by web/scripts/make-samples.mjs', settings: SETTINGS, keys }) + '\n');
console.log(`${keys.length} readings written to src/app/sources/samples.json`);
