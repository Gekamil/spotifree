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
  fetchTopTracks,
} from '../services/spotifyApi';
import {
  validateSpotifyCookie,
  extractSpotifySessionFromCookie,
} from '../services/spotifyCookieService';
import liveExtractedSession from '../data/liveExtractedSession.json';
import liveExtractedFeed from '../data/liveExtractedFeed.json';

export const DEFAULT_SESSION_USER: UserProfile = {
  id: liveExtractedSession.user?.id || 'e6yr34zzwnf1yybcw49po6nrw',
  display_name: liveExtractedSession.user?.display_name || 'Jorgeperezvk',
  images: [],
  email: 'jorgeperezvk@spotify.com',
  followers: { total: 0 },
};

export const DEFAULT_SESSION_PLAYLISTS: Playlist[] = (liveExtractedSession.playlists as any[]) || [];
export const DEFAULT_SESSION_QUICK_ACCESS = (liveExtractedSession.quickAccessCards as any[]) || [];
export const DEFAULT_SESSION_CACHE: Record<string, Playlist> = {};
DEFAULT_SESSION_PLAYLISTS.forEach((p) => {
  DEFAULT_SESSION_CACHE[p.id] = p;
});
if ((liveExtractedSession as any).cachedPlaylistDetails) {
  Object.assign(DEFAULT_SESSION_CACHE, (liveExtractedSession as any).cachedPlaylistDetails);
}

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

export function buildExtractedShelves(userName: string = 'Jorgeperezvk'): DynamicShelf[] {
  const result: DynamicShelf[] = [];
  const feed = liveExtractedFeed as any[];

  feed.forEach((shelf, idx) => {
    // Exclude podcast / episodes per user request
    if (shelf.title.toLowerCase().includes('episodio') || shelf.title.toLowerCase().includes('podcast')) {
      return;
    }
    // Shelf 0 is the raw concatenated list, Shelf 1 is the 8-card "Mixes diarios" for user
    if (idx === 0) return;

    let title = shelf.title;
    let prefix: string | undefined = undefined;
    let type: DynamicShelf['type'] = 'mixes';

    if (title === 'Jorgeperezvk' || title.toLowerCase().includes('jorge')) {
      title = userName;
      prefix = 'Hecho para';
      type = 'made_for';
    } else if (title.toLowerCase().includes('romeo')) {
      prefix = 'Más como';
      type = 'artist';
    } else if (title.toLowerCase().includes('reciente') || title.toLowerCase().includes('sumérgete')) {
      type = 'recent';
    } else if (title.toLowerCase().includes('emisora') || title.toLowerCase().includes('petando') || title.toLowerCase().includes('urbano')) {
      type = 'featured';
    }

    const cards: DynamicShelfCard[] = shelf.cards.map((c: any) => ({
      id: c.id,
      title: c.title,
      subtitle: c.subtitle || '',
      image: c.image || '',
      isRadio: c.title.toLowerCase().startsWith('radio') || /radio/i.test(c.subtitle || ''),
    }));

    if (cards.length > 0) {
      result.push({
        id: `extracted-shelf-${idx}`,
        title,
        prefix,
        type,
        cards,
        hasSeeAll: true,
      });
    }
  });

  return result;
}

export const DEFAULT_PUBLIC_SHELVES: DynamicShelf[] = buildExtractedShelves();

export const DEFAULT_PUBLIC_PLAYLISTS: Playlist[] = [
  {
    id: '37i9dQZF1DWZdsS73T1ogG',
    name: 'el nuevo urbano',
    description: 'Lo más nuevo de la música urbana.',
    images: [{ url: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426' }],
    owner: { display_name: 'Spotify', id: 'spotify' },
    tracks: { total: 50, items: [] },
    color: '#704838',
    is_pinned: true,
  } as any,
  {
    id: '37i9dQZF1DX2EiUAL7Wdfc',
    name: 'míticas',
    description: 'Canciones que nunca pasarán de moda.',
    images: [{ url: 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6' }],
    owner: { display_name: 'Spotify', id: 'spotify' },
    tracks: { total: 50, items: [] },
    color: '#8b3a1a',
    is_pinned: false,
  } as any,
  {
    id: '37i9dQZF1DXcBWIGoYBM5M',
    name: 'Éxitos España',
    description: 'Los éxitos más escuchados en España.',
    images: [{ url: 'https://i.scdn.co/image/ab67706f00000002e8ccdd567fff6a597b87586b' }],
    owner: { display_name: 'Spotify', id: 'spotify' },
    tracks: { total: 50, items: [] },
    color: '#1a4b4c',
    is_pinned: false,
  } as any,
  {
    id: '4f0YTBqSbvM1iJpuY9r3yQ',
    name: 'ZIZI',
    description: 'Música pop y urbana destacada.',
    images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273eb31ebdbca6acd99c23b4d31' }],
    owner: { display_name: 'Spotify', id: 'spotify' },
    tracks: { total: 40, items: [] },
    color: '#2e4a52',
    is_pinned: false,
  } as any,
  {
    id: '7b3MrCWtettvBKlfBSdorn',
    name: 'J+L(2026)',
    description: 'Selección de éxitos contemporáneos.',
    images: [{ url: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c804d43e5cc7f6a6d0ac65ffc' }],
    owner: { display_name: 'Spotify', id: 'spotify' },
    tracks: { total: 35, items: [] },
    color: '#5a483a',
    is_pinned: false,
  } as any,
];

export function buildDynamicShelves(
  user: UserProfile | null,
  playlists: Playlist[],
  _featuredMessage: string | null = null,
  _featuredPlaylists: any[] = [],
  _topTracks: Track[] = [],
  _topArtists: any[] = [],
  _recentlyPlayed: any[] = []
): DynamicShelf[] {
  const displayName = user?.display_name || 'Jorgeperezvk';
  const extracted = buildExtractedShelves(displayName);

  // If user has custom playlists, include them at the top
  const userLists = playlists.filter(
    (p) => !p.id.includes('collection:tracks') && p.type !== 'folder' && (p as any).is_custom
  );

  if (userLists.length > 0) {
    const userShelf: DynamicShelf = {
      id: 'shelf-user-created',
      title: 'Tus listas creadas',
      subtitle: `Listas y creaciones de ${displayName}`,
      type: 'made_for',
      hasSeeAll: true,
      cards: userLists.map((p) => ({
        id: p.id,
        title: p.name,
        subtitle: p.description || `De ${displayName}`,
        image: p.images?.[0]?.url || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg',
      })),
    };
    return [userShelf, ...extracted];
  }

  return extracted;
}

interface SpotifyDataState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  playlists: Playlist[];
  authWarning: string | null;
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
  addCustomPlaylist: (playlist: Playlist) => void;
  createPlaylist: (name?: string) => Playlist;
  initialize: () => Promise<void>;
  login: () => void;
  logout: () => void;
  refreshData: () => Promise<void>;
  setDynamicShelves: (shelves: DynamicShelf[]) => void;
  updatePlaylist: (id: string, updates: Partial<Playlist>) => void;
  deletePlaylist: (id: string) => void;
}

let isInitializing = false;

const store = create<SpotifyDataState>((set, get) => ({
  isAuthenticated: true,
  isLoading: false,
  user: DEFAULT_SESSION_USER,
  authWarning: null,
  playlists: DEFAULT_SESSION_PLAYLISTS,
  categories: [],
  featuredPlaylists: [],
  featuredMessage: 'Novedades populares',
  newReleases: [],
  topTracks: [],
  topArtists: [],
  recentlyPlayed: [],
  dynamicShelves: buildDynamicShelves(DEFAULT_SESSION_USER, DEFAULT_SESSION_PLAYLISTS, 'Novedades para ti'),
  quickAccessCards: DEFAULT_SESSION_QUICK_ACCESS,
  playlistDetailsCache: DEFAULT_SESSION_CACHE,

  cachePlaylistDetails: (playlist: Playlist) => {
    set((s) => ({
      playlistDetailsCache: {
        ...s.playlistDetailsCache,
        [playlist.id]: playlist,
      },
    }));
  },

  addCustomPlaylist: (playlist: Playlist) => {
    set((s) => {
      if (s.playlists.some((p) => p.id === playlist.id)) {
        return s;
      }
      return {
        playlists: [playlist, ...s.playlists],
        playlistDetailsCache: {
          ...s.playlistDetailsCache,
          [playlist.id]: playlist,
        },
      };
    });
  },

  createPlaylist: (name?: string) => {
    const s = get();
    const count = s.playlists.filter((p) => (p as any).is_custom).length + 1;
    const playlistName = name || `Mi lista n.º ${count}`;
    const newPlaylist: Playlist = {
      id: `custom-playlist-${Date.now()}`,
      name: playlistName,
      description: '',
      images: [],
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
    if (isInitializing) return;
    isInitializing = true;
    set({ isLoading: true });

    try {
      // 1. Check for OAuth code or error in URL
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      // 1b. Check for direct 1-click cookie transfer in URL (?sp_dc=AQ... or ?cookie=AQ...)
      const rawUrlCookie = urlParams.get('sp_dc') || urlParams.get('cookie');
      if (rawUrlCookie) {
        const cleanCookie = rawUrlCookie.trim().replace(/^sp_dc=/i, '');
        if (cleanCookie.startsWith('AQ') && cleanCookie.length >= 50) {
          window.localStorage.setItem('user_spotify_cookie', cleanCookie);
          window.localStorage.removeItem('spotify_extracted_session');
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }

      if (error) {
        console.error('Spotify OAuth error in callback:', error);
        window.history.replaceState({}, document.title, '/');
      } else if (code) {
        console.log('Detected Spotify authorization code, exchanging token...');
        const success = await handleSpotifyCallback(code);
        window.history.replaceState({}, document.title, '/');
        if (success) {
          console.log('Spotify token exchanged successfully, refreshing real user profile & playlists...');
          await get().refreshData();
          return;
        } else {
          console.error('Failed to exchange Spotify authorization code for access token.');
        }
      }

      // 2. Prioritize active user OAuth session if logged in
      const oauthToken = typeof window !== 'undefined' ? window.localStorage.getItem('spotify_access_token') : null;
      if (oauthToken && oauthToken !== 'session-bridge-active') {
        await get().refreshData();
        return;
      }

      // 2b. Check for validated cookie session
      const userCookie = typeof window !== 'undefined' ? window.localStorage.getItem('user_spotify_cookie') : null;
      const rawImported = typeof window !== 'undefined' ? window.localStorage.getItem('user_imported_playlists') : null;
      let importedPlaylists: Playlist[] = [];
      if (rawImported) {
        try {
          importedPlaylists = JSON.parse(rawImported);
        } catch {}
      }

      if (userCookie && validateSpotifyCookie(userCookie).valid) {
        let session = null;
        const savedSessionRaw = typeof window !== 'undefined' ? window.localStorage.getItem('spotify_extracted_session') : null;
        if (savedSessionRaw) {
          try {
            session = JSON.parse(savedSessionRaw);
            if (session._cookie && session._cookie !== userCookie) {
              session = null;
            }
          } catch {}
        }
        if (!session || !session.user || !session.playlists || session.playlists.length === 0) {
          try {
            session = await extractSpotifySessionFromCookie(userCookie);
            if (typeof window !== 'undefined') {
              window.localStorage.setItem('spotify_extracted_session', JSON.stringify({ ...session, _cookie: userCookie }));
              if (session.user?.id) {
                window.localStorage.setItem('spotifree_active_user_id', session.user.id);
              }
              if (session.accessToken) {
                window.localStorage.setItem('spotify_access_token', session.accessToken);
              }
            }
          } catch (e) {
            console.error('Failed to extract session from cookie:', e);
          }
        } else if (session && session.accessToken && typeof window !== 'undefined') {
          if (!window.localStorage.getItem('spotify_access_token')) {
            window.localStorage.setItem('spotify_access_token', session.accessToken);
          }
        }

        if (session && session.user && session.playlists) {
          if (typeof window !== 'undefined' && session.user.id) {
            window.localStorage.setItem('spotifree_active_user_id', session.user.id);
          }
          const combinedPlaylists = [...(session.playlists || []), ...importedPlaylists];
          const uniquePlaylists = combinedPlaylists.filter(
            (p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx
          );

          set({
            isAuthenticated: true,
            user: session.user,
            playlists: uniquePlaylists,
            dynamicShelves: session.shelves || [],
            quickAccessCards: session.quickAccess || [],
            isLoading: false,
          });
          return;
        }
      }

      if (importedPlaylists && importedPlaylists.length > 0) {
        const guestUser: UserProfile = {
          id: 'spotify-user',
          display_name: 'Invitado',
          images: [],
          email: '',
        } as any;

        const shelves = buildDynamicShelves(
          guestUser,
          importedPlaylists,
          'Tus listas importadas',
          [],
          []
        );

        set({
          isAuthenticated: true,
          user: guestUser,
          playlists: importedPlaylists,
          dynamicShelves: shelves,
          quickAccessCards: importedPlaylists.slice(0, 4).map((p) => ({
            id: p.id,
            name: p.name,
            image: p.images?.[0]?.url || '',
            color: (p as any).color || '#303030',
          })),
          isLoading: false,
        });
        return;
      }

      // 3. Fallback: Check if user explicitly logged out
      const wasLoggedOut = typeof window !== 'undefined' && window.localStorage.getItem('spotify_logged_out') === 'true';
      if (wasLoggedOut) {
        set({
          isAuthenticated: false,
          user: null,
          playlists: [],
          dynamicShelves: [],
          quickAccessCards: [],
          isLoading: false,
        });
        return;
      }

      // Default active pre-seeded session for Jorge
      set({
        isAuthenticated: true,
        user: DEFAULT_SESSION_USER,
        playlists: DEFAULT_SESSION_PLAYLISTS,
        dynamicShelves: buildDynamicShelves(DEFAULT_SESSION_USER, DEFAULT_SESSION_PLAYLISTS, 'Novedades para ti'),
        quickAccessCards: DEFAULT_SESSION_QUICK_ACCESS,
        playlistDetailsCache: DEFAULT_SESSION_CACHE,
        isLoading: false,
      });
    } finally {
      isInitializing = false;
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
      window.localStorage.removeItem('spotify_access_token');
      window.localStorage.removeItem('spotify_refresh_token');
      window.localStorage.removeItem('spotify_expires_at');
      window.localStorage.removeItem('spotify_session_synced');
      window.localStorage.removeItem('user_spotify_cookie');
      window.localStorage.removeItem('user_imported_playlists');
      window.localStorage.removeItem('spotify_extracted_session');
      window.localStorage.removeItem('spotifree_active_user_id');
      window.localStorage.setItem('spotify_logged_out', 'true');
      window.sessionStorage.removeItem('spotify_403_premium');
    }
    set({
      isAuthenticated: false,
      user: null,
      playlists: [],
      dynamicShelves: [],
      authWarning: null,
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
        dynamicShelves: [],
        isLoading: false,
      });
      return;
    }

    set({ isLoading: true });
    try {
      const [user, playlists, top] = await Promise.all([
        fetchCurrentUser(),
        fetchUserPlaylists(),
        fetchTopTracks(),
      ]);

      if (!user) {
        // If Spotify token was issued but Spotify API returned 403 (Developer Premium requirement)
        const premiumBlocked = typeof window !== 'undefined' && window.sessionStorage.getItem('spotify_403_premium');
        if (premiumBlocked) {
          console.warn('Spotify 403 notice detected. Preserving authenticated session for user.');
          const fallbackUser: UserProfile = {
            id: 'spotify-user',
            display_name: 'Cuenta de Spotify',
            images: [],
            email: '',
          } as any;

          const fallbackShelves = buildDynamicShelves(
            fallbackUser,
            DEFAULT_PUBLIC_PLAYLISTS,
            'Hecho para ti',
            [],
            []
          );

          set({
            isAuthenticated: true,
            user: fallbackUser,
            playlists: DEFAULT_PUBLIC_PLAYLISTS,
            topTracks: [],
            dynamicShelves: fallbackShelves,
            authWarning: 'Active premium subscription required for the owner of the app',
            isLoading: false,
          });
          return;
        }

        console.warn('Spotify session token is invalid or expired');
        logoutSpotify();
        set({
          isAuthenticated: false,
          user: null,
          playlists: [],
          dynamicShelves: [],
          authWarning: null,
          isLoading: false,
        });
        return;
      }

      const userPlaylists = playlists || [];
      const shelves = buildDynamicShelves(
        user,
        userPlaylists,
        `Hecho para ${user.display_name}`,
        [],
        top || []
      );

      set({
        isAuthenticated: true,
        user,
        playlists: userPlaylists,
        topTracks: top || [],
        dynamicShelves: shelves,
        authWarning: null,
        featuredMessage: `Hecho para ${user.display_name}`,
        isLoading: false,
      });
    } catch (err) {
      console.error('Error refreshing Spotify data:', err);
      logoutSpotify();
      set({
        isAuthenticated: false,
        user: null,
        playlists: [],
        dynamicShelves: [],
        isLoading: false,
      });
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

