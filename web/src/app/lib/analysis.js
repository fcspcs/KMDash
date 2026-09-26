// Analysis of single force curves and of a whole run.
// Thresholds follow common technician practice. The tests use synthetic curves shaped like KMD readings.
import { effective, defaultLastDamperKey } from './store.js';
import { isBlack } from './notes.js';
import { resolveTargets } from './targets.js';
import { corrected } from './calibration.js';
import { median } from './stats.js';

export { median };

export const LIMITS = {
  damperLoad: 15, // g step on the downstroke above the starting level
  damperUp: 8, // g step on the upstroke (confirms it: a damper loads both strokes, let-off mostly the downstroke)
  windowRise: 12, // g force rise inside the measuring window
  letoffMargin: 0.5, // mm let-off starting closer than this to the window end
  frictionWarnKmd: 20, // g, technicians see this as a friction problem on the KMD
  frictionMargin: 5, // g above the guide value = warning
  upweightMin: 20, // g
  upweightWarnBelow: 5, // g below the minimum = warning
  outlier: { b: 2, d: 3, u: 3, f: 3, dip: 0.3 }, // g or mm away from the neighbours' median
  neighbourSpan: 3,
  remeasure: 1, // g balance difference between the last two readings
  damperTiming: 0.5, // mm damper onset away from the neighbours
  lostMotionAt: 1.5, // mm until 80 % of the window force is reached
  lostMotionNeighbours: 0.8,
  unevenRms: 1.5, // g balance scatter around a smooth line
  stopWeightLow: 200, // g, below this the key dip is no longer the key bottom
  pedalUp: 0.7,
  pedalDown: 0.3,
  pedalMinKeys: 6,
  aggregateMinKeys: 8,
};

const featureCache = new WeakMap();

const bottomIndex = (m) => {
  let bottom = 0;
  for (let i = 1; i < m.y.length; i++) if (m.y[i] > m.y[bottom]) bottom = i;
  return bottom;
};

export function downstroke(m) {
  if (!m?.x?.length) return [];
  const bottom = bottomIndex(m);
  return m.x.slice(0, bottom + 1).map((x, i) => ({ x, y: m.y[i] }));
}

export function upstroke(m) {
  if (!m?.x?.length) return [];
  const bottom = bottomIndex(m);
  return m.x.slice(bottom).map((x, i) => ({ x, y: m.y[bottom + i] }));
}

function valueAt(points, x) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (b.x >= x) return a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x || 1);
  }
  return points.at(-1)?.y ?? NaN;
}

/** Start of let-off: a force bump before the key bottom, after which the force drops again. */
function letoffOnset(down, bottomX) {
  let peak = -1;
  for (let i = 1; i < down.length - 1; i++) {
    const p = down[i];
    if (p.x < bottomX - 4 || p.x > bottomX - 0.6) continue;
    if (p.y < down[i - 1].y || p.y < down[i + 1].y) continue;
    const dip = Math.min(...down.slice(i + 1).filter((q) => q.x <= bottomX - 0.3).map((q) => q.y));
    if (p.y - dip >= 2 && (peak < 0 || p.y > down[peak].y)) peak = i;
  }
  if (peak < 0) return null;
  const px = down[peak].x;
  const before = down.filter((p) => p.x >= px - 1.6 && p.x <= px - 0.4).map((p) => p.y);
  if (!before.length) return null;
  const level = Math.min(...before) + 5;
  let onset = null;
  for (let i = 0; i < peak; i++) if (down[i].y <= level) onset = down[i].x;
  return onset;
}

/**
 * Curve features: starting level, rise inside the window, damper step (confirmed on both strokes),
 * start of let-off, travel until full force (lost motion) and whether the stop weight was lowered.
 */
export function curveFeatures(m) {
  if (!m) return null;
  if (featureCache.has(m)) return featureCache.get(m);
  const down = downstroke(m);
  let result = null;
  if (down.length >= 10) {
    const up = upstroke(m);
    const bottomX = down.at(-1).x;
    const between = (points, a, b) => points.filter((p) => p.x >= a && p.x <= b).map((p) => p.y);
    // Early travel after the plunger touches the key, before damper and window effects
    const baseline = median(between(down, 1.2, 2.2));
    // Plateau from mid travel, before let-off and key bottom (last ~2.6 mm)
    const plateau = median(between(down, 4.0, bottomX - 2.6));
    const damperLoad = plateau - baseline;
    const damperUp = median(between(up, 4.0, bottomX - 2.6)) - median(between(up, 1.2, 2.2));
    const damper = damperLoad >= LIMITS.damperLoad && damperUp >= LIMITS.damperUp;
    let damperOnset = null;
    if (damper) {
      const start = down.findIndex((p, i) => p.x > 1.5 && p.y >= baseline + 10 && down.slice(i, i + 3).every((q) => q.y >= baseline + 10));
      damperOnset = start >= 0 ? down[start].x : null;
    }
    const windowLevel = median(between(down, m.twLow, m.twHigh));
    const ramp = down.find((p) => p.y >= 0.8 * windowLevel);
    result = {
      baseline,
      windowRise: valueAt(down, m.twHigh) - valueAt(down, m.twLow),
      damper,
      damperLoad: damper ? damperLoad : 0,
      damperUp: Number.isFinite(damperUp) ? damperUp : 0,
      damperOnset,
      letoff: letoffOnset(down, bottomX),
      rampX: ramp?.x ?? null,
      stopLow: Math.max(...m.y) < LIMITS.stopWeightLow,
      bottomX,
    };
  }
  featureCache.set(m, result);
  return result;
}

export function rangeStatus(value, range) {
  if (value == null || !range) return null;
  if (range.min != null && value < range.min) return 'low';
  if (range.max != null && value > range.max) return 'high';
  return 'ok';
}

const madScale = (values) => {
  if (values.length < 5) return 0;
  const mid = median(values);
  return 1.4826 * median(values.map((v) => Math.abs(v - mid)));
};

/** Quadratic fit across the keyboard, returns the RMS of the residuals. */
export function smoothnessRms(points) {
  if (points.length < 12) return null;
  const xs = points.map((p) => p[0]);
  const lo = Math.min(...xs);
  const span = Math.max(...xs) - lo || 1;
  const rows = points.map(([x, y]) => {
    const t = ((x - lo) / span) * 2 - 1;
    return [1, t, t * t, y];
  });
  // 3x3 normal equations
  const A = [0, 1, 2].map((i) => [0, 1, 2].map((j) => rows.reduce((s, r) => s + r[i] * r[j], 0)));
  const v = [0, 1, 2].map((i) => rows.reduce((s, r) => s + r[i] * r[3], 0));
  const coef = solve3(A, v);
  if (!coef) return null;
  const sq = rows.reduce((s, r) => s + (r[3] - (coef[0] + coef[1] * r[1] + coef[2] * r[2])) ** 2, 0);
  return Math.sqrt(sq / rows.length);
}

function solve3(A, v) {
  const M = A.map((row, i) => [...row, v[i]]);
  for (let c = 0; c < 3; c++) {
    let p = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-9) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k];
    }
  }
  return [0, 1, 2].map((i) => M[i][3] / M[i][i]);
}

// Rules that hit more than half of the keys are shown once for the whole keyboard
const signature = (h) => `${h.id}:${h.vars.metric ?? ''}:${h.vars.status ?? ''}`;

/**
 * Analyses one run.
 * ctx: { numKeys, startNote, targetsAt(key), hints (groups on/off), offset, lastDamperKey, valueMode: { valueMode, perKey }, limits }
 * offset: correction from the test weight calibration. Values are converted (m), the KMD value stays in m.raw.
 * Returns { keys: { [key]: { m, last, list, feat, hints, status, targets, outliers, distorted, level } }, global, pedal }.
 * Hints: { id, group, level: 'warn' | 'info', vars }
 */
export function analyzeRun(run, ctx) {
  const { numKeys, startNote = 0, hints: enabled = {}, offset = {}, valueMode } = ctx;
  // Thresholds set in the app (lib/limits.js) replace the defaults
  const L = ctx.limits ? { ...LIMITS, ...ctx.limits, outlier: { ...LIMITS.outlier, ...ctx.limits.outlier } } : LIMITS;
  const targetsAt = ctx.targetsAt ?? ((key) => resolveTargets(null, key, { numKeys, startNote }));
  // The 20 g friction limit comes from KMD readings, so it is converted too
  const frictionWarnKmd = L.frictionWarnKmd - ((Number(offset.d) || 0) - (Number(offset.u) || 0)) / 2;
  const lastDamper = ctx.lastDamperKey ?? defaultLastDamperKey(numKeys);
  const entries = {};

  for (let key = 1; key <= numKeys; key++) {
    const list = run?.keys[key];
    if (!list?.length) continue;
    const last = list.at(-1);
    const m = corrected(effective(list, valueMode), offset);
    const feat = curveFeatures(last);
    const damper = !!feat?.damper;
    const inWindow = damper && feat.damperOnset != null && feat.damperOnset < last.twHigh;
    entries[key] = { key, m, last, list, feat, damper, inWindow, distorted: inWindow, targets: targetsAt(key) || {}, hints: [], status: {}, outliers: {} };
  }
  const all = Object.values(entries);
  const add = (e, group, id, level, vars = {}) => enabled[group] !== false && e.hints.push({ id, group, level, vars });

  // Pedal state: share of damped keys whose curve shows a damper step
  const damped = all.filter((e) => e.key <= lastDamper && e.feat);
  const withStep = damped.filter((e) => e.damper).length;
  const share = damped.length ? withStep / damped.length : 0;
  const pedal = {
    state: damped.length >= L.pedalMinKeys ? (share > L.pedalUp ? 'up' : share < L.pedalDown ? 'down' : 'mixed') : null,
    share,
    count: withStep,
    total: damped.length,
    lastDamper,
  };

  for (const e of all) {
    const { key, m, last, feat, targets } = e;

    // Damper and pedal
    const before = run.history[run.history.lastIndexOf(key) - 1];
    const prevFeat = before != null && before !== key && Math.abs(before - key) <= 6 && entries[before] ? entries[before].feat : null;
    const pedalChanged = feat && prevFeat && key <= lastDamper && before <= lastDamper && e.damper !== !!prevFeat.damper;
    if (e.inWindow) add(e, 'damper', 'damperInWindow', 'warn', { onset: feat.damperOnset, load: feat.damperLoad });
    else if (pedalChanged) add(e, 'damper', e.damper ? 'pedalChangedOn' : 'pedalChangedOff', 'info', { key: before });
    else if (e.damper && pedal.state === 'down' && key <= lastDamper) add(e, 'damper', 'damperWhilePedal', 'info', { onset: feat.damperOnset });
    else if (e.damper) add(e, 'damper', 'damperLoad', 'info', { onset: feat.damperOnset, load: feat.damperLoad });

    // Curve shape: rise in the window, let-off in the window
    if (!e.inWindow && feat && Math.abs(feat.windowRise) > L.windowRise) add(e, 'curve', 'windowRise', 'warn', { rise: feat.windowRise, low: last.twLow, high: last.twHigh });
    if (!e.inWindow && feat?.letoff != null && feat.letoff < last.twHigh + L.letoffMargin) {
      e.distorted = true;
      add(e, 'curve', 'letoffInWindow', 'warn', { onset: feat.letoff, high: last.twHigh });
    }

    // Friction: guide value by section, or from the targets
    const fr = targets.f;
    if (m.f < 0) add(e, 'friction', 'frictionNegative', 'warn', { value: m.f });
    else if (!e.distorted && fr?.max != null) {
      const warnAt = fr.derived ? Math.min(fr.max + L.frictionMargin, Math.max(frictionWarnKmd, fr.max)) : fr.max + L.frictionMargin;
      // own: the piano's own friction targets instead of the guide values (texts say "target")
      const own = !fr.derived;
      if (m.f > warnAt) add(e, 'friction', 'frictionHigh', 'warn', { value: m.f, max: fr.max, own });
      else if (m.f > fr.max) add(e, 'friction', 'frictionElevated', 'info', { value: m.f, max: fr.max, own });
      else if (fr.min != null && m.f < fr.min) add(e, 'friction', 'frictionLow', 'info', { value: m.f, min: fr.min, own });
    }

    // Up weight: info below the minimum, warning well below
    const upMin = targets.u?.min ?? L.upweightMin;
    let upHint = false;
    if (!e.distorted && m.u < upMin - L.upweightWarnBelow) upHint = add(e, 'upweight', 'upweightVeryLow', 'warn', { value: m.u, min: upMin });
    else if (!e.distorted && m.u < upMin) upHint = add(e, 'upweight', 'upweightLow', 'info', { value: m.u, min: upMin });

    // Targets
    const status = e.status;
    for (const metric of ['d', 'u', 'b']) status[metric] = rangeStatus(m[metric], targets[metric]);
    status.f = rangeStatus(m.f, fr);
    status.dip = feat?.stopLow ? null : rangeStatus(m.dip, targets.dip);
    // Distorted readings (damper or let-off in the window) are not compared with targets
    if (e.distorted) for (const metric of ['d', 'u', 'b', 'f']) status[metric] = null;
    if (!e.distorted) {
      for (const metric of ['d', 'u']) {
        if (metric === 'u' && upHint) continue;
        const st = status[metric];
        if (st === 'low' || st === 'high') add(e, 'targets', 'targetMiss', 'info', { metric, value: m[metric], status: st, min: targets[metric].min, max: targets[metric].max });
      }
      if (status.b === 'low' || status.b === 'high') {
        // Distance to the middle of the target, shown in the title
        const tb = targets.b;
        const target = tb.target ?? (tb.min != null && tb.max != null ? (tb.min + tb.max) / 2 : status.b === 'high' ? tb.max : tb.min);
        add(e, 'targets', 'balanceMiss', 'info', { metric: 'b', value: m.b, status: status.b, min: tb.min, max: tb.max, target, delta: m.b - target });
      }
    }
    if (status.dip === 'low' || status.dip === 'high') add(e, 'dip', 'dipMiss', 'info', { status: status.dip, value: m.dip, min: targets.dip.min, max: targets.dip.max });

    // Spread between repeat readings (the first one after a pause often reads 1.5 to 3 g high)
    const prev = e.list.at(-2);
    if (prev && Math.abs(last.b - prev.b) > L.remeasure) add(e, 'spread', 'remeasure', 'info', { delta: last.b - prev.b });
  }

  // Outliers against the neighbours: robust threshold max(T, 3·s), s from the scatter across the keyboard
  for (const metric of ['b', 'd', 'u', 'f', 'dip']) {
    const usable = (e) => !e.distorted && (metric !== 'dip' || !e.feat?.stopLow);
    const residuals = [];
    for (const e of all) {
      if (!usable(e)) continue;
      const refs = [];
      for (let k = e.key - L.neighbourSpan; k <= e.key + L.neighbourSpan; k++) {
        const n = k !== e.key && entries[k];
        if (!n || !usable(n)) continue;
        if (metric === 'dip' && isBlack(k, startNote) !== isBlack(e.key, startNote)) continue;
        refs.push(n.m[metric]);
      }
      if (refs.length >= 2) residuals.push({ e, ref: median(refs), delta: e.m[metric] - median(refs) });
    }
    const threshold = Math.max(L.outlier[metric], 3 * madScale(residuals.map((r) => r.delta)));
    for (const { e, ref, delta } of residuals) {
      if (Math.abs(delta) <= threshold) continue;
      e.outliers[metric] = delta;
      if (metric === 'b') add(e, 'outliers', 'balanceOutlier', 'warn', { metric, delta, ref });
      else add(e, metric === 'dip' ? 'dip' : 'outliers', 'outlier', 'info', { metric, delta, ref });
    }
  }

  // Damper timing and lost motion, both relative to the neighbours
  for (const e of all) {
    const near = [];
    for (let k = e.key - L.neighbourSpan; k <= e.key + L.neighbourSpan; k++) if (k !== e.key && entries[k]) near.push(entries[k]);
    if (e.damper && e.feat.damperOnset != null) {
      const onsets = near.filter((n) => n.damper && n.feat.damperOnset != null).map((n) => n.feat.damperOnset);
      if (onsets.length >= 2 && Math.abs(e.feat.damperOnset - median(onsets)) > L.damperTiming) {
        add(e, 'damper', 'damperTiming', 'info', { onset: e.feat.damperOnset, ref: median(onsets) });
      }
    }
    if (!e.distorted && e.feat?.rampX > L.lostMotionAt) {
      const ramps = near.filter((n) => !n.distorted && n.feat?.rampX != null).map((n) => n.feat.rampX);
      if (ramps.length >= 2 && median(ramps) < L.lostMotionNeighbours) add(e, 'curve', 'lostMotion', 'info', { at: e.feat.rampX });
    }
  }

  // Hints for the whole keyboard
  const global = [];
  if (pedal.state === 'up') {
    for (const e of all) e.hints = e.hints.filter((h) => h.id !== 'damperLoad');
    if (enabled.damper !== false) global.push({ id: 'pedalUp', group: 'damper', level: all.some((e) => e.inWindow) ? 'warn' : 'info', vars: { count: pedal.count, total: pedal.total } });
  } else if (pedal.state === 'mixed' && enabled.damper !== false) {
    global.push({ id: 'pedalMixed', group: 'damper', level: 'info', vars: { count: pedal.count, total: pedal.total } });
  }

  if (all.length >= L.aggregateMinKeys) {
    const groups = new Map();
    for (const e of all) for (const h of e.hints) groups.set(signature(h), [...(groups.get(signature(h)) || []), [e.key, h]]);
    for (const [sig, found] of groups) {
      if (found.length <= all.length / 2) continue;
      for (const [key] of found) entries[key].hints = entries[key].hints.filter((h) => signature(h) !== sig);
      const [, first] = found[0];
      if (first.id === 'damperInWindow' && global[0]?.id === 'pedalUp') {
        global[0].level = 'warn';
        continue;
      }
      global.push({ id: first.id, group: first.group, level: first.level, aggregated: true, vars: { metric: first.vars.metric, status: first.vars.status, own: first.vars.own, count: found.length, total: all.length, keys: found.map(([k]) => k) } });
    }
  }

  const clean = all.filter((e) => !e.distorted).map((e) => [e.key, e.m.b]);
  const rms = smoothnessRms(clean);
  if (rms != null && rms > L.unevenRms && enabled.outliers !== false) global.push({ id: 'uneven', group: 'outliers', level: 'info', vars: { rms } });

  for (const e of all) e.level = e.hints.some((h) => h.level === 'warn') ? 'warn' : e.hints.length ? 'info' : 'ok';
  global.sort((a, b) => (a.level === b.level ? 0 : a.level === 'warn' ? -1 : 1));
  return { keys: entries, global, pedal };
}
