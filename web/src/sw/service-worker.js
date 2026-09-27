// Service worker for KMDash on the website (/app/). Keeps the app on the computer, so it opens on the
// KMD WiFi, which has no internet. Built into dist/sw.js by astro.config.mjs with the list of files and a version.
// It never touches the connection to the KMD: WebSockets do not pass through a service worker.
const VERSION = '__VERSION__';
const FILES = __FILES__;
const CACHE = `kmdash-${VERSION}`;
const APP = '/app/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // One by one: a file that fails (no network) must not stop the rest
      await Promise.all(
        FILES.map(async (url) => {
          try {
            const response = await fetch(url, { credentials: 'include', cache: 'no-cache' });
            if (response.ok) await cache.put(url, response);
          } catch {}
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('kmdash-') && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

// The page: from the network when there is one, else the stored copy. Built files: stored copy first, their names change with every build.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== location.origin) return;
  if (request.mode === 'navigate') event.respondWith(page(request));
  else if (FILES.includes(url.pathname)) event.respondWith(file(request, url.pathname));
});

async function page(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetchWithin(request, 4000);
    if (response.ok) {
      cache.put(APP, response.clone());
      return response;
    }
    return (await cache.match(APP)) ?? response;
  } catch {
    return (await cache.match(APP)) ?? Response.error();
  }
}

async function file(request, path) {
  const cache = await caches.open(CACHE);
  const stored = await cache.match(path);
  if (stored) return stored;
  const response = await fetch(request);
  if (response.ok) cache.put(path, response.clone());
  return response;
}

// On the KMD WiFi a request to the internet can hang instead of failing: give up after a moment
function fetchWithin(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request).then(
      (response) => (clearTimeout(timer), resolve(response)),
      (error) => (clearTimeout(timer), reject(error)),
    );
  });
}
