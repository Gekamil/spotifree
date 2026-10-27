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

export const DEFAULT_PUBLIC_SHELVES: DynamicShelf[] = [
  {
    id: 'shelf-editorial',
    type: 'featured',
    title: 'Novedades populares',
    subtitle: 'Novedades y lanzamientos seleccionados',
    cards: [
      { id: '37i9dQZF1DWZdsS73T1ogG', title: 'el nuevo urbano', subtitle: 'Lo más nuevo de la música urbana.', image: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426' },
      { id: '37i9dQZF1DX2EiUAL7Wdfc', title: 'míticas', subtitle: 'Canciones que nunca pasarán de moda.', image: 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6' },
      { id: '37i9dQZF1DXcBWIGoYBM5M', title: 'Éxitos España', subtitle: 'Los éxitos más escuchados ahora mismo.', image: 'https://i.scdn.co/image/ab67706f00000002e8ccdd567fff6a597b87586b' },
      { id: '4f0YTBqSbvM1iJpuY9r3yQ', title: 'ZIZI', subtitle: 'Música pop y urbana destacada.', image: 'https://i.scdn.co/image/ab67616d0000b273eb31ebdbca6acd99c23b4d31' },
      { id: '37i9dQZEVXbNFJfN1Vw8d9', title: 'Top 50: España', subtitle: 'Tu actualización diaria de los temas más reproducidos.', image: 'https://charts-images.scdn.co/assets/locale_en/regional/daily/region_es_large.jpg' },
      { id: '7b3MrCWtettvBKlfBSdorn', title: 'J+L(2026)', subtitle: 'Selección de éxitos contemporáneos.', image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c804d43e5cc7f6a6d0ac65ffc' },
    ],
    hasSeeAll: true,
  },
  {
    id: 'shelf-popular-mixes',
    type: 'mixes',
    title: 'Mixes y listas recomendadas',
    subtitle: 'Música organizada por tus géneros favoritos',
    cards: [
      { id: '37i9dQZF1EQncLwOalG3K7', title: 'Pop con Ñ', subtitle: 'El pop en español más fresco y actual.', image: 'https://i.scdn.co/image/ab67706f000000020ad613a778fc3ef5c91f54cf' },
      { id: '37i9dQZF1DX10zKzsJ2jva', title: 'Viva Latino', subtitle: 'El corazón de la música latina.', image: 'https://i.scdn.co/image/ab67706f00000002f232ffabeb0f993f45f20f06' },
      { id: '37i9dQZF1DX0XUsuxWHRQd', title: 'RapCaviar', subtitle: 'Nuevos lanzamientos urbanos.', image: 'https://i.scdn.co/image/ab67706f0000000259dc23c89658db41e7f353eb' },
      { id: '37i9dQZF1DX4JAvHpjipBk', title: 'New Music Friday', subtitle: 'Los mejores estrenos de la semana.', image: 'https://i.scdn.co/image/ab67706f000000020fe6127163cb15bf8bfd7df3' },
      { id: '37i9dQZF1DX4sWSpwq3LiO', title: 'Peaceful Piano', subtitle: 'Piano instrumental relajante.', image: 'https://i.scdn.co/image/ab67706f00000002d073e6f3e5cbd79eed7439e2' },
      { id: '37i9dQZF1DWXRqgorJj26U', title: 'Rock Classics', subtitle: 'Grandes leyendas y clásicos del rock.', image: 'https://i.scdn.co/image/ab67706f00000002b0e6e76cf0d4948a3952f481' },
    ],
    hasSeeAll: true,
  },
];

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
  featuredMessage: string | null,
  featuredPlaylists: any[] = [],
  topTracks: Track[] = [],
  topArtists: any[] = [],
  recentlyPlayed: any[] = []
): DynamicShelf[] {
  if (!user && playlists.length === 0) return DEFAULT_PUBLIC_SHELVES;

  const effectivePlaylists = playlists && playlists.length > 0 ? playlists : DEFAULT_PUBLIC_PLAYLISTS;
  const displayName = user?.display_name || 'ti';
  const editorialTitle =
    featuredMessage ||
    (new Date().getDay() === 5 ? '¡Hoy es viernes de novedades!' : 'Novedades populares');

  // Shelf 1: Editorial Featured (Priority 1)
  const editorialPool =
    featuredPlaylists.length > 0
      ? featuredPlaylists
      : effectivePlaylists.filter(
          (p) =>
            p.id.includes('novedades') ||
            p.id.includes('radar') ||
            p.name.toLowerCase().includes('novedades') ||
            p.name.toLowerCase().includes('radar')
        );

  const getFallbackImage = (item: Playlist) => {
    if (item.id === 'liked-songs' || item.id === 'collection-tracks' || item.name?.toLowerCase().trim() === 'canciones que te gustan') {
      return 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';
    }
    return item.images?.[0]?.url || '';
  };

  const editorialCards: DynamicShelfCard[] = (
    editorialPool.length > 0 ? editorialPool : effectivePlaylists.slice(0, 6)
  ).map((item, idx) => ({
    id: item.id || `feat-${idx}`,
    title: item.name,
    subtitle: item.description || 'De Spotify',
    image: getFallbackImage(item),
  }));

  // Shelf 2: Made for user (Priority 2) - Derived dynamically from live playlists
  const dailyMixes = effectivePlaylists.filter((p) =>
    /mix diario|daily mix|discover|radar/i.test(p.name)
  );
  const userPlaylists = effectivePlaylists.filter(
    (p) =>
      p.owner?.display_name === displayName ||
      p.owner?.id === user?.id ||
      /mix|favorit|canciones/i.test(p.name)
  );
  const madeForPool = dailyMixes.length >= 2 ? dailyMixes : userPlaylists.length > 0 ? userPlaylists : effectivePlaylists;

  const badgeColors = ['#00F0FF', '#FFA42B', '#FF6437', '#1ED760', '#B02897', '#509BF5'];
  const madeForCards: DynamicShelfCard[] = madeForPool.slice(0, 6).map((p, idx) => {
    const matchDaily = p.name.match(/Mix diario \d/i);
    return {
      id: p.id || `made-for-${idx}`,
      title: p.name,
      subtitle: p.description || `Mix personalizado para ${displayName}`,
      image: getFallbackImage(p),
      badge: matchDaily ? matchDaily[0] : undefined,
      badgeColor: matchDaily ? badgeColors[idx % badgeColors.length] : undefined,
    };
  });

  // Shelf 3: Recientes (Priority 3) - Derived from recentlyPlayed or playlists order
  const recentCards: DynamicShelfCard[] = (
    recentlyPlayed.length > 0 ? recentlyPlayed : effectivePlaylists
  ).slice(0, 8).map((p, idx) => ({
    id: p.id || `recent-${idx}`,
    title: p.name,
    subtitle: p.description || 'De tu biblioteca',
    image: getFallbackImage(p),
  }));

  // Shelf 4: Más como {topArtist} (Priority 4) - Dynamically derived artist affinity
  const artistFromTop = topArtists[0]?.name;
  const artistFromTracks = topTracks[0]?.artists?.[0]?.name;
  const artistFromPlaylists = effectivePlaylists
    .find((p) => /mix de|radio de|radio/i.test(p.name) || p.name.includes('&'))
    ?.name.replace(/^(mix de|radio de|radio)\s+/i, '')
    .split('&')[0]
    ?.trim();

  const topArtistName = artistFromTop || artistFromTracks || artistFromPlaylists || 'Romeo Santos';

  const artistPool = effectivePlaylists.filter(
    (p) =>
      p.name.toLowerCase().includes(topArtistName.toLowerCase()) ||
      p.description?.toLowerCase().includes(topArtistName.toLowerCase()) ||
      /radio|artista/i.test(p.name)
  );

  const artistCards: DynamicShelfCard[] = (
    artistPool.length >= 2 ? artistPool : effectivePlaylists.slice(2, 6)
  ).map((p, idx) => ({
    id: p.id || `artist-${idx}`,
    title: p.name,
    subtitle: p.description || `Con ${topArtistName} y artistas similares`,
    image: getFallbackImage(p),
  }));

  // Shelf 5: Mixes (Priority 5) - Dynamically derived genre mixes
  const genreMixPool = effectivePlaylists.filter((p) =>
    /mix|urbano|pop|latino|bachata|flamenco|reggaeton|rock|relajante/i.test(p.name)
  );
  const mixesPool = genreMixPool.length >= 3 ? genreMixPool : effectivePlaylists.slice(4, 10);

  const mixesCards: DynamicShelfCard[] = mixesPool.map((p, idx) => ({
    id: p.id || `mix-${idx}`,
    title: p.name,
    subtitle: p.description || 'Música organizada por tus géneros favoritos',
    image: getFallbackImage(p),
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
  isAuthenticated: false,
  isLoading: false,
  user: null,
  authWarning: null,
  playlists: DEFAULT_PUBLIC_PLAYLISTS,
  categories: [],
  featuredPlaylists: [],
  featuredMessage: 'Novedades populares',
  newReleases: [],
  topTracks: [],
  topArtists: [],
  recentlyPlayed: [],
  dynamicShelves: DEFAULT_PUBLIC_SHELVES,
  quickAccessCards: DEFAULT_PUBLIC_PLAYLISTS.slice(0, 4).map((p) => ({
    id: p.id,
    name: p.name,
    image: p.images[0].url,
    color: (p as any).color || '#303030',
  })),
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
          } catch {}
        }
        if (!session || !session.user || !session.playlists || session.playlists.length === 0) {
          try {
            session = await extractSpotifySessionFromCookie(userCookie);
            if (typeof window !== 'undefined') {
              window.localStorage.setItem('spotify_extracted_session', JSON.stringify(session));
            }
          } catch (e) {
            console.error('Failed to extract session from cookie:', e);
          }
        }

        if (session && session.user && session.playlists) {
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

      // 3. Unauthenticated guest: Show gray shimmer view
      set({
        isAuthenticated: false,
        user: null,
        playlists: [],
        dynamicShelves: [],
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

