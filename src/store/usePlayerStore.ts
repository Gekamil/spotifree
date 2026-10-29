import { create } from 'zustand';
import type { Track } from '../types/spotify';
import { useStatsStore } from './useStatsStore';
import { saveCustomLikedSong, removeCustomLikedSong } from '../utils/userStorage';

function resolveTrackCover(track: any): string {
  if (!track) return '';
  if (track.album?.images && track.album.images.length > 0) {
    for (const img of track.album.images) {
      if (img && img.url) return img.url;
    }
  }
  if (track.coverUrl) return track.coverUrl;
  if (track.imageUrl) return track.imageUrl;
  if (track.image) return track.image;
  if (track.thumbnail) return track.thumbnail;
  if (typeof window !== 'undefined' && track.id) {
    try {
      const cached = window.localStorage.getItem(`spotifree_track_cover_${track.id}`);
      if (cached) return cached;
    } catch {}
  }
  return '';
}

function getMediaSessionArtwork(imageUrl?: string) {
  let base = imageUrl || '';
  if (!base && typeof window !== 'undefined') {
    base = `${window.location.origin}/icon-512.png`;
  }
  if (base.startsWith('/') && typeof window !== 'undefined') {
    base = `${window.location.origin}${base}`;
  }

  // Ensure HD 640x640 CDN image for crisp lockscreen artwork
  const hd = base
    .replace(/\/ab67616d[0-9a-f]{8}([0-9a-f]{24})/, '/ab67616d0000b273$1')
    .replace(/\/ab67706f[0-9a-f]{8}([0-9a-f]{24})/, '/ab67706f00000002$1')
    .replace(/\/ab676161[0-9a-f]{8}([0-9a-f]{24})/, '/ab6761610000e5eb$1')
    .replace(/\/ab67706c[0-9a-f]{8}([0-9a-f]{24})/, '/ab67706c0000d72c$1')
    .replace('mosaic.scdn.co/60/', 'mosaic.scdn.co/640/')
    .replace('mosaic.scdn.co/300/', 'mosaic.scdn.co/640/')
    .replace('liked-songs-64.png', 'liked-songs-640.jpg')
    .replace('liked-songs-300.png', 'liked-songs-640.jpg');

  return [
    { src: hd, sizes: '96x96', type: 'image/jpeg' },
    { src: hd, sizes: '128x128', type: 'image/jpeg' },
    { src: hd, sizes: '192x192', type: 'image/jpeg' },
    { src: hd, sizes: '256x256', type: 'image/jpeg' },
    { src: hd, sizes: '384x384', type: 'image/jpeg' },
    { src: hd, sizes: '512x512', type: 'image/jpeg' },
  ];
}
let lastMediaSessionPositionUpdate = 0;

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
  playedInShuffle: string[];
  likedTrackIds: string[];
  currentContextId: string | null;

  // Actions
  playTrack: (track: Track, newQueue?: Track[], contextId?: string) => void;
  setContextId: (id: string | null) => void;
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
  playedInShuffle: [],
  likedTrackIds: getInitialLikedTrackIds(),
  currentContextId: null,

  setContextId: (id: string | null) => set({ currentContextId: id }),

  addToQueue: (tracks: Track | Track[]) => {
    const list = Array.isArray(tracks) ? tracks : [tracks];
    set((s) => ({ queue: [...s.queue, ...list] }));
  },

  playTrack: (track: Track, newQueue?: Track[], contextId?: string) => {
    const state = get();
    const updatedHistory = state.currentTrack ? [state.currentTrack, ...state.history] : state.history;
    try {
      useStatsStore.getState().recordTrackPlayed(track);
    } catch {}

    const updatedShuffle = state.isShuffle
      ? [...state.playedInShuffle.filter((id) => id !== track.id), track.id]
      : [];

    set({
      currentTrack: track,
      currentContextId: contextId !== undefined ? contextId : (track.album?.id || state.currentContextId),
      isPlaying: true,
      progressMs: 0,
      durationMs: track.duration_ms,
      queue: newQueue ?? state.queue,
      history: updatedHistory,
      playedInShuffle: updatedShuffle,
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
        registerMediaSessionHandlers();
        navigator.mediaSession.metadata = new MediaMetadata({
          title: track.name,
          artist: track.artists?.map((a) => a.name).join(', ') || 'Spotifree',
          album: track.album?.name || 'Spotifree',
          artwork: getMediaSessionArtwork(resolveTrackCover(track)),
        });
        navigator.mediaSession.playbackState = 'playing';
        if ((navigator.mediaSession as any).setPositionState && track.duration_ms > 0) {
          (navigator.mediaSession as any).setPositionState({
            duration: Math.max(1, track.duration_ms / 1000),
            playbackRate: 1,
            position: 0,
          });
          lastMediaSessionPositionUpdate = Date.now();
        }
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
    const { queue, currentTrack, isShuffle, repeatMode, playedInShuffle } = get();
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

    let nextTrackCandidate: Track | null = null;

    if (isShuffle && queue.length > 1) {
      // Find tracks in queue that have not been played yet in this shuffle cycle
      const unplayed = queue.filter((t) => !playedInShuffle.includes(t.id));

      if (unplayed.length > 0) {
        // Pick random track from unplayed without repeats
        const randomIndex = Math.floor(Math.random() * unplayed.length);
        nextTrackCandidate = unplayed[randomIndex];
      } else {
        // All tracks in queue have been played once
        if (repeatMode === 'off') {
          set({ isPlaying: false, progressMs: 0 });
          return;
        }
        // Repeat mode is on ('all' or 'smart'): start fresh cycle
        const candidates = queue.filter((t) => t.id !== currentTrack?.id);
        const nextIndex = Math.floor(Math.random() * candidates.length);
        nextTrackCandidate = candidates[nextIndex] || queue[0];
        set({ playedInShuffle: [nextTrackCandidate.id] });
      }
    } else {
      const currentIndex = currentTrack ? queue.findIndex((t) => t.id === currentTrack.id) : -1;
      if (currentIndex === queue.length - 1 && repeatMode === 'off') {
        set({ isPlaying: false, progressMs: 0 });
        return;
      }
      const nextIndex = (currentIndex + 1) % queue.length;
      nextTrackCandidate = queue[nextIndex];
    }

    if (nextTrackCandidate) {
      get().playTrack(nextTrackCandidate);
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

    // Update native lockscreen / notification position state (throttled to every 1.5s or on manual seek)
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && (navigator.mediaSession as any).setPositionState) {
      const { durationMs, isPlaying } = get();
      const now = Date.now();
      const isManualSeek = Math.abs(ms - prev) > 1500;
      if (durationMs > 0 && (isManualSeek || now - lastMediaSessionPositionUpdate > 1500)) {
        lastMediaSessionPositionUpdate = now;
        try {
          const safeDuration = Math.max(1, durationMs / 1000);
          const safePosition = Math.min(safeDuration, Math.max(0, ms / 1000));
          (navigator.mediaSession as any).setPositionState({
            duration: safeDuration,
            playbackRate: isPlaying ? 1 : 0,
            position: safePosition,
          });
        } catch {}
      }
    }
  },

  setDuration: (ms: number) => {
    set({ durationMs: ms });
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && (navigator.mediaSession as any).setPositionState) {
      try {
        const safeDuration = Math.max(1, ms / 1000);
        const safePosition = Math.min(safeDuration, Math.max(0, get().progressMs / 1000));
        (navigator.mediaSession as any).setPositionState({
          duration: safeDuration,
          playbackRate: get().isPlaying ? 1 : 0,
          position: safePosition,
        });
      } catch {}
    }
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
      const isShuffle = nextShuffle !== 'off';
      return {
        shuffleMode: nextShuffle,
        isShuffle,
        playedInShuffle: state.currentTrack && isShuffle ? [state.currentTrack.id] : [],
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

export function registerMediaSessionHandlers() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  try {
    const getEngine = () => typeof window !== 'undefined' ? (window as any).__audioEngine : null;

    navigator.mediaSession.setActionHandler('play', () => {
      usePlayerStore.setState({ isPlaying: true });
      const engine = getEngine();
      if (engine && typeof engine.resume === 'function') {
        engine.resume();
      }
      try { navigator.mediaSession.playbackState = 'playing'; } catch {}
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      usePlayerStore.setState({ isPlaying: false });
      const engine = getEngine();
      if (engine && typeof engine.pause === 'function') {
        engine.pause();
      }
      try { navigator.mediaSession.playbackState = 'paused'; } catch {}
      // Re-affirm handlers when paused so previous and next STAY active and visible!
      registerMediaSessionHandlers();
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

    // Register seekbackward (la flecha curva hacia atrás ↺ 10) and seekforward (↻ 10)
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const skip = details.seekOffset || 10;
      const currentSec = usePlayerStore.getState().progressMs / 1000;
      const targetSec = Math.max(0, currentSec - skip);
      usePlayerStore.getState().setProgress(targetSec * 1000);
      const engine = getEngine();
      if (engine && typeof engine.seek === 'function') engine.seek(targetSec);
    });

    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const skip = details.seekOffset || 10;
      const currentSec = usePlayerStore.getState().progressMs / 1000;
      const durSec = usePlayerStore.getState().durationMs / 1000;
      const targetSec = Math.min(durSec > 0 ? durSec : currentSec + skip, currentSec + skip);
      usePlayerStore.getState().setProgress(targetSec * 1000);
      const engine = getEngine();
      if (engine && typeof engine.seek === 'function') engine.seek(targetSec);
    });

    // Register shuffle action (W3C standard is 'toggleshuffle', also provide fallback)
    try {
      (navigator.mediaSession as any).setActionHandler('toggleshuffle', () => {
        usePlayerStore.getState().toggleShuffle();
      });
    } catch {}
    try {
      (navigator.mediaSession as any).setActionHandler('shuffle', () => {
        usePlayerStore.getState().toggleShuffle();
      });
    } catch {}

    navigator.mediaSession.setActionHandler('stop', () => {
      usePlayerStore.setState({ isPlaying: false });
      const engine = getEngine();
      if (engine && typeof engine.pause === 'function') engine.pause();
      try { navigator.mediaSession.playbackState = 'paused'; } catch {}
    });
  } catch {}
}

if (typeof window !== 'undefined') {
  (window as any).__usePlayerStore = usePlayerStore;
  registerMediaSessionHandlers();
}
