

// 2026-04-29 09:14:02
// File creation: 2026-04-29 09:14:02

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Determine the base path (e.g., /Subwes/ or /)
    const publicUrl = new URL(import.meta.env.BASE_URL, window.location.href);
    const swPath = `${publicUrl.pathname}sw.js`.replace(/\/+/g, '/');

    navigator.serviceWorker.register(swPath, { scope: publicUrl.pathname })
      .then(registration => {
        console.log('[SW] PWA System Active:', registration.scope);
        
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.onstatechange = () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[SW] New version available');
              }
            };
          }
        });
      })
      .catch(err => {
        console.error('[SW] System offline fallback failed:', err);
      });
  });
}

