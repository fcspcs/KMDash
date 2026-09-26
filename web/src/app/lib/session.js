// Guided measuring: which keys in which order, and how readings repeat.
import { isBlack } from './notes.js';

export const ORDERS = ['chromatic', 'whiteFirst', 'white', 'black'];

/** Keys in the chosen order: as given, white keys first, or only one colour. */
export function orderKeys(keys, order, startNote = 0) {
  const white = keys.filter((k) => !isBlack(k, startNote));
  const black = keys.filter((k) => isBlack(k, startNote));
  if (order === 'whiteFirst') return [...white, ...black];
  if (order === 'white') return white;
  if (order === 'black') return black;
  return keys;
}

/** Keys from one key to another, in that direction. */
export function keyRange(from, to) {
  const step = from <= to ? 1 : -1;
  const keys = [];
  for (let k = from; step > 0 ? k <= to : k >= to; k += step) keys.push(k);
  return keys;
}

/**
 * Stops of a session. Key by key: every key once, the app waits there for all readings.
 * In rounds: the whole series once per reading, one reading at each stop.
 */
export function sessionPlan(keys, perKey, rounds) {
  const inRounds = rounds && perKey > 1;
  return {
    stops: inRounds ? Array.from({ length: perKey }, () => keys).flat() : keys,
    perStop: inRounds ? 1 : perKey,
    rounds: inRounds ? perKey : 1,
    roundSize: keys.length,
  };
}
