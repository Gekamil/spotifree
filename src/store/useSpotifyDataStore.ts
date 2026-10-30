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
import {
  cleanSpDc,
  fetchUserProfileFromServer,
} from '../utils/userAccounts';
import { useStatsStore } from './useStatsStore';
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

export function deduplicateUserPlaylists(list: Playlist[]): Playlist[] {
  let seenLiked = false;
  const result: Playlist[] = [];
  const seenIds = new Set<string>();

  for (const pl of list) {
    if (!pl || !pl.id) continue;
    const isLiked =
      pl.id === 'liked-songs' ||
      pl.id.includes('collection:tracks') ||
      pl.id.includes('collection-tracks') ||
      pl.name?.toLowerCase().trim() === 'canciones que te gustan' ||
      pl.name?.toLowerCase().trim() === 'liked songs';

    if (isLiked) {
      if (seenLiked) continue;
      seenLiked = true;
      result.push({
        ...pl,
        id: 'liked-songs',
        name: 'Canciones que te gustan',
        images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
      });
      seenIds.add('liked-songs');
      continue;
    }

    if (seenIds.has(pl.id)) continue;
    seenIds.add(pl.id);
    result.push(pl);
  }
  return result;
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

function getInitialSession(): { user: UserProfile | null; isAuthenticated: boolean } {
  if (typeof window !== 'undefined') {
    try {
      const rawCloud = window.localStorage.getItem('spotifree_current_cloud_account');
      if (rawCloud) {
        const cloud = JSON.parse(rawCloud);
        if (cloud && (cloud.email || cloud.displayName)) {
          return {
            user: {
              id: cloud.uid || 'spotifree-user',
              display_name: cloud.displayName || cloud.email?.split('@')[0] || 'Usuario',
              email: cloud.email || '',
              images: cloud.avatarUrl ? [{ url: cloud.avatarUrl }] : [],
              followers: { total: 0 },
            } as any,
            isAuthenticated: true,
          };
        }
      }
      if (window.localStorage.getItem('spotify_logged_out') === 'true') {
        return { user: null, isAuthenticated: false };
      }
    } catch {}
  }
  return { user: DEFAULT_SESSION_USER, isAuthenticated: true };
}

const initialSession = getInitialSession();

const store = create<SpotifyDataState>((set, get) => ({
  isAuthenticated: initialSession.isAuthenticated,
  isLoading: false,
  user: initialSession.user,
  authWarning: null,
  playlists: DEFAULT_SESSION_PLAYLISTS,
  categories: [],
  featuredPlaylists: [],
  featuredMessage: 'Novedades populares',
  newReleases: [],
  topTracks: [],
  topArtists: [],
  recentlyPlayed: [],
  dynamicShelves: buildDynamicShelves(initialSession.user || DEFAULT_SESSION_USER, DEFAULT_SESSION_PLAYLISTS, 'Novedades para ti'),
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

    const updated = deduplicateUserPlaylists([newPlaylist, ...s.playlists]);

    if (typeof window !== 'undefined') {
      try {
        const rawImported = window.localStorage.getItem('user_imported_playlists');
        const list = rawImported ? JSON.parse(rawImported) : [];
        window.localStorage.setItem('user_imported_playlists', JSON.stringify([newPlaylist, ...list]));

        import('../services/spotifreeAuth').then(({ syncSpotifreeAccount }) => {
          syncSpotifreeAccount({ playlists: updated }).catch(() => {});
        });
      } catch {}
    }

    set((state) => ({
      playlists: updated,
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

      const updatedPlaylists = s.playlists.map((p) => (p.id === id ? { ...p, ...updates } : p));

      if (typeof window !== 'undefined') {
        try {
          const rawImported = window.localStorage.getItem('user_imported_playlists');
          if (rawImported) {
            const list = JSON.parse(rawImported);
            const nextList = list.map((p: any) => p.id === id ? { ...p, ...updates } : p);
            window.localStorage.setItem('user_imported_playlists', JSON.stringify(nextList));
          }
          const userId = window.localStorage.getItem('spotifree_active_user_id') || 'active';
          if (updatedCacheEntry) {
            const rawCache = window.localStorage.getItem(`spotifree_playlist_cache_${userId}`);
            const cacheObj = rawCache ? JSON.parse(rawCache) : {};
            cacheObj[id] = updatedCacheEntry;
            window.localStorage.setItem(`spotifree_playlist_cache_${userId}`, JSON.stringify(cacheObj));
            window.localStorage.setItem('spotifree_playlist_cache_active', JSON.stringify(cacheObj));
          }

          import('../services/spotifreeAuth').then(({ syncSpotifreeAccount }) => {
            syncSpotifreeAccount({ playlists: updatedPlaylists }).catch(() => {});
          });
        } catch {}
      }

      return {
        playlists: updatedPlaylists,
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
      const remainingPlaylists = s.playlists.filter((p) => p.id !== id);
      const newCache = { ...s.playlistDetailsCache };
      delete newCache[id];

      if (typeof window !== 'undefined') {
        try {
          // 1. Remove from user_imported_playlists
          const rawImported = window.localStorage.getItem('user_imported_playlists');
          if (rawImported) {
            const list = JSON.parse(rawImported);
            const updated = list.filter((p: any) => p.id !== id);
            window.localStorage.setItem('user_imported_playlists', JSON.stringify(updated));
          }
          // 2. Remove from spotifree_saved_library_playlists
          const rawSaved = window.localStorage.getItem('spotifree_saved_library_playlists');
          if (rawSaved) {
            const list = JSON.parse(rawSaved);
            const updated = list.filter((pId: string) => pId !== id);
            window.localStorage.setItem('spotifree_saved_library_playlists', JSON.stringify(updated));
          }
          // 3. Remove from user caches and sessions
          const userId = window.localStorage.getItem('spotifree_active_user_id') || 'active';
          window.localStorage.setItem(`spotifree_playlist_cache_${userId}`, JSON.stringify(newCache));
          window.localStorage.setItem('spotifree_playlist_cache_active', JSON.stringify(newCache));

          const rawAccountSession = window.localStorage.getItem(`spotifree_account_session_${userId}`);
          if (rawAccountSession) {
            const parsed = JSON.parse(rawAccountSession);
            parsed.playlists = remainingPlaylists;
            window.localStorage.setItem(`spotifree_account_session_${userId}`, JSON.stringify(parsed));
          }

          const rawExtracted = window.localStorage.getItem('spotify_extracted_session');
          if (rawExtracted) {
            const parsed = JSON.parse(rawExtracted);
            parsed.playlists = remainingPlaylists;
            window.localStorage.setItem('spotify_extracted_session', JSON.stringify(parsed));
          }

          // 4. Remove offline download files
          window.localStorage.removeItem(`spotifree_downloaded_${id}`);
          window.localStorage.removeItem(`spotifree_offline_playlist_${id}`);
          const rawDl = window.localStorage.getItem('spotifree_downloaded_playlists_list');
          if (rawDl) {
            const list = JSON.parse(rawDl).filter((x: string) => x !== id);
            window.localStorage.setItem('spotifree_downloaded_playlists_list', JSON.stringify(list));
          }

          // 5. Cloud sync to Spotifree account if logged in
          import('../services/spotifreeAuth').then(({ syncSpotifreeAccount }) => {
            syncSpotifreeAccount({ playlists: remainingPlaylists }).catch(() => {});
          });
        } catch (e) {
          console.error('Error deleting playlist from storage:', e);
        }
      }

      return {
        playlists: remainingPlaylists,
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

      // Prioritize active Cloud Account if present
      let cloudAcc: any = null;
      if (typeof window !== 'undefined') {
        try {
          const rawCloud = window.localStorage.getItem('spotifree_current_cloud_account');
          if (rawCloud) cloudAcc = JSON.parse(rawCloud);
        } catch {}
      }

      // 2. Prioritize active validated cookie session if present
      const isLoggedOut = typeof window !== 'undefined' && window.localStorage.getItem('spotify_logged_out') === 'true';
      let userCookie = typeof window !== 'undefined' ? window.localStorage.getItem('user_spotify_cookie') : null;
      if (!userCookie && cloudAcc?.spotifyCookie && !isLoggedOut) {
        userCookie = cloudAcc.spotifyCookie || null;
        if (typeof window !== 'undefined' && userCookie) {
          window.localStorage.setItem('user_spotify_cookie', userCookie);
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

          // Check cross-device synced custom profile
          try {
            const serverProfile = await fetchUserProfileFromServer({
              userId: session.user.id,
              displayName: session.user.display_name,
              cookie: userCookie,
            });
            if (serverProfile) {
              if (serverProfile.displayName) session.user.display_name = serverProfile.displayName;
              if (serverProfile.avatarUrl) session.user.images = [{ url: serverProfile.avatarUrl }];
              if (serverProfile.bannerUrl) (session.user as any).bannerUrl = serverProfile.bannerUrl;
            } else {
              const rawCp = window.localStorage.getItem(`spotifree_custom_profile_${session.user.id}`);
              if (rawCp) {
                const parsedCp = JSON.parse(rawCp);
                if (parsedCp.bannerUrl) (session.user as any).bannerUrl = parsedCp.bannerUrl;
                if (parsedCp.avatarUrl && (!session.user.images || session.user.images.length === 0)) {
                  session.user.images = [{ url: parsedCp.avatarUrl }];
                }
                if (parsedCp.displayName) session.user.display_name = parsedCp.displayName;
              }
            }
          } catch {}

          const combinedPlaylists = [...(session.playlists || []), ...importedPlaylists];
          const uniquePlaylists = combinedPlaylists.filter(
            (p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx
          ).map((p: Playlist) => {
            if (cachedPlaylists[p.id]?.tracks?.items?.length) {
              return { ...p, tracks: cachedPlaylists[p.id].tracks };
            }
            return p;
          });

          const activeUser = cloudAcc
            ? {
                id: cloudAcc.uid || session.user.id,
                display_name: cloudAcc.displayName || session.user.display_name,
                email: cloudAcc.email || session.user.email,
                images: cloudAcc.avatarUrl ? [{ url: cloudAcc.avatarUrl }] : session.user.images,
                followers: session.user.followers || { total: 0 },
              }
            : session.user;

          set({
            isAuthenticated: true,
            user: activeUser,
            playlists: uniquePlaylists,
            dynamicShelves: session.shelves || [],
            quickAccessCards: session.quickAccess || [],
            playlistDetailsCache: cachedPlaylists,
            isLoading: false,
          });

          // Pre-warm initial top tracks in the background so audio playback starts instantaneously
          const topCandidates = (uniquePlaylists[0]?.tracks?.items || DEFAULT_SESSION_PLAYLISTS[0]?.tracks?.items || []).slice(0, 6);
          if (topCandidates.length > 0) {
            import('../services/audioEngine').then(({ audioEngine }) => {
              audioEngine.warmupInitialTracks(topCandidates);
            }).catch(() => {});
          }

          // Load per-user stats so profile stats are isolated per account
          if (session.user?.id) {
            try { useStatsStore.getState().loadStatsForUser(session.user.id); } catch {}
          }

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

          // Check cross-device synced custom profile
          try {
            const serverProfile = await fetchUserProfileFromServer({
              userId: session.user.id,
              displayName: session.user.display_name,
              cookie: userCookie,
            });
            if (serverProfile) {
              if (serverProfile.displayName) session.user.display_name = serverProfile.displayName;
              if (serverProfile.avatarUrl) session.user.images = [{ url: serverProfile.avatarUrl }];
              if (serverProfile.bannerUrl) (session.user as any).bannerUrl = serverProfile.bannerUrl;
            } else {
              const rawCp = window.localStorage.getItem(`spotifree_custom_profile_${session.user.id}`);
              if (rawCp) {
                const parsedCp = JSON.parse(rawCp);
                if (parsedCp.bannerUrl) (session.user as any).bannerUrl = parsedCp.bannerUrl;
                if (parsedCp.avatarUrl && (!session.user.images || session.user.images.length === 0)) {
                  session.user.images = [{ url: parsedCp.avatarUrl }];
                }
                if (parsedCp.displayName) session.user.display_name = parsedCp.displayName;
              }
            }
          } catch {}



          const combinedPlaylists = [...(session.playlists || []), ...importedPlaylists];
          const uniquePlaylists = combinedPlaylists.filter(
            (p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx
          );

          const activeUser = cloudAcc
            ? {
                id: cloudAcc.uid || session.user.id,
                display_name: cloudAcc.displayName || session.user.display_name,
                email: cloudAcc.email || session.user.email,
                images: cloudAcc.avatarUrl ? [{ url: cloudAcc.avatarUrl }] : session.user.images,
                followers: session.user.followers || { total: 0 },
              }
            : session.user;

          set({
            isAuthenticated: true,
            user: activeUser,
            playlists: uniquePlaylists,
            dynamicShelves: session.shelves || [],
            quickAccessCards: session.quickAccess || [],
            playlistDetailsCache: cachedPlaylists,
            isLoading: false,
          });

          // Pre-warm initial top tracks in the background so audio playback starts instantaneously
          const topCandidates = (uniquePlaylists[0]?.tracks?.items || DEFAULT_SESSION_PLAYLISTS[0]?.tracks?.items || []).slice(0, 6);
          if (topCandidates.length > 0) {
            import('../services/audioEngine').then(({ audioEngine }) => {
              audioEngine.warmupInitialTracks(topCandidates);
            }).catch(() => {});
          }

          // Load per-user stats so profile stats are isolated per account
          if (session.user?.id) {
            try { useStatsStore.getState().loadStatsForUser(session.user.id); } catch {}
          }
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
      window.localStorage.removeItem('spotifree_current_cloud_account');
      window.localStorage.removeItem('spotifree_account');
      window.localStorage.removeItem('spotifree_saved_accounts');
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
    // Reset stats for logged-out state
    try { useStatsStore.getState().resetStats(); } catch {}
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
        // Spotify Web API token check didn't return a profile (Developer Mode or expired token)
        console.warn('Spotify /v1/me returned no user profile; checking for active Spotifree account.');
        
        const { getSavedSpotifreeAccount } = await import('../services/spotifreeAuth');
        const spotifreeAccount = getSavedSpotifreeAccount();

        if (spotifreeAccount) {
          const userId = spotifreeAccount.uid || spotifreeAccount.email || 'spotifree-user';
          const cloudUser: UserProfile = {
            id: userId,
            display_name: spotifreeAccount.displayName || 'Usuario Spotifree',
            email: spotifreeAccount.email || '',
            images: spotifreeAccount.avatarUrl ? [{ url: spotifreeAccount.avatarUrl }] : [],
            followers: { total: 0 },
          };

          if (typeof window !== 'undefined') {
            window.localStorage.setItem('spotifree_active_user_id', userId);
            window.localStorage.removeItem('spotify_logged_out');
          }

          set({
            isAuthenticated: true,
            user: cloudUser,
            playlists: playlists || [],
            topTracks: top || [],
            dynamicShelves: [],
            quickAccessCards: [],
            authWarning: null,
            featuredMessage: `Sesión activa: ${cloudUser.display_name}`,
            isLoading: false,
          });
          return;
        }

        // Clean stale token so it doesn't repeatedly attempt failed oauth
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('spotify_access_token');
        }

        set({
          isAuthenticated: false,
          user: null,
          playlists: [],
          isLoading: false,
        });
        return;
      }

      const userPlaylists = playlists || [];

      if (typeof window !== 'undefined' && user.id) {
        window.localStorage.setItem('spotifree_active_user_id', user.id);
      }


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

export async function switchActiveAccount(_account: any): Promise<void> {
  // Legacy account switcher deprecated - Firebase cloud auth is unified
}

