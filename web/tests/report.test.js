import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRun } from '../src/app/lib/analysis.js';
import { measurementFromMessage, createInstrument, withMeasurement, activeRun, overviewCsv, effective } from '../src/app/lib/store.js';
import { summarize, changes, pairs, runWindow } from '../src/app/lib/report.js';
import { zipFiles, crc32 } from '../src/app/lib/zip.js';
import { pianoKey } from '../src/app/sources/synthetic.js';

const ctx = { numKeys: 88, startNote: 0, hints: {} };
const emptyRun = () => activeRun(createInstrument('t', 'Run 1'));
const runOf = (keys, extra = {}) => keys.reduce((run, key) => withMeasurement(run, key, measurementFromMessage(pianoKey(key, 88, { seed: 21, ...extra }))), emptyRun());

test('Summary: counts, averages without skewed readings, sections and window', () => {
  const run = runOf([1, 2, 3, 4, 5, 30, 31, 32, 60, 61, 80, 81]);
  const damped = withMeasurement(run, 40, measurementFromMessage(pianoKey(40, 88, { seed: 21, damper: true })));
  const analysis = analyzeRun(damped, ctx);
  const s = summarize(analysis, 88);
  assert.equal(s.measured, 13);
  assert.equal(s.distorted, 1, 'damper in the window');
  const clean = Object.values(analysis.keys).filter((e) => !e.distorted);
  const mean = clean.reduce((sum, e) => sum + e.m.d, 0) / clean.length;
  assert.ok(Math.abs(s.avg.d - mean) < 1e-9, 'skewed reading stays out of the average');
  assert.equal(s.sections.length, 5);
  assert.deepEqual(s.sections.map((x) => [x.from, x.to]), [[1, 13], [14, 25], [26, 49], [50, 61], [62, 88]]);
  assert.equal(s.sections.reduce((sum, x) => sum + x.n, 0), 13);
  assert.equal(s.sections[1].avg.d, null, 'empty section has no average');
  assert.deepEqual(s.window, { low: 2, high: 4 });
  assert.deepEqual(runWindow([]), null);
});

test('Changes: only keys in both runs, later minus earlier', () => {
  const before = analyzeRun(runOf([1, 2, 3, 4, 5, 6]), ctx);
  const after = analyzeRun(runOf([4, 5, 6, 7, 8], { downBy: 2 }), ctx);
  const c = changes(before, after);
  assert.deepEqual(c.rows.map((r) => r.key), [4, 5, 6]);
  for (const r of c.rows) {
    assert.ok(Math.abs(r.delta.d - (after.keys[r.key].m.d - before.keys[r.key].m.d)) < 1e-9);
    assert.ok(r.delta.d > 1 && r.delta.d < 3, `about +2 g, got ${r.delta.d}`);
  }
  assert.ok(Math.abs(c.avg.d - c.rows.reduce((s, r) => s + r.delta.d, 0) / 3) < 1e-9);
  assert.deepEqual(changes(before, analyzeRun(runOf([40]), ctx)).rows, []);
  assert.deepEqual(pairs(['a', 'b', 'c']), [['a', 'b'], ['b', 'c']]);
});

test('Values table keeps the format of the KMD page', () => {
  const run = runOf([1, 3]);
  const lines = overviewCsv(4, (key) => effective(run.keys[key])).trim().split('\n');
  assert.equal(lines[0], 'Key, Downweight, Upweight, Friction, Balance Weight, Keydip');
  assert.equal(lines.length, 5);
  assert.equal(lines[2], ',,,,,', 'unmeasured key stays an empty row');
  const m = run.keys[1][0];
  assert.equal(lines[1], [1, m.d, m.u, m.f, m.b, m.dip].join(','));
});

test('ZIP archive: stored files with UTF-8 names that read back', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const files = [
    { name: 'Flügel_overview.csv', text: 'Key, Downweight\n1,50\n' },
    { name: 'b.csv', text: 'x' },
  ];
  const zip = zipFiles(files, new Date(2026, 8, 26, 10, 30));
  const view = new DataView(zip.buffer);
  const end = zip.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  assert.equal(view.getUint16(end + 10, true), 2);
  let at = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  for (const file of files) {
    assert.equal(view.getUint32(at, true), 0x02014b50);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    assert.equal(decoder.decode(zip.slice(at + 46, at + 46 + nameLength)), file.name);
    assert.equal(view.getUint32(local, true), 0x04034b50);
    const start = local + 30 + view.getUint16(local + 26, true);
    const data = zip.slice(start, start + size);
    assert.equal(decoder.decode(data), file.text);
    assert.equal(view.getUint32(at + 16, true), crc32(data));
    at += 46 + nameLength;
  }
});

import { fitTrend } from '../src/app/lib/trend.js';
import { evenness, findings, detailsCsv } from '../src/app/lib/report.js';
import { setLang } from '../src/app/lib/i18n.js';

test('Smooth curve: recovers a quadratic, ignores a single bad key', () => {
  const f = (k) => 50 - 0.05 * k + 0.0003 * k * k;
  const points = Array.from({ length: 40 }, (_, i) => [i * 2 + 1, f(i * 2 + 1)]);
  const trend = fitTrend(points, { degree: 2 });
  for (const [k] of points) assert.ok(Math.abs(trend.at(k) - f(k)) < 1e-6);
  const bad = points.map(([k, v]) => [k, k === 41 ? v + 8 : v]);
  const robust = fitTrend(bad);
  assert.ok(Math.abs(robust.at(41) - f(41)) < 0.3, `bent by the bad key: ${robust.at(41) - f(41)}`);
  assert.equal(fitTrend(points.slice(0, 5)), null, 'too few keys');
});

test('Evenness: distance from the curve, share near it, share in the targets', () => {
  let run = runOf(Array.from({ length: 30 }, (_, i) => i + 1));
  run = withMeasurement(run, 15, measurementFromMessage(pianoKey(15, 88, { seed: 21, downBy: 6 })));
  const analysis = analyzeRun(run, ctx);
  const ev = evenness(analysis, 'b');
  assert.equal(ev.n, 30);
  assert.ok(ev.deviation[15] > 2, `key 15 stands out: ${ev.deviation[15]}`);
  assert.ok(ev.within < 1 && ev.within > 0.9, `within ${ev.within}`);
  assert.ok(ev.rms > 0 && ev.rms < 1.5, `rms ${ev.rms}`);
  assert.equal(ev.inTarget, null, 'no targets, no share');
  const dip = evenness(analysis, 'dip');
  assert.ok(dip.n < 30, 'key dip counts white keys only');
});

test('Findings: low up weight is named, clean readings pass', () => {
  const run = runOf(Array.from({ length: 20 }, (_, i) => i + 1), { upBy: 0 });
  const low = Array.from({ length: 3 }, (_, i) => i + 5).reduce((r, key) => withMeasurement(r, key, measurementFromMessage(pianoKey(key, 88, { seed: 21, up: 15 }))), run);
  const analysis = analyzeRun(low, ctx);
  const result = findings({ analysis, summary: summarize(analysis, 88) });
  const up = result.find((f) => f.id === 'upweight');
  assert.equal(up.ok, false);
  assert.deepEqual(up.vars.low, [5, 6, 7]);
  assert.equal(result.find((f) => f.id === 'quality').ok, true);
  assert.ok(result.find((f) => f.id === 'even'), 'evenness is always judged');
});

test('Detailed table: one row per key, German with semicolons and decimal commas', () => {
  const analysis = analyzeRun(runOf([1, 2, 3]), ctx);
  setLang('de');
  const csv = detailsCsv(analysis, { numKeys: 5, startNote: 0 });
  setLang('en');
  assert.ok(csv.startsWith('﻿'), 'BOM for Excel');
  const lines = csv.slice(1).trim().split('\n');
  assert.equal(lines.length, 6);
  const head = lines[0].split(';');
  assert.equal(head[0], 'Taste');
  assert.equal(lines[1].split(';').length, head.length);
  assert.equal(lines[4].split(';').length, head.length, 'unmeasured key keeps all columns');
  assert.match(lines[1].split(';')[4], /^\d+,\d{2}$/);
  assert.equal(lines[2].split(';')[2], 'schwarz', 'A#0 is black');
});

import { orderKeys, keyRange, sessionPlan } from '../src/app/lib/session.js';

test('Guided order: white keys first, one colour, both directions', () => {
  const keys = keyRange(40, 44); // C4 C#4 D4 D#4 E4 (88 keys from A)
  assert.deepEqual(keys, [40, 41, 42, 43, 44]);
  assert.deepEqual(orderKeys(keys, 'whiteFirst'), [40, 42, 44, 41, 43]);
  assert.deepEqual(orderKeys(keys, 'white'), [40, 42, 44]);
  assert.deepEqual(orderKeys(keys, 'black'), [41, 43]);
  assert.deepEqual(orderKeys(keyRange(44, 40), 'whiteFirst'), [44, 42, 40, 43, 41]);
  assert.deepEqual(orderKeys(keyRange(1, 3), 'black', 3), [2], 'from C: C#1 is black');
});

test('Repeat readings: key by key or in rounds', () => {
  assert.deepEqual(sessionPlan([1, 2, 3], 2, false), { stops: [1, 2, 3], perStop: 2, rounds: 1, roundSize: 3 });
  assert.deepEqual(sessionPlan([1, 2, 3], 2, true), { stops: [1, 2, 3, 1, 2, 3], perStop: 1, rounds: 2, roundSize: 3 });
  assert.deepEqual(sessionPlan([1, 2], 1, true).stops, [1, 2], 'one reading: no rounds');
});

import { emptyTargets, resolveTargets } from '../src/app/lib/targets.js';
import { hintTitle, hintName } from '../src/app/lib/hints.js';

test('Friction hints say "target" with own friction targets, "guide value" without', () => {
  const run = runOf([1, 2, 3, 4, 5, 6, 7, 8], { downBy: 10 }); // high friction everywhere
  const guide = analyzeRun(run, ctx);
  const targets = emptyTargets();
  targets.metrics.f.push({ from: 1, to: 88, kind: 'range', min: 5, max: 12 });
  const own = analyzeRun(run, { ...ctx, targetsAt: (key) => resolveTargets(targets, key, { numKeys: 88 }) });
  const texts = (a) => [...a.global, ...Object.values(a.keys).flatMap((e) => e.hints)].filter((h) => h.group === 'friction').map((h) => hintTitle(h) + ' / ' + hintName(h));
  assert.ok(texts(guide).length && texts(guide).every((s) => /guide value|high/i.test(s)), texts(guide).join(', '));
  assert.ok(texts(own).length && texts(own).every((s) => !/guide value/i.test(s)), texts(own).join(', '));
});
