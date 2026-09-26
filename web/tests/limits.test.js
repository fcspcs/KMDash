import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRun, LIMITS } from '../src/app/lib/analysis.js';
import { createInstrument, withMeasurement, activeRun, measurementFromMessage } from '../src/app/lib/store.js';
import { evenness, findings, summarize } from '../src/app/lib/report.js';
import { THRESHOLDS, thresholds, toLimits, toTolerance, validThreshold } from '../src/app/lib/limits.js';
import { pianoKey } from '../src/app/sources/synthetic.js';

const ctx = { numKeys: 88, startNote: 0, hints: {} };
const runOf = (keys, extra = {}) => keys.reduce((run, key) => withMeasurement(run, key, measurementFromMessage(pianoKey(key, 88, { seed: 21, ...extra }))), activeRun(createInstrument('t', 'Run 1')));
const hintIds = (analysis) => [...analysis.global, ...Object.values(analysis.keys).flatMap((e) => e.hints)].map((h) => h.id);

test('Thresholds: defaults match the analysis limits, stored values only when valid', () => {
  const defaults = thresholds();
  const limits = toLimits(defaults);
  assert.deepEqual(limits.outlier, LIMITS.outlier);
  for (const key of ['frictionMargin', 'upweightMin', 'upweightWarnBelow', 'remeasure', 'unevenRms']) assert.equal(limits[key], LIMITS[key], key);
  assert.deepEqual(toTolerance(defaults), { g: 2, mm: 0.2 });
  const th = thresholds({ evenG: 1, outlierB: 99, remeasure: 'x', frictionMargin: '4' });
  assert.equal(th.evenG, 1);
  assert.equal(th.outlierB, 2, 'out of range falls back to the default');
  assert.equal(th.remeasure, 1, 'not a number falls back to the default');
  assert.equal(th.frictionMargin, 4);
  assert.ok(THRESHOLDS.every((x) => validThreshold(x.id, x.def)), 'every default is valid');
  assert.equal(validThreshold('evenMm', 0), false);
});

test('Thresholds change hints and evenness, never the readings', () => {
  let run = runOf(Array.from({ length: 30 }, (_, i) => i + 1), { upBy: 0 });
  run = withMeasurement(run, 15, measurementFromMessage(pianoKey(15, 88, { seed: 21, downBy: 4 })));
  const plain = analyzeRun(run, ctx);
  const loose = analyzeRun(run, { ...ctx, limits: toLimits(thresholds({ outlierB: 10, outlierWeights: 10 })) });
  assert.ok(plain.keys[15].hints.some((h) => h.group === 'outliers'), 'key 15 stands out by default');
  assert.ok(!loose.keys[15].hints.some((h) => h.group === 'outliers'), 'not with a wide threshold');
  assert.deepEqual(loose.keys[15].m, plain.keys[15].m, 'same reading');

  const strictUp = analyzeRun(run, { ...ctx, limits: toLimits(thresholds({ upweightMin: 40 })) });
  const upHints = (a) => hintIds(a).filter((id) => id.startsWith('upweight')).length;
  assert.ok(upHints(strictUp) > upHints(plain), `minimum 40 g flags more keys (${upHints(plain)} → ${upHints(strictUp)})`);

  const wide = evenness(plain, 'b', 0, { g: 10, mm: 1 });
  const narrow = evenness(plain, 'b', 0, { g: 0.5, mm: 0.05 });
  assert.equal(wide.within, 1);
  assert.ok(narrow.within < wide.within);
  assert.equal(wide.rms, narrow.rms, 'scatter does not depend on the tolerance');

  const up = (min) => findings({ analysis: strictUp, summary: summarize(strictUp, 88) }, null, { upweightMin: min }).find((f) => f.id === 'upweight');
  assert.equal(up(40).ok, false);
  assert.equal(up(5).ok, true);
});
