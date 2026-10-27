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
  openWrapped: () => void;
  closeWrapped: () => void;
  recordPlaybackSecond: (track: Track) => void;
  recordTrackPlayed: (track: Track) => void;
  syncWithSpotifyTop: (accessToken: string) => Promise<void>;
  getTopArtists: (limit?: number) => ArtistStat[];
  getTopTracks: (limit?: number) => TrackStat[];
}

const STORAGE_KEY = 'spotifree_user_stats';

const DEFAULT_ARTISTS: Record<string, ArtistStat> = {
  'romeo-santos': {
    id: 'romeo-santos',
    name: 'Romeo Santos',
    image: 'https://i.scdn.co/image/ab6761610000e5eb56e6d183815f9bca1b4a9296',
    plays: 142,
    minutes: 426,
  },
  'prince-royce': {
    id: 'prince-royce',
    name: 'Prince Royce',
    image: 'https://i.scdn.co/image/ab6761610000e5eb7dcab764f69fc39bb2f97a5b',
    plays: 98,
    minutes: 310,
  },
  'trueno': {
    id: 'trueno',
    name: 'Trueno',
    image: 'https://i.scdn.co/image/ab6761610000e5ebc8be3c6e5a824360d1bffc03',
    plays: 85,
    minutes: 280,
  },
  'bad-bunny': {
    id: 'bad-bunny',
    name: 'Bad Bunny',
    image: 'https://i.scdn.co/image/ab6761610000e5eb9ad3eb759082ef7ef688b56d',
    plays: 76,
    minutes: 230,
  },
  'quevedo': {
    id: 'quevedo',
    name: 'Quevedo',
    image: 'https://i.scdn.co/image/ab6761610000e5eb4e015d3113dd88ee0cb71658',
    plays: 61,
    minutes: 180,
  },
};

const DEFAULT_TRACKS: Record<string, TrackStat> = {
  '1EljzqiV1RDtXj1QUbx3db': {
    id: '1EljzqiV1RDtXj1QUbx3db',
    name: 'Rain',
    artist: 'Trueno',
    image: 'https://i.scdn.co/image/ab67616d000048512fda43dd98cc1cad8b908d9f',
    plays: 38,
  },
  '7gwG5KyFAaLDV73ND47Q0w': {
    id: '7gwG5KyFAaLDV73ND47Q0w',
    name: 'Junto al Amanecer',
    artist: 'J Alvarez',
    image: 'https://i.scdn.co/image/ab67616d00004851d33f8f4911fcbb4c2f706365',
    plays: 31,
  },
  '2eQFYGegTZaObk2kuBz83Z': {
    id: '2eQFYGegTZaObk2kuBz83Z',
    name: 'Tú Con Él',
    artist: 'Rauw Alejandro',
    image: 'https://i.scdn.co/image/ab67616d00004851a6224f2f93c0ab4b2e01b44b',
    plays: 27,
  },
  '2lTm559tuIvatlT1u0JYG2': {
    id: '2lTm559tuIvatlT1u0JYG2',
    name: 'BAILE INoLVIDABLE',
    artist: 'Bad Bunny',
    image: 'https://i.scdn.co/image/ab67616d00004851bbd45c8d36e0e045ef640411',
    plays: 24,
  },
  '6bI00brFpeprqCDqKouEJS': {
    id: '6bI00brFpeprqCDqKouEJS',
    name: 'El Clavo (Remix)',
    artist: 'Prince Royce, Maluma',
    image: 'https://i.scdn.co/image/ab67616d000048515c13e4b702ec1d44111ea3c2',
    plays: 21,
  },
};

function loadSavedStats() {
  if (typeof window === 'undefined') {
    return {
      totalSeconds: 85200,
      totalTracksPlayed: 482,
      artists: DEFAULT_ARTISTS,
      tracks: DEFAULT_TRACKS,
      audioPersonality: 'Explorador Urbano',
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        totalSeconds: parsed.totalSeconds || 85200,
        totalTracksPlayed: parsed.totalTracksPlayed || 482,
        artists: { ...DEFAULT_ARTISTS, ...(parsed.artists || {}) },
        tracks: { ...DEFAULT_TRACKS, ...(parsed.tracks || {}) },
        audioPersonality: parsed.audioPersonality || 'Explorador Urbano',
      };
    }
  } catch {}

  return {
    totalSeconds: 85200,
    totalTracksPlayed: 482,
    artists: DEFAULT_ARTISTS,
    tracks: DEFAULT_TRACKS,
    audioPersonality: 'Explorador Urbano',
  };
}

function persistStats(data: any) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
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

const initial = loadSavedStats();

export const useStatsStore = create<StatsState>((set, get) => ({
  totalSeconds: initial.totalSeconds,
  totalTracksPlayed: initial.totalTracksPlayed,
  artists: initial.artists,
  tracks: initial.tracks,
  audioPersonality: initial.audioPersonality,
  isWrappedOpen: false,

  openWrapped: () => set({ isWrappedOpen: true }),
  closeWrapped: () => set({ isWrappedOpen: false }),

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
        persistStats({ ...state, ...updated });
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

      persistStats({ ...state, ...next });
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
            persistStats({ ...state, artists: next });
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
            persistStats({ ...state, tracks: next });
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
