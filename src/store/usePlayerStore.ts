import { create } from 'zustand';
import type { Track } from '../types/spotify';
import { useStatsStore } from './useStatsStore';
import { saveCustomLikedSong, removeCustomLikedSong } from '../utils/userStorage';

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  volume: number;
  previousVolume: number;
  isMuted: boolean;
  isShuffle: boolean;
  shuffleMode: 'off' | 'all' | 'smart';
  repeatMode: 'off' | 'all' | 'one';
  queue: Track[];
  history: Track[];
  likedTrackIds: string[];

  // Actions
  playTrack: (track: Track, newQueue?: Track[]) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  setProgress: (ms: number) => void;
  setDuration: (ms: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleLike: (trackId: string, trackObj?: Track) => void;
  addToQueue: (tracks: Track | Track[]) => void;
}

const getInitialLikedTrackIds = (): string[] => {
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem('spotifree_liked_tracks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
  }
  return [];
};

const store = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  progressMs: 0,
  durationMs: 0,
  volume: 0.7,
  previousVolume: 0.7,
  isMuted: false,
  isShuffle: false,
  shuffleMode: 'off',
  repeatMode: 'off',
  queue: [],
  history: [],
  likedTrackIds: getInitialLikedTrackIds(),

  addToQueue: (tracks: Track | Track[]) => {
    const list = Array.isArray(tracks) ? tracks : [tracks];
    set((s) => ({ queue: [...s.queue, ...list] }));
  },

  playTrack: (track: Track, newQueue?: Track[]) => {
    const state = get();
    const updatedHistory = state.currentTrack ? [state.currentTrack, ...state.history] : state.history;
    try {
      useStatsStore.getState().recordTrackPlayed(track);
    } catch {}
    set({
      currentTrack: track,
      isPlaying: true,
      progressMs: 0,
      durationMs: track.duration_ms,
      queue: newQueue ?? state.queue,
      history: updatedHistory,
    });

    const engine = typeof window !== 'undefined' ? (window as any).__audioEngine : null;
    if (engine) {
      engine.unlockAudio?.();
      const artistName = track.artists?.[0]?.name || '';
      const query = `${track.name} ${artistName}`.trim();
      engine.playTrack(track.id, query, 0);
    }

    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.name,
          artist: track.artists?.map((a) => a.name).join(', ') || 'Spotify',
          album: track.album?.name || '',
          artwork: [
            { src: track.album?.images?.[0]?.url || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg', sizes: '512x512', type: 'image/jpeg' },
          ],
        });
        navigator.mediaSession.playbackState = 'playing';
      } catch {}
    }
  },

  togglePlay: () => {
    const nextState = !get().isPlaying;
    set({ isPlaying: nextState });
    const engine = typeof window !== 'undefined' ? (window as any).__audioEngine : null;
    if (engine) {
      if (nextState) {
        engine.unlockAudio?.();
        engine.resume();
      } else {
        engine.pause();
      }
    }
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = nextState ? 'playing' : 'paused';
      } catch {}
    }
  },

  nextTrack: () => {
    const { queue, currentTrack, isShuffle, repeatMode } = get();
    if (queue.length === 0) return;

    if (repeatMode === 'one' && currentTrack) {
      set({
        isPlaying: true,
        progressMs: 0,
      });
      if (typeof window !== 'undefined' && (window as any).__audioEngine) {
        (window as any).__audioEngine.seek(0);
      }
      return;
    }

    const currentIndex = currentTrack ? queue.findIndex((t) => t.id === currentTrack.id) : -1;
    let nextIndex = 0;

    if (isShuffle && queue.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
      } while (nextIndex === currentIndex);
    } else {
      if (currentIndex === queue.length - 1 && repeatMode === 'off') {
        set({ isPlaying: false, progressMs: 0 });
        return;
      }
      nextIndex = (currentIndex + 1) % queue.length;
    }

    const next = queue[nextIndex];
    if (next) {
      get().playTrack(next);
    }
  },

  previousTrack: () => {
    const { queue, currentTrack, progressMs } = get();
    if (progressMs > 3000) {
      set({ progressMs: 0 });
      if (typeof window !== 'undefined' && (window as any).__audioEngine) {
        (window as any).__audioEngine.seek(0);
      }
      return;
    }
    if (queue.length === 0) return;
    const currentIndex = currentTrack ? queue.findIndex((t) => t.id === currentTrack.id) : 0;
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    const prev = queue[prevIndex];
    if (prev) {
      get().playTrack(prev);
    }
  },

  setProgress: (ms: number) => {
    const prev = get().progressMs;
    const current = get().currentTrack;
    if (current && Math.abs(ms - prev) >= 800 && Math.abs(ms - prev) <= 1500 && get().isPlaying) {
      try {
        useStatsStore.getState().recordPlaybackSecond(current);
      } catch {}
    }
    set({ progressMs: ms });
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && (navigator.mediaSession as any).setPositionState) {
      const { durationMs } = get();
      if (durationMs > 0 && ms <= durationMs) {
        try {
          (navigator.mediaSession as any).setPositionState({
            duration: Math.max(1, durationMs / 1000),
            playbackRate: 1,
            position: Math.max(0, ms / 1000),
          });
        } catch {}
      }
    }
  },

  setDuration: (ms: number) => {
    set({ durationMs: ms });
  },

  setVolume: (volume: number) => {
    set({ volume, isMuted: volume === 0 });
  },

  toggleMute: () => {
    const { isMuted, volume, previousVolume } = get();
    if (isMuted) {
      set({ isMuted: false, volume: previousVolume > 0 ? previousVolume : 0.5 });
    } else {
      set({ isMuted: true, previousVolume: volume, volume: 0 });
    }
  },

  toggleShuffle: () => {
    set((state) => {
      const nextShuffle = state.shuffleMode === 'off' ? 'all' : state.shuffleMode === 'all' ? 'smart' : 'off';
      return {
        shuffleMode: nextShuffle,
        isShuffle: nextShuffle !== 'off',
      };
    });
  },

  toggleRepeat: () => {
    set((state) => {
      const nextMode = state.repeatMode === 'off' ? 'all' : state.repeatMode === 'all' ? 'one' : 'off';
      return { repeatMode: nextMode };
    });
  },

  toggleLike: (trackId: string, trackObj?: Track) => {
    set((state) => {
      const exists = state.likedTrackIds.includes(trackId);
      const updated = exists
        ? state.likedTrackIds.filter((id) => id !== trackId)
        : [...state.likedTrackIds, trackId];

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('spotifree_liked_tracks', JSON.stringify(updated));

          // Manage per-user saved liked tracks collection
          if (exists) {
            removeCustomLikedSong(trackId);
          } else if (trackObj) {
            saveCustomLikedSong(trackObj);
          }
        } catch {}
      }

      return { likedTrackIds: updated };
    });
  },
}));

export const usePlayerStore =
  typeof window !== 'undefined' && (window as any).__usePlayerStore
    ? ((window as any).__usePlayerStore as typeof store)
    : store;

if (typeof window !== 'undefined') {
  (window as any).__usePlayerStore = usePlayerStore;

  // Register W3C MediaSession API action handlers for native lockscreen player controls
  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    try {
      navigator.mediaSession.setActionHandler('play', () => {
        usePlayerStore.getState().togglePlay();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        usePlayerStore.getState().togglePlay();
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        usePlayerStore.getState().previousTrack();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        usePlayerStore.getState().nextTrack();
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime != null) {
          const ms = details.seekTime * 1000;
          usePlayerStore.getState().setProgress(ms);
          if ((window as any).__audioEngine) {
            (window as any).__audioEngine.seek(details.seekTime);
          }
        }
      });
    } catch {}
  }
}

