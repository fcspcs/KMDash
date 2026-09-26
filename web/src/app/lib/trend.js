// Smooth curve across the keyboard: a polynomial over the key number, like the trendlines technicians fit
// in their spreadsheets (2nd degree for a few keys, 3rd degree from 30 keys on). Fitted twice: keys far off
// the first curve are left out of the second one, so a single bad key does not bend it.
import { median } from './stats.js';

/** Solves A·x = b (Gaussian elimination with pivoting), null if singular. */
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/**
 * points: [[key, value]]. minOutlier: keys closer than this (g or mm) to the first curve always count.
 * Returns { at(key), lo, hi, degree } or null with fewer than 6 keys. The curve is only defined from lo to hi.
 */
export function fitTrend(points, { degree = null, minOutlier = 1 } = {}) {
  const pts = points.filter(([k, v]) => Number.isFinite(k) && Number.isFinite(v));
  if (pts.length < 6) return null;
  const lo = Math.min(...pts.map((p) => p[0]));
  const hi = Math.max(...pts.map((p) => p[0]));
  if (hi - lo < 5) return null;
  const deg = degree ?? (pts.length >= 30 ? 3 : 2);
  const t = (key) => ((key - lo) / (hi - lo)) * 2 - 1;

  const fit = (list) => {
    const n = deg + 1;
    const A = Array.from({ length: n }, () => Array(n).fill(0));
    const b = Array(n).fill(0);
    for (const [key, value] of list) {
      const pow = [1];
      for (let i = 1; i < n; i++) pow.push(pow[i - 1] * t(key));
      for (let i = 0; i < n; i++) {
        b[i] += pow[i] * value;
        for (let j = 0; j < n; j++) A[i][j] += pow[i] * pow[j];
      }
    }
    return solve(A, b);
  };
  const valueAt = (coef, key) => coef.reduceRight((y, c) => y * t(key) + c, 0);

  let coef = fit(pts);
  if (!coef) return null;
  const residuals = pts.map(([k, v]) => v - valueAt(coef, k));
  const mid = median(residuals);
  const limit = Math.max(minOutlier, 3 * 1.4826 * median(residuals.map((r) => Math.abs(r - mid))));
  const kept = pts.filter((_, i) => Math.abs(residuals[i]) <= limit);
  if (kept.length < pts.length && kept.length >= deg + 4) coef = fit(kept) ?? coef;
  return { at: (key) => valueAt(coef, key), lo, hi, degree: deg };
}
