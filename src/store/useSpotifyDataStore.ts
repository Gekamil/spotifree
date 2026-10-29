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
import { saveAccount, getSavedAccounts, cleanSpDc } from '../utils/userAccounts';
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
    set((s) => {
      const nextCache = {
        ...s.playlistDetailsCache,
        [playlist.id]: playlist,
      };
      if (typeof window !== 'undefined') {
        try {
          const userId = s.user?.id || 'active';
          window.localStorage.setItem(`spotifree_playlist_cache_${userId}`, JSON.stringify(nextCache));
        } catch {}
      }
      return {
        playlistDetailsCache: nextCache,
        playlists: s.playlists.map((p) => (p.id === playlist.id ? { ...p, tracks: playlist.tracks } : p)),
      };
    });
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
        const cleanCookie = cleanSpDc(rawUrlCookie);
        if (cleanCookie.startsWith('AQ') && cleanCookie.length >= 30) {
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

      // 2. Prioritize active validated cookie session if present
      let userCookie = typeof window !== 'undefined' ? window.localStorage.getItem('user_spotify_cookie') : null;
      if (!userCookie) {
        const savedAccounts = getSavedAccounts();
        if (savedAccounts.length > 0 && savedAccounts[0].cookie) {
          userCookie = savedAccounts[0].cookie;
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('user_spotify_cookie', userCookie);
          }
        }
      }

      const rawImported = typeof window !== 'undefined' ? window.localStorage.getItem('user_imported_playlists') : null;
      let importedPlaylists: Playlist[] = [];
      if (rawImported) {
        try {
          importedPlaylists = JSON.parse(rawImported);
        } catch {}
      }

      if (userCookie && validateSpotifyCookie(userCookie).valid) {
        const cleanCookie = cleanSpDc(userCookie);
        let session = null;
        const savedSessionRaw = typeof window !== 'undefined' ? window.localStorage.getItem('spotify_extracted_session') : null;
        if (savedSessionRaw) {
          try {
            session = JSON.parse(savedSessionRaw);
            if (session._cookie && cleanSpDc(session._cookie) !== cleanCookie) {
              session = null;
            }
          } catch {}
        }

        // Load cached playlist tracks
        let cachedPlaylists: Record<string, Playlist> = {};
        const userId = session?.user?.id || (typeof window !== 'undefined' ? window.localStorage.getItem('spotifree_active_user_id') : 'active') || 'active';
        if (typeof window !== 'undefined') {
          try {
            const rawCache = window.localStorage.getItem(`spotifree_playlist_cache_${userId}`) ||
                             window.localStorage.getItem('spotifree_playlist_cache_active');
            if (rawCache) cachedPlaylists = JSON.parse(rawCache);
          } catch {}
        }

        // If session was already cached, restore immediately so reload is instantaneous
        if (session && session.user) {
          if (session.playlists && Array.isArray(session.playlists)) {
            session.playlists.forEach((p: Playlist) => {
              if (p?.id && !cachedPlaylists[p.id]) {
                cachedPlaylists[p.id] = p;
              }
            });
          }
          if (session.cachedPlaylistDetails) {
            Object.assign(cachedPlaylists, session.cachedPlaylistDetails);
          }
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem(`spotifree_playlist_cache_${userId}`, JSON.stringify(cachedPlaylists));
              window.localStorage.setItem('spotifree_playlist_cache_active', JSON.stringify(cachedPlaylists));
            } catch {}
          }

          const combinedPlaylists = [...(session.playlists || []), ...importedPlaylists];
          const uniquePlaylists = combinedPlaylists.filter(
            (p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx
          ).map((p: Playlist) => {
            if (cachedPlaylists[p.id]?.tracks?.items?.length) {
              return { ...p, tracks: cachedPlaylists[p.id].tracks };
            }
            return p;
          });

          set({
            isAuthenticated: true,
            user: session.user,
            playlists: uniquePlaylists,
            dynamicShelves: session.shelves || [],
            quickAccessCards: session.quickAccess || [],
            playlistDetailsCache: cachedPlaylists,
            isLoading: false,
          });

          // In background, refresh session data if playlists were empty
          if (!session.playlists || session.playlists.length === 0) {
            extractSpotifySessionFromCookie(userCookie).then((fresh) => {
              if (fresh && fresh.user) {
                window.localStorage.setItem('spotify_extracted_session', JSON.stringify({ ...fresh, _cookie: userCookie }));
                set({
                  playlists: fresh.playlists || [],
                  dynamicShelves: fresh.shelves || [],
                  quickAccessCards: fresh.quickAccess || [],
                });
              }
            }).catch(() => {});
          }
          return;
        }

        // If no cached session, extract from cookie
        try {
          session = await extractSpotifySessionFromCookie(userCookie);
          if (typeof window !== 'undefined' && session) {
            window.localStorage.setItem('spotify_extracted_session', JSON.stringify({ ...session, _cookie: userCookie }));
            if (session.user?.id) {
              window.localStorage.setItem('spotifree_active_user_id', session.user.id);
            }
          }
        } catch (e) {
          console.error('Failed to extract session from cookie:', e);
        }

        if (session && session.user) {
          const freshUserId = session.user.id || 'active';
          if (typeof window !== 'undefined' && session.user.id) {
            window.localStorage.setItem('spotifree_active_user_id', session.user.id);
          }

          if (session.playlists && Array.isArray(session.playlists)) {
            session.playlists.forEach((p: Playlist) => {
              if (p?.id) cachedPlaylists[p.id] = p;
            });
          }
          if (session.cachedPlaylistDetails) {
            Object.assign(cachedPlaylists, session.cachedPlaylistDetails);
          }
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem(`spotifree_playlist_cache_${freshUserId}`, JSON.stringify(cachedPlaylists));
              window.localStorage.setItem('spotifree_playlist_cache_active', JSON.stringify(cachedPlaylists));
            } catch {}
          }

          saveAccount({
            id: session.user.id || `user-${Date.now()}`,
            displayName: session.user.display_name || 'Usuario Spotify',
            email: session.user.email,
            avatarUrl: session.user.images?.[0]?.url,
            cookie: userCookie,
            accessToken: session.accessToken,
            lastUsed: Date.now(),
          });

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
            playlistDetailsCache: cachedPlaylists,
            isLoading: false,
          });
          return;
        }
      }

      // 3. If NO cookie session, check for OAuth token
      const oauthToken = typeof window !== 'undefined' ? window.localStorage.getItem('spotify_access_token') : null;
      if (oauthToken && oauthToken !== 'session-bridge-active') {
        await get().refreshData();
        return;
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

      // 4. Default: User has no active session -> Unauthenticated clean state
      set({
        isAuthenticated: false,
        user: null,
        playlists: [],
        dynamicShelves: [],
        quickAccessCards: [],
        playlistDetailsCache: {},
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
        // Spotify token was issued, but Spotify Web API returned 403 (Developer Mode limitation)
        // Preserve the authenticated session so the user stays logged in!
        console.warn('Spotify /v1/me returned 403; preserving active session for authorized user.');
        
        const oauthUser: UserProfile = {
          id: 'spotify-oauth-user',
          display_name: 'Cuenta de Spotify',
          email: '',
          images: [],
          followers: { total: 0 },
        };

        if (typeof window !== 'undefined') {
          window.localStorage.setItem('spotifree_active_user_id', 'spotify-oauth-user');
          window.localStorage.removeItem('spotify_logged_out');
        }

        saveAccount({
          id: 'spotify-oauth-user',
          displayName: 'Cuenta de Spotify',
          email: '',
          cookie: '',
          accessToken: userToken,
          lastUsed: Date.now(),
        });

        set({
          isAuthenticated: true,
          user: oauthUser,
          playlists: playlists || [],
          topTracks: top || [],
          dynamicShelves: [],
          quickAccessCards: [],
          authWarning: null,
          featuredMessage: 'Cuenta de Spotify conectada',
          isLoading: false,
        });
        return;
      }

      const userPlaylists = playlists || [];

      if (typeof window !== 'undefined' && user.id) {
        window.localStorage.setItem('spotifree_active_user_id', user.id);
      }

      saveAccount({
        id: user.id || `user-${Date.now()}`,
        displayName: user.display_name || 'Usuario Spotify',
        email: user.email,
        avatarUrl: user.images?.[0]?.url,
        cookie: (typeof window !== 'undefined' && window.localStorage.getItem('user_spotify_cookie')) || '',
        accessToken: userToken,
        lastUsed: Date.now(),
      });
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

export async function switchActiveAccount(account: import('../utils/userAccounts').SavedAccount): Promise<void> {
  if (typeof window === 'undefined') return;

  const updatedAccount = { ...account, lastUsed: Date.now() };
  saveAccount(updatedAccount);

  window.localStorage.setItem('spotifree_active_user_id', account.id);
  window.localStorage.setItem('user_spotify_cookie', account.cookie || '');
  window.localStorage.removeItem('spotify_logged_out');

  let cachedAccountSession: any = null;
  try {
    const raw = window.localStorage.getItem(`spotifree_account_session_${account.id}`);
    if (raw) cachedAccountSession = JSON.parse(raw);
  } catch {}

  let customProfile: any = null;
  try {
    const rawCp = window.localStorage.getItem(`spotifree_custom_profile_${account.id}`);
    if (rawCp) customProfile = JSON.parse(rawCp);
  } catch {}

  const activeAvatar = customProfile?.avatarUrl || account.avatarUrl;
  const activeDisplayName = customProfile?.displayName || account.displayName;
  const activeBanner = customProfile?.bannerUrl || account.bannerUrl;

  let cachedPlaylists: Record<string, any> = {};
  try {
    const rawPl = window.localStorage.getItem(`spotifree_playlist_cache_${account.id}`);
    if (rawPl) cachedPlaylists = JSON.parse(rawPl);
  } catch {}

  const targetUser: UserProfile = {
    ...(cachedAccountSession?.user || {}),
    id: account.id,
    display_name: activeDisplayName || cachedAccountSession?.user?.display_name || 'Usuario Spotify',
    images: activeAvatar ? [{ url: activeAvatar }] : (cachedAccountSession?.user?.images || []),
    email: account.email || cachedAccountSession?.user?.email || '',
    followers: cachedAccountSession?.user?.followers || { total: 0 },
    bannerUrl: activeBanner,
  } as any;

  const initialPlaylists = cachedAccountSession?.playlists || [];
  const initialShelves = cachedAccountSession?.shelves || buildDynamicShelves(targetUser, initialPlaylists, 'Recomendado para ti');
  const initialQuickAccess = cachedAccountSession?.quickAccess || [];

  useSpotifyDataStore.setState({
    isAuthenticated: true,
    user: targetUser,
    playlists: initialPlaylists,
    dynamicShelves: initialShelves,
    quickAccessCards: initialQuickAccess,
    playlistDetailsCache: cachedPlaylists,
    isLoading: false,
  });

  if (account.cookie && account.cookie.trim().startsWith('AQ')) {
    try {
      const res = await fetch('/api/extract-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: account.cookie }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.user) {
          const cacheToSave: Record<string, any> = { ...cachedPlaylists };
          if (data.playlists && Array.isArray(data.playlists)) {
            data.playlists.forEach((p: any) => {
              if (p?.id) cacheToSave[p.id] = p;
            });
          }
          if (data.cachedPlaylistDetails) {
            Object.assign(cacheToSave, data.cachedPlaylistDetails);
          }

          window.localStorage.setItem(`spotifree_account_session_${account.id}`, JSON.stringify(data));
          window.localStorage.setItem(`spotifree_playlist_cache_${account.id}`, JSON.stringify(cacheToSave));
          window.localStorage.setItem('spotify_extracted_session', JSON.stringify({ ...data, _cookie: account.cookie }));
          window.localStorage.setItem('spotifree_playlist_cache_active', JSON.stringify(cacheToSave));

          saveAccount({
            ...updatedAccount,
            displayName: data.user.display_name || updatedAccount.displayName,
            avatarUrl: data.user.images?.[0]?.url || updatedAccount.avatarUrl,
            lastUsed: Date.now(),
          });

          useSpotifyDataStore.setState({
            isAuthenticated: true,
            user: data.user,
            playlists: data.playlists || [],
            dynamicShelves: data.shelves || [],
            quickAccessCards: data.quickAccess || [],
            playlistDetailsCache: cacheToSave,
            isLoading: false,
          });
        }
      }
    } catch (e) {
      console.warn('[AccountSwitch] Error updating account from cookie in background:', e);
    }
  }
}

