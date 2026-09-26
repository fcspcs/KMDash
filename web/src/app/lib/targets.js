// A piano's own targets: for each value a list of ranges across the keys.
//   Range: { from, to, kind: 'range', min, max }            (min or max may be empty)
//   Slope: { from, to, kind: 'slope', start, end, tol }     (start value to end value, ± tolerance)
// Where ranges overlap, the later one wins. Missing values are derived:
//   balance from down and up weight, friction from common technician guide values.
// Targets are test weight values. The calibration (lib/calibration.js) converts the readings instead.
import { SECTION_ENDS } from './profiles.js';
import { isBlack } from './notes.js';

export const TARGET_METRICS = ['d', 'u', 'b', 'f', 'dip'];

const num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const round = (v, step) => (v == null ? null : Math.round(v / step) * step);

/** Standard sections (keys 1-13, 14-25, 26-49, 50-61, 62-88), scaled to other key counts. */
export function standardSections(numKeys) {
  const out = [];
  let from = 1;
  for (const end of SECTION_ENDS) {
    const to = Math.min(numKeys, Math.round((end * numKeys) / 88));
    if (to >= from) out.push([from, to]);
    from = to + 1;
  }
  if (out.length && out.at(-1)[1] < numKeys) out.at(-1)[1] = numKeys;
  return out;
}

/** Factory profile as editable targets. */
export function profileToTargets(profile, numKeys) {
  const all = { from: 1, to: numKeys };
  const metrics = { d: [], u: [], b: [], f: [], dip: [] };
  const down = profile.down;
  if (down?.sections) {
    let start = 0;
    for (const [end, value] of down.sections) {
      const from = Math.round((start * numKeys) / 88) + 1;
      const to = Math.min(numKeys, Math.round((end * numKeys) / 88));
      const [a, b] = Array.isArray(value) ? value : [value, value];
      if (to >= from) metrics.d.push({ from, to, kind: 'slope', start: a, end: b, tol: down.tol ?? 2 });
      start = end;
    }
  } else if (down) {
    metrics.d.push({ ...all, kind: 'range', min: down.min ?? null, max: down.max ?? null });
  }
  if (profile.up) metrics.u.push({ ...all, kind: 'range', min: profile.up.min ?? null, max: profile.up.max ?? null });
  if (profile.balance) metrics.b.push({ ...all, kind: 'range', min: profile.balance.min ?? null, max: profile.balance.max ?? null });
  if (profile.friction?.max != null) metrics.f.push({ ...all, kind: 'range', min: profile.friction.min ?? null, max: profile.friction.max });
  if (profile.keyDip) metrics.dip.push({ ...all, kind: 'range', min: profile.keyDip.min ?? null, max: profile.keyDip.max ?? null });
  return { source: profile.id, edited: false, metrics };
}

export const emptyTargets = () => ({ source: null, edited: true, metrics: { d: [], u: [], b: [], f: [], dip: [] } });

function segmentValue(s, key) {
  if (s.kind === 'slope') {
    const start = num(s.start);
    const end = num(s.end) ?? start;
    if (start == null) return null;
    const frac = s.to > s.from ? (key - s.from) / (s.to - s.from) : 0;
    const target = start + (end - start) * frac;
    const tol = Math.abs(num(s.tol) ?? 0);
    return { min: target - tol, max: target + tol, target };
  }
  const min = num(s.min);
  const max = num(s.max);
  if (min == null && max == null) return null;
  return { min, max, target: min != null && max != null ? (min + max) / 2 : null };
}

/** Own target of a value at one key, without derived values. */
export function ownValue(targets, metric, key) {
  const list = targets?.metrics?.[metric] || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i];
    if (key >= s.from && key <= s.to) {
      const v = segmentValue(s, key);
      if (v) return v;
    }
  }
  return null;
}

/** Friction guide values (test weights): 9 to 17 g in the bass, 5 to 13 g in the treble. */
export function defaultFriction(key, numKeys) {
  const n = numKeys > 1 ? 1 + ((key - 1) * 87) / (numKeys - 1) : 1;
  const drop = (4 * (n - 1)) / 87;
  return { min: 9 - drop, max: 17 - drop, target: null };
}

/** Target including derived values (balance, friction), regardless of key colour. */
export function metricValue(targets, metric, key, numKeys) {
  const own = ownValue(targets, metric, key);
  if (own) return own;
  if (metric === 'b') {
    const d = ownValue(targets, 'd', key);
    const u = ownValue(targets, 'u', key);
    if (d?.min == null || d?.max == null || u?.min == null) return null;
    const min = (d.min + u.min) / 2;
    const max = (d.max + (u.max ?? u.min + 6)) / 2;
    return { min, max, target: (min + max) / 2, derived: true };
  }
  if (metric === 'f') return { ...defaultFriction(key, numKeys), derived: true };
  return null;
}

/** Shift a range, e.g. a target band into raw KMD values for the curve view. */
export const shiftRange = (range, by) =>
  range && by
    ? { ...range, min: range.min != null ? range.min + by : null, max: range.max != null ? range.max + by : null, target: range.target != null ? range.target + by : null }
    : range;

/**
 * Targets of one key: { d, u, b, f, dip }, each { min, max, target } or null.
 * Key dip applies to white keys only (sharps are set from the aftertouch of the naturals).
 */
export function resolveTargets(targets, key, { numKeys, startNote = 0 }) {
  return {
    d: metricValue(targets, 'd', key, numKeys),
    u: metricValue(targets, 'u', key, numKeys),
    b: metricValue(targets, 'b', key, numKeys),
    f: metricValue(targets, 'f', key, numKeys),
    dip: isBlack(key, startNote) ? null : metricValue(targets, 'dip', key, numKeys),
  };
}

const STEP = { d: 0.5, u: 0.5, b: 0.5, f: 0.5, dip: 0.05 };

/** Splits a value into the standard sections, keeping the current values. */
export function splitIntoSections(targets, metric, numKeys) {
  const step = STEP[metric];
  return standardSections(numKeys).map(([from, to]) => {
    const a = metricValue(targets, metric, from, numKeys);
    const b = metricValue(targets, metric, to, numKeys);
    if (metric === 'd' || metric === 'b') {
      const tol = a?.target != null ? round((a.max - a.min) / 2, step) : 2;
      return { from, to, kind: 'slope', start: round(a?.target ?? null, step), end: round(b?.target ?? null, step), tol };
    }
    const mid = metricValue(targets, metric, Math.round((from + to) / 2), numKeys);
    return { from, to, kind: 'range', min: metric === 'f' ? null : round(mid?.min ?? null, step), max: round(mid?.max ?? null, step) };
  });
}

/** New range over the whole keyboard, prefilled with the current values in the middle. */
export function newSegment(targets, metric, numKeys, from = 1, to = numKeys) {
  const step = STEP[metric];
  const v = metricValue(targets, metric, Math.round((from + to) / 2), numKeys);
  if (metric === 'd' || metric === 'b') {
    return { from, to, kind: 'slope', start: round(v?.target ?? null, step), end: round(v?.target ?? null, step), tol: v?.target != null ? round((v.max - v.min) / 2, step) : 2 };
  }
  return { from, to, kind: 'range', min: metric === 'f' ? null : round(v?.min ?? null, step), max: round(v?.max ?? null, step) };
}
