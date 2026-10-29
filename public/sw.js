/**
 * Spotifree Service Worker
 * Purpose: Keep the PWA alive in the background so audio continues playing
 * when the user switches apps or locks their screen on Android/iOS.
 */

const CACHE_NAME = 'spotifree-v1';

// On install, activate immediately (no waiting)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Take control of all clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Minimal fetch handler – pass through everything (no caching interference)
// The SW must have a fetch handler to be counted as a "service worker controlled page",
// which is required for background playback on Android Chrome PWA.
self.addEventListener('fetch', (event) => {
  // Let the browser handle all requests normally
  event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'KEEP_ALIVE') {
    // Reply to confirm the SW is alive and the background timer should keep running
    if (event.source) {
      event.source.postMessage({ type: 'KEEP_ALIVE_ACK' });
    }
  }

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
