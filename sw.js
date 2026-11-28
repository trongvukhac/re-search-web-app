/* RE:SEARCH — Progressive Web App Service Worker (v5.0.2) */
const CACHE_NAME = "research-pwa-v5.0.2";

const PRECACHE_ASSETS = [
  "/",
  "/manifest.json",
  "/styles.css",
  "/public/assets/logo.png",
  "/public/assets/logodark.png",
  "/public/assets/favicon-light.png",
  "/public/assets/favicon-dark.png",
  "/public/assets/app-ios-192.png",
  "/public/assets/app-ios-512.png"
];

// Install: Kích hoạt Service Worker và nạp cache bộ khung ứng dụng
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("[PWA SW] Precache warning:", err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Xóa các cache cũ khi có phiên bản mới
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Chiến lược Network-First bảo đảm luôn nhận phiên bản mới nhất
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. Tuyệt đối không cache API requests, localhost dev, và phương thức không phải GET
  if (req.method !== "GET" || url.pathname.startsWith("/api/") || url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return;
  }

  // 2. Với trang HTML (điều hướng): Network-First (ưu tiên mạng, mất mạng mới lấy cache)
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return response;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // 3. Với tài nguyên tĩnh (CSS, JS, Fonts, Images): Network-First, fallback về Cache
  event.respondWith(
    fetch(req)
      .then((response) => {
        if (response && response.status === 200 && req.url.startsWith("http")) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return response;
      })
      .catch(() => caches.match(req))
  );
});
