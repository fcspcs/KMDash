// Simulated KMD for the demo on the website: plays synthetic readings (see synthetic.js).
import * as store from '../lib/store.js';
import { profileToTargets } from '../lib/targets.js';
import { findProfile } from '../lib/profiles.js';
import { t, dictionaries } from '../lib/i18n.js';
import { pianoKey, SETTINGS } from './synthetic.js';

// A few keys stand out, so the demo has something to show: heavier keys and a shallow dip
const quirks = (key) => ({ ...(key % 29 === 7 ? { downBy: 4.5 } : {}), ...(key % 31 === 11 ? { dipBy: -0.45 } : {}) });

export function createDemoSource() {
  const listeners = { message: new Set(), status: new Set() };
  const emit = (type, value) => listeners[type].forEach((fn) => fn(value));
  let settings = { ...SETTINGS };
  let count = 0;

  setTimeout(() => emit('status', 'connected'), 400);

  return {
    kind: 'demo',
    status: 'connecting',
    on(type, fn) {
      listeners[type].add(fn);
      return () => listeners[type].delete(fn);
    },
    send(msg) {
      setTimeout(() => {
        if (msg.type === 'send_settings') emit('message', { type: 'settings_data', ...settings });
        if (msg.type === 'set_calibration_weight') settings.calibration_weight = Number(msg.cal_weight_val);
        if (msg.type === 'set_stop_weight') settings.stop_weight_val = Number(msg.stop_weight_val);
        if (msg.type === 'set_tw_window') {
          settings.touchweight_window_low = Number(msg.tw_window_low);
          settings.touchweight_window_high = Number(msg.tw_window_high);
        }
        if (msg.type === 'restore_defaults') settings = { ...settings, touchweight_window_low: 2, touchweight_window_high: 4, stop_weight_val: 250 };
      }, 250);
      return true;
    },
    /** Language changed: the demo piano and its runs follow, unless they were renamed. */
    relabel(from, to) {
      const a = dictionaries[from];
      const b = dictionaries[to];
      if (!a || !b) return;
      const swap = (text, key) => (text === a[key] ? b[key] : text);
      for (const entry of store.listInstruments()) {
        const inst = store.loadInstrument(entry.id, b.runDefault.replace('{n}', '1'));
        if (!inst || inst.name !== a.demoPiano) continue;
        inst.name = b.demoPiano;
        if (inst.info) inst.info = { ...inst.info, client: swap(inst.info.client, 'demoClient'), place: swap(inst.info.place, 'demoPlace') };
        inst.runs = inst.runs.map((r) => ({
          ...r,
          title: swap(swap(r.title, 'demoRun1'), 'demoRun2'),
          notes: swap(swap(r.notes ?? '', 'demoRun1Notes'), 'demoRun2Notes'),
          conditions: r.conditions ? { ...r.conditions, point: swap(r.conditions.point ?? '', 'measurePointPlaceholder') } : r.conditions,
        }));
        store.saveInstrument(inst);
      }
    },
    /** Demo: trigger a reading as if the key had been pressed on the device. */
    measure(key, numKeys, { damper = false } = {}) {
      const msg = pianoKey(key, numKeys, { seed: 100 + count++, damper, ...quirks(key), twLow: settings.touchweight_window_low, twHigh: settings.touchweight_window_high });
      setTimeout(() => emit('message', msg), 1600);
    },
  };
}

// Lower friction by "by" g, balance stays the same (as after cleaning the knuckles)
function lessFriction(msg, by) {
  const bottom = msg.yvalue.indexOf(Math.max(...msg.yvalue));
  return {
    ...msg,
    yvalue: msg.yvalue.map((y, i) => (y === 0 ? 0 : Math.round((i <= bottom ? y - by : y + by) * 100) / 100)),
    average_downweight: msg.average_downweight - by,
    average_upweight: msg.average_upweight + by,
    friction: msg.friction - by,
  };
}

/** On the first visit, creates a demo piano with two runs (before and after). */
export function seedDemo() {
  if (store.listInstruments().length) return;
  const numKeys = 88;
  let inst = store.createInstrument(t('demoPiano'), t('demoRun1'));
  inst.targets = profileToTargets(findProfile('steinway-ny-b'), numKeys);
  inst.info = { client: t('demoClient'), place: t('demoPlace'), serial: '', technician: '' };
  const first = store.activeRun(inst);
  const point = t('measurePointPlaceholder');
  let run = { ...first, notes: t('demoRun1Notes'), createdAt: Date.now() - 3 * 86400000, conditions: { point, humidity: 48, temperature: 20.5 } };
  for (let key = 1; key <= numKeys - 6; key++) {
    const msg = pianoKey(key, numKeys, { damper: key === 58, ...quirks(key) });
    run = store.withMeasurement(run, key, { ...store.measurementFromMessage(msg), t: run.createdAt + key * 40000 });
  }
  inst = store.withRun(inst, run);
  inst = store.addRun(inst, t('demoRun2'), t('demoRun2Notes'), { point, humidity: 45, temperature: 21 });
  run = store.activeRun(inst);
  for (let key = 1; key <= 49; key++) {
    const base = pianoKey(key, numKeys, quirks(key));
    run = store.withMeasurement(run, key, store.measurementFromMessage(lessFriction(base, key % 17 === 5 ? 0.2 : 1.4)));
  }
  inst = store.withRun(inst, run);
  store.saveInstrument(inst);
  store.savePrefs({ ...store.loadPrefs(), activeId: inst.id });
}
