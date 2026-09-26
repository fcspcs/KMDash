// Thresholds a technician can set (Piano → Hints). Only the changed ones are stored, the rest stays default.
// They decide when a hint appears and what counts as near the smooth curve. They never change a reading.

export const THRESHOLDS = [
  { id: 'outlierB', unit: 'g', def: 2, min: 0.5, max: 10 },
  { id: 'outlierWeights', unit: 'g', def: 3, min: 0.5, max: 10 },
  { id: 'outlierDip', unit: 'mm', def: 0.3, min: 0.05, max: 2 },
  { id: 'frictionMargin', unit: 'g', def: 5, min: 0.5, max: 20 },
  { id: 'upweightMin', unit: 'g', def: 20, min: 5, max: 40 },
  { id: 'upweightWarnBelow', unit: 'g', def: 5, min: 0.5, max: 20 },
  { id: 'remeasure', unit: 'g', def: 1, min: 0.2, max: 10 },
  { id: 'evenG', unit: 'g', def: 2, min: 0.5, max: 10 },
  { id: 'evenMm', unit: 'mm', def: 0.2, min: 0.05, max: 2 },
  { id: 'unevenRms', unit: 'g', def: 1.5, min: 0.3, max: 10 },
];

const byId = Object.fromEntries(THRESHOLDS.map((th) => [th.id, th]));

export const validThreshold = (id, value) => Number.isFinite(value) && value >= byId[id].min && value <= byId[id].max;

/** All thresholds: valid stored values, defaults for the rest. */
export function thresholds(stored = {}) {
  return Object.fromEntries(THRESHOLDS.map((th) => [th.id, validThreshold(th.id, Number(stored?.[th.id])) ? Number(stored[th.id]) : th.def]));
}

/** The part of the analysis limits (lib/analysis.js LIMITS) the thresholds replace. */
export const toLimits = (th) => ({
  outlier: { b: th.outlierB, d: th.outlierWeights, u: th.outlierWeights, f: th.outlierWeights, dip: th.outlierDip },
  frictionMargin: th.frictionMargin,
  upweightMin: th.upweightMin,
  upweightWarnBelow: th.upweightWarnBelow,
  remeasure: th.remeasure,
  unevenRms: th.unevenRms,
});

/** Distance from the smooth curve that still counts as even, in g for weights and mm for key dip. */
export const toTolerance = (th) => ({ g: th.evenG, mm: th.evenMm });
