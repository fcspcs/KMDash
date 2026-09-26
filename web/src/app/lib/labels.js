import { findProfile, profileName } from './profiles.js';
import { t, lang } from './i18n.js';

/** Short name for the targets of a piano, e.g. "Steinway B (Hamburg), edited". */
export function targetsLabel(targets) {
  if (!targets) return t('targetsNone');
  const profile = findProfile(targets.source);
  if (!profile) return t('targetsOwn');
  const name = profileName(profile, lang());
  return targets.edited ? t('targetsEdited', { name }) : name;
}

/** Hint groups, each can be turned off. */
export const HINT_GROUPS = ['damper', 'curve', 'friction', 'upweight', 'outliers', 'targets', 'dip', 'spread'];
