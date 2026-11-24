const CACHE_NAME = 'llamago-v4.4';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/logo.png',
  '/wordmark.png',
  '/wordmark-dark.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-180.png',
  '/apple-touch-icon.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Use Promise.allSettled so an individual asset failure doesn't kill SW install
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((url) => 
          fetch(url, { cache: 'reload' })
            .then((res) => {
              if (res.ok) return cache.put(url, res);
            })
            .catch((err) => console.warn('PWA Cache item failed:', url, err))
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('Purging old PWA cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Cache API ONLY supports GET requests. Immediately ignore POST, PUT, DELETE, etc.
  if (event.request.method !== 'GET') {
    return;
  }

  // Only handle http/https URLs
  if (!event.request.url.startsWith('http')) {
    return;
  }

  const url = new URL(event.request.url);

  // Do not intercept or cache any Next.js API routes (/api/*)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Do not intercept or cache external auth/database/recaptcha APIs
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('google.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('identitytoolkit')
  ) {
    return;
  }

  // If requesting manifest or icons/logo, always attempt network first so new branding updates immediately
  if (
    url.pathname.endsWith('manifest.json') ||
    url.pathname.includes('icon') ||
    url.pathname.includes('logo') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && event.request.method === 'GET') {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              try {
                cache.put(event.request, responseClone);
              } catch (e) {
                // Ignore Cache put errors
              }
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Network first for navigation
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/') || caches.match(event.request);
      })
    );
    return;
  }

  // Stale-while-revalidate for other requests
  event.respondWith(
    caches.match(event.request).then((response) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              try {
                cache.put(event.request, clone);
              } catch (e) {
                // Ignore Cache put errors
              }
            });
          }
          return networkResponse;
        })
        .catch(() => null);

      return response || fetchPromise;
    })
  );
});


// ---- Avisos push: llegan aunque la app esté cerrada ----
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'LlamaGO', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'LlamaGO';
  event.waitUntil((async () => {
    // Si la app está abierta y a la vista, ya suena dentro: no duplicar.
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.some((w) => w.visibilityState === 'visible')) return;
    await self.registration.showNotification(title, {
      body: data.body || '',
      icon: data.icon || '/icon-192.png',
      badge: data.badge || '/icon-192.png',
      tag: data.tag || 'llamago',
      renotify: true,
      vibrate: data.urgent ? [200, 100, 200, 100, 400] : [120, 60, 120],
      requireInteraction: !!data.urgent,
      data: { url: data.url || '/' },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) { await w.focus(); return; }
    }
    await self.clients.openWindow(url);
  })());
});
