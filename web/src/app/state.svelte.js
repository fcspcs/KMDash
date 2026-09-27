import * as store from './lib/store.js';
import { analyzeRun } from './lib/analysis.js';
import { resolveTargets, profileToTargets } from './lib/targets.js';
import { findProfile } from './lib/profiles.js';
import { keyRange, sessionPlan } from './lib/session.js';
import { thresholds, toLimits, toTolerance } from './lib/limits.js';
import { t, setLang } from './lib/i18n.js';

// Same order and format as the KMD's own page uses when it applies settings
const SETTING_ORDER = ['calibration_weight', 'tw_window', 'stop_weight_val'];
const SETTINGS_TIMEOUT_MS = 4000;

export class AppState {
  source;
  instrument = $state.raw(null);
  prefs = $state(store.loadPrefs());
  instruments = $state.raw([]);
  status = $state('connecting');
  view = $state('measure');
  current = $state(1); // displayed key
  target = $state(1); // key the next reading is assigned to
  mode = $state('single'); // 'single' | 'continuous'
  session = $state(null); // guided session
  ghost = $state.raw(null); // previously shown curve, for comparison
  compareId = $state(null); // run to compare against
  device = $state({ settings: null, loading: false, pending: false, error: null });
  sheet = $state(null);
  toast = $state(null);
  pulse = $state(0); // counts up on every new reading (animation)
  storageOk = $state(true);
  lang = $state('en');
  // Chart views, kept while switching keys and tabs
  curveZoom = $state(null); // { x: [mm, mm], y: [g, g] } or automatic
  curveWindow = $state(true); // measuring window shown in the curve
  showTrend = $state(true); // smooth curves in the overview charts
  keysZoom = $state(null); // [first key, last key] in the overview charts or all keys
  hiddenSeries = $state([]); // weight series hidden in the overview ('d', 'b', 'u')

  run = $derived(store.activeRun(this.instrument));
  compareRun = $derived(this.instrument.runs.find((r) => r.id === this.compareId && r.id !== this.run.id) ?? null);
  valueMode = $derived({ valueMode: this.prefs.valueMode, perKey: this.prefs.perKey });
  // Correction from the calibration with test weights: how much higher the KMD reads
  correction = $derived(this.prefs.correctionOn !== false ? { d: Number(this.prefs.offset.d) || 0, u: Number(this.prefs.offset.u) || 0 } : { d: 0, u: 0 });
  correctionActive = $derived(this.correction.d !== 0 || this.correction.u !== 0);
  // Thresholds for hints and evenness (lib/limits.js), the same for all pianos
  thresholds = $derived(thresholds(this.prefs.limits));
  tolerance = $derived(toTolerance(this.thresholds));
  targetsAt = $derived.by(() => {
    const { targets, numKeys, startNote } = this.instrument;
    return (key) => resolveTargets(targets, key, { numKeys, startNote });
  });
  analysis = $derived(this.#analyze(this.run));
  compareAnalysis = $derived(this.compareRun ? this.#analyze(this.compareRun) : null);
  result = $derived(this.analysis.keys[this.current] ?? null);
  displayed = $derived(this.run.keys[this.current]?.at(-1) ?? null); // latest reading (curve)

  constructor(source) {
    setLang(this.prefs.lang);
    this.lang = this.prefs.lang;
    this.source = source;
    this.status = source.status;
    source.on('status', (status) => (this.status = status));
    source.on('message', (msg) => this.#handleMessage(msg));

    this.instruments = store.listInstruments();
    const active = this.prefs.activeId && store.loadInstrument(this.prefs.activeId, t('runDefault', { n: 1 }));
    this.instrument = active || store.createInstrument(t('unnamed'), t('runDefault', { n: 1 }));
    this.prefs.activeId = this.instrument.id;
    this.#jumpToFirst();
  }

  #analyze(run) {
    const { numKeys, startNote, lastDamperKey } = this.instrument;
    return analyzeRun(run, { numKeys, startNote, lastDamperKey, targetsAt: this.targetsAt, hints: this.prefs.hints, offset: this.correction, valueMode: this.valueMode, limits: toLimits(this.thresholds) });
  }

  /** Analysis of any run of this piano (for the report). */
  analyze = (run) => this.#analyze(run);

  /** KMD value of a key in the active run (latest reading or median), for exports without correction. */
  valueOf = (key) => store.effective(this.run.keys[key], this.valueMode);

  // --- Persistence -------------------------------------------------------------------------------

  persist() {
    this.storageOk = store.saveInstrument(this.instrument);
    this.instruments = store.listInstruments();
  }

  savePrefs() {
    store.savePrefs($state.snapshot(this.prefs));
  }

  #set(instrument) {
    this.instrument = instrument;
    this.persist();
  }

  #setRun(run) {
    this.#set(store.withRun(this.instrument, run));
  }

  // --- Measurements ------------------------------------------------------------------------------

  #handleMessage(msg) {
    if (msg?.type === 'settings_data') {
      clearTimeout(this.#settingsTimer);
      this.device = {
        loading: false,
        pending: false,
        error: null,
        settings: {
          calibration_weight: Number(msg.calibration_weight),
          touchweight_window_low: Number(msg.touchweight_window_low),
          touchweight_window_high: Number(msg.touchweight_window_high),
          stop_weight_val: Number(msg.stop_weight_val),
        },
      };
      this.#recordSettings(this.device.settings);
    } else if (msg?.type === 'key_data') {
      this.#addMeasurement(store.measurementFromMessage(msg));
    }
  }

  /** Settings read from the KMD stay with the active run, for the report. Nothing is sent for this. */
  #recordSettings(s) {
    const kmd = { stopWeight: s.stop_weight_val, calibrationWeight: s.calibration_weight, twLow: s.touchweight_window_low, twHigh: s.touchweight_window_high };
    const old = this.run.kmd;
    if (old && Object.keys(kmd).every((k) => old[k] === kmd[k])) return;
    this.#setRun({ ...this.run, kmd: { ...kmd, at: Date.now() } });
  }

  #addMeasurement(measurement) {
    const key = this.target;
    if (this.displayed && key !== this.current) this.ghost = { key: this.current, m: this.displayed };
    else if (this.displayed) this.ghost = { key, m: this.displayed };
    this.#setRun(store.withMeasurement(this.run, key, measurement));
    this.current = key;
    this.pulse++;

    const warned = this.analysis.keys[key]?.level === 'warn';
    const s = this.session;
    if (s && s.index < s.keys.length) {
      s.taken[key] = (s.taken[key] || 0) + 1;
      s.lastKey = key;
      s.skipped = s.skipped.filter((k) => k !== key);
      if (s.taken[key] < s.perKey) s.blocked = false;
      else if (warned) s.blocked = true;
      else this.#advanceSession();
    } else if (!s && this.mode === 'continuous') {
      this.target = key >= this.instrument.numKeys ? 1 : key + 1;
    }
    if (this.prefs.sound) beep(warned);
  }

  select(key) {
    const next = Math.min(Math.max(1, Math.round(key)), this.instrument.numKeys);
    if (next === this.current && next === this.target) return;
    if (this.displayed && next !== this.current) this.ghost = { key: this.current, m: this.displayed };
    this.current = next;
    this.target = next;
    this.#syncSession(next);
  }

  setMode(mode) {
    this.mode = mode;
    this.target = this.current;
  }

  /** Measure the same key again. */
  repeat() {
    this.target = this.current;
    this.#syncSession(this.current);
  }

  undo() {
    const { run, key } = store.withoutLastMeasurement(this.run);
    if (key == null) return;
    this.#setRun(run);
    this.ghost = null;
    this.current = key;
    this.target = key;
    if (this.session?.taken[key]) this.session.taken[key]--;
    this.#syncSession(key);
    this.notify(t('undone', { key }));
  }

  #syncSession(key) {
    const s = this.session;
    if (!s) return;
    // In rounds a key comes up several times: the next stop from here, otherwise the first one
    const ahead = s.keys.indexOf(key, s.index);
    const index = ahead >= 0 ? ahead : s.keys.indexOf(key);
    if (index >= 0) s.index = index;
    s.blocked = false;
  }

  #jumpToFirst() {
    const first = Number(Object.keys(this.run.keys)[0]) || 1;
    this.current = Math.min(first, this.instrument.numKeys);
    this.target = this.current;
  }

  // --- Guided session ----------------------------------------------------------------------------

  // keys: the keys in their order. rounds: repeat readings by going through the whole series again
  startSession({ from, to, skipMeasured = false, keys = null, perKey = this.prefs.perKey, rounds = false }) {
    const list = keys ?? keyRange(from, to).filter((k) => !(skipMeasured && this.run.keys[k]));
    if (!list.length) return false;
    const plan = sessionPlan(list, perKey, rounds);
    this.session = { keys: plan.stops, index: 0, blocked: false, lastKey: null, startedAt: Date.now(), perKey: plan.perStop, rounds: plan.rounds, roundSize: plan.roundSize, taken: {}, skipped: [] };
    this.current = list[0];
    this.target = list[0];
    this.ghost = null;
    this.view = 'measure';
    return true;
  }

  #advanceSession() {
    const s = this.session;
    s.blocked = false;
    if (s.index >= s.keys.length - 1) {
      s.index = s.keys.length;
      this.sheet = { type: 'summary' };
      return;
    }
    s.index++;
    this.target = s.keys[s.index];
  }

  skip() {
    const s = this.session;
    if (!s || s.index >= s.keys.length) return;
    if (!s.taken[s.keys[s.index]]) s.skipped = [...s.skipped, s.keys[s.index]];
    this.#advanceSession();
    if (this.session && s.index < s.keys.length) this.current = this.target;
  }

  continueAnyway() {
    if (this.session) this.#advanceSession();
  }

  endSession() {
    this.session = null;
    this.target = this.current;
  }

  // --- Pianos and runs ---------------------------------------------------------------------------

  editInstrument(fields) {
    let targets = this.instrument.targets;
    const numKeys = fields.numKeys ?? this.instrument.numKeys;
    // Unmodified factory profiles adapt to a new key count
    if (numKeys !== this.instrument.numKeys && targets?.source && !targets.edited) {
      const profile = findProfile(targets.source);
      if (profile) targets = profileToTargets(profile, numKeys);
    }
    this.#set({ ...this.instrument, ...fields, targets, updated: Date.now() });
    if (this.current > numKeys) this.select(numKeys);
  }

  newInstrument(name) {
    this.persist();
    this.#activate(store.createInstrument(name || t('unnamed'), t('runDefault', { n: 1 })));
  }

  openInstrument(id) {
    if (id === this.instrument.id) return;
    const instrument = store.loadInstrument(id, t('runDefault', { n: 1 }));
    if (instrument) this.#activate(instrument);
  }

  importInstrument(instrument) {
    this.#activate(instrument);
  }

  deleteInstrument(id) {
    store.deleteInstrument(id);
    this.instruments = store.listInstruments();
    if (id === this.instrument.id) {
      const next = this.instruments[0] && store.loadInstrument(this.instruments[0].id, t('runDefault', { n: 1 }));
      this.#activate(next || store.createInstrument(t('unnamed'), t('runDefault', { n: 1 })));
    }
  }

  #activate(instrument) {
    this.session = null;
    this.ghost = null;
    this.compareId = null;
    this.instrument = instrument;
    this.prefs.activeId = instrument.id;
    this.savePrefs();
    this.persist();
    this.#jumpToFirst();
  }

  /** New run, the previous one automatically becomes the comparison. */
  newRun(title, notes = '', conditions = {}) {
    const previous = this.run.id;
    this.session = null;
    this.ghost = null;
    this.#set(store.addRun(this.instrument, title || t('runDefault', { n: this.instrument.runs.length + 1 }), notes, conditions));
    this.compareId = previous;
    this.#jumpToFirst();
  }

  editRun(id, fields) {
    this.#set(store.editRun(this.instrument, id, fields));
  }

  deleteRun(id) {
    if (this.compareId === id) this.compareId = null;
    this.#set(store.deleteRun(this.instrument, id, t('runDefault', { n: 1 })));
    if (this.compareId === this.run.id) this.compareId = null;
    this.#jumpToFirst();
  }

  activateRun(id) {
    if (id === this.run.id) return;
    const previous = this.run.id;
    this.session = null;
    this.ghost = null;
    this.#set(store.setActiveRun(this.instrument, id));
    if (this.compareId === id) this.compareId = previous;
    this.#jumpToFirst();
  }

  // --- Calibration with test weights -------------------------------------------------------------

  addCalibrationEntry(entry) {
    this.prefs.calibration.entries = [...this.prefs.calibration.entries, { id: Date.now().toString(36), t: Date.now(), ...entry }];
    this.savePrefs();
  }

  removeCalibrationEntry(id) {
    this.prefs.calibration.entries = this.prefs.calibration.entries.filter((e) => e.id !== id);
    this.savePrefs();
  }

  /** Apply the correction (rounded to 0.1 g). */
  applyCorrection({ d, u }) {
    this.prefs.offset = { d: Math.round(d * 10) / 10, u: Math.round(u * 10) / 10 };
    this.prefs.correctionOn = true;
    this.savePrefs();
  }

  setTargets(targets) {
    this.#set({ ...this.instrument, targets, updated: Date.now() });
  }

  loadProfile(id) {
    const profile = findProfile(id);
    this.setTargets(profile ? profileToTargets(profile, this.instrument.numKeys) : null);
  }

  // --- Device ------------------------------------------------------------------------------------

  #settingsTimer;

  /** Reads the settings fresh from the device (send_settings is a read-only command). */
  loadDeviceSettings() {
    clearTimeout(this.#settingsTimer);
    this.device = { settings: null, loading: true, pending: false, error: null };
    if (!this.source.send({ type: 'send_settings' })) {
      this.device = { settings: null, loading: false, pending: false, error: 'offline' };
      return;
    }
    this.#settingsTimer = setTimeout(() => {
      if (this.device.loading) this.device = { ...this.device, loading: false, error: 'noAnswer' };
    }, SETTINGS_TIMEOUT_MS);
  }

  /** Only changed values, as strings and in the same order as the KMD's own page. */
  settingsMessages(next) {
    const cur = this.device.settings;
    if (!cur) return [];
    // The KMD sends floats (211.6900024): small rounding differences do not count as a change
    const differs = (a, b) => Math.abs(a - b) > 0.004;
    const messages = [];
    for (const field of SETTING_ORDER) {
      if (field === 'calibration_weight' && differs(next.calibration_weight, cur.calibration_weight)) {
        messages.push({ type: 'set_calibration_weight', cal_weight_val: String(next.calibration_weight) });
      }
      if (field === 'tw_window' && (differs(next.touchweight_window_low, cur.touchweight_window_low) || differs(next.touchweight_window_high, cur.touchweight_window_high))) {
        messages.push({ type: 'set_tw_window', tw_window_low: String(next.touchweight_window_low), tw_window_high: String(next.touchweight_window_high) });
      }
      if (field === 'stop_weight_val' && differs(next.stop_weight_val, cur.stop_weight_val)) {
        messages.push({ type: 'set_stop_weight', stop_weight_val: String(next.stop_weight_val) });
      }
    }
    return messages;
  }

  applySettings(next) {
    if (!this.device.settings) return false; // never without settings loaded first
    const messages = this.settingsMessages(next);
    if (!messages.length) return true;
    for (const msg of messages) if (!this.source.send(msg)) return false;
    this.device = { ...this.device, pending: true };
    setTimeout(() => this.loadDeviceSettings(), 700);
    return true;
  }

  startCalibration() {
    return this.source.send({ type: 'start_calibration' });
  }

  restoreDefaults() {
    return this.source.send({ type: 'restore_defaults' });
  }

  // --- UI ----------------------------------------------------------------------------------------

  setLanguage(lang) {
    const from = this.lang;
    setLang(lang);
    this.prefs.lang = lang;
    this.savePrefs();
    if (this.source.relabel && from !== lang) {
      this.persist();
      this.source.relabel(from, lang);
      this.instrument = store.loadInstrument(this.instrument.id, t('runDefault', { n: 1 })) ?? this.instrument;
      this.instruments = store.listInstruments();
    }
    this.lang = lang;
  }

  notify(text) {
    const toast = { text, id: Date.now() };
    this.toast = toast;
    setTimeout(() => this.toast === toast && (this.toast = null), 2600);
  }
}

let audio;
function beep(warned) {
  try {
    audio ||= new AudioContext();
    const notes = warned ? [520, 390] : [880];
    notes.forEach((freq, i) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + i * 0.13;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.12);
    });
  } catch {}
}

/** iOS only allows sound after a touch, so unlock it on the first tap. */
export function unlockAudio() {
  try {
    audio ||= new AudioContext();
    if (audio.state === 'suspended') audio.resume();
  } catch {}
}
