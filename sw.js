// PWAのインストール要件を満たすためのダミーService Worker
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  // オフラインキャッシュ等の複雑な処理は行わず、そのまま通信を通す
  return;
});