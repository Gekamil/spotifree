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

const CACHE_NAME = 'spotifree-v2';

// On install, activate immediately (no waiting)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Take control of all clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean old caches
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      ),
    ])
  );
});

// Pass through cross-origin requests natively so CDNs, images, and streams are never blocked
self.addEventListener('fetch', (event) => {
  // Only handle same-origin requests; never intercept cross-origin image CDNs or audio streams
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(() => new Response('', { status: 503 }))
  );
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
  }
});
