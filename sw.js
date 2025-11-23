// sw.js - FIXED OFFLINE VERSION
const CACHE_NAME = 'gloves-manufacture-v4.15-offline';
const STATIC_CACHE = 'static-v4.15-offline';

// ✅ ALL files to cache for offline use
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

// 🧱 INSTALL EVENT - Cache all files
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing and caching files...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching all static files');
        // Add all files to cache
        return cache.addAll(STATIC_FILES).catch(error => {
          console.log('Cache addAll failed, adding files one by one:', error);
          // If addAll fails, add files individually
          const promises = STATIC_FILES.map(url => {
            return cache.add(url).catch(e => {
              console.log(`Failed to cache: ${url}`, e);
            });
          });
          return Promise.all(promises);
        });
      })
      .then(() => {
        console.log('Service Worker: All files cached successfully');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// 🚀 ACTIVATE EVENT - Clean old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== STATIC_CACHE && cache !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activated and ready');
      return self.clients.claim();
    })
  );
});

// 🌐 FETCH EVENT - OFFLINE FIRST STRATEGY
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and chrome extensions
  if (event.request.method !== 'GET' || 
      event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // ✅ OFFLINE: Return from cache if available
        if (response) {
          return response;
        }

        // ✅ ONLINE: Try network request
        return fetch(event.request)
          .then((networkResponse) => {
            // Cache successful responses
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(STATIC_CACHE)
                .then(cache => {
                  cache.put(event.request, responseClone);
                });
            }
            return networkResponse;
          })
          .catch((error) => {
            // 🆘 OFFLINE FALLBACKS
            console.log('Network failed, serving offline fallback:', error);
            
            // For HTML pages, return index.html
            if (event.request.destination === 'document' || 
                event.request.headers.get('accept').includes('text/html')) {
              return caches.match('./index.html');
            }
            
            // For CSS/JS, try to get from cache with different URLs
            if (event.request.url.includes('.css') || 
                event.request.url.includes('.js')) {
              return caches.match(event.request.url)
                .then(r => r || caches.match('./index.html'));
            }
            
            // Default offline message
            return new Response('🔌 You are offline. App is working in offline mode.', {
              status: 200,
              headers: { 'Content-Type': 'text/html' }
            });
          });
      })
  );
});

// 📱 Handle app updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
