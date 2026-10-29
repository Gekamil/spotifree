const fs = require('fs');
const f = 'src/store/usePlayerStore.ts';
let c = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

const marker = 'export function registerMediaSessionHandlers()';
const startIdx = c.indexOf(marker);
if (startIdx === -1) { console.error('marker not found'); process.exit(1); }

// Find end of function by counting braces
let depth = 0;
let i = startIdx;
let inFunc = false;
while (i < c.length) {
  if (c[i] === '{') { depth++; inFunc = true; }
  if (c[i] === '}') { depth--; }
  i++;
  if (inFunc && depth === 0) break;
}
const endIdx = i;
const oldFn = c.slice(startIdx, endIdx);

const newFn = `export function registerMediaSessionHandlers() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    // Use engine.pause()/resume() directly to avoid isPlaying race conditions in Brave notification.
    // togglePlay() reads store state which may lag behind real audio element state, causing bounce.
    const getEngine = () => typeof window !== 'undefined' ? (window as any).__audioEngine : null;

    navigator.mediaSession.setActionHandler('play', () => {
      const engine = getEngine();
      if (engine && typeof engine.resume === 'function') {
        engine.resume();
      } else {
        const s = usePlayerStore.getState();
        if (!s.isPlaying) s.togglePlay();
      }
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      const engine = getEngine();
      if (engine && typeof engine.pause === 'function') {
        engine.pause();
      } else {
        const s = usePlayerStore.getState();
        if (s.isPlaying) s.togglePlay();
      }
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      usePlayerStore.getState().previousTrack();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      usePlayerStore.getState().nextTrack();
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) {
        usePlayerStore.getState().setProgress(details.seekTime * 1000);
        const engine = getEngine();
        if (engine && typeof engine.seek === 'function') engine.seek(details.seekTime);
      }
    });
    // Null out seekbackward/seekforward so Android Chrome & Brave allocate notification slots
    // to PREVIOUS TRACK and NEXT TRACK instead.
    try {
      (navigator.mediaSession as any).setActionHandler('seekbackward', null);
      (navigator.mediaSession as any).setActionHandler('seekforward', null);
    } catch {}
    navigator.mediaSession.setActionHandler('stop', () => {
      const engine = getEngine();
      if (engine && typeof engine.pause === 'function') engine.pause();
    });
  } catch {}
}`;

c = c.slice(0, startIdx) + newFn + c.slice(endIdx);
fs.writeFileSync(f, c);
console.log('done, written', newFn.length, 'chars');
