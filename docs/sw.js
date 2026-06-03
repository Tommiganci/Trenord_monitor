const CACHE_NAME = 'tmonitor-cache-v2';

// Risorse da caricare in cache immediatamente all'installazione
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'static/icons/icon-192.png',
  'static/icons/icon-512.png'
];

// Installa il Service Worker e memorizza la cache statica
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Apertura cache e salvataggio asset statici');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Attiva il Service Worker e pulisci le vecchie cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Cancellazione vecchia cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercetta le richieste di rete
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Strategia per le chiamate API in tempo reale (Network-First)
  if (requestUrl.pathname.includes('/api/') || requestUrl.pathname.endsWith('.json')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Se la risposta è valida, salviamola in cache
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Se offline, restituisci l'ultimo stato noto salvato in cache
          console.log('[Service Worker] Rete non disponibile per API, uso fallback cache per:', requestUrl.pathname);
          return caches.match(event.request);
        })
    );
  } else {
    // Strategia per asset statici e librerie esterne (Stale-While-Revalidate)
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        }).catch(() => {
          // Ignora gli errori di rete per Stale-While-Revalidate
        });

        // Restituisci la risposta in cache (se disponibile) o aspetta la rete
        return cachedResponse || fetchPromise;
      })
    );
  }
});
