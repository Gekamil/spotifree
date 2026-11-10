/**
 * Spotifree Service Worker
 * Purpose: Keep the PWA alive in the background so audio continues playing
 * when the user switches apps or locks their screen on Android/iOS.
 *
 * Critical for Android Chrome PWA background audio:
 *  - SW must have a fetch handler (required for SW-controlled page)
 *  - SW must respond to keepalive pings from the main thread
 *  - SW must proactively tell clients to resume audio when they were suspended
 */

// App shell cache: lets the app open with no connection (airplane mode), so the songs in
// "Archivos locales" can be played. Only this cache's own older versions are ever deleted:
// "musica-spotifree" (downloads) and other caches are left alone.
const CACHE_NAME = 'spotifree-shell-v4';
const SHELL = ['/', '/index.html', '/offline.html', '/silence.wav', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png'];
const MAX_ASSETS = 180;

function fetchWithTimeout(request, ms = 2800) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(request, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(async (cache) => {
        await Promise.all(SHELL.map((u) => cache.add(u).catch(() => {})));
        // Also pre-cache the current entry JS/CSS assets referenced by index.html on first install
        try {
          const indexRes = await cache.match('/');
          if (indexRes) {
            const html = await indexRes.clone().text();
            const urls = [];
            const re = /(?:src|href)=["'](\/assets\/[^"']+)["']/g;
            let m;
            while ((m = re.exec(html)) !== null) {
              if (m[1]) urls.push(m[1]);
            }
            await Promise.all(urls.map((u) => cache.add(u).catch(() => {})));
          }
        } catch {}
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => (k.startsWith('spotifree-v') || k.startsWith('spotifree-shell-')) && k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
    ])
  );
});

async function trimAssets(cache) {
  const keys = (await cache.keys()).filter((r) => new URL(r.url).pathname.startsWith('/assets/'));
  for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i]);
}

/** Pages: fast network-first (always latest when online), instant cached shell in airplane mode */
async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetchWithTimeout(request, 2800);
    if (res && res.ok) cache.put('/', res.clone()).catch(() => {});
    return res;
  } catch {
    return (await cache.match('/')) || (await cache.match('/index.html')) || (await cache.match(request)) || (await cache.match('/offline.html')) || new Response('Sin conexión', { status: 503 });
  }
}

/** Built files (/assets/... have a hash in the name): saved copy first */
async function handleAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res && res.ok) {
      cache.put(request, res.clone()).then(() => trimAssets(cache)).catch(() => {});
    }
    return res;
  } catch {
    return new Response('', { status: 503 });
  }
}

/** Fonts, icons, manifest: fast network first, saved copy when offline */
async function handleStatic(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const res = await fetchWithTimeout(request, 2800);
    if (res && res.ok) cache.put(request, res.clone()).catch(() => {});
    return res;
  } catch {
    return (await cache.match(request)) || new Response('', { status: 503 });
  }
}

// Cross-origin requests (CDNs, images, audio streams) are never intercepted
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  const path = new URL(req.url).pathname;
  // The phone's own files (APK, "Archivos locales") and media byte ranges go straight through
  if (path.startsWith('/_capacitor_') || req.headers.has('range')) return;
  if (req.mode === 'navigate') {
    event.respondWith(handleNavigation(req));
  } else if (path.startsWith('/assets/')) {
    event.respondWith(handleAsset(req));
  } else if (/\.(woff2?|ttf|otf|png|svg|ico|webmanifest|json)$/i.test(path) && !/^\/(api|src|node_modules|@)/.test(path)) {
    event.respondWith(handleStatic(req));
  } else {
    event.respondWith(fetch(req).catch(() => new Response('', { status: 503 })));
  }
});

// Track whether audio is currently playing (updated by main thread messages)
let isAudioPlaying = false;

// Periodic background keepalive: every 5 seconds, tell all clients to check & resume audio
// This fires even when the browser tab is backgrounded on Android
let keepaliveTimer = null;

function startKeepaliveTimer() {
  if (keepaliveTimer) return;
  keepaliveTimer = setInterval(async () => {
    if (!isAudioPlaying) return;
    try {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: false });
      clients.forEach(client => {
        client.postMessage({ type: 'AUDIO_KEEPALIVE_TICK' });
      });
    } catch {}
  }, 5000);
}

function stopKeepaliveTimer() {
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }
}

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (!event.data) return;

  switch (event.data.type) {
    case 'KEEP_ALIVE':
      // Main thread is pinging us — reply to confirm SW is alive
      if (event.source) {
        event.source.postMessage({ type: 'KEEP_ALIVE_ACK' });
      }
      break;

    case 'AUDIO_PLAYING':
      // Main thread told us audio started playing — begin keepalive broadcasts
      isAudioPlaying = true;
      startKeepaliveTimer();
      break;

    case 'AUDIO_PAUSED':
    case 'AUDIO_STOPPED':
      // Main thread told us audio stopped — stop keepalive broadcasts
      isAudioPlaying = false;
      stopKeepaliveTimer();
      break;

    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_URLS':
      if (Array.isArray(event.data.urls)) {
        event.waitUntil(
          caches.open(CACHE_NAME).then((cache) =>
            Promise.all(
              event.data.urls
                .filter((u) => typeof u === 'string' && u.startsWith('/'))
                .map((u) => cache.match(u).then((hit) => (hit ? null : cache.add(u).catch(() => {}))))
            )
          )
        );
      }
      break;
  }
});
