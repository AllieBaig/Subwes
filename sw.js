const VERSION = "subliminal-v8";
const CACHE_NAME = `subliminal-player-${VERSION}`;
const BASE_PATH = "/Subwes";

const NATURE_SOUNDS_ASSETS = [
  "https://assets.mixkit.co/sfx/preview/mixkit-light-rain-loop-2393.mp3",
  "https://assets.mixkit.co/sfx/preview/mixkit-ocean-waves-loop-1196.mp3",
  "https://assets.mixkit.co/sfx/preview/mixkit-forest-birds-ambience-loop-1210.mp3",
  "https://assets.mixkit.co/sfx/preview/mixkit-wind-whistle-loop-1159.mp3",
  "https://assets.mixkit.co/sfx/preview/mixkit-campfire-crackling-loop-1144.mp3",
  "https://assets.mixkit.co/sfx/preview/mixkit-river-flowing-water-loop-1195.mp3"
];

const STATIC_ASSETS = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/manifest.json`,
  `${BASE_PATH}/favicon.ico`
];

const PRECACHE_ASSETS = [...STATIC_ASSETS, ...NATURE_SOUNDS_ASSETS];

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_ASSETS.map(async (asset) => {
          try {
            const response = await fetch(asset, { mode: "no-cors" });
            if (response && (response.ok || response.type === "opaque")) {
              await cache.put(asset, response);
            }
          } catch (err) {
            console.warn("[SW] Pre-cache failed:", asset, err);
          }
        })
      );
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("subliminal-player-") &&
              key !== CACHE_NAME
          )
          .map((key) => caches.delete(key))
      );

      await self.clients.claim();
    })
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    if (
      request.method === "POST" &&
      url.pathname === `${BASE_PATH}/share-target`
    ) {
      event.respondWith(
        (async () => {
          try {
            const formData = await request.formData();
            const files = formData.getAll("audio_files");

            if (files.length) {
              const cache = await caches.open("shared-files");

              for (let i = 0; i < files.length; i++) {
                const file = files[i];
                await cache.put(
                  `${BASE_PATH}/shared-files/temp-${i}`,
                  new Response(file)
                );
              }

              return Response.redirect(
                `${BASE_PATH}/?shared-count=${files.length}`,
                303
              );
            }
          } catch (err) {
            console.error("[SW] Share target failed:", err);
          }

          return Response.redirect(`${BASE_PATH}/`, 303);
        })()
      );
    }

    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (
            response &&
            (response.status === 200 || response.type === "opaque")
          ) {
            const isLocal = url.origin === self.location.origin;
            const isFont =
              url.hostname.includes("fonts");
            const isImage =
              /\.(png|jpg|jpeg|svg|gif|webp)$/i.test(url.pathname);
            const isAudio =
              /\.(mp3|wav|m4a|aac)$/i.test(url.pathname) ||
              url.hostname.includes("mixkit");

            if (isLocal || isFont || isImage || isAudio) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, response.clone());
              });
            }
          }

          return response;
        })
        .catch(() => cached);

      if (cached) return cached;

      return networkFetch.catch(async () => {
        if (request.mode === "navigate") {
          return caches.match(`${BASE_PATH}/index.html`);
        }
        return null;
      });
    })
  );
});
