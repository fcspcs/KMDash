export const NOTES = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];

// As on the KMD's own page: octaves start at C, A/A#/B belong to the previous one (88 keys from A: 1 = A0, 40 = C4)
export function noteName(key, startNote) {
  const index = startNote + key - 1;
  const note = index % 12;
  const octave = 1 + Math.floor(index / 12);
  return NOTES[note] + (note <= 2 ? octave - 1 : octave);
}

export const isBlack = (key, startNote) => NOTES[(startNote + key - 1) % 12].includes('#');
