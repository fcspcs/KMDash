// Starting points for a piano's targets (see lib/targets.js). Values are test weight values as published
// in factory regulation specs or common technician practice. Check them against your own documentation.
//
// down.sections: down weight per section as [last key, value] or [last key, [from, to]] for a slope,
//                for 88 keys. Other key counts are scaled.
// down.tol:      allowed deviation in g. Makers rarely publish one, so this is an estimate.
// up, keyDip, balance, friction: as published. Missing values are derived in lib/targets.js.
import { t } from './i18n.js';

// Section ends for 88 keys: bass, tenor, middle, treble, top
export const SECTION_ENDS = [13, 25, 49, 61, 88];
const sections = (values) => SECTION_ENDS.map((end, i) => [end, values[i]]);

const steinwayNY = { keyDip: { min: 9.91, max: 10.67, target: 10.16 }, up: { min: 19, max: 25 }, confidence: 'official' };
const steinwayHH = { keyDip: { min: 9.9, max: 10.6, target: 10.25 }, up: { min: 19, max: 25 }, confidence: 'official' };

const NY_SMALL = { sections: sections([50, [49, 49], 48, 48, 47]), tol: 2 };
const NY_LARGE = { sections: sections([51, [50, 49], 48, 47, 46]), tol: 2 };
const HH_FLAT = { sections: sections([47, 47, 47, 47, 47]), tol: 2 };
const HH_LARGE = { sections: sections([52, [50, 49], 48, 47, 46]), tol: 2 };

export const PROFILES = [
  // General
  { id: 'grand-generic', maker: 'general', name: { de: 'Flügel allgemein', en: 'Grand piano (general)' }, keyDip: { min: 9.7, max: 10.3, target: 10 }, down: { min: 47, max: 53 }, up: { min: 20, max: 30 }, friction: { max: 15 }, confidence: 'consensus' },
  { id: 'upright-generic', maker: 'general', name: { de: 'Klavier allgemein', en: 'Upright piano (general)' }, keyDip: { min: 9.2, max: 9.8, target: 9.5 }, down: { min: 50, max: 58 }, up: { min: 20, max: 30 }, friction: { max: 15 }, confidence: 'consensus' },

  // Steinway New York
  ...['S', 'M', 'L', 'O'].map((model) => ({ id: `steinway-ny-${model.toLowerCase()}`, maker: 'Steinway & Sons', name: `Steinway ${model} (New York)`, down: NY_SMALL, ...steinwayNY })),
  ...['A', 'B', 'D'].map((model) => ({ id: `steinway-ny-${model.toLowerCase()}`, maker: 'Steinway & Sons', name: `Steinway ${model} (New York)`, down: NY_LARGE, ...steinwayNY })),
  // Steinway Hamburg
  ...['S', 'M', 'O', 'A', 'B'].map((model) => ({ id: `steinway-hamburg-${model.toLowerCase()}`, maker: 'Steinway & Sons', name: `Steinway ${model} (Hamburg)`, down: HH_FLAT, ...steinwayHH })),
  ...['C', 'D'].map((model) => ({ id: `steinway-hamburg-${model.toLowerCase()}`, maker: 'Steinway & Sons', name: `Steinway ${model} (Hamburg)`, down: HH_LARGE, ...steinwayHH })),
  // Steinway uprights
  { id: 'steinway-ny-k52', maker: 'Steinway & Sons', name: { de: 'Steinway K-52 Klavier (New York)', en: 'Steinway K-52 upright (New York)' }, keyDip: { target: 10.16, min: 9.9, max: 10.4 }, down: { min: 47, max: 53 }, up: { min: 19, max: 25 }, confidence: 'official' },
  { id: 'steinway-hamburg-k132', maker: 'Steinway & Sons', name: { de: 'Steinway K-132 Klavier (Hamburg)', en: 'Steinway K-132 upright (Hamburg)' }, keyDip: { target: 10.16, min: 9.9, max: 10.4 }, down: { min: 47, max: 53 }, up: { min: 19, max: 25 }, confidence: 'official' },
  { id: 'steinway-hamburg-v125', maker: 'Steinway & Sons', name: { de: 'Steinway V-125 Klavier (Hamburg)', en: 'Steinway V-125 upright (Hamburg)' }, keyDip: { target: 10.16, min: 9.9, max: 10.4 }, down: { min: 47, max: 53 }, up: { min: 19, max: 25 }, confidence: 'official' },
];

export const findProfile = (id) => PROFILES.find((p) => p.id === id) ?? null;

export const profileName = (profile, lang) => (typeof profile.name === 'string' ? profile.name : profile.name[lang] ?? profile.name.en);

export function profileGroups() {
  const groups = new Map();
  for (const p of PROFILES) {
    const group = p.maker === 'general' ? t('profilesGeneral') : p.maker;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(p);
  }
  return [...groups];
}
