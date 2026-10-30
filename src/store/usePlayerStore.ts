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
  preselectedNextTrackId: string | null;

  // Actions
  playTrack: (track: Track, newQueue?: Track[], contextId?: string) => void;
  setContextId: (id: string | null) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  getNextTrack: () => Track | null;
  completeCrossfadeTrack: (track: Track, initialProgressMs?: number) => void;
  triggerAutoplaySimilar: (track: Track) => Promise<void>;
  triggerSmartShuffleRecommendation: (track: Track) => Promise<void>;
  previousTrack: () => void;
  setProgress: (ms: number) => void;
  setDuration: (ms: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleLike: (trackId: string, trackObj?: Track) => void;
  addToQueue: (tracks: Track | Track[]) => void;
  setQueue: (tracks: Track[]) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
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
  preselectedNextTrackId: null,

  setContextId: (id: string | null) => set({ currentContextId: id }),

  addToQueue: (tracks: Track | Track[]) => {
    const list = Array.isArray(tracks) ? tracks : [tracks];
    set((s) => ({ queue: [...s.queue, ...list] }));
  },

  setQueue: (tracks: Track[]) => {
    set({ queue: tracks });
  },

  reorderQueue: (fromIndex: number, toIndex: number) => {
    const current = [...get().queue];
    if (
      fromIndex < 0 ||
      fromIndex >= current.length ||
      toIndex < 0 ||
      toIndex >= current.length
    )
      return;
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    set({ queue: current });
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

    const activeQueue = newQueue ?? state.queue;
    let nextPreselectedId: string | null = null;
    if (state.isShuffle && activeQueue.length > 1) {
      const unplayed = activeQueue.filter((t) => !updatedShuffle.includes(t.id));
      if (unplayed.length > 0) {
        const rnd = Math.floor(Math.random() * unplayed.length);
        nextPreselectedId = unplayed[rnd].id;
      }
    }

    set({
      currentTrack: track,
      currentContextId: contextId !== undefined ? contextId : (track.album?.id || state.currentContextId),
      isPlaying: true,
      progressMs: 0,
      durationMs: track.duration_ms,
      queue: activeQueue,
      history: updatedHistory,
      playedInShuffle: updatedShuffle,
      preselectedNextTrackId: nextPreselectedId,
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
    const { queue, currentTrack, repeatMode } = get();
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

    const nextTrackCandidate = get().getNextTrack();

    if (!nextTrackCandidate) {
      const isAutoplay = typeof window !== 'undefined' ? window.localStorage.getItem('spotifree_autoplay') !== 'false' : true;
      if (isAutoplay && currentTrack) {
        get().triggerAutoplaySimilar(currentTrack);
        return;
      }

      // Autoplay is OFF: advance to next user playlist or restart current playlist from track 0
      const playlists = (typeof window !== 'undefined' && (window as any).__useSpotifyDataStore?.getState?.()?.playlists) || [];
      const currentContextId = get().currentContextId;
      const currentPlaylistIdx = playlists.findIndex((p: any) => p.id === currentContextId);

      if (playlists.length > 1 && currentPlaylistIdx >= 0 && currentPlaylistIdx < playlists.length - 1) {
        const nextPlaylist = playlists[currentPlaylistIdx + 1];
        const tracks = nextPlaylist.tracks?.items || [];
        if (tracks.length > 0) {
          get().playTrack(tracks[0], tracks, nextPlaylist.id);
          return;
        }
      }

      if (queue.length > 0) {
        get().playTrack(queue[0], queue, currentContextId || undefined);
        return;
      }

      set({ isPlaying: false, progressMs: 0 });
      return;
    }

    get().playTrack(nextTrackCandidate);
    if (get().shuffleMode === 'smart') {
      get().triggerSmartShuffleRecommendation(nextTrackCandidate);
    }
  },

  triggerAutoplaySimilar: async (track: Track) => {
    try {
      const { fetchRecommendations } = await import('../services/spotifyApi');
      const seedArtist = track.artists?.[0]?.name;
      const seedArtistId = track.artists?.[0]?.id;
      const seedTrackId = track.id && !track.id.startsWith('yt-') && !track.id.startsWith('itunes-') ? track.id : undefined;

      // Extract context from recent queue to enrich seed
      const recentTracks = get().queue.slice(-5);
      const seedArtists = Array.from(new Set([
        seedArtistId,
        ...recentTracks.map((t) => t.artists?.[0]?.id).filter(Boolean),
      ])).filter((id): id is string => Boolean(id && !id.startsWith('art-')));

      const candidateTracks = await fetchRecommendations({
        seedTracks: seedTrackId ? [seedTrackId] : undefined,
        seedArtists: seedArtists.length > 0 ? seedArtists.slice(0, 3) : undefined,
        artistName: seedArtist,
        trackName: track.name,
        limit: 15,
      });

      const existingIds = new Set(get().queue.map((t) => t.id));
      existingIds.add(track.id);
      const existingTitles = new Set(get().queue.map((t) => (t.name || '').toLowerCase().trim()));
      existingTitles.add((track.name || '').toLowerCase().trim());

      const validTracks = candidateTracks.filter(
        (t) => !existingIds.has(t.id) && !existingTitles.has((t.name || '').toLowerCase().trim())
      );

      if (validTracks.length > 0) {
        const toAdd = validTracks.slice(0, 10).map((t) => ({
          ...t,
          isAutoplayRecommendation: true,
        }));
        set((s) => ({
          queue: [...s.queue, ...toAdd],
        }));
        get().playTrack(toAdd[0]);
        return;
      }
    } catch (err) {
      console.warn('[Autoplay] Failed to fetch similar tracks:', err);
    }

    // Fallback if no similar tracks found: restart playlist
    const currentQueue = get().queue;
    if (currentQueue.length > 0) {
      get().playTrack(currentQueue[0]);
    } else {
      set({ isPlaying: false, progressMs: 0 });
    }
  },

  triggerSmartShuffleRecommendation: async (track: Track) => {
    try {
      const { searchSpotify } = await import('../services/spotifyApi');
      const artist = track.artists?.[0]?.name || track.name;
      const res = await searchSpotify(artist);
      const existingIds = new Set(get().queue.map((t) => t.id));
      existingIds.add(track.id);
      const items: Track[] = res?.tracks?.items || [];
      const candidate = items.find((t: Track) => !existingIds.has(t.id));
      if (candidate) {
        const smartTrack: Track = {
          ...candidate,
          isSmartRecommendation: true,
        };
        const currentQueue = get().queue;
        const currentIdx = get().currentTrack ? currentQueue.findIndex((t) => t.id === get().currentTrack?.id) : -1;
        const insertIdx = currentIdx >= 0 ? currentIdx + 1 : currentQueue.length;
        set({
          queue: [...currentQueue.slice(0, insertIdx), smartTrack, ...currentQueue.slice(insertIdx)],
        });
      }
    } catch (e) {
      console.warn('[SmartShuffle] Failed to inject recommendation:', e);
    }
  },

  getNextTrack: (): Track | null => {
    const { queue, currentTrack, isShuffle, repeatMode, playedInShuffle, preselectedNextTrackId } = get();
    if (queue.length === 0) return null;

    if (repeatMode === 'one' && currentTrack) {
      return currentTrack;
    }

    if (isShuffle && queue.length > 1) {
      if (preselectedNextTrackId) {
        const found = queue.find((t) => t.id === preselectedNextTrackId);
        if (found) return found;
      }
      const unplayed = queue.filter((t) => !playedInShuffle.includes(t.id));
      if (unplayed.length > 0) {
        return unplayed[0];
      }
      const candidates = queue.filter((t) => t.id !== currentTrack?.id);
      return candidates[0] || queue[0];
    } else {
      const currentIndex = currentTrack ? queue.findIndex((t) => t.id === currentTrack.id) : -1;
      if (currentIndex === queue.length - 1 && repeatMode === 'off') {
        return null;
      }
      const nextIndex = (currentIndex + 1) % queue.length;
      return queue[nextIndex] || null;
    }
  },

  completeCrossfadeTrack: (track: Track, initialProgressMs: number = 0) => {
    const state = get();
    const updatedHistory = [track, ...state.history.filter((t) => t.id !== track.id)].slice(0, 50);
    try {
      useStatsStore.getState().recordTrackPlayed(track);
    } catch {}

    const updatedShuffle = state.isShuffle
      ? [...state.playedInShuffle.filter((id) => id !== track.id), track.id]
      : [];

    let nextPreselectedId: string | null = null;
    if (state.isShuffle && state.queue.length > 1) {
      const unplayed = state.queue.filter((t) => !updatedShuffle.includes(t.id));
      if (unplayed.length > 0) {
        const rnd = Math.floor(Math.random() * unplayed.length);
        nextPreselectedId = unplayed[rnd].id;
      }
    }

    set({
      currentTrack: track,
      currentContextId: track.album?.id || state.currentContextId,
      isPlaying: true,
      progressMs: Math.max(0, initialProgressMs),
      durationMs: track.duration_ms,
      history: updatedHistory,
      playedInShuffle: updatedShuffle,
      preselectedNextTrackId: nextPreselectedId,
    });

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
            position: Math.max(0, initialProgressMs / 1000),
          });
          lastMediaSessionPositionUpdate = Date.now();
        }
      } catch {}
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
      if (nextShuffle === 'off') {
        return {
          shuffleMode: nextShuffle,
          isShuffle,
          playedInShuffle: [],
          queue: state.queue.filter((t: any) => !t.isSmartRecommendation),
        };
      }
      return {
        shuffleMode: nextShuffle,
        isShuffle,
        playedInShuffle: state.currentTrack && isShuffle ? [state.currentTrack.id] : [],
      };
    });
    if (get().shuffleMode === 'smart' && get().currentTrack) {
      get().triggerSmartShuffleRecommendation(get().currentTrack!);
    }
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
