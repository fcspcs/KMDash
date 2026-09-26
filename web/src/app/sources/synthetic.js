// Synthetic KMD readings: force curves shaped like the device's, made from a few numbers.
// Used by the website demo, the tests and the simulator (samples.json). No real recordings.

const POINTS_DOWN = 51; // travel 0 to key bottom, the last point is the bottom
const POINTS_UP = 48; // back up, then a final point at 0

// Small deterministic random generator, so the same seed always gives the same curve
function random(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5;
  };
}

const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const round = (v, digits) => Math.round(v * 10 ** digits) / 10 ** digits;
const mean = (values) => values.reduce((s, v) => s + v, 0) / values.length;

/**
 * One key_data message as the KMD sends it.
 * down, up:  force level in g on the down and upstroke
 * dip:       key dip in mm
 * letoff:    start of let-off in mm (default 2.8 mm before key bottom)
 * damper:    { onset, load, up } damper picked up at `onset` mm, `load` g on the downstroke, `up` g on the upstroke
 * stop:      force at key bottom (stop weight)
 * Averages, balance and friction are computed from the curve inside the window, the way the KMD does it.
 */
export function makeReading({ down = 52, up = 26, dip = 10, letoff, damper = null, stop = 265, twLow = 2, twHigh = 4, seed = 1, noise = 1.2 } = {}) {
  const rnd = random(seed);
  const letoffAt = letoff ?? dip - 2.8;
  const step = dip / (POINTS_DOWN - 1);

  const downAt = (x) => {
    // Plunger meets the key: quick rise with a small ring
    const ring = x > 0.75 ? 0.12 * Math.sin(((x - 0.75) / 0.35) * Math.PI) * Math.exp(-(x - 0.75) / 0.4) : 0;
    let y = down * (Math.min(1, x / 0.75) ** 0.8 + ring) + 0.3 * (x - dip / 2);
    if (damper) y += damper.load * smooth((x - damper.onset) / 1.4);
    // Let-off: a bump of about 30 g, then the force drops back
    const l = x - letoffAt;
    if (l > 0) y += l < 0.5 ? 30 * smooth(l / 0.5) : l < 1 ? 4 + 26 * (1 - smooth((l - 0.5) / 0.5)) : 4;
    // After-touch and key bottom
    const after = letoffAt + 1.1;
    if (x > after) y += 60 * ((x - after) / (dip - after)) ** 1.2;
    y += (stop - down - 64) * Math.exp(-(dip - x) / 0.2);
    return y;
  };

  const upAt = (x) => {
    const fromBottom = dip - x;
    let y = up + 0.2 * (dip / 2 - x);
    if (x < 1.5) y *= 0.65 + 0.35 * smooth((x - 1) / 0.5);
    if (damper) y += damper.up * smooth((x - damper.onset - 0.2) / 1.2);
    y += 170 * Math.exp(-fromBottom / 0.25) + 30 * Math.exp(-fromBottom / 0.9);
    return y;
  };

  const xvalue = [];
  const yvalue = [];
  for (let i = 0; i < POINTS_DOWN; i++) {
    const x = i * step;
    xvalue.push(round(x, 3));
    yvalue.push(i === 0 ? 0 : i === POINTS_DOWN - 1 ? round(stop + rnd() * 6, 2) : round(Math.max(0, downAt(x) + rnd() * 2 * noise), 2));
  }
  for (let i = 1; i <= POINTS_UP; i++) {
    const x = dip - i * step;
    xvalue.push(round(x, 3));
    yvalue.push(round(Math.max(0, upAt(x) + rnd() * 2 * noise), 2));
  }
  xvalue.push(0);
  yvalue.push(0);

  const inWindow = (from, to) => yvalue.slice(from, to).filter((_, i) => xvalue[from + i] >= twLow && xvalue[from + i] <= twHigh);
  const d = mean(inWindow(0, POINTS_DOWN));
  const u = mean(inWindow(POINTS_DOWN, xvalue.length));
  return {
    type: 'key_data',
    xvalue,
    yvalue,
    keydip: round(dip + rnd() * 0.02, 6),
    average_downweight: round(d, 6),
    average_upweight: round(u, 6),
    average_balanceweight: round((d + u) / 2, 6),
    friction: round((d - u) / 2, 6),
    touchweight_window_low: twLow,
    touchweight_window_high: twHigh,
  };
}

/** A believable grand piano: heavier in the bass, lighter in the treble, with a little scatter. */
export function pianoKey(key, numKeys = 88, { seed = 1, damper = false, downBy = 0, dipBy = 0, ...extra } = {}) {
  const rnd = random(seed * 1000 + key);
  const pos = (key - 1) / Math.max(1, numKeys - 1);
  const down = 52.5 - pos * 5 + rnd() * 1.6 + downBy;
  const up = 22 - pos * 1.5 + rnd() * 1.2;
  const dip = 10.1 + rnd() * 0.25 + dipBy;
  const damperShape = damper ? { onset: 2.7 + rnd() * 0.3, load: 60 + rnd() * 10, up: 26 + rnd() * 4 } : null;
  return makeReading({ down, up, dip, damper: damperShape, seed: seed * 1000 + key, ...extra });
}

export const SETTINGS = { type: 'settings_data', calibration_weight: 200, touchweight_window_low: 2, touchweight_window_high: 4, stop_weight_val: 250 };
