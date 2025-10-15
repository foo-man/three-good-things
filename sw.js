const CACHE_NAME = "good-things-cache-v3"; // ← v3など毎回変える！
const urlsToCache = [
  "./",
  "./index.html",
  "./manifest.json",
  "./kyattorabinngu.png"
];

// インストール時
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting(); // 新しいSWを即座に有効化
});

// 古いキャッシュ削除
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      )
    )
  );
  self.clients.claim();
});

// fetchリクエスト（キャッシュ優先）
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

// Push通知（必要なら維持OK）
self.addEventListener("push", event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "kyattorabinngu.png",
      badge: "kyattorabinngu.png"
    })
  );
});
