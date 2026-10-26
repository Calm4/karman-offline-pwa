/* Only app files are cached. Notes never leave device storage. */
const CACHE = 'karman-shell-v2';
const ROOT = new URL('./', self.location.href);
const FILES = ['./',  './style.css', './app.js', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'].map(path => new URL(path, ROOT).href);
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Reject auth pages, redirects and HTML masquerading as a script.
    for (const url of FILES) {
      const response = await fetch(new Request(url, {cache:'reload', redirect:'error'}));
      if (!response.ok || response.type === 'opaque') throw new Error('App file unavailable');
      const type = response.headers.get('content-type') || '';
      if (url.endsWith('.js') && !/javascript/.test(type)) throw new Error('Invalid script');
      if (url.endsWith('.css') && !/text\/css/.test(type)) throw new Error('Invalid stylesheet');
      await cache.put(url, response);
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('karman-shell-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(ROOT.href)) || (await cache.match(new URL('index.html', ROOT).href)) || fetch(event.request);
    })());
  } else if (FILES.includes(url.href)) {
    event.respondWith((async () => (await (await caches.open(CACHE)).match(event.request)) || fetch(event.request))());
  }
});
