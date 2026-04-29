const VERSION = 'subliminal-v6';
const CACHE_NAME = `subliminal-player-${VERSION}`;

// Nature sounds are core features, pre-cache them for airplane mode support
// These are preview files and usually small (<1MB)
const NATURE_SOUNDS_ASSETS = [
  'https://assets.mixkit.co/sfx/preview/mixkit-light-rain-loop-2393.mp3',
  'https://assets.mixkit.co/sfx/preview/mixkit-ocean-waves-loop-1196.mp3',
  'https://assets.mixkit.co/sfx/preview/mixkit-forest-birds-ambience-loop-1210.mp3',
  'https://assets.mixkit.co/sfx/preview/mixkit-wind-whistle-loop-1159.mp3',
  'https://assets.mixkit.co/sfx/preview/mixkit-campfire-crackling-loop-1144.mp3',
  'https://assets.mixkit.co/sfx/preview/mixkit-river-flowing-water-loop-1195.mp3',
];

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
];

// Combine all pre-cache targets
const PRECACHE_ASSETS = [...STATIC_ASSETS, ...NATURE_SOUNDS_ASSETS];

// Offline-first strategy: Cache essential assets on install
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching system assets');
      return Promise.allSettled(
        PRECACHE_ASSETS.map(asset => 
          fetch(asset, { mode: 'no-cors' }).then(response => {
            if (response.type === 'opaque' || response.ok) {
              return cache.put(asset, response);
            }
          }).catch(err => console.warn(`[SW] Failed to pre-cache ${asset}:`, err))
        )
      );
    })
  );
});

// Clean up old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('subliminal-player-') && name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Clearing legacy system cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests (except for Share Target handled below)
  if (event.request.method !== 'GET') {
    // Handle Share Target (POST)
    if (event.request.method === 'POST' && url.pathname === '/share-target') {
      event.respondWith(
        (async () => {
          try {
            const formData = await event.request.formData();
            const audioFiles = formData.getAll('audio_files');
            
            if (audioFiles && audioFiles.length > 0) {
              const cache = await caches.open('shared-files');
              for (let i = 0; i < audioFiles.length; i++) {
                const file = audioFiles[i];
                const response = new Response(file);
                const headers = new Headers(response.headers);
                headers.set('x-filename', encodeURIComponent(file.name));
                const responseWithMeta = new Response(file, { headers });
                await cache.put(`/shared-files/temp-${i}`, responseWithMeta);
              }
              return Response.redirect('/?shared-count=' + audioFiles.length, 303);
            }
          } catch (err) {
            console.error('[SW] System: Share-target fallback failed:', err);
          }
          return Response.redirect('/', 303);
        })()
      );
    }
    return;
  }

  // Caching Strategy: Stale-While-Revalidate for most assets, Cache-First for versioned
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Cache successful responses for local assets, fonts, and images
        if (networkResponse && networkResponse.status === 200) {
          const isLocal = url.origin === self.location.origin;
          const isFont = url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com';
          const isImage = url.hostname === 'picsum.photos' || url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp)$/);
          const isAudio = url.hostname === 'assets.mixkit.co' || url.pathname.match(/\.(mp3|wav|m4a|aac)$/);
          
          if (isLocal || isFont || isImage || isAudio) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
        }
        return networkResponse;
      }).catch((err) => {
        // Return cached response if network fails, or nothing if no cache
        console.warn(`[SW] Network request failed for ${url.pathname}. Using cache if available.`);
        return cachedResponse;
      });

      // For core assets like index.html or pre-cached items, prefer cache immediately but update in background
      if (cachedResponse) {
        return cachedResponse;
      }

      // If not in cache, wait for network
      return fetchPromise.catch(() => {
        // Offline Fallback shell for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
        return null;
      });
    })
  );
});
