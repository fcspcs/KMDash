import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../src/app/lib/store.js';
import { standardSections, splitIntoSections, profileToTargets, resolveTargets } from '../src/app/lib/targets.js';
import { findProfile } from '../src/app/lib/profiles.js';

import { pianoKey } from '../src/app/sources/synthetic.js';

const measurements = Array.from({ length: 20 }, (_, i) => store.measurementFromMessage(pianoKey(i + 1, 88, { seed: 5 })));

// localStorage for Node
const memory = new Map();
globalThis.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
};

test('Old projects become pianos with one run, the profile becomes targets', () => {
  memory.clear();
  const old = { id: 'abc', name: 'Studio B', numKeys: 88, startNote: 0, profileId: 'steinway-hamburg-b', keys: { 40: [measurements[15]] }, history: [40], created: 1, updated: 2 };
  localStorage.setItem('kmdashboard:project:abc', JSON.stringify(old));
  localStorage.setItem('kmdashboard:index', JSON.stringify([{ id: 'abc', name: 'Studio B', updated: 2 }]));
  const inst = store.loadInstrument('abc', 'Run 1');
  assert.equal(inst.version, 2);
  assert.equal(inst.name, 'Studio B');
  assert.equal(inst.runs.length, 1);
  assert.equal(inst.runs[0].title, 'Run 1');
  assert.deepEqual(inst.runs[0].history, [40]);
  assert.equal(store.activeRun(inst).keys[40][0].d, measurements[15].d);
  assert.equal(inst.targets.source, 'steinway-hamburg-b');
  // saved in the new format, index with the number of runs
  assert.equal(JSON.parse(localStorage.getItem('kmdashboard:project:abc')).version, 2);
  assert.equal(store.listInstruments()[0].runs, 1);
});

test('A new run leaves the old one unchanged', () => {
  let inst = store.createInstrument('P', 'Run 1');
  const first = inst.runs[0].id;
  inst = store.withRun(inst, store.withMeasurement(store.activeRun(inst), 10, measurements[15]));
  inst = store.addRun(inst, 'Run 2', 'after cleaning');
  assert.equal(inst.runs.length, 2);
  assert.notEqual(inst.activeRunId, first);
  inst = store.withRun(inst, store.withMeasurement(store.activeRun(inst), 10, measurements[16]));
  assert.equal(inst.runs[0].keys[10].length, 1);
  assert.equal(inst.runs[0].keys[10][0].d, measurements[15].d);
  assert.equal(inst.runs[1].keys[10][0].d, measurements[16].d);
  assert.equal(inst.runs[1].notes, 'after cleaning');
  inst = store.deleteRun(inst, inst.activeRunId);
  assert.equal(inst.activeRunId, first);
  assert.equal(store.deleteRun(inst, first).runs.length, 1, 'the last run stays');
});

test('Several readings: the value is the last reading or the median', () => {
  const list = [measurements[15], measurements[16], measurements[17]];
  assert.equal(store.effective(list, { valueMode: 'last', perKey: 3 }), measurements[17]);
  const med = store.effective(list, { valueMode: 'median', perKey: 3 });
  const d = [measurements[15].d, measurements[16].d, measurements[17].d].sort((a, b) => a - b)[1];
  const u = [measurements[15].u, measurements[16].u, measurements[17].u].sort((a, b) => a - b)[1];
  assert.equal(med.d, d);
  assert.equal(med.b, (d + u) / 2);
  assert.equal(med.f, (d - u) / 2);
  assert.equal(med.n, 3);
  assert.equal(med.x, measurements[17].x, 'curve of the last reading');
  // Median of the last two: their mean
  assert.equal(store.effective(list, { valueMode: 'median', perKey: 2 }).d, (measurements[16].d + measurements[17].d) / 2);
});

test('Older readings of a key keep only their values', () => {
  let run = store.createRun('r');
  for (const m of measurements.slice(15, 19)) run = store.withMeasurement(run, 5, m);
  assert.equal(run.keys[5].length, 4);
  assert.equal(run.keys[5][0].x.length, 0);
  assert.equal(run.keys[5][1].x.length, 0);
  assert.equal(run.keys[5][3].x.length, 100);
  const { run: undone, key } = store.withoutLastMeasurement(run);
  assert.equal(key, 5);
  assert.equal(undone.keys[5].length, 3);
  assert.equal(undone.keys[5].at(-1).x.length, 100);
});

test('Project file: format of the KMD page in and out, own files with all runs', () => {
  let inst = store.createInstrument('Salon', 'Run 1');
  inst = store.withRun(inst, store.withMeasurement(store.activeRun(inst), 3, measurements[15]));
  inst = store.addRun(inst, 'Run 2');
  inst = store.withRun(inst, store.withMeasurement(store.activeRun(inst), 3, measurements[16]));
  const valueOf = (key) => store.latest(store.activeRun(inst), key);
  const text = store.toProjectFile(inst, valueOf);
  const file = JSON.parse(text);
  assert.equal(file.pianoname, 'Salon');
  assert.equal(file.downweight_data[3], measurements[16].d);
  assert.equal(file.xyvalues_data[3].length, 100);

  const back = store.fromProjectFile(text, 'x', 'Run 1');
  assert.equal(back.runs.length, 2);
  assert.notEqual(back.id, inst.id, 'import never overwrites an existing piano');

  // File from the KMD's own page (without kmdashboard)
  const { kmdashboard, ...original } = file;
  const imported = store.fromProjectFile(JSON.stringify(original), 'x', 'Run 1');
  assert.equal(imported.runs.length, 1);
  assert.equal(imported.runs[0].keys[3][0].d, measurements[16].d);
  assert.equal(imported.runs[0].keys[3][0].x.length, 100);
  assert.throws(() => store.fromProjectFile('{"foo": 1}', 'x', 'Run 1'));
});

test('CSV in the format of the KMD page', () => {
  const csv = store.overviewCsv(3, (key) => (key === 2 ? measurements[15] : null));
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], 'Key, Downweight, Upweight, Friction, Balance Weight, Keydip');
  assert.equal(lines.length, 4);
  assert.ok(lines[2].startsWith('2,'));
  assert.equal(lines[1], ',,,,,');
});

test('Standard sections and splitting of targets', () => {
  assert.deepEqual(standardSections(88), [[1, 13], [14, 25], [26, 49], [50, 61], [62, 88]]);
  const s85 = standardSections(85);
  assert.equal(s85[0][0], 1);
  assert.equal(s85.at(-1)[1], 85);
  const targets = profileToTargets(findProfile('steinway-ny-b'), 88);
  const split = splitIntoSections(targets, 'd', 88);
  assert.equal(split.length, 5);
  assert.deepEqual([split[1].start, split[1].end, split[1].tol], [50, 49, 2]);
  const copy = { ...targets, metrics: { ...targets.metrics, d: split } };
  for (const key of [1, 14, 20, 30, 70, 88]) {
    assert.equal(resolveTargets(copy, key, { numKeys: 88 }).d.target, resolveTargets(targets, key, { numKeys: 88 }).d.target, `key ${key}`);
  }
});
