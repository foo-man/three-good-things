const CACHE_NAME = "good-things-cache-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/manifest.json",
  "/kyattorabinngu.png"
];

// インストール時にキャッシュ
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

// リクエストをキャッシュから返す
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});

// Push通知受け取り
self.addEventListener("push", event => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "kyattorabinngu.png",
      badge: "kyattorabinngu.png"
    })
  );
});

