// Geist (latin, variable weight 100 to 900) under the SIL Open Font License, see OFL-Geist.txt.
// Modern and easy to read: open shapes, a 1 with a flag, tabular figures on request.
// Bundled into the app: on the KMD's WiFi there is no internet. Added with the FontFace API, so nothing
// is written into the page's <head>.
import geist from './geist.woff2';

let loaded = false;

export function loadFonts() {
  if (loaded || typeof document === 'undefined' || !document.fonts || typeof FontFace === 'undefined') return;
  loaded = true;
  document.fonts.add(new FontFace('KMDashboard Sans', `url(${geist}) format('woff2')`, { weight: '100 900', style: 'normal', display: 'swap' }));
}
