import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.tsx';

console.log('Spotifree: main.tsx mounting root...');
const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// ─── Service Worker & Background Audio ───────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[SW] Registered, scope:', reg.scope);

        // Periodically ping SW to keep it alive while audio is playing
        setInterval(() => {
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'KEEP_ALIVE' });
          }
        }, 20000);
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });

    // Listen for messages from the Service Worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (!event.data) return;

      if (event.data.type === 'AUDIO_KEEPALIVE_TICK') {
        // SW is telling us to check & resume audio if it was suspended in background
        try {
          const engine = (window as any).__audioEngine;
          if (!engine) return;

          // Import player store state to check if we should be playing
          import('./store/usePlayerStore').then(({ usePlayerStore }) => {
            const { isPlaying } = usePlayerStore.getState();
            if (isPlaying && engine.ytPlayer) {
              try {
                const ytState = typeof engine.ytPlayer.getPlayerState === 'function'
                  ? engine.ytPlayer.getPlayerState() : -1;
                // If YT player got paused by browser (state 2) or unstarted (-1), resume it
                if (ytState === 2 || ytState === -1) {
                  console.log('[SW Tick] Resuming audio that was suspended in background');
                  engine.ytPlayer.playVideo();
                }
                // Ensure not muted
                if (typeof engine.ytPlayer.unMute === 'function') {
                  engine.ytPlayer.unMute();
                  const { volume, isMuted } = usePlayerStore.getState();
                  if (!isMuted) engine.ytPlayer.setVolume(Math.round(volume * 100));
                }
                // Re-signal MediaSession
                if ('mediaSession' in navigator) {
                  navigator.mediaSession.playbackState = 'playing';
                }
              } catch {}
            }
          }).catch(() => {});
        } catch {}
      }
    });
  });
}

// ─── Notify Service Worker of audio playback state ───────────────────────────
// Hook into audioEngine events after it's created (module loads asynchronously)
function notifySwAudioState(playing: boolean) {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
  try {
    navigator.serviceWorker.controller.postMessage({
      type: playing ? 'AUDIO_PLAYING' : 'AUDIO_PAUSED',
    });
  } catch {}
}

// Attach to the audioEngine singleton once it's available
function attachSwNotifier() {
  const engine = (window as any).__audioEngine;
  if (!engine) {
    setTimeout(attachSwNotifier, 500);
    return;
  }

  // Patch togglePlay / pause / resume / playTrack to notify SW
  const origToggle = engine.togglePlay.bind(engine);
  engine.togglePlay = function () {
    origToggle();
    // State changes asynchronously, check after brief delay
    setTimeout(() => {
      import('./store/usePlayerStore').then(({ usePlayerStore }) => {
        notifySwAudioState(usePlayerStore.getState().isPlaying);
      }).catch(() => {});
    }, 200);
  };

  const origPlayTrack = engine.playTrack.bind(engine);
  engine.playTrack = async function (...args: any[]) {
    await origPlayTrack(...args);
    notifySwAudioState(true);
  };

  const origPause = engine.pause.bind(engine);
  engine.pause = function () {
    origPause();
    notifySwAudioState(false);
  };

  const origResume = engine.resume.bind(engine);
  engine.resume = function () {
    origResume();
    notifySwAudioState(true);
  };
}

// Start attaching once page is loaded
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    setTimeout(attachSwNotifier, 1000);
  });
}
