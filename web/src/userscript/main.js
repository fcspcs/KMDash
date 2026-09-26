// Userscript entry point: runs on the KMD's page (http://192.168.1.67) and replaces the KMD's own interface.
// With #original in the address the KMD's own page stays as it is (plus a button back to the app).
// Nothing is sent to the device: the KMD's own page is only stopped before it opens its WebSocket.
import { mount } from 'svelte';
import App from '../app/App.svelte';
import { AppState } from '../app/state.svelte.js';
import { createLiveSource } from '../app/sources/live.js';
import { loadPrefs } from '../app/lib/store.js';
import { setLang, t } from '../app/lib/i18n.js';

const PAGE_STYLE = `
  html, body { margin: 0; height: 100%; background: #f6f5f0; }
  @media (prefers-color-scheme: dark) { html, body { background: #0f0f0e; } }
`;

function meta(name, content) {
  const el = document.createElement('meta');
  el.name = name;
  el.content = content;
  document.head.append(el);
}

/** Stop the KMD's own page: init() only runs in window.onload. When injected late, close its socket and timers. */
function stopOriginal() {
  window.onload = null;
  try {
    const socket = window.Socket;
    if (socket && socket.readyState <= 1) {
      socket.onmessage = null;
      socket.close();
    }
  } catch {}
  const last = setInterval(() => {}, 1e9);
  for (let id = 1; id <= last; id++) clearInterval(id);
}

function takeOver() {
  stopOriginal();
  document.querySelectorAll('link[rel="stylesheet"], style, meta[name="viewport"]').forEach((el) => el.remove());
  meta('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
  meta('color-scheme', 'light dark');
  meta('theme-color', '#f6f5f0');
  const style = document.createElement('style');
  style.textContent = PAGE_STYLE;
  document.head.append(style);
  // Clear the body first: the KMD's page has a typo (<htm>), so its <title> ends up in the body
  document.body.replaceChildren();
  document.body.removeAttribute('style');
  document.querySelectorAll('title').forEach((el) => el.remove());
  document.title = 'KMDashboard';
  document.documentElement.lang = loadPrefs().lang || 'en';
  const root = document.createElement('div');
  root.id = 'kmdashboard';
  document.body.append(root);
  mount(App, { target: root, props: { app: new AppState(createLiveSource()) } });
}

/** On the KMD's own page: small button back to the app. */
function backButton() {
  setLang(loadPrefs().lang);
  const button = document.createElement('button');
  button.textContent = t('backToApp');
  button.style.cssText =
    'position:fixed;right:12px;bottom:12px;z-index:99999;padding:12px 18px;border:0;border-radius:2px;background:#141414;color:#f6f5f0;font:500 14px -apple-system,system-ui,sans-serif;letter-spacing:.01em;box-shadow:0 6px 20px rgb(0 0 0/.22)';
  button.onclick = () => {
    history.replaceState(null, '', location.pathname);
    location.reload();
  };
  document.body.append(button);
}

if (!window.__kmdashboard) {
  window.__kmdashboard = true;
  if (location.hash === '#original') backButton();
  else takeOver();
}
