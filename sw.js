// sw.js - Robust offline-first service worker for GMC App
const APP_VERSION = 'v4.15'; // change if you release a new app version
const CACHE_PREFIX = 'gmc-cache-';
const CACHE_NAME = `${CACHE_PREFIX}${APP_VERSION}`;
const OFFLINE_PAGE = './index.html';

// Files you want guaranteed cached for offline. Add any extra files your app needs.
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
  './lib/jspdf-autotable.min.js',
  './version.json',
  './_redirects',
  './_headers'
];

// During install: cache core files
self.addEventListener('install', (event) => {
  console.log('[SW] Install event, caching core files...', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        try {
          // Try addAll first (faster), fallback to individual adds on failure
          await cache.addAll(STATIC_FILES);
          console.log('[SW] All static files added to cache.');
        } catch (err) {
          console.warn('[SW] addAll failed, adding files individually:', err);
          for (const url of STATIC_FILES) {
            try {
              await cache.add(url);
            } catch (e) {
              console.warn(`[SW] Failed to cache ${url}:`, e);
            }
          }
        }
      })
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Install failed:', err))
  );
});

// Activate: cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(old => {
            console.log('[SW] Deleting old cache', old);
            return caches.delete(old);
          })
      );
    }).then(() => {
      // Take control of uncontrolled clients immediately
      return self.clients.claim();
    })
  );
});

// Utility to send messages to all clients
async function broadcastMessage(msg) {
  const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clientsList) {
    client.postMessage(msg);
  }
}

// Fetch handler: offline-first for navigation; stale-while-revalidate for assets
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const requestURL = new URL(event.request.url);

  // Don't handle chrome-extension requests or analytics 3rd party (let them go to network)
  if (requestURL.protocol.startsWith('chrome-extension')) return;

  // Navigation request (HTML page)
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          // Return cached page immediately, then try network to update cache
          fetchAndCache(event.request);
          return cachedResponse;
        }

        // No cache: try network, else fallback to offline page
        return fetch(event.request)
          .then(networkResponse => {
            // Cache HTML responses for later
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => caches.match(OFFLINE_PAGE));
      })
    );
    return;
  }

  // For other resources: try cache first, then network, and update cache (stale-while-revalidate)
  event.respondWith(
    caches.match(event.request).then(cached => {
      // If we have cached response, return it and refresh in background
      if (cached) {
        // Refresh latest in background
        event.waitUntil(fetchAndCache(event.request));
        return cached;
      }

      // No cache — fetch from network, cache if ok, else fallback
      return fetch(event.request)
        .then(networkResponse => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
            return networkResponse;
          }
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
          return networkResponse;
        })
        .catch(() => {
          // If request is for an image, return a blank 1x1 PNG fallback (optional)
          if ((event.request.destination === 'image') || event.request.url.match(/\.(png|jpg|jpeg|svg|gif)$/i)) {
            // a tiny transparent pixel base64 response
            const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==';
            return fetch(transparentPixel);
          }
          return caches.match(OFFLINE_PAGE);
        });
    })
  );
});

// Helper: fetch from network and put to cache (used to refresh)
function fetchAndCache(request) {
  return fetch(request)
    .then(response => {
      if (!response || response.status !== 200) return;
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => {
        cache.put(request, copy);
      });
    })
    .catch(err => {
      // network failed — do nothing
      console.warn('[SW] fetchAndCache failed for', request.url, err);
    });
}

// Listen for messages from page
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data && data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (data && data.type === 'PING') {
    // Reply to client telling it that SW is active and ready
    event.source.postMessage({ type: 'PONG', version: APP_VERSION });
  }
});

// Optionally broadcast when SW is installed and ready
self.addEventListener('sync', (e) => {
  // handle background sync if you implement it later
});

// Immediately notify clients when activated
self.addEventListener('activate', () => {
  broadcastMessage({ type: 'SW_READY', version: APP_VERSION });
});
