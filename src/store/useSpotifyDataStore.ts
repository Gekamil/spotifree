import { create } from 'zustand';
import type { Playlist, UserProfile, Track } from '../types/spotify';
import {
  initiateSpotifyLogin,
  handleSpotifyCallback,
  logoutSpotify,
} from '../services/spotifyAuth';
import {
  fetchCurrentUser,
  fetchUserPlaylists,
  fetchBrowseCategories,
  fetchFeaturedPlaylists,
  fetchNewReleases,
  fetchTopTracks,
} from '../services/spotifyApi';
import { fetchChromeSession } from '../services/sessionSync';

export interface DynamicShelfCard {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  badge?: string;
  badgeColor?: string;
  isRadio?: boolean;
  video?: string | null;
}

export interface DynamicShelf {
  id: string;
  title: string;
  prefix?: string;
  subtitle?: string;
  type: 'featured' | 'made_for' | 'recent' | 'artist' | 'mixes';
  cards: DynamicShelfCard[];
  hasSeeAll?: boolean;
}

export function buildDynamicShelves(
  user: UserProfile | null,
  playlists: Playlist[],
  featuredMessage: string | null,
  featuredPlaylists: any[] = [],
  topTracks: Track[] = [],
  topArtists: any[] = [],
  recentlyPlayed: any[] = []
): DynamicShelf[] {
  if (!user && playlists.length === 0) return [];

  const displayName = user?.display_name || 'ti';
  const editorialTitle =
    featuredMessage ||
    (new Date().getDay() === 5 ? '¡Hoy es viernes de novedades!' : 'Novedades populares');

  // Shelf 1: Editorial Featured (Priority 1)
  const editorialPool =
    featuredPlaylists.length > 0
      ? featuredPlaylists
      : playlists.filter(
          (p) =>
            p.id.includes('novedades') ||
            p.id.includes('radar') ||
            p.name.toLowerCase().includes('novedades') ||
            p.name.toLowerCase().includes('radar')
        );

  const editorialCards: DynamicShelfCard[] = (
    editorialPool.length > 0 ? editorialPool : playlists.slice(0, 6)
  ).map((item, idx) => ({
    id: item.id || `feat-${idx}`,
    title: item.name,
    subtitle: item.description || 'De Spotify',
    image:
      item.images?.[0]?.url ||
      'https://misc.scdn.co/liked-songs/liked-songs-640.jpg',
  }));

  // Shelf 2: Made for user (Priority 2) - Derived dynamically from live playlists
  const dailyMixes = playlists.filter((p) =>
    /mix diario|daily mix|discover|radar/i.test(p.name)
  );
  const userPlaylists = playlists.filter(
    (p) =>
      p.owner?.display_name === displayName ||
      p.owner?.id === user?.id ||
      /mix|favorit|canciones/i.test(p.name)
  );
  const madeForPool = dailyMixes.length >= 2 ? dailyMixes : userPlaylists.length > 0 ? userPlaylists : playlists;

  const badgeColors = ['#00F0FF', '#FFA42B', '#FF6437', '#1ED760', '#B02897', '#509BF5'];
  const madeForCards: DynamicShelfCard[] = madeForPool.slice(0, 6).map((p, idx) => {
    const matchDaily = p.name.match(/Mix diario \d/i);
    return {
      id: p.id || `made-for-${idx}`,
      title: p.name,
      subtitle: p.description || `Mix personalizado para ${displayName}`,
      image: p.images?.[0]?.url || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg',
      badge: matchDaily ? matchDaily[0] : undefined,
      badgeColor: matchDaily ? badgeColors[idx % badgeColors.length] : undefined,
    };
  });

  // Shelf 3: Recientes (Priority 3) - Derived from recentlyPlayed or playlists order
  const recentCards: DynamicShelfCard[] = (
    recentlyPlayed.length > 0 ? recentlyPlayed : playlists
  ).slice(0, 8).map((p, idx) => ({
    id: p.id || `recent-${idx}`,
    title: p.name,
    subtitle: p.description || 'De tu biblioteca',
    image: p.images?.[0]?.url || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg',
  }));

  // Shelf 4: Más como {topArtist} (Priority 4) - Dynamically derived artist affinity
  const artistFromTop = topArtists[0]?.name;
  const artistFromTracks = topTracks[0]?.artists?.[0]?.name;
  const artistFromPlaylists = playlists
    .find((p) => /mix de|radio de|radio/i.test(p.name) || p.name.includes('&'))
    ?.name.replace(/^(mix de|radio de|radio)\s+/i, '')
    .split('&')[0]
    ?.trim();

  const topArtistName = artistFromTop || artistFromTracks || artistFromPlaylists || 'Romeo Santos';

  const artistPool = playlists.filter(
    (p) =>
      p.name.toLowerCase().includes(topArtistName.toLowerCase()) ||
      p.description?.toLowerCase().includes(topArtistName.toLowerCase()) ||
      /radio|artista/i.test(p.name)
  );

  const artistCards: DynamicShelfCard[] = (
    artistPool.length >= 2 ? artistPool : playlists.slice(2, 6)
  ).map((p, idx) => ({
    id: p.id || `artist-${idx}`,
    title: p.name,
    subtitle: p.description || `Con ${topArtistName} y artistas similares`,
    image: p.images?.[0]?.url || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg',
  }));

  // Shelf 5: Mixes (Priority 5) - Dynamically derived genre mixes
  const genreMixPool = playlists.filter((p) =>
    /mix|urbano|pop|latino|bachata|flamenco|reggaeton|rock|relajante/i.test(p.name)
  );
  const mixesPool = genreMixPool.length >= 3 ? genreMixPool : playlists.slice(4, 10);

  const mixesCards: DynamicShelfCard[] = mixesPool.map((p, idx) => ({
    id: p.id || `mix-${idx}`,
    title: p.name,
    subtitle: p.description || 'Música organizada por tus géneros favoritos',
    image: p.images?.[0]?.url || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg',
  }));

  return [
    {
      id: 'shelf-editorial',
      type: 'featured',
      title: editorialTitle,
      subtitle: 'Novedades y lanzamientos seleccionados',
      cards: editorialCards,
      hasSeeAll: true,
    },
    {
      id: 'shelf-made-for-you',
      type: 'made_for',
      prefix: 'Hecho para',
      title: displayName,
      subtitle: 'Tus listas y mixes personalizados',
      cards: madeForCards,
      hasSeeAll: true,
    },
    {
      id: 'shelf-recent',
      type: 'recent',
      title: 'Recientes',
      subtitle: 'Basado en tu actividad reciente',
      cards: recentCards,
      hasSeeAll: true,
    },
    {
      id: 'shelf-more-like',
      type: 'artist',
      prefix: 'Más como',
      title: topArtistName,
      subtitle: 'Recomendaciones basadas en tus artistas favoritos',
      cards: artistCards,
      hasSeeAll: true,
    },
    {
      id: 'shelf-mixes',
      type: 'mixes',
      title: 'Tus mixes más escuchados',
      subtitle: 'Música que te encanta organizada por géneros y estados de ánimo',
      cards: mixesCards,
      hasSeeAll: true,
    },
  ];
}

interface SpotifyDataState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  playlists: Playlist[];
  categories: any[];
  featuredPlaylists: any[];
  featuredMessage: string | null;
  newReleases: any[];
  topTracks: Track[];
  topArtists: any[];
  recentlyPlayed: any[];
  dynamicShelves: DynamicShelf[];
  quickAccessCards: Array<{ id: string; name: string; image: string; color: string }>;

  playlistDetailsCache: Record<string, Playlist>;
  cachePlaylistDetails: (playlist: Playlist) => void;
  createPlaylist: (name?: string) => Playlist;
  initialize: () => Promise<void>;
  login: () => void;
  logout: () => void;
  refreshData: () => Promise<void>;
  setDynamicShelves: (shelves: DynamicShelf[]) => void;
  updatePlaylist: (id: string, updates: Partial<Playlist>) => void;
  deletePlaylist: (id: string) => void;
}

const store = create<SpotifyDataState>((set, get) => ({
  isAuthenticated: false,
  isLoading: false,
  user: null,
  playlists: [],
  categories: [],
  featuredPlaylists: [],
  featuredMessage: null,
  newReleases: [],
  topTracks: [],
  topArtists: [],
  recentlyPlayed: [],
  dynamicShelves: [],
  quickAccessCards: [],
  playlistDetailsCache: {},

  cachePlaylistDetails: (playlist: Playlist) => {
    set((s) => ({
      playlistDetailsCache: {
        ...s.playlistDetailsCache,
        [playlist.id]: playlist,
      },
    }));
  },

  createPlaylist: (name?: string) => {
    const s = get();
    const count = s.playlists.filter((p) => (p as any).is_custom).length + 1;
    const playlistName = name || `Mi lista n.º ${count}`;
    const newPlaylist: Playlist = {
      id: `custom-playlist-${Date.now()}`,
      name: playlistName,
      description: '',
      images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
      owner: { display_name: s.user?.display_name || 'Jorgeperezvk', id: 'user' },
      tracks: { total: 0, items: [] },
      color: '#303030',
      is_pinned: false,
      is_custom: true,
    } as any;

    set((state) => ({
      playlists: [newPlaylist, ...state.playlists],
      playlistDetailsCache: {
        ...state.playlistDetailsCache,
        [newPlaylist.id]: newPlaylist,
      },
    }));

    return newPlaylist;
  },

  updatePlaylist: (id: string, updates: Partial<Playlist>) => {
    set((s) => {
      const existingInCache = s.playlistDetailsCache[id];
      const updatedCacheEntry = existingInCache
        ? { ...existingInCache, ...updates }
        : undefined;

      return {
        playlists: s.playlists.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        playlistDetailsCache: updatedCacheEntry
          ? { ...s.playlistDetailsCache, [id]: updatedCacheEntry }
          : s.playlistDetailsCache,
        dynamicShelves: s.dynamicShelves.map((shelf) => ({
          ...shelf,
          cards: shelf.cards.map((c) =>
            c.id === id
              ? {
                  ...c,
                  ...(updates.name ? { title: updates.name } : {}),
                  ...(updates.description ? { subtitle: updates.description } : {}),
                  ...(updates.images?.[0]?.url ? { image: updates.images[0].url } : {}),
                }
              : c
          ),
        })),
      };
    });
  },

  deletePlaylist: (id: string) => {
    set((s) => {
      const newCache = { ...s.playlistDetailsCache };
      delete newCache[id];
      return {
        playlists: s.playlists.filter((p) => p.id !== id),
        playlistDetailsCache: newCache,
        dynamicShelves: s.dynamicShelves.map((shelf) => ({
          ...shelf,
          cards: shelf.cards.filter((c) => c.id !== id),
        })),
        quickAccessCards: s.quickAccessCards.filter((q) => q.id !== id),
      };
    });
  },

  setDynamicShelves: (shelves: DynamicShelf[]) => {
    set({ dynamicShelves: shelves });
  },

  initialize: async () => {
    set({ isLoading: true });

    // 1. Check for OAuth code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      const success = await handleSpotifyCallback(code);
      if (success) {
        window.history.replaceState({}, document.title, '/');
      }
    }

    // 2. Prioritize active user OAuth session if logged in
    const oauthToken = typeof window !== 'undefined' ? window.localStorage.getItem('spotify_access_token') : null;
    if (oauthToken && oauthToken !== 'session-bridge-active') {
      await get().refreshData();
      return;
    }

    // 2. Try Chrome session sync if available (skip if user explicitly logged out)
    if (typeof window !== 'undefined' && window.localStorage.getItem('spotify_logged_out') === 'true') {
      set({
        isAuthenticated: false,
        user: null,
        playlists: [],
        categories: [],
        featuredPlaylists: [],
        featuredMessage: null,
        newReleases: [],
        topTracks: [],
        topArtists: [],
        recentlyPlayed: [],
        dynamicShelves: [],
        quickAccessCards: [],
        playlistDetailsCache: {},
        isLoading: false,
      });
      return;
    }

    try {
      const session = await fetchChromeSession();
      if (session && session.connected && session.user) {
        const userProfile: UserProfile = {
          id: session.user.id || 'e6yr34zzwnf1yybcw49po6nrw',
          display_name: session.user.display_name || 'Jorgeperezvk',
          images: (session.user.images || []).map((img) => ({
            url: img.url,
            ...(img.height != null ? { height: img.height } : {}),
            ...(img.width != null ? { width: img.width } : {}),
          })),
          email: 'jorgeperezvk@spotify.com',
          followers: { total: 0 },
        };

        const livePlaylists = session.playlists || [];
        const msg =
          session.featuredMessage ||
          (new Date().getDay() === 5 ? '¡Hoy es viernes de novedades!' : 'Novedades populares');
        const liveShelves = (session.shelves && session.shelves.length > 0)
          ? session.shelves
          : buildDynamicShelves(
              userProfile,
              livePlaylists,
              msg,
              (session as any).featuredPlaylists || [],
              (session as any).topTracks || [],
              (session as any).topArtists || [],
              session.recentlyPlayed || []
            );

        const liveQuick = (session.quickAccess && session.quickAccess.length > 0)
          ? session.quickAccess.map((q: any) => ({
              id: q.id,
              name: q.name,
              image: q.image,
              color: q.color || '#303030',
            }))
          : [
              { id: '37i9dQZF1DWZdsS73T1ogG', name: 'el nuevo urbano', image: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426', color: '#704838' },
              { id: '7b3MrCWtettvBKlfBSdorn', name: 'J+L(2026)', image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c804d43e5cc7f6a6d0ac65ffc', color: '#5a483a' },
              { id: '4f0YTBqSbvM1iJpuY9r3yQ', name: 'ZIZI', image: 'https://i.scdn.co/image/ab67616d0000b273eb31ebdbca6acd99c23b4d31', color: '#2e4a52' },
              { id: '37i9dQZF1DX2EiUAL7Wdfc', name: 'míticas', image: 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6', color: '#8b3a1a' },
            ];

        set({
          isAuthenticated: true,
          user: userProfile,
          playlists: livePlaylists,
          quickAccessCards: liveQuick,
          featuredMessage: msg,
          dynamicShelves: liveShelves,
          topTracks: (session as any).topTracks || [],
          topArtists: (session as any).topArtists || [],
          recentlyPlayed: session.recentlyPlayed || [],
          isLoading: false,
        });
        return;
      }
    } catch {
      // Chrome session unavailable
    }

    // 3. Check for existing OAuth token
    const token = window.localStorage.getItem('spotify_access_token');
    if (token) {
      await get().refreshData();
    } else {
      // Unauthenticated clean state
      set({
        isAuthenticated: false,
        user: null,
        playlists: [],
        categories: [],
        featuredPlaylists: [],
        featuredMessage: null,
        newReleases: [],
        topTracks: [],
        topArtists: [],
        recentlyPlayed: [],
        dynamicShelves: [],
        playlistDetailsCache: {},
        isLoading: false,
      });
    }
  },

  login: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('spotify_logged_out');
    }
    initiateSpotifyLogin();
  },

  logout: () => {
    logoutSpotify();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('spotify_logged_out', 'true');
      window.localStorage.removeItem('spotify_session_synced');
    }
    set({
      isAuthenticated: false,
      user: null,
      playlists: [],
      categories: [],
      featuredPlaylists: [],
      featuredMessage: null,
      newReleases: [],
      topTracks: [],
      topArtists: [],
      recentlyPlayed: [],
      dynamicShelves: [],
      quickAccessCards: [],
      playlistDetailsCache: {},
      isLoading: false,
    });
  },

  refreshData: async () => {
    const userToken = window.localStorage.getItem('spotify_access_token');
    if (!userToken) {
      set({
        isAuthenticated: false,
        user: null,
        playlists: [],
        categories: [],
        featuredPlaylists: [],
        featuredMessage: null,
        newReleases: [],
        topTracks: [],
        topArtists: [],
        recentlyPlayed: [],
        dynamicShelves: [],
        isLoading: false,
      });
      return;
    }

    set({ isLoading: true });
    try {
      const [user, playlists, categories, featured, releases, top] = await Promise.all([
        fetchCurrentUser(),
        fetchUserPlaylists(),
        fetchBrowseCategories(),
        fetchFeaturedPlaylists(),
        fetchNewReleases(),
        fetchTopTracks(),
      ]);

      const defaultMsg =
        new Date().getDay() === 5 ? '¡Hoy es viernes de novedades!' : 'Novedades populares';
      const livePlaylists = playlists && playlists.length > 0 ? playlists : [];
      const shelves = buildDynamicShelves(user, livePlaylists, defaultMsg, featured || [], top || []);

      set({
        isAuthenticated: !!user,
        user: user || null,
        playlists: livePlaylists,
        categories: categories || [],
        featuredPlaylists: featured || [],
        featuredMessage: defaultMsg,
        newReleases: releases || [],
        topTracks: top || [],
        dynamicShelves: shelves,
        isLoading: false,
      });
    } catch (err) {
      console.error('Error refreshing Spotify data:', err);
      set({ isLoading: false });
    }
  },
}));

export const useSpotifyDataStore =
  typeof window !== 'undefined' && (window as any).__useSpotifyDataStore
    ? ((window as any).__useSpotifyDataStore as typeof store)
    : store;

if (typeof window !== 'undefined') {
  (window as any).__useSpotifyDataStore = useSpotifyDataStore;
}

