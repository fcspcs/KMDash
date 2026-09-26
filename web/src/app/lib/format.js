import { lang, t } from './i18n.js';

// Numbers in the format of the app language, not the system language (otherwise "48,5" in English text)
const cache = new Map();
function formatter(digits) {
  const id = `${lang()}:${digits}`;
  if (!cache.has(id)) cache.set(id, new Intl.NumberFormat(lang() === 'de' ? 'de-DE' : 'en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }));
  return cache.get(id);
}

export const EMPTY = '·';

/** A number typed by hand: comma or point as decimal separator in both languages, "−" as minus, spaces ignored.
 *  Empty gives null, anything else that is not a number gives NaN. */
export function parseNumber(raw) {
  const clean = String(raw ?? '').replace(/\s+/g, '').replace(/[−–]/g, '-').replace(',', '.');
  if (clean === '') return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : NaN;
}
const missing = (value) => value == null || Number.isNaN(value);

export const fmt = (value) => (missing(value) ? EMPTY : formatter(1).format(value));
export const fmtDip = (value) => (missing(value) ? EMPTY : formatter(2).format(value));
export const fmtPct = (value) => (missing(value) ? EMPTY : new Intl.NumberFormat(lang() === 'de' ? 'de-DE' : 'en-US', { style: 'percent', maximumFractionDigits: 0 }).format(value));
export const fmtSigned = (value, digits = 1) => (missing(value) ? EMPTY : (value > 0.05 ? '+' : value < -0.05 ? '−' : '±') + formatter(digits).format(Math.abs(value)));

export const METRICS = [
  { id: 'd', unit: 'g', format: fmt },
  { id: 'u', unit: 'g', format: fmt },
  { id: 'b', unit: 'g', format: fmt },
  { id: 'f', unit: 'g', format: fmt },
  { id: 'dip', unit: 'mm', format: fmtDip },
];

export const formatOf = (metric) => (metric === 'dip' ? fmtDip : fmt);
export const unitOf = (metric) => (metric === 'dip' ? 'mm' : 'g');

/** "46.0 to 50.0 g", "at least 19.0 g" or "at most 17.0 g" */
export function fmtRange(range, metric) {
  if (!range) return '';
  const f = formatOf(metric);
  const unit = unitOf(metric);
  if (range.min != null && range.max != null) return t('rangeBoth', { min: f(range.min), max: f(range.max), unit });
  if (range.min != null) return t('rangeMin', { min: f(range.min), unit });
  if (range.max != null) return t('rangeMax', { max: f(range.max), unit });
  return '';
}

export function fmtDate(time) {
  if (!time) return '';
  return new Intl.DateTimeFormat(lang() === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(time);
}

export function download(filename, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type: typeof text === 'string' ? `${type};charset=utf-8` : type }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function pickFile(accept = '.json,application/json') {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept });
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then((text) => resolve({ name: file.name.replace(/\.json$/i, ''), text }));
    };
    input.click();
  });
}

export const safeFileName = (name) => (name || 'kmd').replace(/[\\/:*?"<>|]+/g, '_').trim();

export function niceTicks(min, max, count = 5) {
  const span = max - min || 1;
  const magnitude = 10 ** Math.floor(Math.log10(span / count));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => span / s <= count);
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

export function niceCeil(value, count = 5) {
  const ticks = niceTicks(0, value, count);
  const step = ticks[1] - ticks[0];
  return ticks.at(-1) >= value ? ticks.at(-1) : ticks.at(-1) + step;
}

export const fmtTick = (value) => {
  const digits = Number.isInteger(value) ? 0 : Number.isInteger(Math.round(value * 1e6) / 1e5) ? 1 : 2;
  return formatter(digits).format(value);
};
