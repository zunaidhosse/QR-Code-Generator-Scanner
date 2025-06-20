const CACHE_NAME = 'qr-app-cache-v8';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './main.js',
  './generator.js',
  './scanner.js',
  './ui.js',
  './language.js',
  './en.json',
  './bn.json',
  './generator-view.html',
  './scanner-view.html',
  './click.mp3',
  './scan-success.mp3',
  './toast-pop.mp3',
  './icon-192.png',
  './icon-512.png',
  './liquid-bg.png',
  './bg-pattern.png',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
];

// Install event: cache all important assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        const urlsToCache = URLS_TO_CACHE.map(url => new Request(url, { cache: 'reload' }));
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event: serve from cache first, then network
self.addEventListener('fetch', event => {
  // We only want to handle GET requests.
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(cachedResponse => {
        // Cache hit - return response
        if (cachedResponse) {
          return cachedResponse;
        }

        // Not in cache - fetch from network
        return fetch(event.request).then(
          networkResponse => {
            // Check if we received a valid response to cache.
            // We don't want to cache error pages or opaque responses (e.g. from some CDNs without CORS)
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'error') {
              return networkResponse;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = networkResponse.clone();
            
            // Don't block the network response from returning by waiting for cache.put
            // We cache in the background.
            cache.put(event.request, responseToCache);

            return networkResponse;
          }
        ).catch(error => {
            console.log('Fetch failed; returning offline page instead.', error);
            // In case of a fetch error (e.g., user is offline and resource is not in cache),
            // you might want to return a fallback page or resource.
            // For this app, we let the browser handle it.
        });
      });
    })
  );
});

// Activate event: clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});