// Numbers for the report: a summary per run, averages by section and the changes from one run to the next.
// Works on the output of analyzeRun (lib/analysis.js), so the report shows the same values as the app.
import { standardSections } from './targets.js';
import { fitTrend } from './trend.js';
import { isBlack, noteName } from './notes.js';
import { hintName } from './hints.js';
import { t, lang } from './i18n.js';

export const REPORT_METRICS = ['d', 'u', 'b', 'f', 'dip'];

const mean = (values) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);

// Weights of skewed readings (damper or let-off in the window) stay out, like in the charts.
// Key dip counts unless the stop weight was too low to reach the key bottom.
const usable = (e, metric) => (metric === 'dip' ? !e.feat?.stopLow : !e.distorted);

function averages(entries) {
  return Object.fromEntries(REPORT_METRICS.map((metric) => [metric, mean(entries.filter((e) => usable(e, metric) && Number.isFinite(e.m[metric])).map((e) => e.m[metric]))]));
}

/** Measuring window used by most readings of a run, as { low, high }. */
export function runWindow(entries) {
  const counts = new Map();
  for (const e of entries) {
    if (!Number.isFinite(e.last?.twLow) || !Number.isFinite(e.last?.twHigh)) continue;
    const id = `${e.last.twLow}|${e.last.twHigh}`;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  const best = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (!best) return null;
  const [low, high] = best[0].split('|').map(Number);
  return { low, high };
}

/** Summary of one analysed run. */
export function summarize(analysis, numKeys) {
  const entries = Object.values(analysis.keys);
  return {
    measured: entries.length,
    warnings: entries.filter((e) => e.level === 'warn').length,
    distorted: entries.filter((e) => e.distorted).length,
    avg: averages(entries),
    sections: standardSections(numKeys).map(([from, to]) => {
      const inside = entries.filter((e) => e.key >= from && e.key <= to);
      return { from, to, n: inside.length, avg: averages(inside) };
    }),
    window: runWindow(entries),
  };
}

/**
 * Changes from one run to a later one, for the keys measured in both.
 * Rows: { key, delta: { d, u, b, f, dip }, skewed } where skewed marks a damper or let-off in the window
 * in either run: its weight changes say little and stay out of the mean.
 */
export function changes(before, after) {
  const rows = [];
  for (const [k, e] of Object.entries(after.keys)) {
    const b = before.keys[k];
    if (!b) continue;
    const delta = Object.fromEntries(REPORT_METRICS.map((metric) => [metric, e.m[metric] - b.m[metric]]));
    rows.push({ key: Number(k), delta, skewed: e.distorted || b.distorted, dipOk: !e.feat?.stopLow && !b.feat?.stopLow });
  }
  rows.sort((a, b) => a.key - b.key);
  const avg = Object.fromEntries(
    REPORT_METRICS.map((metric) => [metric, mean(rows.filter((r) => (metric === 'dip' ? r.dipOk : !r.skewed)).map((r) => r.delta[metric]))]),
  );
  return { rows, avg };
}

/** Consecutive pairs of runs in the order given (oldest first): [[a, b], [b, c], ...]. */
export const pairs = (list) => list.slice(1).map((run, i) => [list[i], run]);

// --- Evenness ------------------------------------------------------------------------------------

/** Distance from the smooth curve that still counts as even: 2 g (common result in technicians' reports), 0.2 mm dip. */
export const DEFAULT_TOLERANCE = { g: 2, mm: 0.2 };

// Key dip: white keys only, sharps are set from the naturals and sit on their own level
const evenUsable = (e, metric, startNote) => (metric === 'dip' ? !e.feat?.stopLow && !isBlack(e.key, startNote) : !e.distorted);

/**
 * Evenness of one value across the keyboard: smooth curve, each key's distance from it, the typical distance
 * (RMS, "scatter"), the share of keys within the tolerance, the span and the share of keys inside the targets.
 */
export function evenness(analysis, metric, startNote = 0, tol = DEFAULT_TOLERANCE) {
  const all = Object.values(analysis.keys);
  const points = all.filter((e) => evenUsable(e, metric, startNote) && Number.isFinite(e.m[metric])).map((e) => [e.key, e.m[metric]]);
  const values = points.map((p) => p[1]);
  const trend = fitTrend(points, { minOutlier: metric === 'dip' ? 0.1 : 1 });
  const deviation = trend ? Object.fromEntries(points.map(([k, v]) => [k, v - trend.at(k)])) : {};
  const residuals = Object.values(deviation);
  const tolerance = metric === 'dip' ? tol.mm : tol.g;
  const judged = all.filter((e) => e.status[metric] != null);
  return {
    n: points.length,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    span: values.length ? Math.max(...values) - Math.min(...values) : null,
    rms: residuals.length ? Math.sqrt(mean(residuals.map((r) => r * r))) : null,
    within: residuals.length ? residuals.filter((r) => Math.abs(r) <= tolerance + 1e-9).length / residuals.length : null,
    inTarget: judged.length ? judged.filter((e) => e.status[metric] === 'ok').length / judged.length : null,
    judged: judged.length,
    trend,
    deviation,
    tolerance,
  };
}

export const evennessAll = (analysis, startNote = 0, tol = DEFAULT_TOLERANCE) =>
  Object.fromEntries(REPORT_METRICS.map((metric) => [metric, evenness(analysis, metric, startNote, tol)]));

// --- Findings ------------------------------------------------------------------------------------

export const EVEN_OK = 0.9; // share of keys within the tolerance or the targets that counts as good

/**
 * Short findings for the top of the report, from the newest run (and the oldest one for "before").
 * Each: { id, ok, vars } with the numbers the texts need. Computed from the values, not from the hints,
 * so switched off hint groups do not change the findings.
 */
export function findings(now, before = null, { startNote = 0, tolerance = DEFAULT_TOLERANCE, upweightMin = 20 } = {}) {
  const out = [];
  const entries = Object.values(now.analysis.keys);
  const even = now.even ?? evennessAll(now.analysis, startNote, tolerance);
  const prev = before ? (before.even ?? evennessAll(before.analysis, startNote, tolerance)) : null;
  if (!entries.length) return out;

  const b = even.b;
  if (b.within != null) out.push({ id: 'even', ok: b.within >= EVEN_OK, vars: { within: b.within, rms: b.rms, span: b.span, before: prev?.b.within ?? null } });

  if (b.judged) {
    const judged = entries.filter((e) => e.status.b != null && e.targets.b);
    const middle = (tb) => tb.target ?? (tb.min != null && tb.max != null ? (tb.min + tb.max) / 2 : (tb.min ?? tb.max));
    const offset = mean(judged.map((e) => e.m.b - middle(e.targets.b)));
    out.push({ id: 'target', ok: b.inTarget >= EVEN_OK, vars: { n: judged.filter((e) => e.status.b === 'ok').length, total: judged.length, offset, before: prev?.b.inTarget ?? null } });
  }

  const f = even.f;
  if (f.judged) {
    const high = entries.filter((e) => e.status.f === 'high' || e.m.f < 0).map((e) => e.key);
    out.push({ id: 'friction', ok: f.inTarget >= EVEN_OK && !entries.some((e) => e.m.f < 0), vars: { n: entries.filter((e) => e.status.f === 'ok').length, total: f.judged, avg: now.summary?.avg.f ?? null, high, before: prev?.f.inTarget ?? null } });
  }

  const upClean = entries.filter((e) => !e.distorted);
  if (upClean.length) {
    const minOf = (e) => e.targets.u?.min ?? upweightMin;
    const low = upClean.filter((e) => e.m.u < minOf(e)).map((e) => e.key);
    const lowest = upClean.reduce((a, e) => (e.m.u < a.m.u ? e : a));
    out.push({ id: 'upweight', ok: !low.length, vars: { low, min: minOf(lowest), lowest: lowest.m.u } });
  }

  const dip = even.dip;
  if (dip.judged) {
    const off = entries.filter((e) => e.status.dip === 'high' || e.status.dip === 'low').map((e) => e.key);
    out.push({ id: 'dip', ok: dip.inTarget >= EVEN_OK, vars: { mode: 'target', n: dip.judged - off.length, total: dip.judged, off } });
  } else if (dip.within != null) {
    out.push({ id: 'dip', ok: dip.within >= EVEN_OK, vars: { mode: 'even', within: dip.within } });
  }

  const distorted = entries.filter((e) => e.distorted).length;
  const pedal = now.analysis.pedal?.state ?? null;
  out.push({ id: 'quality', ok: !distorted && pedal !== 'up' && pedal !== 'mixed', vars: { distorted, pedal } });
  return out;
}

// --- Detailed table ------------------------------------------------------------------------------

/**
 * Every key of a run with note, section, values as shown in the app, the KMD's own values, targets,
 * distance to the smooth curve and hints. German: semicolons and decimal commas, so Excel opens it directly.
 */
export function detailsCsv(analysis, { numKeys, startNote = 0, targetsAt, tolerance = DEFAULT_TOLERANCE }) {
  const german = lang() === 'de';
  const sep = german ? ';' : ',';
  const num = (value, digits) => (value == null || !Number.isFinite(value) ? '' : german ? value.toFixed(digits).replace('.', ',') : value.toFixed(digits));
  const text = (value) => (/[";,\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const even = evennessAll(analysis, startNote, tolerance);
  const sections = standardSections(numKeys);
  const sectionOf = (key) => {
    const s = sections.find(([from, to]) => key >= from && key <= to);
    return s ? `${noteName(s[0], startNote)} ${t('to')} ${noteName(s[1], startNote)}` : '';
  };
  const digits = (metric) => (metric === 'dip' ? 3 : 2);
  const middle = (r) => (r ? (r.target ?? (r.min != null && r.max != null ? (r.min + r.max) / 2 : null)) : null);

  const rows = [t('csvHead').split('|').map(text).join(sep)];
  for (let key = 1; key <= numKeys; key++) {
    const e = analysis.keys[key];
    const targets = e?.targets ?? targetsAt?.(key) ?? {};
    const raw = e?.m.raw ?? e?.m;
    const spread = e && e.list.length > 1 ? Math.max(...e.list.map((m) => m.b)) - Math.min(...e.list.map((m) => m.b)) : null;
    const cells = [
      key,
      noteName(key, startNote),
      isBlack(key, startNote) ? t('keyBlack') : t('keyWhite'),
      text(sectionOf(key)),
      ...REPORT_METRICS.map((metric) => num(e?.m[metric], digits(metric))),
      num(raw?.d, 2),
      num(raw?.u, 2),
      e ? e.list.length : '',
      num(spread, 2),
      ...REPORT_METRICS.flatMap((metric) => [num(targets[metric]?.min, digits(metric)), num(targets[metric]?.max, digits(metric))]),
      ...REPORT_METRICS.map((metric) => num(even[metric].deviation[key], digits(metric))),
      num(e && middle(targets.b) != null ? e.m.b - middle(targets.b) : null, 2),
      e ? (e.distorted ? t('yes') : t('no')) : '',
      e ? (e.level === 'warn' ? t('yes') : t('no')) : '',
      text(e ? e.hints.map(hintName).join(' | ') : ''),
      e?.last?.t ? new Date(e.last.t).toISOString() : '',
    ];
    rows.push(cells.join(sep));
  }
  return '\ufeff' + rows.join('\n') + '\n';
}
