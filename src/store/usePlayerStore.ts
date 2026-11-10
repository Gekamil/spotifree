import { create } from 'zustand';
import type { Track } from '../types/spotify';
import { useStatsStore } from './useStatsStore';
import { recordHistoryItem } from '../services/listeningHistory';
import {
  saveCustomLikedSong,
  removeCustomLikedSong,
  getCustomLikedSongs,
  getActiveUserId,
} from '../utils/userStorage';
import { deduplicateTracks } from '../utils/trackDeduplication';
import { shuffleTracks } from '../utils/shuffleOrder';
import { TRACK_COVER_CACHE, isPlaylistOrGenericCover, resolveTrackCoversBatch } from '../utils/trackCovers';

export function matchTrackId(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const ca = a.replace(/^spotify:track:/i, '').replace(/^(search-add-|artist-song-|imported-|itunes-|search-)/i, '').split('?')[0].trim().toLowerCase();
  const cb = b.replace(/^spotify:track:/i, '').replace(/^(search-add-|artist-song-|imported-|itunes-|search-)/i, '').split('?')[0].trim().toLowerCase();
  return Boolean(ca && cb && ca === cb);
}

export function findTrackIndexInQueue(queue: Track[], currentTrack: Track | null | undefined): number {
  if (!currentTrack || !queue || queue.length === 0) return -1;
  // 1. Direct ID or stripped ID match
  let idx = queue.findIndex((t) => t && (t.id === currentTrack.id || matchTrackId(t.id, currentTrack.id)));
  if (idx !== -1) return idx;

  // 2. Normalized title + primary artist
  const norm = (s?: string) =>
    (s || '')
      .toLowerCase()
      .replace(/\s*\(.*?\)/g, '')
      .replace(/\s*\[.*?\]/g, '')
      .replace(/\s*-\s*(remaster|remix|version|radio|edit|live).*$/i, '')
      .replace(/[^\p{L}\p{N}]/gu, '')
      .trim();

  const curTitle = norm(currentTrack.name);
  const curArtist = norm(currentTrack.artists?.[0]?.name || (currentTrack as any)?.artist);

  if (curTitle) {
    idx = queue.findIndex((t) => {
      if (!t) return false;
      const tTitle = norm(t.name);
      const tArtist = norm(t.artists?.[0]?.name || (t as any)?.artist);
      if (tTitle === curTitle && (!curArtist || !tArtist || curArtist === tArtist)) {
        return true;
      }
      return false;
    });
    if (idx !== -1) return idx;
  }

  return -1;
}

function resolveTrackCover(track: any): string {
  if (!track) return '';

  const rawId = track.id || '';
  const cleanId = rawId.replace(/^spotify:track:/i, '').split('?')[0].trim();

  // 1. The song's own album images (its real cover) always win
  if (track.album?.images && track.album.images.length > 0) {
    for (const img of track.album.images) {
      if (img && img.url && !isPlaylistOrGenericCover(img.url)) return img.url;
    }
  }

  // 2. A cover found for this exact song (exact title + artist match, see trackCovers.tsx)
  if (rawId && TRACK_COVER_CACHE.has(rawId)) {
    const cached = TRACK_COVER_CACHE.get(rawId);
    if (cached && !isPlaylistOrGenericCover(cached)) return cached;
  }
  if (cleanId && TRACK_COVER_CACHE.has(cleanId)) {
    const cached = TRACK_COVER_CACHE.get(cleanId);
    if (cached && !isPlaylistOrGenericCover(cached)) return cached;
  }
  if (track.album?.images && track.album.images.length > 0) {
    const first = track.album.images[0]?.url;
    if (first && !first.includes('liked-songs') && !first.includes('mosaic.scdn.co')) return first;
  }

  // 3. Fallback direct properties on track
  if (track.coverUrl && !isPlaylistOrGenericCover(track.coverUrl)) return track.coverUrl;
  if (track.imageUrl && !isPlaylistOrGenericCover(track.imageUrl)) return track.imageUrl;
  if (track.image && !isPlaylistOrGenericCover(track.image)) return track.image;
  if (track.thumbnail && !isPlaylistOrGenericCover(track.thumbnail)) return track.thumbnail;

  const directProp = track.coverUrl || track.imageUrl || track.image || track.thumbnail;
  if (directProp && !directProp.includes('liked-songs') && !directProp.includes('mosaic.scdn.co')) return directProp;

  // 4. Check spotifree_track_covers in localStorage
  if (typeof window !== 'undefined') {
    try {
      const rawCovers = window.localStorage.getItem('spotifree_track_covers_v2');
      if (rawCovers) {
        const parsed = JSON.parse(rawCovers);
        if (parsed[rawId] && !isPlaylistOrGenericCover(parsed[rawId])) return parsed[rawId];
        if (cleanId && parsed[cleanId] && !isPlaylistOrGenericCover(parsed[cleanId])) return parsed[cleanId];
      }
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

  const mime = hd.toLowerCase().endsWith('.png') ? 'image/png' : hd.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg';

  return [
    { src: hd, sizes: '96x96', type: mime },
    { src: hd, sizes: '128x128', type: mime },
    { src: hd, sizes: '192x192', type: mime },
    { src: hd, sizes: '256x256', type: mime },
    { src: hd, sizes: '384x384', type: mime },
    { src: hd, sizes: '512x512', type: mime },
  ];
}

function updateMediaSessionTrack(track: Track, positionSec: number = 0) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !track) return;
  try {
    registerMediaSessionHandlers();
    const coverUrl = resolveTrackCover(track);
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.name,
      artist: track.artists?.map((a) => a.name).join(', ') || 'Spotifree',
      album: track.album?.name || 'Spotifree',
      artwork: getMediaSessionArtwork(coverUrl),
    });
    navigator.mediaSession.playbackState = 'playing';
    if ((navigator.mediaSession as any).setPositionState && track.duration_ms > 0) {
      (navigator.mediaSession as any).setPositionState({
        duration: Math.max(1, track.duration_ms / 1000),
        playbackRate: 1,
        position: Math.max(0, positionSec),
      });
      lastMediaSessionPositionUpdate = Date.now();
    }

    // If artwork is not resolved yet, resolve in background and re-apply crisp lockscreen artwork immediately
    if (!coverUrl && track.name) {
      resolveTrackCoversBatch([track]).then(() => {
        const freshCover = resolveTrackCover(track);
        if (freshCover && typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: track.name,
            artist: track.artists?.map((a) => a.name).join(', ') || 'Spotifree',
            album: track.album?.name || 'Spotifree',
            artwork: getMediaSessionArtwork(freshCover),
          });
        }
      }).catch(() => {});
    }
  } catch {}
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
  shuffleVersion: number;
  repeatMode: 'off' | 'all' | 'one';
  queue: Track[];
  originalQueue: Track[];
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
  getUpcomingTracks: (count?: number) => Track[];
  completeCrossfadeTrack: (track: Track, initialProgressMs?: number) => void;
  triggerAutoplaySimilar: (track: Track) => Promise<void>;
  triggerSmartShuffleRecommendation: (track: Track) => Promise<void>;
  populateSmartShuffleRecommendations: (baseTracks?: Track[]) => Promise<void>;
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

/** When a song was last heard (this account's stats), for 'recent songs at the end' */
function lastPlayedAt(t: Track): number {
  try {
    const st = useStatsStore.getState().tracks || {};
    return st[t.id]?.lastPlayedAt || 0;
  } catch {
    return 0;
  }
}

/** Listening time not yet counted (less than a second), see setProgress */
let statCarryMs = 0;
let statLastMs = -1;

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
  shuffleVersion: 0,
  repeatMode: 'off',
  queue: [],
  originalQueue: [],
  history: [],
  playedInShuffle: [],
  likedTrackIds: getInitialLikedTrackIds(),
  currentContextId: null,
  preselectedNextTrackId: null,

  setContextId: (id: string | null) => set({ currentContextId: id }),

  addToQueue: (tracks: Track | Track[]) => {
    const list = Array.isArray(tracks) ? tracks : [tracks];
    set((s) => ({
      queue: deduplicateTracks([...s.queue, ...list]),
      originalQueue: deduplicateTracks([...s.originalQueue, ...list]),
    }));
  },

  setQueue: (tracks: Track[]) => {
    const deduped = deduplicateTracks(tracks);
    set({ queue: deduped, originalQueue: deduped });
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
    set({ queue: current, originalQueue: current });
  },

  playTrack: (track: Track, newQueue?: Track[], contextId?: string) => {
    const state = get();
    const cleanCur = (state.currentTrack?.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
    const cleanNew = (track?.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();

    const rawOriginal = newQueue ? deduplicateTracks(newQueue) : (state.originalQueue.length > 0 ? state.originalQueue : state.queue);
    let activeQueue: Track[];
    if (newQueue) {
      if (state.isShuffle) {
        const others = shuffleTracks(rawOriginal.filter((t) => t.id !== track.id), lastPlayedAt);
        activeQueue = [track, ...others];
      } else {
        activeQueue = rawOriginal;
      }
    } else {
      const exists = state.queue.some((t) => t && (t.id === track.id || matchTrackId(t.id, track.id)));
      if (!exists && track) {
        activeQueue = [track, ...state.queue];
      } else {
        activeQueue = state.queue;
      }
    }

    if (cleanCur && cleanNew && cleanCur === cleanNew && state.isPlaying) {
      // Already playing this song, update queue if newQueue is provided, but do NOT restart to 0!
      if (newQueue) {
        set({
          queue: activeQueue,
          originalQueue: rawOriginal,
          currentContextId: contextId !== undefined ? contextId : state.currentContextId,
        });
      }
      return;
    }

    const updatedHistory = state.currentTrack ? [state.currentTrack, ...state.history] : state.history;
    try {
      useStatsStore.getState().recordTrackPlayed(track);
      recordHistoryItem({
        id: track.id,
        name: track.name || 'Canción',
        subtitle: track.artists?.[0]?.name ? `Canción • ${track.artists[0].name}` : 'Canción',
        image: track.album?.images?.[0]?.url || '',
        type: 'track',
        track,
      });
    } catch {}

    const updatedShuffle = state.isShuffle
      ? [...state.playedInShuffle.filter((id) => id !== track.id), track.id]
      : [];

    let nextPreselectedId: string | null = null;
    if (state.isShuffle && activeQueue.length > 1) {
      const unplayed = activeQueue.filter((t) => !updatedShuffle.includes(t.id));
      if (unplayed.length > 0) {
        const rnd = Math.floor(Math.random() * unplayed.length);
        nextPreselectedId = unplayed[rnd].id;
      } else {
        const candidates = activeQueue.filter((t) => t.id !== track.id);
        if (candidates.length > 0) {
          const rnd = Math.floor(Math.random() * candidates.length);
          nextPreselectedId = candidates[rnd].id;
        }
      }
    }

    set({
      currentTrack: track,
      currentContextId: contextId !== undefined ? contextId : (track.album?.id || state.currentContextId),
      isPlaying: true,
      progressMs: 0,
      durationMs: track.duration_ms,
      queue: activeQueue,
      originalQueue: rawOriginal,
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

      // Immediately preload the next 2 tracks (N+1 and N+2) in the background for zero-lag instant transitions
      setTimeout(() => {
        try {
          if (typeof engine.preloadUpcomingTracks === 'function') {
            engine.preloadUpcomingTracks();
          } else {
            const nextCandidate = get().getNextTrack?.();
            if (nextCandidate && typeof engine.resolveVideoId === 'function') {
              const nextArtist = nextCandidate.artists?.[0]?.name || '';
              const nextQuery = `${nextCandidate.name} ${nextArtist}`.trim();
              engine.resolveVideoId(nextQuery, nextCandidate.id).catch(() => {});
            }
          }
        } catch {}
      }, 500);
    }

    updateMediaSessionTrack(track, 0);
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
    // Debounce and lock against rapid manual button spamming to prevent concurrent track resolution collisions
    if ((usePlayerStore as any).isSkippingLock) return;
    (usePlayerStore as any).isSkippingLock = true;
    setTimeout(() => {
      (usePlayerStore as any).isSkippingLock = false;
    }, 120);

    const { queue, currentTrack } = get();
    if (queue.length === 0) return;

    const nextTrackCandidate = get().getNextTrack();

    if (!nextTrackCandidate) {
      // 1. If currently in AI DJ mode, trigger DJ set completion with conversational transition & 15 new songs
      const currentContextId = get().currentContextId;
      const isDJSession =
        currentContextId === 'dj-session' ||
        (typeof window !== 'undefined' && Boolean((window as any).__useAIDJStore?.getState?.()?.isDJModeActive));

      if (isDJSession) {
        const aiDJStore = typeof window !== 'undefined' ? (window as any).__useAIDJStore?.getState?.() : null;
        if (aiDJStore && typeof aiDJStore.handleSetCompletion === 'function') {
          aiDJStore.handleSetCompletion();
          return;
        }
      }

      const currentIndex = findTrackIndexInQueue(queue, currentTrack);
      const isActuallyAtEndOfQueue = currentIndex >= queue.length - 1;

      // Autoplay similar songs ONLY if we are legitimately at the very end of the playlist / queue
      const isAutoplay = typeof window !== 'undefined' ? window.localStorage.getItem('spotifree_autoplay') !== 'false' : true;
      if (isAutoplay && currentTrack && isActuallyAtEndOfQueue) {
        get().triggerAutoplaySimilar(currentTrack);
        return;
      }

      // If not legitimately at end of queue (e.g. index glitch), play next sequential item in queue
      if (currentIndex >= 0 && currentIndex < queue.length - 1) {
        get().playTrack(queue[currentIndex + 1], queue, currentContextId || undefined);
        return;
      }

      // Autoplay is OFF: advance to next user playlist or restart current playlist from track 0
      const playlists = (typeof window !== 'undefined' && (window as any).__useSpotifyDataStore?.getState?.()?.playlists) || [];
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

    // "Siguiente" changes song at once, like Spotify: the crossfade / DJ mix is only for songs that
    // end by themselves. (On the computer it used to start a crossfade: both songs played together
    // for several seconds and further presses were ignored meanwhile.) playTrack stops the deck
    // that was fading in, if any.
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
        const insertIdx = currentIdx >= 0 ? currentIdx + 2 : currentQueue.length;
        set({
          queue: [...currentQueue.slice(0, insertIdx), smartTrack, ...currentQueue.slice(insertIdx)],
        });
      }
    } catch (e) {
      console.warn('[SmartShuffle] Failed to inject recommendation:', e);
    }
  },

  populateSmartShuffleRecommendations: async (baseTracks?: Track[]) => {
    try {
      const currentQ = get().queue;
      const tracksToAnalyze = baseTracks || currentQ.filter((t: any) => !t.isSmartRecommendation);
      if (tracksToAnalyze.length === 0) return;

      const artists = Array.from(
        new Set(
          tracksToAnalyze
            .map((t) => t.artists?.[0]?.name)
            .filter((name): name is string => Boolean(name && name.length > 1))
        )
      ).slice(0, 4);

      if (artists.length === 0) return;

      const { searchSpotify } = await import('../services/spotifyApi');
      const existingIds = new Set(get().queue.map((t) => t.id));
      const existingNames = new Set(get().queue.map((t) => (t.name || '').toLowerCase().trim()));

      const recommendedCandidates: Track[] = [];

      for (const artist of artists) {
        try {
          const res = await searchSpotify(artist);
          const items: Track[] = res?.tracks?.items || [];
          for (const item of items) {
            const cleanName = (item.name || '').toLowerCase().trim();
            if (!existingIds.has(item.id) && !existingNames.has(cleanName)) {
              existingIds.add(item.id);
              existingNames.add(cleanName);
              recommendedCandidates.push({
                ...item,
                isSmartRecommendation: true,
              });
              if (recommendedCandidates.length >= 6) break;
            }
          }
        } catch {}
        if (recommendedCandidates.length >= 6) break;
      }

      if (recommendedCandidates.length > 0) {
        const cleanQueue = get().queue.filter((t: any) => !t.isSmartRecommendation);
        const interspersed: Track[] = [];
        let recIdx = 0;

        for (let i = 0; i < cleanQueue.length; i++) {
          interspersed.push(cleanQueue[i]);
          // Insert a recommended track every 3 tracks (and not on track 0)
          if ((i + 1) % 3 === 0 && recIdx < recommendedCandidates.length) {
            interspersed.push(recommendedCandidates[recIdx]);
            recIdx++;
          }
        }
        while (recIdx < Math.min(recommendedCandidates.length, 3)) {
          interspersed.push(recommendedCandidates[recIdx]);
          recIdx++;
        }

        set({ queue: interspersed });
      }
    } catch (e) {
      console.warn('[SmartShuffle] Error populating recommendations:', e);
    }
  },

  getNextTrack: (): Track | null => {
    const { queue, currentTrack, repeatMode, preselectedNextTrackId } = get();
    if (queue.length === 0) return null;

    if (repeatMode === 'one' && currentTrack) {
      return currentTrack;
    }

    const currentIndex = findTrackIndexInQueue(queue, currentTrack);

    // Follow the queue sequentially (works for both sequential mode AND pre-shuffled queue!)
    if (currentIndex >= 0 && currentIndex < queue.length - 1) {
      return queue[currentIndex + 1];
    }

    if (preselectedNextTrackId) {
      const found = queue.find((t) => matchTrackId(t.id, preselectedNextTrackId) && !matchTrackId(t.id, currentTrack?.id));
      if (found) return found;
    }

    // End of queue:
    if (repeatMode === 'all') {
      return queue[0] || null;
    }

    // If current track was not in queue (currentIndex === -1) and queue has tracks,
    // play from start of queue rather than returning null!
    if (currentIndex === -1 && queue.length > 0) {
      return queue[0];
    }

    return null;
  },

  getUpcomingTracks: (count: number = 2): Track[] => {
    const { queue, currentTrack, repeatMode, preselectedNextTrackId } = get();
    if (queue.length === 0) return [];

    if (repeatMode === 'one' && currentTrack) {
      return Array(count).fill(currentTrack);
    }

    const currentIndex = findTrackIndexInQueue(queue, currentTrack);
    const result: Track[] = [];

    if (currentIndex >= 0) {
      for (let i = 1; i <= count; i++) {
        const targetIdx = currentIndex + i;
        if (targetIdx < queue.length) {
          result.push(queue[targetIdx]);
        } else if (repeatMode === 'all') {
          const wrapIdx = (targetIdx - queue.length) % queue.length;
          result.push(queue[wrapIdx]);
        }
      }
      if (result.length > 0) return result;
    }

    if (preselectedNextTrackId) {
      const found = queue.find((t) => matchTrackId(t.id, preselectedNextTrackId) && !matchTrackId(t.id, currentTrack?.id));
      if (found) {
        result.push(found);
        const nextIdx = queue.findIndex((t) => matchTrackId(t.id, found.id));
        if (nextIdx >= 0 && nextIdx < queue.length - 1) {
          result.push(queue[nextIdx + 1]);
        }
        return result;
      }
    }

    if (queue.length > 0 && repeatMode === 'all') {
      return queue.slice(0, count);
    }

    return [];
  },

  completeCrossfadeTrack: (track: Track, initialProgressMs: number = 0) => {
    const state = get();
    const updatedHistory = [track, ...state.history.filter((t) => t.id !== track.id)].slice(0, 50);
    try {
      useStatsStore.getState().recordTrackPlayed(track);
      recordHistoryItem({
        id: track.id,
        name: track.name || 'Canción',
        subtitle: track.artists?.[0]?.name ? `Canción • ${track.artists[0].name}` : 'Canción',
        image: track.album?.images?.[0]?.url || '',
        type: 'track',
        track,
      });
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
      } else {
        const candidates = state.queue.filter((t) => t.id !== track.id);
        if (candidates.length > 0) {
          const rnd = Math.floor(Math.random() * candidates.length);
          nextPreselectedId = candidates[rnd].id;
        }
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

    updateMediaSessionTrack(track, initialProgressMs / 1000);

    // Preload next upcoming tracks N+1 and N+2
    const engine = typeof window !== 'undefined' ? (window as any).__audioEngine : null;
    if (engine && typeof engine.preloadUpcomingTracks === 'function') {
      setTimeout(() => {
        try {
          engine.preloadUpcomingTracks();
        } catch {}
      }, 500);
    }
  },

  previousTrack: () => {
    const { queue, currentTrack, progressMs, isShuffle, history, playedInShuffle } = get();
    // Pressed during the automatic fade at the end of a song: stop the incoming song first, or it
    // kept playing on top of the restarted one
    const eng = typeof window !== 'undefined' ? (window as any).__audioEngine : null;
    if (eng?.isCrossfading && typeof eng.resetTransitionState === 'function') eng.resetTransitionState();
    if (progressMs > 3000) {
      set({ progressMs: 0 });
      if (typeof window !== 'undefined' && (window as any).__audioEngine) {
        (window as any).__audioEngine.seek(0);
      }
      return;
    }
    if (queue.length === 0) return;

    // In shuffle mode: Going backward navigates through the actual history of songs that already played
    if (isShuffle) {
      if (history.length > 0) {
        const prevTrackFromHistory = history.find((t) => t.id !== currentTrack?.id);
        if (prevTrackFromHistory) {
          const remainingShuffle = currentTrack ? playedInShuffle.filter((id) => id !== currentTrack.id) : playedInShuffle;
          const remainingHistory = history.filter((t) => t.id !== prevTrackFromHistory.id);
          set({
            playedInShuffle: remainingShuffle,
            history: remainingHistory,
          });
          get().playTrack(prevTrackFromHistory);
          return;
        }
      }
    }

    // Normal sequential playback previous track
    const currentIndex = findTrackIndexInQueue(queue, currentTrack);
    const safeIdx = currentIndex >= 0 ? currentIndex : 0;
    const prevIndex = (safeIdx - 1 + queue.length) % queue.length;
    const prev = queue[prevIndex];
    if (prev) {
      get().playTrack(prev);
    }
  },

  setProgress: (ms: number) => {
    const prev = get().progressMs;
    const current = get().currentTrack;
    // Listening time: the player reports progress every 0.1-0.25 s, so the real elapsed time is
    // added up and counted second by second (jumps from seeking are not listening time)
    const delta = statLastMs >= 0 ? ms - statLastMs : 0;
    statLastMs = ms;
    if (current && get().isPlaying && delta > 0 && delta <= 2000) {
      statCarryMs += delta;
      while (statCarryMs >= 1000) {
        statCarryMs -= 1000;
        try {
          useStatsStore.getState().recordPlaybackSecond(current);
        } catch {}
      }
    }
    // Smoothness: while a song simply plays on, screens get its position ~4 times a second (enough
    // for the bar and the lyrics) instead of 10; seeks, pauses and new songs go through at once
    if (get().isPlaying && ms > prev && ms - prev < 240) return;
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
    const state = get();
    const nextShuffle = state.shuffleMode === 'off' ? 'all' : state.shuffleMode === 'all' ? 'smart' : 'off';

    // Mutual exclusivity: Activating shuffle automatically deactivates DJ mode
    if (nextShuffle !== 'off' && typeof window !== 'undefined') {
      window.localStorage.setItem('spotifree_dj_mode', 'false');
      window.localStorage.setItem('spotifree_dj_mode_desktop', 'false');
      window.dispatchEvent(new CustomEvent('spotifree_dj_mode_changed', { detail: { enabled: false } }));
      try {
        (window as any).__audioEngine?.resetTransitionState?.();
        const dj = (window as any).__useAIDJStore?.getState?.();
        if (dj?.isDJModeActive) {
          dj.stopDJSession?.();
        }
      } catch {}
    }

    if (nextShuffle === 'off') {
      const source = state.originalQueue.length > 0 ? state.originalQueue : state.queue;
      const cleanQueue = deduplicateTracks(source.filter((t: any) => !t.isSmartRecommendation));
      set({
        shuffleMode: nextShuffle,
        isShuffle: false,
        shuffleVersion: state.shuffleVersion + 1,
        playedInShuffle: [],
        preselectedNextTrackId: null,
        queue: cleanQueue,
      });
      return;
    }

    if (nextShuffle === 'all') {
      const source = state.originalQueue.length > 0 ? state.originalQueue : state.queue;
      const baseTracks = deduplicateTracks(source.filter((t: any) => !t.isSmartRecommendation));
      const curr = state.currentTrack;
      // Order from Settings › Ajustes avanzados (balanced by artist, recent songs at the end)
      const others = shuffleTracks(baseTracks.filter((t) => t.id !== curr?.id), lastPlayedAt);
      const shuffledQueue = curr ? [curr, ...others] : others;
      set({
        shuffleMode: nextShuffle,
        isShuffle: true,
        shuffleVersion: state.shuffleVersion + 1,
        playedInShuffle: curr ? [curr.id] : [],
        preselectedNextTrackId: others[0]?.id || null,
        queue: shuffledQueue,
      });
      return;
    }

    if (nextShuffle === 'smart') {
      const source = state.originalQueue.length > 0 ? state.originalQueue : state.queue;
      const baseTracks = deduplicateTracks(source.filter((t: any) => !t.isSmartRecommendation));
      const curr = state.currentTrack;
      const others = shuffleTracks(baseTracks.filter((t) => t.id !== curr?.id), lastPlayedAt);
      const shuffledQueue = curr ? [curr, ...others] : others;
      set({
        shuffleMode: nextShuffle,
        isShuffle: true,
        shuffleVersion: state.shuffleVersion + 1,
        playedInShuffle: curr ? [curr.id] : [],
        preselectedNextTrackId: others[0]?.id || null,
        queue: shuffledQueue,
      });
      get().populateSmartShuffleRecommendations(shuffledQueue);
      return;
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
      const cleanId = (trackId || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
      const exists =
        state.likedTrackIds.includes(trackId) ||
        state.likedTrackIds.includes(cleanId) ||
        state.likedTrackIds.includes(`spotify:track:${cleanId}`);

      const updated = exists
        ? state.likedTrackIds.filter(
            (id) => id !== trackId && id !== cleanId && id !== `spotify:track:${cleanId}`
          )
        : [...new Set([...state.likedTrackIds, trackId, cleanId])];

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('spotifree_liked_tracks', JSON.stringify(updated));

          const activeUserId = getActiveUserId();
          let updatedLikedTracks: Track[];
          if (exists) {
            updatedLikedTracks = removeCustomLikedSong(trackId, activeUserId, trackObj);
          } else if (trackObj) {
            updatedLikedTracks = saveCustomLikedSong(trackObj, activeUserId);
          } else {
            updatedLikedTracks = getCustomLikedSongs(activeUserId);
          }

          // Update liked-songs in SpotifyDataStore and persist everywhere
          import('./useSpotifyDataStore').then(({ useSpotifyDataStore }) => {
            const ds = useSpotifyDataStore.getState();
            const isLikedTarget = (pid: string, pname?: string) =>
              pid === 'liked-songs' ||
              pid === 'user-liked-songs' ||
              pid === 'tracks' ||
              pid.includes('collection:tracks') ||
              /^(canciones que te gustan|canciones que me gustan|tus me gusta|liked songs|liked tracks)$/i.test((pname || '').trim());

            const updatedPlaylists = ds.playlists.map((p) => {
              if (isLikedTarget(p.id, p.name)) {
                return {
                  ...p,
                  tracks: { total: updatedLikedTracks.length, items: updatedLikedTracks },
                };
              }
              return p;
            });
            useSpotifyDataStore.setState({ playlists: updatedPlaylists });
            // Sync with cloud
            import('../services/spotifreeAuth').then(({ syncSpotifreeAccount }) => {
              syncSpotifreeAccount({ playlists: updatedPlaylists, likedTracks: updated }).catch(() => {});
            }).catch(() => {});
          }).catch(() => {});

          // Dispatch event so any currently open playlist view reactively adds/removes the song
          window.dispatchEvent(
            new CustomEvent('spotifree_liked_songs_updated', {
              detail: { trackId, liked: !exists, tracks: updatedLikedTracks },
            })
          );
        } catch (e) {
          console.error('Error toggling like:', e);
        }
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
      const engine = getEngine();
      if (engine) {
        engine.unlockAudio?.();
        if (typeof engine.resume === 'function') engine.resume();
      }
      try { navigator.mediaSession.playbackState = 'playing'; } catch {}
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      usePlayerStore.getState().nextTrack();
      const engine = getEngine();
      if (engine) {
        engine.unlockAudio?.();
        if (typeof engine.resume === 'function') engine.resume();
      }
      try { navigator.mediaSession.playbackState = 'playing'; } catch {}
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
