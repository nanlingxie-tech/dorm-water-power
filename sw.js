/* Service Worker：预缓存应用外壳，离线可用 */
const CACHE = 'dwp-v1.0.0';

const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/base.css',
  './css/components.css',
  './css/pages.css',
  './js/util.js',
  './js/seed.js',
  './js/store.js',
  './js/domain.js',
  './js/perm.js',
  './js/ocr.js',
  './js/ui.js',
  './js/pages/guard.js',
  './js/pages/supervisor.js',
  './js/pages/manager.js',
  './js/pages/finance.js',
  './js/pages/admin.js',
  './js/pages/report.js',
  './js/pages/employee.js',
  './js/router.js',
  './js/app.js',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
