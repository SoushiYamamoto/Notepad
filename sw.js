const CACHE_NAME = 'notepad-pwa-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './favicon16.png',
  './favicon32.png',
  './favicon96.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // CDN経由のスクリプト（Aceエディタ等）のキャッシュ
  if (url.origin !== location.origin) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((fetchRes) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, fetchRes.clone());
            return fetchRes;
          });
        });
      })
    );
    return;
  }

  // ローカルファイル（index.html?transfer=xxx のようなクエリを無視してキャッシュを返す）
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((response) => {
      return response || fetch(event.request);
    }).catch(() => {
      return caches.match('./index.html', { ignoreSearch: true });
    })
  );
});