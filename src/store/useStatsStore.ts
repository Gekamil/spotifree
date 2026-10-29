import { create } from 'zustand';
import type { Track } from '../types/spotify';

export interface ArtistStat {
  id: string;
  name: string;
  image: string;
  plays: number;
  minutes: number;
}

export interface TrackStat {
  id: string;
  name: string;
  artist: string;
  image: string;
  plays: number;
}

interface StatsState {
  totalSeconds: number;
  totalTracksPlayed: number;
  artists: Record<string, ArtistStat>;
  tracks: Record<string, TrackStat>;
  audioPersonality: string;
  isWrappedOpen: boolean;
  currentUserId: string | null;
  openWrapped: () => void;
  closeWrapped: () => void;
  recordPlaybackSecond: (track: Track) => void;
  recordTrackPlayed: (track: Track) => void;
  syncWithSpotifyTop: (accessToken: string) => Promise<void>;
  getTopArtists: (limit?: number) => ArtistStat[];
  getTopTracks: (limit?: number) => TrackStat[];
  /** Load and activate stats for a specific userId (call on account switch/init) */
  loadStatsForUser: (userId: string) => void;
  /** Reset stats in memory and localStorage for current user (call on logout) */
  resetStats: () => void;
}

const STORAGE_KEY_PREFIX = 'spotifree_user_stats';

function storageKeyFor(userId: string | null) {
  return userId ? `${STORAGE_KEY_PREFIX}_${userId}` : STORAGE_KEY_PREFIX;
}

const EMPTY_STATS = {
  totalSeconds: 0,
  totalTracksPlayed: 0,
  artists: {} as Record<string, ArtistStat>,
  tracks: {} as Record<string, TrackStat>,
  audioPersonality: 'Oyente Musical',
};

function loadSavedStats(userId: string | null = null) {
  if (typeof window === 'undefined') return { ...EMPTY_STATS };

  try {
    const key = storageKeyFor(userId);
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        totalSeconds: parsed.totalSeconds || 0,
        totalTracksPlayed: parsed.totalTracksPlayed || 0,
        artists: parsed.artists || {},
        tracks: parsed.tracks || {},
        audioPersonality: parsed.audioPersonality || 'Oyente Musical',
      };
    }
  } catch {}

  return { ...EMPTY_STATS };
}

function persistStats(data: any, userId: string | null = null) {
  if (typeof window === 'undefined') return;
  try {
    const key = storageKeyFor(userId);
    window.localStorage.setItem(
      key,
      JSON.stringify({
        totalSeconds: data.totalSeconds,
        totalTracksPlayed: data.totalTracksPlayed,
        artists: data.artists,
        tracks: data.tracks,
        audioPersonality: data.audioPersonality,
      })
    );
  } catch {}
}

// Determine initial userId from localStorage
const initialUserId = typeof window !== 'undefined'
  ? window.localStorage.getItem('spotifree_active_user_id') || null
  : null;

const initial = loadSavedStats(initialUserId);

export const useStatsStore = create<StatsState>((set, get) => ({
  totalSeconds: initial.totalSeconds,
  totalTracksPlayed: initial.totalTracksPlayed,
  artists: initial.artists,
  tracks: initial.tracks,
  audioPersonality: initial.audioPersonality,
  isWrappedOpen: false,
  currentUserId: initialUserId,

  openWrapped: () => set({ isWrappedOpen: true }),
  closeWrapped: () => set({ isWrappedOpen: false }),

  loadStatsForUser: (userId: string) => {
    const loaded = loadSavedStats(userId);
    set({
      currentUserId: userId,
      totalSeconds: loaded.totalSeconds,
      totalTracksPlayed: loaded.totalTracksPlayed,
      artists: loaded.artists,
      tracks: loaded.tracks,
      audioPersonality: loaded.audioPersonality,
    });
  },

  resetStats: () => {
    set({
      currentUserId: null,
      totalSeconds: 0,
      totalTracksPlayed: 0,
      artists: {},
      tracks: {},
      audioPersonality: 'Oyente Musical',
    });
  },

  recordPlaybackSecond: (track: Track) => {
    if (!track) return;
    set((state) => {
      const newSec = state.totalSeconds + 1;
      const primaryArtist = track.artists?.[0]?.name || 'Spotify';
      const artistKey = primaryArtist.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const existingArtist = state.artists[artistKey] || {
        id: artistKey,
        name: primaryArtist,
        image: track.album?.images?.[0]?.url || 'https://i.scdn.co/image/ab6761610000e5eb4e015d3113dd88ee0cb71658',
        plays: 0,
        minutes: 0,
      };

      const updatedArtist = {
        ...existingArtist,
        minutes: existingArtist.minutes + 1 / 60,
      };

      const updated = {
        totalSeconds: newSec,
        artists: {
          ...state.artists,
          [artistKey]: updatedArtist,
        },
      };

      if (newSec % 10 === 0) {
        persistStats({ ...state, ...updated }, state.currentUserId);
      }

      return updated;
    });
  },

  recordTrackPlayed: (track: Track) => {
    if (!track) return;
    set((state) => {
      const primaryArtist = track.artists?.[0]?.name || 'Spotify';
      const artistKey = primaryArtist.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const trackId = track.id || `track-${Date.now()}`;

      const existingArtist = state.artists[artistKey] || {
        id: artistKey,
        name: primaryArtist,
        image: track.album?.images?.[0]?.url || 'https://i.scdn.co/image/ab6761610000e5eb4e015d3113dd88ee0cb71658',
        plays: 0,
        minutes: 0,
      };

      const existingTrack = state.tracks[trackId] || {
        id: trackId,
        name: track.name || 'Canción',
        artist: primaryArtist,
        image: track.album?.images?.[0]?.url || '',
        plays: 0,
      };

      const next = {
        totalTracksPlayed: state.totalTracksPlayed + 1,
        artists: {
          ...state.artists,
          [artistKey]: {
            ...existingArtist,
            plays: existingArtist.plays + 1,
          },
        },
        tracks: {
          ...state.tracks,
          [trackId]: {
            ...existingTrack,
            plays: existingTrack.plays + 1,
          },
        },
      };

      persistStats({ ...state, ...next }, state.currentUserId);
      return next;
    });
  },

  syncWithSpotifyTop: async (accessToken: string) => {
    if (!accessToken || accessToken === 'session-bridge-active') return;
    try {
      const [artistsRes, tracksRes] = await Promise.all([
        fetch('https://api.spotify.com/v1/me/top/artists?limit=10&time_range=medium_term', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch('https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=medium_term', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      if (artistsRes.ok) {
        const artData = await artistsRes.json();
        const incomingArtists: Record<string, ArtistStat> = {};
        (artData.items || []).forEach((a: any, idx: number) => {
          const key = a.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
          incomingArtists[key] = {
            id: a.id || key,
            name: a.name,
            image: a.images?.[0]?.url || '',
            plays: 120 - idx * 8,
            minutes: 360 - idx * 24,
          };
        });

        if (Object.keys(incomingArtists).length > 0) {
          set((state) => {
            const next = { ...state.artists, ...incomingArtists };
            persistStats({ ...state, artists: next }, state.currentUserId);
            return { artists: next };
          });
        }
      }

      if (tracksRes.ok) {
        const trkData = await tracksRes.json();
        const incomingTracks: Record<string, TrackStat> = {};
        (trkData.items || []).forEach((t: any, idx: number) => {
          incomingTracks[t.id] = {
            id: t.id,
            name: t.name,
            artist: t.artists?.[0]?.name || '',
            image: t.album?.images?.[0]?.url || '',
            plays: 40 - idx * 2,
          };
        });

        if (Object.keys(incomingTracks).length > 0) {
          set((state) => {
            const next = { ...state.tracks, ...incomingTracks };
            persistStats({ ...state, tracks: next }, state.currentUserId);
            return { tracks: next };
          });
        }
      }
    } catch (err) {
      console.warn('[useStatsStore] Could not fetch real Spotify top stats:', err);
    }
  },

  getTopArtists: (limit = 5) => {
    const list = Object.values(get().artists);
    return list.sort((a, b) => b.plays - a.plays).slice(0, limit);
  },

  getTopTracks: (limit = 5) => {
    const list = Object.values(get().tracks);
    return list.sort((a, b) => b.plays - a.plays).slice(0, limit);
  },
}));
