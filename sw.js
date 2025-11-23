// sw.js - FINAL FIXED VERSION (Offline-safe + Stable PWA)
const CACHE_NAME = 'gloves-manufacture-v4.13';
const STATIC_CACHE = 'static-v4.13';

// ✅ Static files to cache
const STATIC_FILES = [
  './',
  './index.html',
  './manifest.json',
  './storage.js',
  './sw.js',
  './icon-192.png',
  './icon-512.png',
  './thumb.jpg',
  './lib/jspdf.umd.min.js',
  './lib/jspdf-autotable.min.js'
];

// 🧱 INSTALL EVENT
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Service Worker: Installed');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// 🚀 ACTIVATE EVENT
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== STATIC_CACHE) {
            console.log('Service Worker: Deleting old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activated');
      return self.clients.claim();
    })
  );
});

// 🌐 FETCH EVENT (fixed offline fallback)
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip extension or chrome requests
  if (event.request.url.startsWith('chrome-extension://')) return;

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // ✅ Cache hit - return directly
        if (response) return response;

        // Clone the request before fetch
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest)
          .then((response) => {
            // Check for valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone response and store it in cache
            const responseToCache = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(event.request, responseToCache);
            });

            return response;
          })
          .catch(() => {
            // 🧩 FIXED OFFLINE FALLBACK
            if (event.request.destination === 'document') {
              // Try both absolute + relative match
              return caches.match(event.request.url)
                .then(r => r || caches.match('./index.html'));
            }

            // Other assets (images, JS) fallback
            return new Response('⚠️ Network error (offline)', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});


