import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curveFeatures, analyzeRun, smoothnessRms } from '../src/app/lib/analysis.js';
import { measurementFromMessage, createInstrument, withMeasurement, activeRun } from '../src/app/lib/store.js';
import { profileToTargets, resolveTargets } from '../src/app/lib/targets.js';
import { findProfile } from '../src/app/lib/profiles.js';
import { makeReading, pianoKey } from '../src/app/sources/synthetic.js';

// Synthetic readings: 14 bass keys with the damper picked up inside the window (pedal not pressed), 5 clean keys
const damped = Array.from({ length: 14 }, (_, i) => measurementFromMessage(pianoKey(i + 1, 88, { seed: 11, damper: true })));
const clean = Array.from({ length: 5 }, (_, i) => measurementFromMessage(pianoKey(40 + i, 88, { seed: 11 })));
const measurements = [...damped, ...clean];

const ctx = (extra = {}) => ({ numKeys: 88, startNote: 0, hints: {}, ...extra });
const analyze = (run, extra) => analyzeRun(run, ctx(extra));
const runWith = (pairs) => pairs.reduce((run, [key, m]) => withMeasurement(run, key, m), activeRun(createInstrument('t', 'Run 1')));
const hintIds = (result) => result.hints.map((h) => h.id);

/** Clean curve with freely chosen values. */
function synthetic(i, { d = 50, u = 26, dip = 9.8 } = {}) {
  return { ...clean[i % clean.length], d, u, b: (d + u) / 2, f: (d - u) / 2, dip };
}

test('Synthetic readings: averages come from the curve inside the window', () => {
  const msg = makeReading({ down: 50, up: 25, dip: 10, seed: 3 });
  assert.equal(msg.xvalue.length, 100);
  assert.equal(msg.xvalue[50], 10);
  assert.ok(Math.abs(msg.average_downweight - 50) < 2, `down ${msg.average_downweight}`);
  assert.ok(Math.abs(msg.average_upweight - 25) < 2, `up ${msg.average_upweight}`);
  assert.equal(msg.friction, Math.round(((msg.average_downweight - msg.average_upweight) / 2) * 1e6) / 1e6);
  assert.deepEqual(makeReading({ seed: 3 }), makeReading({ seed: 3 }), 'same seed, same curve');
});

test('Damper step in the measuring window is found, clean curves have none', () => {
  measurements.forEach((m, i) => {
    const f = curveFeatures(m);
    if (i < 14) {
      assert.ok(f.damper, `#${i + 1} damper`);
      assert.ok(f.damperLoad > 40, `#${i + 1} load ${f.damperLoad}`);
      assert.ok(f.damperOnset >= 2.0 && f.damperOnset < m.twHigh, `#${i + 1} onset ${f.damperOnset}`);
    } else {
      assert.equal(f.damper, false, `#${i + 1}`);
      assert.equal(f.damperLoad, 0, `#${i + 1} load ${f.damperLoad}`);
      assert.ok(Math.abs(f.windowRise) < 12, `#${i + 1} rise ${f.windowRise}`);
    }
  });
});

test('Damper step is confirmed on the upstroke', () => {
  damped.forEach((m, i) => assert.ok(curveFeatures(m).damperUp > 15, `#${i + 1} up step ${curveFeatures(m).damperUp}`));
  clean.forEach((m, i) => assert.ok(curveFeatures(m).damperUp < 8, `#${i + 15} up step ${curveFeatures(m).damperUp}`));
});

test('Let-off lies well past the measuring window', () => {
  measurements.forEach((m, i) => {
    const { letoff } = curveFeatures(m);
    assert.ok(letoff > 5 && letoff < 8, `#${i + 1} letoff ${letoff}`);
  });
  const a = analyze(runWith(clean.map((m, i) => [40 + i, m])));
  assert.ok(Object.values(a.keys).every((r) => !hintIds(r).includes('letoffInWindow')));
  // Window up to 7 mm: the let-off falls inside it
  const late = analyze(runWith([[40, { ...clean[0], twHigh: 7 }]]));
  assert.ok(hintIds(late.keys[40]).includes('letoffInWindow'));
  assert.ok(late.keys[40].distorted);
});

test('Run: warning for distorted readings, pedal change at the transition', () => {
  const a = analyze(runWith([...damped.slice(0, 5), ...clean].map((m, i) => [30 + i, m])));
  assert.equal(a.pedal.state, 'mixed');
  assert.ok(hintIds(a.keys[30]).includes('damperInWindow'));
  assert.ok(!hintIds(a.keys[30]).includes('frictionHigh'), 'friction not reported twice when the reading is distorted');
  assert.notEqual(a.keys[36].level, 'warn');
  assert.ok(hintIds(a.keys[35]).includes('pedalChangedOff'), 'pedal pressed at the transition is detected');
});

test('Pedal state per run: almost all damped keys with a step = pedal not pressed', () => {
  const a = analyze(runWith(damped.map((m, i) => [10 + i, m])));
  assert.equal(a.pedal.state, 'up');
  const pedalUp = a.global.find((h) => h.id === 'pedalUp');
  assert.ok(pedalUp);
  assert.equal(pedalUp.level, 'warn');
  // The single warnings are merged into one message for the whole keyboard
  assert.ok(Object.values(a.keys).every((r) => !hintIds(r).includes('damperInWindow')));
  assert.ok(Object.values(a.keys).every((r) => r.distorted), 'distorted values stay marked');

  const b = analyze(runWith(clean.flatMap((m, i) => [[10 + 2 * i, m], [11 + 2 * i, m]])));
  assert.equal(b.pedal.state, 'down');
  // Above the last damped key the step does not count
  const c = analyze(runWith(damped.map((m, i) => [75 + i, m])));
  assert.equal(c.pedal.total, 0);
});

test('Friction by section: info above the guide value, warning from +5 g or above 20 g, negative = measure again', () => {
  const a = analyze(runWith([[1, synthetic(0, { d: 55, u: 20 })], [88, synthetic(1, { d: 52, u: 24 })], [80, synthetic(1, { d: 60, u: 20 })], [44, synthetic(2, { d: 40, u: 42 })], [20, synthetic(3, { d: 64, u: 22 })]]));
  assert.ok(hintIds(a.keys[1]).includes('frictionElevated'), 'bass: 17.5 g above F_hi(1) = 17 g');
  assert.equal(a.keys[1].level, 'info');
  assert.ok(hintIds(a.keys[88]).includes('frictionElevated'), 'treble: 14 g above F_hi(88) = 13 g');
  assert.ok(hintIds(a.keys[80]).includes('frictionHigh'), 'treble: 20 g above F_hi + 5');
  assert.ok(hintIds(a.keys[44]).includes('frictionNegative'));
  assert.ok(hintIds(a.keys[20]).includes('frictionHigh'), 'bass: 21 g above 20 g');
});

test('Upweight: info below 20 g, warning below 15 g', () => {
  const a = analyze(runWith([[30, synthetic(0, { u: 18 })], [60, synthetic(1, { u: 13 })]]));
  assert.ok(hintIds(a.keys[30]).includes('upweightLow'));
  assert.equal(a.keys[30].level, 'info');
  assert.ok(hintIds(a.keys[60]).includes('upweightVeryLow'));
  assert.equal(a.keys[60].level, 'warn');
});

test('Balance outlier of more than 2 g against the neighbours is a warning', () => {
  const pairs = [];
  for (let key = 20; key <= 40; key++) pairs.push([key, synthetic(key, { d: 52 - key * 0.05, u: 26 })]);
  pairs[10] = [30, synthetic(30, { d: 52 - 30 * 0.05 + 5, u: 26 })]; // Balance +2.5 g
  const a = analyze(runWith(pairs));
  assert.ok(hintIds(a.keys[30]).includes('balanceOutlier'));
  assert.equal(a.keys[30].level, 'warn');
  assert.ok(!hintIds(a.keys[29]).includes('balanceOutlier'));
});

test('Rule hit on more than half the keys: one message instead of many', () => {
  const pairs = [];
  for (let key = 1; key <= 20; key++) pairs.push([key, synthetic(key, { d: 44, u: 18 })]);
  const a = analyze(runWith(pairs));
  const agg = a.global.find((h) => h.id === 'upweightLow');
  assert.ok(agg?.aggregated);
  assert.equal(agg.vars.count, 20);
  assert.ok(Object.values(a.keys).every((r) => !hintIds(r).includes('upweightLow')));
});

test('Targets from a Steinway profile: sections, slope, tolerance, key color', () => {
  const targets = profileToTargets(findProfile('steinway-ny-b'), 88);
  const at = (key) => resolveTargets(targets, key, { numKeys: 88, startNote: 0 });
  assert.equal(at(1).d.target, 51);
  assert.equal(at(14).d.target, 50);
  assert.equal(at(25).d.target, 49);
  assert.equal(at(88).d.target, 46);
  assert.deepEqual([at(1).d.min, at(1).d.max], [49, 53]);
  assert.equal(at(1).u.min, 19);
  assert.equal(at(2).dip, null, 'A#0 is black');
  assert.equal(at(4).dip.min, 9.91);
  // Balance derived from Down and Up
  assert.deepEqual([at(40).b.min, at(40).b.max], [(46 + 19) / 2, (50 + 25) / 2]);
  // Friction without own values: guide value 17 g (bass) to 13 g (treble)
  assert.equal(at(1).f.max, 17);
  assert.ok(Math.abs(at(88).f.max - 13) < 1e-9);
});

test('KMD correction converts readings to test weights, the raw value is kept', () => {
  const a = analyze(runWith([[1, synthetic(0, { d: 55, u: 20 })]]), { offset: { d: 4, u: -2 } });
  const m = a.keys[1].m;
  assert.equal(m.d, 51);
  assert.equal(m.u, 22);
  assert.equal(m.b, 36.5);
  assert.equal(m.f, 14.5);
  assert.equal(m.raw.d, 55);
  // 17.5 g friction on the KMD converts to 14.5 g, which is below the 17 g guide value
  assert.ok(!hintIds(a.keys[1]).includes('frictionElevated'));
});

test('Balance off target: distance to the middle of the target', () => {
  const targets = profileToTargets(findProfile('steinway-hamburg-b'), 88);
  const a = analyze(runWith([[40, synthetic(0, { d: 56, u: 26 })]]), { targetsAt: (key) => resolveTargets(targets, key, { numKeys: 88 }) });
  const hint = a.keys[40].hints.find((h) => h.id === 'balanceMiss');
  assert.ok(hint);
  assert.equal(hint.vars.status, 'high');
  assert.ok(Math.abs(hint.vars.delta - (41 - 34.5)) < 1e-9, `delta ${hint.vars.delta}`);
});

test('Uneven curve across the keyboard', () => {
  const smooth = Array.from({ length: 30 }, (_, i) => [i + 1, 38 - i * 0.05]);
  assert.ok(smoothnessRms(smooth) < 0.01);
  const rough = smooth.map(([k, b]) => [k, b + (k % 2 ? 2 : -2)]);
  assert.ok(smoothnessRms(rough) > 1.5);
});
