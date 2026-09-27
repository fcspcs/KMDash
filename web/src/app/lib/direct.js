// KMDash straight from the website, without the userscript.
// The website is https, the KMD only speaks plain ws:// on its own WiFi. Browsers block that ("mixed content"),
// except Chrome and Edge from version 147: after the user allows access to the local network, a secure site may
// reach a device at a local address like the KMD's. Safari and Firefox have no such permission.

export const MIN_CHROMIUM = 147;

/** 'ok', 'update' (Chrome or Edge too old) or 'browser' (Safari, Firefox and others). */
export function browserSupport(nav = globalThis.navigator) {
  const brand = nav?.userAgentData?.brands?.find((b) => b.brand === 'Chromium');
  if (!brand) return 'browser';
  return Number(brand.version) >= MIN_CHROMIUM ? 'ok' : 'update';
}

// Chrome 142 introduced "local-network-access", later versions split it into "local-network" and "loopback-network"
const PERMISSION_NAMES = ['local-network', 'local-network-access'];

/** The browser's local network permission: { state: 'granted' | 'prompt' | 'denied', onchange } or null if unknown. */
export async function localNetworkPermission(nav = globalThis.navigator) {
  for (const name of PERMISSION_NAMES) {
    try {
      return await nav.permissions.query({ name });
    } catch {}
  }
  return null;
}
