// Pianos live only on the phone (localStorage), the KMD itself does not store readings.
// A piano has several runs. New readings always go into the active run,
// the others stay unchanged. Readings are immutable objects, changes create new objects.
// For compatibility the storage key is still "project:<id>", since version 2 it holds an instrument.
import { findProfile } from './profiles.js';
import { profileToTargets } from './targets.js';

let PREFIX = 'kmdash:';
export const VERSION = 2;
export const MAX_PER_KEY = 5;
const CURVES_PER_KEY = 2; // older readings of a key keep only their values, to save storage
const MAX_HISTORY = 400;

/** Separate storage namespace, e.g. for the demo on the website. */
export function usePrefix(prefix) {
  PREFIX = prefix;
}

// First start: German if the browser prefers German, otherwise English
const browserLang = typeof navigator !== 'undefined' && /^de\b/i.test(navigator.language || '') ? 'de' : 'en';

export const DEFAULT_PREFS = {
  activeId: null,
  lang: browserLang,
  hints: { damper: true, friction: true, upweight: true, outliers: true, dip: true, targets: true, spread: true, curve: true },
  sound: true,
  offset: { d: 0, u: 0 }, // how much higher the KMD reads than test weights (g), see lib/calibration.js
  correctionOn: true,
  calibration: { entries: [] }, // comparison readings, KMD against test weights
  perKey: 1, // readings per key in guided mode
  sessionOrder: 'chromatic', // guided mode: 'chromatic' | 'whiteFirst' | 'white' | 'black'
  sessionRounds: false, // guided mode: repeat readings in rounds instead of key by key
  limits: {}, // changed thresholds for hints and evenness, see lib/limits.js
  valueMode: 'last', // 'last' | 'median'
};

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + key));
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {}
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export const defaultLastDamperKey = (numKeys) => Math.round((numKeys * 69) / 88);

// conditions: { point, humidity, temperature } entered by hand; kmd: settings read from the device while the run was active
export function createRun(title, notes = '', conditions = {}) {
  return { id: newId(), title, notes, conditions, createdAt: Date.now(), keys: {}, history: [] };
}

export function createInstrument(name, runTitle) {
  const now = Date.now();
  const run = createRun(runTitle);
  return {
    version: VERSION,
    id: newId(),
    name,
    numKeys: 88,
    startNote: 0,
    targets: null,
    lastDamperKey: null, // null = default (defaultLastDamperKey)
    info: { client: '', place: '', serial: '', technician: '' }, // job data for the report
    runs: [run],
    activeRunId: run.id,
    created: now,
    updated: now,
  };
}

/** Upgrades older saved data (version 1: a project without runs) to the current format. */
export function migrate(data, runTitle) {
  if (!data) return null;
  if (Array.isArray(data.runs) && data.runs.length) {
    return { lastDamperKey: null, targets: null, ...data, version: VERSION, activeRunId: data.runs.some((r) => r.id === data.activeRunId) ? data.activeRunId : data.runs.at(-1).id };
  }
  const numKeys = clampKeys(data.numKeys);
  const run = { ...createRun(runTitle), createdAt: data.created || Date.now(), keys: data.keys || {}, history: data.history || [] };
  const profile = findProfile(data.profileId);
  return {
    version: VERSION,
    id: data.id || newId(),
    name: data.name || runTitle,
    numKeys,
    startNote: Number(data.startNote) || 0,
    targets: profile ? profileToTargets(profile, numKeys) : null,
    lastDamperKey: null,
    runs: [run],
    activeRunId: run.id,
    created: data.created || Date.now(),
    updated: data.updated || Date.now(),
  };
}

const clampKeys = (n) => Math.min(108, Math.max(1, Math.round(Number(n)) || 88));

// --- Settings and storage ------------------------------------------------------------------------

export function loadPrefs() {
  const saved = read('prefs') || {};
  return {
    ...DEFAULT_PREFS,
    ...saved,
    hints: { ...DEFAULT_PREFS.hints, ...saved.hints },
    offset: { ...DEFAULT_PREFS.offset, ...saved.offset },
    calibration: { entries: [], ...saved.calibration },
  };
}

export const savePrefs = (prefs) => write('prefs', prefs);

export function listInstruments() {
  return (read('index') || []).sort((a, b) => b.updated - a.updated);
}

export function loadInstrument(id, runTitle) {
  const data = read('project:' + id);
  if (!data) return null;
  const instrument = migrate(data, runTitle);
  if (data.version !== VERSION) saveInstrument(instrument);
  return instrument;
}

export function saveInstrument(instrument) {
  const run = activeRun(instrument);
  const entry = {
    id: instrument.id,
    name: instrument.name,
    updated: instrument.updated,
    measured: measuredCount(run, instrument.numKeys),
    numKeys: instrument.numKeys,
    runs: instrument.runs.length,
  };
  const index = (read('index') || []).filter((p) => p.id !== instrument.id);
  return write('project:' + instrument.id, instrument) && write('index', [entry, ...index]);
}

/** Deletes everything in this storage namespace (demo only). */
export function clearAll() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key);
  } catch {}
}

export function deleteInstrument(id) {
  remove('project:' + id);
  write('index', (read('index') || []).filter((p) => p.id !== id));
}

// --- Runs (pure, return new objects) ------------------------------------------------------------

export const activeRun = (instrument) => instrument.runs.find((r) => r.id === instrument.activeRunId) ?? instrument.runs.at(-1);

const touch = (instrument, fields) => ({ ...instrument, ...fields, updated: Date.now() });

export const withRun = (instrument, run) => touch(instrument, { runs: instrument.runs.map((r) => (r.id === run.id ? run : r)) });

export function addRun(instrument, title, notes = '', conditions = {}) {
  const run = createRun(title, notes, conditions);
  return touch(instrument, { runs: [...instrument.runs, run], activeRunId: run.id });
}

export const editRun = (instrument, id, fields) => touch(instrument, { runs: instrument.runs.map((r) => (r.id === id ? { ...r, ...fields } : r)) });

export function deleteRun(instrument, id) {
  if (instrument.runs.length < 2) return instrument;
  const runs = instrument.runs.filter((r) => r.id !== id);
  return touch(instrument, { runs, activeRunId: instrument.activeRunId === id ? runs.at(-1).id : instrument.activeRunId });
}

export const setActiveRun = (instrument, id) => touch(instrument, { activeRunId: id });

// --- Measurements --------------------------------------------------------------------------------

export const latest = (run, key) => run.keys[key]?.at(-1);
export const measuredCount = (run, numKeys) => Object.keys(run.keys).filter((k) => Number(k) <= numKeys).length;
const hasCurve = (m) => m?.x?.length > 0;

export function measurementFromMessage(msg) {
  return {
    t: Date.now(),
    d: Number(msg.average_downweight),
    u: Number(msg.average_upweight),
    b: Number(msg.average_balanceweight),
    f: Number(msg.friction),
    dip: Number(msg.keydip),
    twLow: Number(msg.touchweight_window_low),
    twHigh: Number(msg.touchweight_window_high),
    x: (msg.xvalue || []).map((v) => Math.round(v * 1000) / 1000),
    y: (msg.yvalue || []).map((v) => Math.round(v * 100) / 100),
  };
}

export function withMeasurement(run, key, measurement) {
  const list = [...(run.keys[key] || []), measurement].slice(-MAX_PER_KEY);
  const trimmed = list.map((m, i) => (i < list.length - CURVES_PER_KEY && hasCurve(m) ? { ...m, x: [], y: [] } : m));
  return {
    ...run,
    keys: { ...run.keys, [key]: trimmed },
    history: [...run.history, key].slice(-MAX_HISTORY),
  };
}

export function withoutLastMeasurement(run) {
  const key = run.history.at(-1);
  if (key == null) return { run, key: null };
  const keys = { ...run.keys };
  const list = (keys[key] || []).slice(0, -1);
  if (list.length) keys[key] = list;
  else delete keys[key];
  return { run: { ...run, keys, history: run.history.slice(0, -1) }, key };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Value of a key: the last reading or the median of the last readings (down, up, key dip).
 * Balance and friction are computed from down and up, as on the KMD. The curve is the one of the last reading.
 */
export function effective(list, { valueMode = 'last', perKey = 1 } = {}) {
  const last = list?.at(-1);
  if (!last) return null;
  const used = list.slice(-perKey);
  if (valueMode !== 'median' || used.length < 2) return last;
  const d = median(used.map((m) => m.d));
  const u = median(used.map((m) => m.u));
  return { ...last, d, u, b: (d + u) / 2, f: (d - u) / 2, dip: median(used.map((m) => m.dip)), n: used.length };
}

// --- Export / import, compatible with the KMD's own page --------------------------------------

/** valueOf(key) returns the value of a key (last reading or median). */
export function overviewCsv(numKeys, valueOf) {
  // Same format as the KMD's own page, so existing spreadsheets keep working
  let csv = 'Key, Downweight, Upweight, Friction, Balance Weight, Keydip\n';
  for (let key = 1; key <= numKeys; key++) {
    const m = valueOf(key);
    csv += (m ? [key, m.d, m.u, m.f, m.b, m.dip] : ['', '', '', '', '', '']).join(',') + '\n';
  }
  return csv;
}

export function keyCsv(measurement) {
  let csv = 'keystroke position (mm), touchweight (g)\n';
  measurement.x.forEach((x, i) => (csv += `${x},${measurement.y[i]}\n`));
  return csv;
}

export function allCurvesCsv(run, numKeys) {
  let csv = 'Key, keystroke position (mm), touchweight (g)\n';
  for (let key = 1; key <= numKeys; key++) {
    const m = latest(run, key);
    m?.x.forEach((x, i) => (csv += `${key},${x},${m.y[i]}\n`));
  }
  return csv;
}

/** Project file: the fields of the KMD's own page at the top (active run), plus the whole piano. */
export function toProjectFile(instrument, valueOf) {
  const run = activeRun(instrument);
  const file = {
    pianoname: instrument.name,
    startingnoteindex: instrument.startNote,
    numkeys: instrument.numKeys,
    keydip_data: [],
    downweight_data: [],
    upweight_data: [],
    balanceweight_data: [],
    friction_data: [],
    keynumber_data: [],
    xyvalues_data: [],
    twwindow_data: [],
    kmdash: { version: VERSION, instrument },
  };
  for (const key of Object.keys(run.keys).map(Number).filter((k) => k <= instrument.numKeys)) {
    const m = valueOf(key);
    if (!m) continue;
    file.keydip_data[key] = m.dip;
    file.downweight_data[key] = m.d;
    file.upweight_data[key] = m.u;
    file.balanceweight_data[key] = m.b;
    file.friction_data[key] = m.f;
    file.keynumber_data[key] = key;
    file.xyvalues_data[key] = m.x.map((x, i) => ({ x, y: m.y[i] }));
    file.twwindow_data[key] = [{ x: m.twLow, y: 350 }, { x: m.twHigh, y: 350 }];
  }
  return JSON.stringify(file);
}

export function fromProjectFile(text, fallbackName, runTitle) {
  const file = JSON.parse(text);
  if (!file || typeof file !== 'object') throw new Error('not a project file');
  const extra = file.kmdash;
  // Our own files get a new ID so an import never overwrites an existing piano
  if (extra?.instrument?.runs) return { ...migrate(extra.instrument, runTitle), id: newId(), updated: Date.now() };
  if (extra?.keys) {
    return { ...migrate({ name: file.pianoname || fallbackName, numKeys: file.numkeys, startNote: file.startingnoteindex, profileId: extra.profileId, keys: extra.keys, history: extra.history, created: extra.created }, runTitle), id: newId() };
  }
  if (!Array.isArray(file.keynumber_data)) throw new Error('not a project file');
  const instrument = createInstrument(String(file.pianoname || fallbackName), runTitle);
  instrument.numKeys = clampKeys(file.numkeys);
  instrument.startNote = Math.min(11, Math.max(0, Number(file.startingnoteindex) || 0));
  const run = instrument.runs[0];
  file.keynumber_data.forEach((key, i) => {
    if (key == null || i < 1 || i > instrument.numKeys) return;
    const xy = file.xyvalues_data?.[i] || [];
    const tw = file.twwindow_data?.[i] || [];
    run.keys[i] = [{
      t: 0,
      d: Number(file.downweight_data?.[i]),
      u: Number(file.upweight_data?.[i]),
      b: Number(file.balanceweight_data?.[i]),
      f: Number(file.friction_data?.[i]),
      dip: Number(file.keydip_data?.[i]),
      twLow: tw[0]?.x ?? 2,
      twHigh: tw[1]?.x ?? 4,
      x: xy.map((p) => p.x),
      y: xy.map((p) => p.y),
    }];
    run.history.push(i);
  });
  return instrument;
}
