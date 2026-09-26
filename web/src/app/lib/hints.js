// Hint texts: title and explanation of a hint from lib/analysis.js, used in the app and in the report.
import { fmt, fmtDip, fmtSigned, fmtRange } from './format.js';
import { t, has } from './i18n.js';

function vars(hint) {
  const v = hint.vars;
  const isDip = v.metric === 'dip' || hint.id === 'dipMiss';
  const num = isDip ? fmtDip : fmt;
  const unit = isDip ? 'mm' : 'g';
  return {
    key: v.key,
    onset: fmt(v.onset),
    at: fmt(v.at),
    load: fmt(v.load),
    rise: fmtSigned(v.rise ?? 0),
    low: fmt(v.low),
    high: fmt(v.high),
    value: num(v.value),
    target: num(v.target),
    max: num(v.max),
    min: num(v.min),
    range: fmtRange({ min: v.min, max: v.max }, isDip ? 'dip' : 'd'),
    delta: `${fmtSigned(v.delta ?? 0, isDip ? 2 : 1)} ${unit}`,
    by: fmt(Math.abs(v.delta ?? 0)),
    ref: v.ref != null ? `${num(v.ref)} ${unit}` : '',
    refMm: fmt(v.ref),
    rms: `${fmt(v.rms)} g`,
    count: v.count,
    total: v.total,
    metric: v.metric ? t(`metric_${v.metric}`) : '',
  };
}

// With the piano's own targets some hints have their own wording ("target" instead of "guide value")
const own = (hint, key) => (hint.vars.own && has(`${key}_own`) ? `${key}_own` : key);
const variant = (hint) => {
  const base = `${hint.id}${hint.vars.status ? '_' + hint.vars.status : ''}`;
  return own(hint, `hint_${base}`).slice(5);
};
const nameKey = (hint) => own(hint, `name_${hint.id}`);

export function hintTitle(hint) {
  const v = vars(hint);
  if (!hint.aggregated) return t(`hint_${variant(hint)}`, v);
  return t('agg', { ...v, name: t(nameKey(hint), v) });
}

export function hintDetail(hint) {
  const v = vars(hint);
  if (!hint.aggregated) return t(`hint_${variant(hint)}_detail`, v);
  const key = hint.vars.own && has(`agg_${hint.id}_own_detail`) ? `agg_${hint.id}_own_detail` : `agg_${hint.id}_detail`;
  return has(key) ? t(key, v) : t('agg_detail', v);
}

/** Short name of a hint, without values (for table columns). */
export const hintName = (hint) => t(nameKey(hint), vars(hint));
