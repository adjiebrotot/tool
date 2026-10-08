/* Service worker for the installable app (PWA).
 *
 * Online, every page and file comes from the network first, and is checked
 * with the server each time (a cheap 304 when unchanged) rather than reused
 * from the browser's 10-minute HTTP cache, so a deploy (a new tool or an
 * update) is live on the very next load. Whatever loads is also kept in the
 * cache, so a tool opened once still opens offline. The service worker itself
 * is re-checked by the browser on every visit, and pwa.js asks an app left
 * open to reload when a newer deploy is out.
 * Libraries and fonts from the CDNs are pinned by URL, so they are served
 * from the cache first and refreshed in the background.
 *
 * Bump VERSION only to throw every cached file away (the cache refreshes
 * itself otherwise).
 */
const VERSION = 'v1';
const PAGES = 'brotools-pages-' + VERSION;
const CDN = 'brotools-cdn-' + VERSION;
const CDN_MAX = 80;

const PRECACHE = [
  './',
  'shared.css', 'shared.js', 'dropdown.css', 'dropdown.js', 'light.css', 'dark.css',
  'tour-shared.css', 'tour-shared.js', 'pwa.js',
  'manifest.webmanifest',
  'logos/logo.svg', 'logos/icon-192.png', 'logos/icon-512.png',
];

const CDN_HOSTS = [
  'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com',
  'fonts.googleapis.com', 'fonts.gstatic.com',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PAGES)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = [PAGES, CDN];
    for (const key of await caches.keys()) {
      if (key.startsWith('brotools-') && !keep.includes(key)) await caches.delete(key);
    }
    // v1 turned navigation preload on; nothing reads it any more.
    if (self.registration.navigationPreload) await self.registration.navigationPreload.disable();
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(event));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(event));
  }
  // Anything else (analytics, market-data proxy, ads) goes straight to the network.
});

async function networkFirst(event) {
  const req = event.request;
  const cache = await caches.open(PAGES);
  try {
    const res = revalidate(await fetch(req, { cache: 'no-cache' }));
    if (res.ok) event.waitUntil(cache.put(req, res.clone()));
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    // A page never opened before: send the user to the home page (cached on
    // install) rather than a browser error. A redirect, so its links resolve.
    if (req.mode === 'navigate' && await cache.match('./')) {
      return Response.redirect(new URL('./', self.location).href, 302);
    }
    throw err;
  }
}

// GitHub Pages sends max-age=600, and Chrome keeps a script or stylesheet
// that is still "fresh" in memory and reuses it without asking this worker,
// so an app reopened within 10 minutes of a deploy would run the old code.
// Handing the page a copy marked no-cache sends every load back through here.
function revalidate(res) {
  if (res.type !== 'basic' || res.status === 206) return res;
  const headers = new Headers(res.headers);
  headers.set('Cache-Control', 'no-cache');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

async function cacheFirst(event) {
  const req = event.request;
  const cache = await caches.open(CDN);
  const hit = await cache.match(req);
  const refresh = fetch(req).then(async res => {
    if (res.ok || res.type === 'opaque') {
      await cache.put(req, res.clone());
      await trim(cache);
    }
    return res;
  });
  if (hit) {
    event.waitUntil(refresh.catch(() => {}));
    return hit;
  }
  return refresh;
}

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - CDN_MAX; i++) await cache.delete(keys[i]);
}
