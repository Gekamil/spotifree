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
  /** Epoch ms of the last time it was played (used by the DJ for "hace tiempo que no la escuchas") */
  lastPlayedAt?: number;
}

interface StatsState {
  totalSeconds: number;
  totalTracksPlayed: number;
  artists: Record<string, ArtistStat>;
  tracks: Record<string, TrackStat>;
  audioPersonality: string;
  /** Seconds listened per local day (YYYY-MM-DD), last 60 days */
  daily: Record<string, number>;
  /** Seconds listened per hour of the day (0-23) */
  hourly: number[];
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
  /** Sync and merge cloud stats with local stats without overwriting with zeros */
  syncWithCloudStats: (cloudStats?: any) => void;
  /** Extract clean, bounded stats payload for Firestore cloud sync */
  getExportableStats: () => Record<string, any>;
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
  daily: {} as Record<string, number>,
  hourly: new Array(24).fill(0) as number[],
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
        daily: parsed.daily && typeof parsed.daily === 'object' ? parsed.daily : {},
        hourly: Array.isArray(parsed.hourly) && parsed.hourly.length === 24 ? parsed.hourly : new Array(24).fill(0),
      };
    }
  } catch {}

  return { ...EMPTY_STATS, daily: {}, hourly: new Array(24).fill(0) };
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
        daily: data.daily,
        hourly: data.hourly,
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
  daily: initial.daily,
  hourly: initial.hourly,
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
      daily: loaded.daily,
      hourly: loaded.hourly,
    });
  },

  syncWithCloudStats: (cloudStats?: any) => {
    if (!cloudStats || typeof cloudStats !== 'object') return;
    set((state) => {
      const mergedTotalSeconds = Math.max(state.totalSeconds || 0, Number(cloudStats.totalSeconds || 0));
      const mergedTotalTracksPlayed = Math.max(state.totalTracksPlayed || 0, Number(cloudStats.totalTracksPlayed || 0));

      const mergedArtists: Record<string, ArtistStat> = { ...(cloudStats.artists || {}), ...state.artists };
      if (cloudStats.artists && typeof cloudStats.artists === 'object') {
        for (const [key, cArt] of Object.entries(cloudStats.artists as Record<string, any>)) {
          const lArt = state.artists[key];
          if (lArt && cArt) {
            mergedArtists[key] = {
              ...lArt,
              plays: Math.max(lArt.plays || 0, Number(cArt.plays || 0)),
              minutes: Math.max(lArt.minutes || 0, Number(cArt.minutes || 0)),
              image: lArt.image || cArt.image || '',
            };
          } else if (cArt) {
            mergedArtists[key] = {
              id: cArt.id || key,
              name: cArt.name || key,
              image: cArt.image || '',
              plays: Number(cArt.plays || 0),
              minutes: Number(cArt.minutes || 0),
            };
          }
        }
      }

      const mergedTracks: Record<string, TrackStat> = { ...(cloudStats.tracks || {}), ...state.tracks };
      if (cloudStats.tracks && typeof cloudStats.tracks === 'object') {
        for (const [key, cTrk] of Object.entries(cloudStats.tracks as Record<string, any>)) {
          const lTrk = state.tracks[key];
          if (lTrk && cTrk) {
            mergedTracks[key] = {
              ...lTrk,
              plays: Math.max(lTrk.plays || 0, Number(cTrk.plays || 0)),
              lastPlayedAt: Math.max(lTrk.lastPlayedAt || 0, Number(cTrk.lastPlayedAt || 0)),
              image: lTrk.image || cTrk.image || '',
            };
          } else if (cTrk) {
            mergedTracks[key] = {
              id: cTrk.id || key,
              name: cTrk.name || 'Cancion',
              artist: cTrk.artist || 'Artista',
              image: cTrk.image || '',
              plays: Number(cTrk.plays || 0),
              lastPlayedAt: Number(cTrk.lastPlayedAt || 0),
            };
          }
        }
      }

      const mergedDaily: Record<string, number> = { ...(cloudStats.daily || {}), ...state.daily };
      if (cloudStats.daily && typeof cloudStats.daily === 'object') {
        for (const [day, secs] of Object.entries(cloudStats.daily as Record<string, number>)) {
          mergedDaily[day] = Math.max(state.daily[day] || 0, Number(secs || 0));
        }
      }

      const mergedHourly = (state.hourly || new Array(24).fill(0)).map((val, idx) => {
        const cVal = Array.isArray(cloudStats.hourly) ? Number(cloudStats.hourly[idx] || 0) : 0;
        return Math.max(val || 0, cVal);
      });

      const next = {
        totalSeconds: mergedTotalSeconds,
        totalTracksPlayed: mergedTotalTracksPlayed,
        artists: mergedArtists,
        tracks: mergedTracks,
        daily: mergedDaily,
        hourly: mergedHourly,
        audioPersonality: state.audioPersonality !== 'Oyente Musical' ? state.audioPersonality : (cloudStats.audioPersonality || state.audioPersonality),
      };

      persistStats({ ...state, ...next }, state.currentUserId);
      try {
        (window as any).__spotifree_syncStats?.();
      } catch {}
      return next;
    });
  },

  getExportableStats: () => {
    const s = get();
    const topArtistEntries = Object.entries(s.artists || {})
      .sort(([, a], [, b]) => (b.plays || 0) - (a.plays || 0))
      .slice(0, 100);
    const topTrackEntries = Object.entries(s.tracks || {})
      .sort(([, a], [, b]) => (b.plays || 0) - (a.plays || 0))
      .slice(0, 100);

    return {
      totalSeconds: s.totalSeconds || 0,
      totalTracksPlayed: s.totalTracksPlayed || 0,
      artists: Object.fromEntries(topArtistEntries),
      tracks: Object.fromEntries(topTrackEntries),
      daily: s.daily || {},
      hourly: s.hourly || new Array(24).fill(0),
      audioPersonality: s.audioPersonality || 'Oyente Musical',
      updatedAt: Date.now(),
    };
  },

  resetStats: () => {
    set({
      currentUserId: null,
      totalSeconds: 0,
      totalTracksPlayed: 0,
      artists: {},
      tracks: {},
      audioPersonality: 'Oyente Musical',
      daily: {},
      hourly: new Array(24).fill(0),
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
        image: track.album?.images?.[0]?.url || '',
        plays: 0,
        minutes: 0,
      };

      const updatedArtist = {
        ...existingArtist,
        minutes: existingArtist.minutes + 1 / 60,
      };

      // When: per local day (kept 60 days) and per hour of the day, for the listening charts
      const now = new Date();
      const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      let daily = state.daily;
      if (daily[day] === undefined && Object.keys(daily).length >= 60) {
        daily = Object.fromEntries(Object.entries(daily).sort(([a], [b]) => a.localeCompare(b)).slice(-59));
      }
      daily = { ...daily, [day]: (daily[day] || 0) + 1 };
      const hourly = state.hourly.slice();
      hourly[now.getHours()] = (hourly[now.getHours()] || 0) + 1;

      const updated = {
        totalSeconds: newSec,
        daily,
        hourly,
        artists: {
          ...state.artists,
          [artistKey]: updatedArtist,
        },
      };

      if (newSec % 10 === 0) {
        persistStats({ ...state, ...updated }, state.currentUserId);
      }
      if (newSec % 30 === 0) {
        try {
          (window as any).__spotifree_syncStats?.();
        } catch {}
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
        image: track.album?.images?.[0]?.url || '',
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
            lastPlayedAt: Date.now(),
          },
        },
      };

      persistStats({ ...state, ...next }, state.currentUserId);
      try {
        (window as any).__spotifree_syncStats?.();
      } catch {}
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
