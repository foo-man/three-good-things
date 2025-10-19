// sw.js — 改良版
const CACHE_NAME = "good-things-cache-v3"; // バージョンをあげてデプロイしてください
const OFFLINE_FALLBACK = "/index.html"; // ナビゲーションフォールバック（サイトルートに合わせて変更）
const urlsToCache = [
  "./",
  "./index.html",
  "./manifest.json",
  "./kuroba.jpg"
];

// インストール：必要リソースを事前キャッシュ（失敗してもインストールを阻害しない）
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      // Promise.allSettled で個別リソースの失敗に耐える
      const results = await Promise.allSettled(urlsToCache.map(url => cache.add(url).catch(err => {
        // add() がCORSなどで失敗する場合があるのでログを残して続行
        console.warn("sw: cache.add failed for", url, err);
      })));
      // ensure OFFLINE_FALLBACK exists — if not cached above, try to fetch+cache it
      const fallbackResponse = await cache.match(OFFLINE_FALLBACK);
      if(!fallbackResponse){
        try {
          const resp = await fetch(OFFLINE_FALLBACK, {cache: "no-store"});
          if(resp && resp.ok) await cache.put(OFFLINE_FALLBACK, resp.clone());
        } catch(e){
          console.warn("sw: failed to fetch offline fallback", e);
        }
      }
    } catch(err){
      console.error("sw: install failed (but continuing)", err);
    }
    // できるだけ早くアクティブ化（任意）
    await self.skipWaiting();
  })());
});

// 有効化：古いキャッシュを削除
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    } catch(e){
      console.warn("sw: activate cleanup error", e);
    }
    // 新しい SW がすぐにクライアントを制御
    await self.clients.claim();
  })());
});

// fetch ハンドラ
self.addEventListener("fetch", event => {
  // only handle GET requests
  if (event.request.method !== "GET") return;

  const req = event.request;

  // navigation requests (ページ遷移) -> ネットワーク優先、失敗時はオフラインフォールバック
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        // prefer network (to get latest app shell)
        const networkResponse = await fetch(req);
        // optionally update the cache with the fresh index.html
        const cache = await caches.open(CACHE_NAME);
        // キャッシュに put するのは index などに限定しても良い
        try { cache.put(OFFLINE_FALLBACK, networkResponse.clone()); } catch(e){/* ignore */ }
        return networkResponse;
      } catch (err) {
        // offline -> キャッシュされた index を返す
        const cached = await caches.match(OFFLINE_FALLBACK);
        if (cached) return cached;
        // 最後の手段：空のレスポンス
        return new Response("Offline", {status: 503, statusText: "Offline"});
      }
    })());
    return;
  }

  // 非ナビゲーションはキャッシュ優先 (cache-first) パターン
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const networkResponse = await fetch(req);
      // 成功したら静的リソースはキャッシュしておく（次回の高速化）
      // ただし opaque レスポンスや 206/304 等は慎重に扱う
      if (networkResponse && networkResponse.ok) {
        try { cache.put(req, networkResponse.clone()); } catch(e){ /* ignore e.g., opaque */ }
      }
      return networkResponse;
    } catch (err) {
      // ネットワーク失敗: キャッシュを返すか、適切なフォールバックを返す
      if (cached) return cached;
      return new Response(null, { status: 504, statusText: "Gateway Timeout" });
    }
  })());
});

// Push 受け取り（iOS Safari は Push をサポートしない点に注意）
self.addEventListener("push", event => {
  if (!event.data) return;
  let payload = null;
  try {
    payload = event.data.json();
  } catch(e){
    try { payload = { title: "通知", body: event.data.text() }; } catch(e2){ payload = { title: "通知", body: "" }; }
  }
  if(!payload) return;
  const title = payload.title || "お知らせ";
  const options = {
    body: payload.body || "",
    icon: "kuroba.jpg",
    badge: "kuroba.jpg",
    data: payload.data || {}
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// 通知クリック
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
    for (let i = 0; i < windowClients.length; i++) {
      const client = windowClients[i];
      if (client.url === url && 'focus' in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});

// クライアントからメッセージで skipWaiting を受け取れるように（デプロイ運用で便利）
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
