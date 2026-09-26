// Calibration against test weights: measure a few keys with the KMD and with brass weights and
// work out how to convert KMD readings. Nothing on the device is changed.
// The KMD averages over part of the key travel and moves through let-off, so down and up weight usually
// read a few grams off compared with weights and friction reads higher, while balance agrees well.
import { median } from './stats.js';

export const CALIBRATION = {
  minKeys: 3, // keys needed before the correction counts as reliable
  maxSpread: 1.5, // g robust spread of the differences between keys
  balanceAgree: 1.5, // g, KMD and weights should agree this well on balance
  readings: 3, // KMD value of a key: median of the last readings
};

const robustSpread = (values) => {
  if (values.length < 3) return null;
  const mid = median(values);
  return 1.4826 * median(values.map((v) => Math.abs(v - mid)));
};

/** KMD value of a key for calibration: median of the last readings (the first after a pause often reads high). */
export function kmdReference(list) {
  if (!list?.length) return null;
  const used = list.slice(-CALIBRATION.readings);
  return { d: median(used.map((m) => m.d)), u: median(used.map((m) => m.u)), n: used.length };
}

/**
 * Correction from comparison readings. entries: [{ kmd: { d, u }, weights: { d, u } }]
 * Returns how much higher the KMD reads (positive = higher), plus checks.
 */
export function computeCorrection(entries) {
  const valid = entries.filter((e) => [e.kmd?.d, e.kmd?.u, e.weights?.d, e.weights?.u].every((v) => Number.isFinite(v)));
  if (!valid.length) return null;
  const dd = valid.map((e) => e.kmd.d - e.weights.d);
  const du = valid.map((e) => e.kmd.u - e.weights.u);
  const db = valid.map((e) => (e.kmd.d + e.kmd.u) / 2 - (e.weights.d + e.weights.u) / 2);
  const d = median(dd);
  const u = median(du);
  const spread = Math.max(robustSpread(dd) ?? 0, robustSpread(du) ?? 0);
  const balance = median(db);
  const notes = [];
  if (valid.length < CALIBRATION.minKeys) notes.push('fewKeys');
  if (spread > CALIBRATION.maxSpread) notes.push('spread');
  if (Math.abs(balance) > CALIBRATION.balanceAgree) notes.push('balance');
  return { n: valid.length, d, u, balance, friction: (d - u) / 2, spread, notes, reliable: !notes.length };
}

/** Convert KMD values to test weight values. Balance and friction follow from down and up like on the KMD. */
export function corrected(m, offset) {
  const od = Number(offset?.d) || 0;
  const ou = Number(offset?.u) || 0;
  if (!m || (!od && !ou)) return m;
  const d = m.d - od;
  const u = m.u - ou;
  return { ...m, d, u, b: (d + u) / 2, f: (d - u) / 2, raw: m };
}
