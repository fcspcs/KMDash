import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCorrection, kmdReference, corrected } from '../src/app/lib/calibration.js';

const entry = (kd, ku, wd, wu) => ({ kmd: { d: kd, u: ku }, weights: { d: wd, u: wu } });

test('Correction from comparison readings: median of the differences', () => {
  // KMD reads Down 3 g higher and Up 3 g lower (friction +3 g, balance the same), one key is an outlier
  const r = computeCorrection([entry(53, 22, 50, 25), entry(51, 23, 48, 26), entry(49.5, 24, 46.5, 27), entry(60, 24, 50, 25)]);
  assert.equal(r.n, 4);
  assert.equal(r.d, 3);
  assert.equal(r.u, -3);
  assert.equal(r.friction, 3);
  assert.ok(Math.abs(r.balance) < 0.5);
  assert.ok(r.reliable, r.notes.join());
});

test('Notes for too few keys, spread or a balance offset', () => {
  assert.deepEqual(computeCorrection([entry(53, 22, 50, 25)]).notes, ['fewKeys']);
  const noisy = computeCorrection([entry(53, 22, 50, 25), entry(56, 20, 48, 26), entry(47, 27, 46, 27), entry(52, 25, 50, 25)]);
  assert.ok(noisy.notes.includes('spread'));
  const off = computeCorrection([entry(55, 27, 50, 25), entry(53, 28, 48, 26), entry(51, 29, 46, 27)]);
  assert.ok(off.notes.includes('balance'));
  assert.equal(computeCorrection([]), null);
});

test('KMD value of a key: median of the last three readings', () => {
  const list = [{ d: 60, u: 20 }, { d: 52, u: 24 }, { d: 51, u: 25 }, { d: 51.5, u: 24.5 }];
  assert.deepEqual(kmdReference(list), { d: 51.5, u: 24.5, n: 3 });
  assert.equal(kmdReference([]), null);
});

test('Conversion changes nothing without a correction', () => {
  const m = { d: 50, u: 26, b: 38, f: 12, dip: 10 };
  assert.equal(corrected(m, { d: 0, u: 0 }), m);
  assert.equal(corrected(m, null), m);
  assert.equal(corrected(m, { d: 2, u: 0 }).f, 11);
});
