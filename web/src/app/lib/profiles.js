// Starting points for a piano's targets (see lib/targets.js). Values are test weight values as published
// in factory regulation specs or common technician practice. Check them against your own documentation.
//
// down.sections: down weight per section as [last key, value] or [last key, [from, to]] for a slope,
//                for 88 keys. Other key counts are scaled.
// down.tol:      allowed deviation in g. Makers rarely publish one, so this is an estimate.
// up:            a range for all keys, or sections and tol like down when the maker gives bass to treble.
// keyDip, balance, friction: as published. Missing values are derived in lib/targets.js.
// confidence:    official (the maker's own document), secondary (the maker quoted by others),
//                consensus (technicians agree), estimate (a single statement without a document).
import { t } from './i18n.js';

// Section ends for 88 keys: bass, tenor, middle, treble, top
export const SECTION_ENDS = [13, 25, 49, 61, 88];
const sections = (values) => SECTION_ENDS.map((end, i) => [end, values[i]]);

const steinwayNY = { keyDip: { min: 9.91, max: 10.67, target: 10.16 }, up: { min: 19, max: 25 }, confidence: 'official' };
const steinwayHH = { keyDip: { min: 9.9, max: 10.6, target: 10.25 }, up: { min: 19, max: 25 }, confidence: 'official' };

// Other makers give bass, middle and treble without key numbers: a straight line from key 1 to 88
const slope = (bass, treble) => [[88, [bass, treble]]];
// Published as 10 mm without a tolerance: ±0.3 mm as in the general grand profile
const DIP_10 = { min: 9.7, max: 10.3, target: 10 };
// Petrof grand service manual (2008): key dip 10 mm +0.5 mm, a key has to come back with 22 g on it
const PETROF_GRAND = { keyDip: { min: 10, max: 10.5, target: 10 }, up: { min: 22, max: null } };
const upright = (de, en) => ({ de: `${de} (Klavier)`, en: `${en} (upright)` });

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

  // C. Bechstein: technical specifications per model (2025/2026). Concert grands down 52/50/48 g and up 26/28/30 g,
  // each ±1 g; Academy grands down 54/52/50 g and up 23/25.5/28 g, each ±2 g; uprights down 52/51/50 g, up 30 to 34 g.
  // Key dip is not published.
  ...['L-167', 'A-192', 'B-212', 'C-234', 'D-282'].map((model) => ({ id: `bechstein-concert-${model.replace('-', '').toLowerCase()}`, maker: 'C. Bechstein', name: `C. Bechstein ${model}`, down: { sections: slope(52, 48), tol: 1 }, up: { sections: slope(26, 30), tol: 1 }, confidence: 'official' })),
  ...['160', '175', '190', '208', '228'].map((size) => ({ id: `bechstein-academy-a${size}`, maker: 'C. Bechstein', name: `C. Bechstein Academy A ${size}`, down: { sections: slope(54, 50), tol: 2 }, up: { sections: slope(23, 28), tol: 2 }, confidence: 'official' })),
  ...[
    ['bechstein-concert-c6', 'Concert C 6'],
    ['bechstein-concert-c8', 'Concert C 8'],
    ['bechstein-residence-r2', 'Residence R 2'],
    ['bechstein-residence-r4', 'Residence R 4'],
    ['bechstein-residence-r6', 'Residence R 6'],
    ['bechstein-academy-a2', 'Academy A 2'],
    ['bechstein-academy-a4', 'Academy A 4'],
    ['bechstein-academy-a6', 'Academy A 6'],
  ].map(([id, model]) => ({ id, maker: 'C. Bechstein', name: upright(`C. Bechstein ${model}`, `C. Bechstein ${model}`), down: { sections: slope(52, 50), tol: 2 }, up: { min: 30, max: 34 }, confidence: 'official' })),

  // Blüthner: nothing published by the maker. Key dip of the modern action only from a forum post quoting a
  // Blüthner sheet; the old patent action from a Blüthner dealer's regulation notes.
  { id: 'bluethner-grand', maker: 'Blüthner', name: { de: 'Blüthner Flügel', en: 'Blüthner grand' }, keyDip: { min: 10.2, max: 10.8, target: 10.5 }, confidence: 'estimate' },
  { id: 'bluethner-patent', maker: 'Blüthner', name: { de: 'Blüthner Patentmechanik (alt)', en: 'Blüthner patent action (vintage)' }, keyDip: { min: 8.7, max: 9.3, target: 9 }, confidence: 'secondary' },

  // Fazioli: data sheets F183 to F278 (2011/12), the same text for all four: down 52 g in the bass to 48 g in the
  // treble, up 21 to 23 g in the bass and 25 to 26 g in the treble. Key dip is not published.
  ...['F183', 'F212', 'F228', 'F278'].map((model) => ({ id: `fazioli-${model.toLowerCase()}`, maker: 'Fazioli', name: `Fazioli ${model}`, down: { sections: slope(52, 48), tol: 2 }, up: { sections: slope(22, 25.5), tol: 1 }, confidence: 'official' })),

  // Kawai: grand (2013) and upright (2011) regulation manuals. Key dip only, no touch weight.
  { id: 'shigeru-kawai-sk', maker: 'Kawai', name: { de: 'Shigeru Kawai SK-2 bis SK-EX', en: 'Shigeru Kawai SK-2 to SK-EX' }, keyDip: { min: 9.8, max: 10.4, target: 10.1 }, confidence: 'official' },
  { id: 'kawai-gx', maker: 'Kawai', name: { de: 'Kawai GX-1 bis GX-7', en: 'Kawai GX-1 to GX-7' }, keyDip: { min: 9.8, max: 10.4, target: 10.1 }, confidence: 'official' },
  { id: 'kawai-rx', maker: 'Kawai', name: { de: 'Kawai RX-1 bis RX-7', en: 'Kawai RX-1 to RX-7' }, keyDip: { min: 10, max: 10.6, target: 10.3 }, confidence: 'official' },
  { id: 'kawai-upright', maker: 'Kawai', name: { de: 'Kawai Klavier', en: 'Kawai upright' }, keyDip: { min: 10, max: 10.6, target: 10.3 }, confidence: 'official' },

  // Mason & Hamlin: key dip 25/64 inch from the maker's reply to a customer, matching the Piano Action Handbook.
  { id: 'mason-hamlin-grand', maker: 'Mason & Hamlin', name: { de: 'Mason & Hamlin Flügel', en: 'Mason & Hamlin grand' }, keyDip: { min: 9.62, max: 10.22, target: 9.92 }, confidence: 'secondary' },

  // Petrof: grand service manual (2008) with two ways of balancing, upright manual (2010), Ant. Petrof model pages.
  { id: 'petrof-grand', maker: 'Petrof', name: { de: 'Petrof Flügel (Ausgleich 51 g)', en: 'Petrof grand (51 g balancing)' }, down: { min: 50, max: 52 }, ...PETROF_GRAND, confidence: 'official' },
  { id: 'petrof-grand-german', maker: 'Petrof', name: { de: 'Petrof Flügel (deutscher Ausgleich)', en: 'Petrof grand (German balancing)' }, down: { sections: [[27, 55], [40, 53], [53, 52], [67, 51], [88, 50]], tol: 1 }, ...PETROF_GRAND, confidence: 'official' },
  ...['225', '275'].map((size) => ({ id: `ant-petrof-${size}`, maker: 'Petrof', name: `Ant. Petrof ${size}`, down: { sections: slope(55, 50), tol: 1 }, ...PETROF_GRAND, confidence: 'official' })),
  ...['126', '136'].map((size) => ({ id: `ant-petrof-${size}`, maker: 'Petrof', name: upright(`Ant. Petrof ${size}`, `Ant. Petrof ${size}`), down: { sections: slope(53, 51), tol: 2 }, keyDip: { min: 10, max: 10.5, target: 10 }, confidence: 'official' })),
  { id: 'petrof-upright', maker: 'Petrof', name: { de: 'Petrof Klavier', en: 'Petrof upright' }, keyDip: { min: 10, max: 10.5, target: 10 }, confidence: 'official' },

  // Schimmel: the maker's grand action handbook (1991), static touch weight 53 g ±3 g, heavier in the bass.
  // Whether it still holds for today's models is open; there is no up weight and no upright handbook.
  { id: 'schimmel-grand-large', maker: 'Schimmel', name: { de: 'Schimmel Flügel über 2 m', en: 'Schimmel grand over 2 m' }, down: { sections: slope(56, 53), tol: 3 }, keyDip: { min: 10.3, max: 10.7, target: 10.5 }, confidence: 'official' },
  { id: 'schimmel-grand-small', maker: 'Schimmel', name: { de: 'Schimmel Flügel unter 2 m', en: 'Schimmel grand under 2 m' }, down: { sections: slope(56, 53), tol: 3 }, keyDip: { min: 9.8, max: 10.2, target: 10 }, confidence: 'official' },

  // Seiler: key dip from the maker (Samick) quoted in a technicians' forum (2024).
  { id: 'seiler-grand', maker: 'Seiler', name: { de: 'Seiler Flügel (Ed. Seiler)', en: 'Seiler grand (Ed. Seiler)' }, keyDip: DIP_10, confidence: 'secondary' },
  { id: 'seiler-upright', maker: 'Seiler', name: { de: 'Seiler Klavier', en: 'Seiler upright' }, keyDip: { min: 10.2, max: 10.8, target: 10.5 }, confidence: 'secondary' },

  // Yamaha: piano regulation specifications (2004), key travel 10 mm for all models. No touch weight published.
  { id: 'yamaha-cf', maker: 'Yamaha', name: 'Yamaha CF, CFIII, CFIIIS', keyDip: DIP_10, confidence: 'official' },
  { id: 'yamaha-c', maker: 'Yamaha', name: { de: 'Yamaha C- und G-Flügel', en: 'Yamaha C and G grands' }, keyDip: DIP_10, confidence: 'official' },
  { id: 'yamaha-u', maker: 'Yamaha', name: upright('Yamaha U1, U3, U5', 'Yamaha U1, U3, U5'), keyDip: DIP_10, confidence: 'official' },
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
