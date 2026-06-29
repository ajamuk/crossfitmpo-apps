// Service worker — cachea el shell para uso offline; la API siempre va a la red.
const CACHE = 'entrena-v1';
const SHELL = [
  '/', '/index.html',
  '/css/styles.css',
  '/js/api.js', '/js/charts.js', '/js/app.js',
  '/manifest.webmanifest', '/icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Las llamadas a la API nunca se cachean (datos siempre frescos).
  if (url.pathname.startsWith('/api/')) return;
  // Estrategia cache-first para el shell estático.
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('/index.html'))
    )
  );
});
