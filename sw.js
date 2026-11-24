/* Service Worker：预缓存应用外壳，离线可用；更新时优先拿新版本 */
const CACHE = 'dwp-v1.1.0';

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

  const wantsHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').indexOf('text/html') > -1;

  // 页面：网络优先，拿到新的就用新的；断网再回缓存
  if (wantsHTML) {
    e.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // 静态资源：先用缓存保证秒开，同时后台悄悄更新，下次访问即最新
  e.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => hit || caches.match('./index.html'));
      return hit || network;
    })
  );
});
