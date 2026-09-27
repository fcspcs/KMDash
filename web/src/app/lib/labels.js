import { findProfile, profileName } from './profiles.js';
import { t, lang } from './i18n.js';
import { fmtTick } from './format.js';

/** Short name for the targets of a piano, e.g. "Steinway B (Hamburg), edited". */
export function targetsLabel(targets) {
  if (!targets) return t('targetsNone');
  const profile = findProfile(targets.source);
  if (!profile) return t('targetsOwn');
  const name = profileName(profile, lang());
  return targets.edited ? t('targetsEdited', { name }) : name;
}

// Bass and treble value of a profile entry (sections for 88 keys, or a range)
function span(spec) {
  if (!spec) return null;
  if (spec.sections) {
    const first = spec.sections[0][1];
    const last = spec.sections.at(-1)[1];
    return [Array.isArray(first) ? first[0] : first, Array.isArray(last) ? last[1] : last, 'slope'];
  }
  if (spec.min == null && spec.max == null) return null;
  return spec.max == null ? [spec.min, null] : [spec.min ?? spec.max, spec.max];
}
// A slope runs from the bass to the treble (52 → 48 g), a range holds for all keys (47 to 53 g)
function spanText([a, b, kind], unit) {
  if (b == null) return t('profileAtLeast', { v: fmtTick(a), unit });
  if (a === b) return `${fmtTick(a)}\u00A0${unit}`;
  return t(kind === 'slope' ? 'profileSlope' : 'profileSpan', { a: fmtTick(a), b: fmtTick(b), unit });
}

/** What a factory profile brings, e.g. "Down weight 52 to 48 g, up weight 26 to 30 g" or "Key dip only, 10 mm". */
export function profileSummary(profile) {
  const parts = [];
  const down = span(profile.down);
  const up = span(profile.up);
  if (down) parts.push(t('profileDown', { v: spanText(down, 'g') }));
  if (up) parts.push(t('profileUp', { v: spanText(up, 'g') }));
  if (parts.length) return parts.join(', ');
  const dip = profile.keyDip;
  if (!dip) return '';
  return t('profileDipOnly', { v: `${fmtTick(dip.target ?? (dip.min + dip.max) / 2)}\u00A0mm` });
}

/** Hint groups, each can be turned off. */
export const HINT_GROUPS = ['damper', 'curve', 'friction', 'upweight', 'outliers', 'targets', 'dip', 'spread'];
