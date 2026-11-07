/**
 * Sleep timer ("Temporizador de apagado", like Spotify's): stops the music after N minutes or at
 * the end of the current song, fading out over the last seconds. Works with the screen off in
 * the APK (the page keeps running while music plays).
 */
import { create } from 'zustand';
import { usePlayerStore } from '../store/usePlayerStore';
import { audioEngine } from './audioEngine';

export const SLEEP_TIMER_SHEET_EVENT = 'spotifree:open-sleep-timer';
export const SLEEP_MINUTES = [5, 10, 15, 30, 45, 60] as const;
const FADE_MS = 8000;

interface SleepTimerState {
  /** Minutes timer: when the music stops (ms epoch) */
  endsAt: number | null;
  /** "End of this song": the song it stops after */
  trackId: string | null;
  start: (minutes: number) => void;
  endOfTrack: () => void;
  cancel: () => void;
}

let ticker: number | undefined;
let fading = false;
let fadeTimer: number | undefined;

export const useSleepTimer = create<SleepTimerState>((set) => ({
  endsAt: null,
  trackId: null,
  start: (minutes) => {
    stopFade(true);
    set({ endsAt: Date.now() + minutes * 60_000, trackId: null });
    ensureTicker();
  },
  endOfTrack: () => {
    stopFade(true);
    const t = usePlayerStore.getState().currentTrack;
    set({ endsAt: null, trackId: t?.id || null });
    ensureTicker();
  },
  cancel: () => {
    stopFade(true);
    set({ endsAt: null, trackId: null });
  },
}));

export function openSleepTimerSheet() {
  window.dispatchEvent(new CustomEvent(SLEEP_TIMER_SHEET_EVENT));
}

/** While "end of this song" is on, the song must not mix into the next one */
export function sleepTimerHoldsTransition(): boolean {
  const s = useSleepTimer.getState();
  return Boolean(s.trackId) || (s.endsAt !== null && s.endsAt - Date.now() < 30_000);
}

/** Remaining ms (minutes timer) or null */
export function sleepTimerRemainingMs(): number | null {
  const { endsAt } = useSleepTimer.getState();
  return endsAt === null ? null : Math.max(0, endsAt - Date.now());
}

function stopFade(restoreVolume: boolean) {
  window.clearInterval(fadeTimer);
  fadeTimer = undefined;
  if (fading && restoreVolume) {
    try {
      audioEngine.restoreDuckedVolume(600);
    } catch {}
  }
  fading = false;
}

/** Lowers the volume to silence over `ms`, then pauses */
function fadeOutAndStop(ms: number) {
  if (fading) return;
  fading = true;
  const steps = Math.max(1, Math.round(ms / 200));
  let i = 0;
  fadeTimer = window.setInterval(() => {
    i += 1;
    const f = Math.max(0, 1 - i / steps);
    try {
      audioEngine.setDuckedVolume(Math.max(0.001, f * f));
    } catch {}
    if (i >= steps) {
      window.clearInterval(fadeTimer);
      fadeTimer = undefined;
      const player = usePlayerStore.getState();
      if (player.isPlaying) player.togglePlay();
      // Back to the normal volume for the next time the user presses play (already paused)
      window.setTimeout(() => {
        try {
          audioEngine.restoreDuckedVolume(0);
        } catch {}
        fading = false;
      }, 400);
      useSleepTimer.setState({ endsAt: null, trackId: null });
    }
  }, 200);
}

function ensureTicker() {
  if (ticker !== undefined) return;
  ticker = window.setInterval(() => {
    const s = useSleepTimer.getState();
    if (s.endsAt === null && !s.trackId) {
      window.clearInterval(ticker);
      ticker = undefined;
      return;
    }
    const player = usePlayerStore.getState();
    if (s.endsAt !== null) {
      const left = s.endsAt - Date.now();
      if (left <= FADE_MS) {
        if (!player.isPlaying) {
          // Already paused: nothing to fade
          useSleepTimer.setState({ endsAt: null });
          return;
        }
        fadeOutAndStop(Math.max(400, left));
      }
      return;
    }
    // End of this song
    if (s.trackId && player.currentTrack && player.currentTrack.id !== s.trackId) {
      // The song changed (skipped by hand): stop after this new one instead
      useSleepTimer.setState({ trackId: player.currentTrack.id });
      return;
    }
    const dur = player.durationMs || player.currentTrack?.duration_ms || 0;
    const left = dur - (player.progressMs || 0);
    if (player.isPlaying && dur > 0 && left <= 4000) fadeOutAndStop(Math.max(400, left - 600));
  }, 500);
}
