const CACHE_NAME = 'notepad-pwa-v20';
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

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FOCUS_ALL_WINDOWS') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        clientList.forEach((client) => {
          if ('focus' in client) {
            client.focus();
          }
        });
      })
    );
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.origin === location.origin) {
    const cleanUrl = url.pathname;
    event.respondWith(
      caches.match(cleanUrl).then((response) => {
        return response || fetch(event.request);
      }).catch(() => {
        return caches.match('./index.html');
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((fetchRes) => {
          return caches.open(CACHE_NAME).then((cache) => {
            if (fetchRes.status === 200) {
              cache.put(event.request, fetchRes.clone());
            }
            return fetchRes;
          });
        });
      })
    );
  }
});