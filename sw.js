const CACHE_NAME = 'events-app-v2';        // ← новая версия, чтобы старый кэш сбросился
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/app.js',
  '/icon-512.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Приглашения /e/* и /e.html — НИКОГДА не кэшируем, всегда идём в сеть.
  if (url.pathname.startsWith('/e/') || url.pathname === '/e.html') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. Навигационные запросы (HTML страницы) — network-first
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 3. Остальное — network-first с fallback на кэш
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// Web Push — без изменений
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icon-512.png',
    badge: '/icon-512.png',
    tag: data.tag || 'general-notification',
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});