import { create } from 'zustand';
import { addToTrash, trashForCloud } from '../services/playlistTrash';
import { recordPlaylistVersion } from '../services/playlistVersions';
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
  EXPECTED_HOME_SECTION_LIMIT,
} from '../services/spotifyCookieService';
import {
  cleanSpDc,
  fetchUserProfileFromServer,
} from '../utils/userAccounts';
import { useStatsStore } from './useStatsStore';
import { stripHtml } from '../utils/formatters';
import { getCustomLikedSongs, getActiveUserId, removeCustomTrackFromStorage, getRemovedTrackIdsForPlaylist } from '../utils/userStorage';
import { deduplicateTracks } from '../utils/trackDeduplication';
import { getPlaylistCover } from '../utils/playlistCover';

export const SPOTIFY_DJ_COVER_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><defs><linearGradient id="djgrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%231ed760"/><stop offset="50%" stop-color="%2300f2fe"/><stop offset="100%" stop-color="%231ed760"/></linearGradient></defs><rect width="300" height="300" fill="%230c52cc"/><circle cx="150" cy="150" r="80" fill="none" stroke="url(%23djgrad)" stroke-width="22" stroke-linecap="round"/><text x="150" y="270" text-anchor="middle" fill="white" font-family="sans-serif" font-weight="900" font-size="26" letter-spacing="4">DJ</text></svg>';

export const SPOTIFY_DJ_PLAYLIST: Playlist = {
  id: 'spotify-dj',
  name: 'DJ',
  description: 'Tu DJ personal con IA • Hecho para ti',
  type: 'playlist',
  images: [{ url: SPOTIFY_DJ_COVER_IMAGE }],
  owner: { display_name: 'Spotify', id: 'spotify' },
  tracks: { total: 15, items: [] },
} as any;

export function getDeletedPlaylistIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem('spotifree_deleted_playlist_ids');
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

export function deduplicateUserPlaylists(list: Playlist[]): Playlist[] {
  const deletedIds = getDeletedPlaylistIds();
  let seenLiked = false;
  let seenDJ = false;
  const result: Playlist[] = [];
  const seenIds = new Set<string>();

  for (const pl of list) {
    if (!pl || !pl.id || deletedIds.has(pl.id)) continue;
    const isLiked =
      pl.id === 'liked-songs' ||
      pl.id === 'user-liked-songs' ||
      pl.id === 'tracks' ||
      pl.id.includes('collection:tracks') ||
      pl.id.includes('collection-tracks') ||
      /^(canciones que te gustan|canciones que me gustan|tus me gusta|liked songs|liked tracks|saved songs|saved tracks|favoritas|favorites|my favorites|favorite songs)$/i.test(
        (pl.name || '').trim()
      );

    if (isLiked) {
      if (seenLiked) {
        seenIds.add(pl.id);
        continue;
      }
      seenLiked = true;
      const customLiked = getCustomLikedSongs(getActiveUserId());
      const removedLiked = getRemovedTrackIdsForPlaylist('liked-songs');
      const baseTracks = (pl.tracks?.items || []).filter((t) => {
        const c = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
        return !removedLiked.has(t.id) && !removedLiked.has(c);
      });
      const mergedTracks = deduplicateTracks([...customLiked, ...baseTracks]);
      result.push({
        ...pl,
        id: 'liked-songs',
        name: 'Canciones que te gustan',
        images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
        tracks: {
          total: mergedTracks.length,
          items: mergedTracks,
        },
      });
      seenIds.add('liked-songs');
      seenIds.add(pl.id);
      continue;
    }

    const isDJ =
      pl.id === 'spotify-dj' ||
      pl.id === 'dj' ||
      (pl as any).is_dj === true ||
      pl.name?.toLowerCase().trim() === 'dj';

    if (isDJ) {
      if (seenDJ) {
        seenIds.add(pl.id);
        continue;
      }
      seenDJ = true;
      result.push(SPOTIFY_DJ_PLAYLIST);
      seenIds.add('spotify-dj');
      seenIds.add(pl.id);
      continue;
    }

    if (seenIds.has(pl.id)) continue;
    seenIds.add(pl.id);

    const removedTrackIds = getRemovedTrackIdsForPlaylist(pl.id);
    let finalPl = pl;
    if (pl.tracks?.items && removedTrackIds.size > 0) {
      const cleanItems = pl.tracks.items.filter((t) => {
        const c = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
        return !removedTrackIds.has(t.id) && !removedTrackIds.has(c);
      });
      finalPl = {
        ...pl,
        tracks: {
          total: cleanItems.length,
          items: cleanItems,
        },
      };
    }
    result.push(finalPl);
  }

  // Ensure Liked Songs is ALWAYS present at position 0
  if (!seenLiked) {
    const customLiked = getCustomLikedSongs(getActiveUserId());
    result.unshift({
      id: 'liked-songs',
      name: 'Canciones que te gustan',
      description: 'Tus canciones favoritas guardadas',
      type: 'playlist',
      images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
      owner: { display_name: 'Spotify', id: 'spotify' },
      tracks: { total: customLiked.length, items: customLiked },
    } as any);
    seenIds.add('liked-songs');
  }

  // Ensure single DJ playlist is always present in library right after Liked Songs
  if (!seenDJ) {
    result.splice(1, 0, SPOTIFY_DJ_PLAYLIST);
    seenIds.add('spotify-dj');
  }

  return result;
}

export const DEFAULT_SESSION_USER: UserProfile = {
  id: 'guest',
  display_name: 'Invitado',
  images: [],
  email: '',
  followers: { total: 0 },
};

export const DEFAULT_SESSION_PLAYLISTS: Playlist[] = [];
export const DEFAULT_SESSION_QUICK_ACCESS: Array<{ id: string; name: string; image: string; color: string }> = [];
export const DEFAULT_SESSION_CACHE: Record<string, Playlist> = {};

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
    id: 'shelf-popular-playlists',
    title: 'Éxitos y novedades',
    prefix: 'Listas populares',
    type: 'featured',
    hasSeeAll: true,
    cards: [
      {
        id: '37i9dQZF1DXcBWIGoYBM5M',
        title: 'Éxitos España',
        subtitle: 'Los temas más escuchados en España',
        image: 'https://i.scdn.co/image/ab67706f00000002e8ccdd567fff6a597b87586b',
      },
      {
        id: '37i9dQZF1DX10zKzsJ2jva',
        title: 'Viva Latino',
        subtitle: 'Los éxitos latinos que están marcando el ritmo',
        image: 'https://i.scdn.co/image/ab67706f00000002964880811c74069be12f02b5',
      },
      {
        id: '37i9dQZF1DWZdsS73T1ogG',
        title: 'el nuevo urbano',
        subtitle: 'Lo último de la música urbana y reggaeton',
        image: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426',
      },
      {
        id: '37i9dQZF1DX6PYajiT4pAf',
        title: 'Novedades Viernes España',
        subtitle: 'Los mejores lanzamientos de la semana',
        image: 'https://i.scdn.co/image/ab67706f00000002eaecef062c2877a5c0f5f10e',
      },
      {
        id: '37i9dQZF1DX2EiUAL7Wdfc',
        title: 'míticas',
        subtitle: 'Canciones que nunca pasarán de moda',
        image: 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6',
      },
    ],
  },
  {
    id: 'shelf-top-charts',
    title: 'Top listas',
    prefix: 'Rankings',
    type: 'featured',
    hasSeeAll: true,
    cards: [
      {
        id: '37i9dQZEVXbNFJfN1Vw8d9',
        title: 'Top 50: España',
        subtitle: 'Tu actualización diaria de las canciones más escuchadas en España',
        image: 'https://charts-images.scdn.co/assets/locale_en/regional/daily/region_es_default.jpg',
      },
      {
        id: '37i9dQZEVXbMDoHDwVN2tF',
        title: 'Top 50: Global',
        subtitle: 'Tu actualización diaria de las canciones más escuchadas en el mundo',
        image: 'https://charts-images.scdn.co/assets/locale_en/regional/daily/region_global_default.jpg',
      },
      {
        id: '37i9dQZEVXbLiRSasKsNU9',
        title: 'Top Canciones: Viral España',
        subtitle: 'Las canciones más virales en España',
        image: 'https://charts-images.scdn.co/assets/locale_en/viral/daily/region_es_default.jpg',
      },
    ],
  },
];

export function buildExtractedShelves(_userName: string = 'Para ti'): DynamicShelf[] {
  return DEFAULT_PUBLIC_SHELVES;
}

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
    id: '37i9dQZF1DX10zKzsJ2jva',
    name: 'Viva Latino',
    description: 'Los éxitos de la música latina.',
    images: [{ url: 'https://i.scdn.co/image/ab67706f00000002964880811c74069be12f02b5' }],
    owner: { display_name: 'Spotify', id: 'spotify' },
    tracks: { total: 50, items: [] },
    color: '#bd2427',
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
  const displayName = user?.display_name || 'Para ti';
  const extracted = buildExtractedShelves(displayName);

  const deletedIds = getDeletedPlaylistIds();
  // If user has custom playlists, include them at the top
  const userLists = playlists.filter(
    (p) => !deletedIds.has(p.id) && !p.id.includes('collection:tracks') && p.type !== 'folder' && (p as any).is_custom
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
        subtitle: stripHtml(p.description) || `De ${displayName}`,
        image: getPlaylistCover(p),
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
  createPlaylist: (name?: string, initialTracks?: Track[]) => Playlist;
  initialize: () => Promise<void>;
  login: () => void;
  logout: () => void;
  refreshData: () => Promise<void>;
  setDynamicShelves: (shelves: DynamicShelf[]) => void;
  updatePlaylist: (id: string, updates: Partial<Playlist>) => void;
  deletePlaylist: (id: string) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string, trackObj?: Track) => void;
  /** Re-reads the Spotify account with the saved cookie (once a day, or forced) and merges it. */
  refreshSpotifySession: (force?: boolean) => Promise<boolean>;
  /** A cookie was (re)saved: same account → merge, keeping the user's changes; other account → switch. */
  applyCookieSession: (session: any, cookie: string, userOverride?: any) => void;
}

let isInitializing = false;
let refreshInFlight: Promise<boolean> | null = null;
let dailyRefreshTimer: number | null = null;

/** While the app stays open, checks every 30 min (and on focus) whether a new day started. */
function startDailySpotifyRefreshTimer() {
  if (typeof window === 'undefined' || dailyRefreshTimer !== null) return;
  const check = () => {
    try {
      useSpotifyDataStore.getState().refreshSpotifySession(false).catch(() => {});
    } catch {}
  };
  dailyRefreshTimer = window.setInterval(check, 30 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) check();
  });
}

/** Local calendar day (YYYY-MM-DD), used for the once-a-day Spotify refresh. */
export function localDayStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Merges a fresh read of the Spotify account into what the user has now, without undoing
 * anything they did here:
 *  - the user's order, their own/imported lists and their edits (name, cover, description)
 *    are kept (edits live in user_imported_playlists);
 *  - deleted lists stay deleted;
 *  - lists that appeared on Spotify since the last read are added; lists that are no
 *    longer there are kept;
 *  - untouched Spotify lists take the fresh cover/description and, when the fresh read has
 *    them, the fresh songs (songs the user added/removed are separate overlays, so they
 *    still apply on top).
 */
export function mergeFreshSpotifyPlaylists(
  current: Playlist[],
  fresh: Playlist[],
  imported: Playlist[],
  opts: { addEdits?: boolean } = {}
): Playlist[] {
  const addEdits = opts.addEdits !== false;
  const deleted = getDeletedPlaylistIds();
  const editedById = new Map<string, Playlist>();
  for (const p of imported || []) if (p?.id) editedById.set(p.id, p);
  const freshById = new Map<string, Playlist>();
  for (const p of fresh || []) if (p?.id) freshById.set(p.id, p);
  const out: Playlist[] = [];
  const seen = new Set<string>();
  const push = (p: Playlist) => {
    if (!p?.id || seen.has(p.id) || deleted.has(p.id)) return;
    seen.add(p.id);
    out.push(p);
  };
  for (const p of current || []) {
    if (!p?.id) continue;
    const f = freshById.get(p.id);
    const edited = editedById.get(p.id);
    if (f) {
      const freshTracks = f.tracks?.items?.length ? f.tracks : null;
      push({
        ...p,
        ...(edited ? {} : { name: f.name || p.name, description: f.description ?? p.description, images: f.images?.length ? f.images : p.images }),
        owner: f.owner || p.owner,
        tracks: freshTracks || p.tracks,
        ...(edited ? { name: edited.name || p.name, description: edited.description ?? p.description, images: edited.images?.length ? edited.images : p.images } : {}),
      } as Playlist);
    } else {
      push(edited ? ({ ...p, ...edited, tracks: p.tracks?.items?.length ? p.tracks : edited.tracks } as Playlist) : p);
    }
  }
  for (const f of fresh || []) {
    const edited = editedById.get(f?.id);
    push(edited ? ({ ...f, name: edited.name || f.name, description: edited.description ?? f.description, images: edited.images?.length ? edited.images : f.images } as Playlist) : f);
  }
  if (addEdits) for (const p of imported || []) push(p);
  return addEdits ? deduplicateUserPlaylists(out) : out.filter((p) => !deleted.has(p.id));
}

// Cross-tab and cross-window instantaneous synchronization channel
let crossTabSyncChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    crossTabSyncChannel = new BroadcastChannel('spotifree_cross_tab_sync');
    crossTabSyncChannel.onmessage = (event) => {
      if (event?.data?.type && event?.data?.detail) {
        window.dispatchEvent(new CustomEvent(event.data.type, { detail: event.data.detail }));
      }
    };
  } catch {}
}

export function broadcastCrossTabEvent(type: string, detail: any) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(type, { detail }));
    try {
      crossTabSyncChannel?.postMessage({ type, detail });
    } catch {}
  }
}

/**
 * Sanitizes imported playlists from localStorage by purging any viewed-only playlists
 * that leaked due to prior auto-save bugs, while strictly preserving:
 * 1. Custom user-created playlists (is_custom === true, 'custom-', 'pl-custom-', 'imported-', 'local-')
 * 2. Artist dummy playlists ('art-', 'artist-')
 * 3. Virtual playlists ('liked-songs', 'spotify-dj', 'collection:tracks')
 * 4. Explicitly saved playlists whose ID is in 'spotifree_saved_library_playlists'
 */
export function sanitizeImportedPlaylists(list: Playlist[]): Playlist[] {
  if (!Array.isArray(list) || list.length === 0) return [];
  if (typeof window === 'undefined') return list;
  try {
    const rawSaved = window.localStorage.getItem('spotifree_saved_library_playlists');
    const savedIds: string[] = rawSaved ? JSON.parse(rawSaved) : [];
    const cleanPid = (val: string) => (val || '').replace(/^spotify:(playlist|album):/i, '').replace(/^(custom|playlist)-/, '').split('?')[0].trim();
    const rawCleanPid = (val: string) => (val || '').replace(/^spotify:(playlist|album):/i, '').split('?')[0].trim();
    const savedSet = new Set<string>();
    for (const sId of savedIds) {
      if (sId) {
        savedSet.add(sId);
        savedSet.add(cleanPid(sId));
        savedSet.add(rawCleanPid(sId));
      }
    }

    return list.filter((p: any) => {
      if (!p || !p.id) return false;
      const pid = String(p.id);
      const cpid = cleanPid(pid);
      const rawCpid = rawCleanPid(pid);
      if (pid === 'liked-songs' || cpid === 'liked-songs' || rawCpid === 'liked-songs' || pid.includes('collection:tracks')) return true;
      if (pid === 'spotify-dj' || cpid === 'spotify-dj' || rawCpid === 'spotify-dj') return true;
      if (p.is_custom === true || p.owner?.id === 'user') return true;
      if (pid.startsWith('custom-') || pid.startsWith('pl-custom-') || pid.startsWith('imported-') || pid.startsWith('local-')) return true;
      if (pid.startsWith('art-') || pid.startsWith('artist-')) return true;
      return savedSet.has(pid) || savedSet.has(cpid) || savedSet.has(rawCpid);
    });
  } catch {
    return list;
  }
}

export function getGuestPlaylists(): Playlist[] {
  if (typeof window === 'undefined') return [];
  try {
    const rawImported = window.localStorage.getItem('user_imported_playlists');
    if (rawImported) {
      const list = JSON.parse(rawImported);
      if (Array.isArray(list) && list.length > 0) {
        return deduplicateUserPlaylists(sanitizeImportedPlaylists(list));
      }
    }
  } catch {}
  return [];
}

export function getInitialPlaylists(userId?: string): Playlist[] {
  if (typeof window === 'undefined') return [];
  try {
    const targetId = userId || window.localStorage.getItem('spotifree_active_user_id') || 'active';
    const rawImported = window.localStorage.getItem('user_imported_playlists');
    const rawList: Playlist[] = rawImported ? JSON.parse(rawImported) : [];
    const imported: Playlist[] = sanitizeImportedPlaylists(rawList);

    // 1. Check account session
    const rawAccountSession = window.localStorage.getItem(`spotifree_account_session_${targetId}`);
    if (rawAccountSession) {
      const parsed = JSON.parse(rawAccountSession);
      if (Array.isArray(parsed.playlists) && parsed.playlists.length > 0) {
        return deduplicateUserPlaylists([...parsed.playlists, ...imported]);
      }
    }

    // 2. Check extracted session
    const savedSessionRaw = window.localStorage.getItem('spotify_extracted_session');
    if (savedSessionRaw) {
      const session = JSON.parse(savedSessionRaw);
      if (Array.isArray(session.playlists) && session.playlists.length > 0) {
        return deduplicateUserPlaylists([...session.playlists, ...imported]);
      }
    }

    // 3. Check cloud account
    const rawCloud = window.localStorage.getItem('spotifree_current_cloud_account');
    if (rawCloud) {
      const cloud = JSON.parse(rawCloud);
      if (Array.isArray(cloud.playlists) && cloud.playlists.length > 0) {
        return deduplicateUserPlaylists([...cloud.playlists, ...imported]);
      }
    }

    if (imported.length > 0) {
      return deduplicateUserPlaylists(imported);
    }
  } catch {}
  return [];
}

function getInitialSession(): { user: UserProfile | null; isAuthenticated: boolean } {
  if (typeof window !== 'undefined') {
    try {
      if (window.localStorage.getItem('spotify_logged_out') === 'true') {
        return { user: null, isAuthenticated: false };
      }

      // Check cloud account
      const rawCloud = window.localStorage.getItem('spotifree_current_cloud_account');
      if (rawCloud) {
        const cloud = JSON.parse(rawCloud);
        if (cloud && (cloud.email || cloud.displayName)) {
          return {
            user: {
              id: cloud.uid || cloud.email || 'spotifree-user',
              display_name: cloud.displayName || cloud.email?.split('@')[0] || 'Usuario',
              email: cloud.email || '',
              images: cloud.avatarUrl ? [{ url: cloud.avatarUrl }] : [],
              bannerUrl: cloud.bannerUrl || null,
              followers: { total: 0 },
            } as any,
            isAuthenticated: true,
          };
        }
      }

      // Check active Spotify cookie session
      const userCookie = window.localStorage.getItem('user_spotify_cookie');
      const savedSessionRaw = window.localStorage.getItem('spotify_extracted_session');
      if (userCookie && savedSessionRaw) {
        const session = JSON.parse(savedSessionRaw);
        if (session && session.user && session.user.id) {
          return {
            user: session.user,
            isAuthenticated: true,
          };
        }
      }
    } catch {}
  }
  // NEW DEVICE / VISITOR STARTS LOGGED OUT WITH NO LEAKED ACCOUNT
  return { user: null, isAuthenticated: false };
}

const initialSession = getInitialSession();

/** The signed-in Spotify account's taste saved with its session (top artists / songs, recent plays) */
function getSavedTaste(): { topArtists: any[]; topTracks: Track[]; recentlyPlayed: any[] } {
  const empty = { topArtists: [], topTracks: [], recentlyPlayed: [] };
  if (typeof window === 'undefined' || !initialSession.isAuthenticated) return empty;
  try {
    const s = JSON.parse(window.localStorage.getItem('spotify_extracted_session') || 'null');
    // Only the account that is signed in now
    if (!s?.user?.id || s.user.id !== initialSession.user?.id) return empty;
    return {
      topArtists: Array.isArray(s.topArtists) ? s.topArtists : [],
      topTracks: Array.isArray(s.topTracks) ? s.topTracks : [],
      recentlyPlayed: Array.isArray(s.recentlyPlayed) ? s.recentlyPlayed : [],
    };
  } catch {
    return empty;
  }
}
const savedTaste = getSavedTaste();

const store = create<SpotifyDataState>((set, get) => ({
  isAuthenticated: initialSession.isAuthenticated,
  isLoading: false,
  user: initialSession.user,
  authWarning: null,
  playlists: initialSession.isAuthenticated
    ? getInitialPlaylists(initialSession.user?.id)
    : getGuestPlaylists(),
  categories: [],
  featuredPlaylists: [],
  featuredMessage: 'Novedades populares',
  newReleases: [],
  topTracks: savedTaste.topTracks,
  topArtists: savedTaste.topArtists,
  recentlyPlayed: savedTaste.recentlyPlayed,
  dynamicShelves: initialSession.isAuthenticated
    ? buildDynamicShelves(initialSession.user, getInitialPlaylists(initialSession.user?.id), 'Novedades para ti')
    : DEFAULT_PUBLIC_SHELVES,
  quickAccessCards: initialSession.isAuthenticated ? DEFAULT_SESSION_QUICK_ACCESS : [],
  playlistDetailsCache: initialSession.isAuthenticated ? DEFAULT_SESSION_CACHE : {},

  cachePlaylistDetails: (playlist: Playlist) => {
    const removedIds = getRemovedTrackIdsForPlaylist(playlist.id);
    let cleanPlaylist = playlist;
    if (playlist.tracks?.items && removedIds.size > 0) {
      const cleanItems = playlist.tracks.items.filter((t) => {
        const c = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
        return !removedIds.has(t.id) && !removedIds.has(c);
      });
      cleanPlaylist = {
        ...playlist,
        tracks: { total: cleanItems.length, items: cleanItems },
      };
    }

    set((s) => {
      const nextCache = {
        ...s.playlistDetailsCache,
        [cleanPlaylist.id]: cleanPlaylist,
      };
      if (typeof window !== 'undefined') {
        try {
          const userId = s.user?.id || 'active';
          window.localStorage.setItem(`spotifree_playlist_cache_${userId}`, JSON.stringify(nextCache));
          window.localStorage.setItem('spotifree_playlist_cache_active', JSON.stringify(nextCache));
        } catch {}
      }
      return {
        playlistDetailsCache: nextCache,
        playlists: s.playlists.map((p) => (p.id === cleanPlaylist.id ? { ...p, tracks: cleanPlaylist.tracks } : p)),
      };
    });
  },

  addCustomPlaylist: (playlist: Playlist) => {
    set((s) => {
      const cleanId = (playlist.id || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
      const existingCached = s.playlistDetailsCache[playlist.id] || s.playlistDetailsCache[cleanId];
      const existingPl = s.playlists.find((p) => p.id === playlist.id || p.id === cleanId);

      // Preserve tracks if incoming playlist object has empty items
      const hasIncomingTracks = Array.isArray(playlist.tracks?.items) && playlist.tracks.items.length > 0;
      const tracksToKeep = hasIncomingTracks
        ? playlist.tracks
        : (existingCached?.tracks?.items && existingCached.tracks.items.length > 0)
        ? existingCached.tracks
        : (existingPl?.tracks?.items && existingPl.tracks.items.length > 0)
        ? existingPl.tracks
        : playlist.tracks || { total: 0, items: [] };

      const fullPlaylist: Playlist = {
        ...playlist,
        tracks: tracksToKeep,
      };

      // Also persist tracks in localStorage if available so it's immediately cached
      if (typeof window !== 'undefined' && tracksToKeep.items && tracksToKeep.items.length > 0) {
        try {
          window.localStorage.setItem(`spotifree_playlist_tracks_${cleanId}`, JSON.stringify(tracksToKeep.items));
        } catch {}
      }

      const isAlreadyInPlaylists = s.playlists.some((p) => p.id === playlist.id || p.id === cleanId);
      const updatedPlaylists = isAlreadyInPlaylists
        ? s.playlists.map((p) => (p.id === playlist.id || p.id === cleanId ? fullPlaylist : p))
        : [fullPlaylist, ...s.playlists];

      if (typeof window !== 'undefined') {
        try {
          // 0. Remove from deleted playlist blacklist so re-saved playlists appear in library and sidebar
          let updatedDeleted: string[] = [];
          const rawDeleted = window.localStorage.getItem('spotifree_deleted_playlist_ids');
          if (rawDeleted) {
            try {
              const deletedList: string[] = JSON.parse(rawDeleted);
              updatedDeleted = deletedList.filter((dId: string) => {
                if (!dId) return false;
                const c = dId.replace(/^spotify:(playlist|album):/i, '').split('?')[0].trim();
                return dId !== playlist.id && dId !== cleanId && c !== cleanId;
              });
              window.localStorage.setItem('spotifree_deleted_playlist_ids', JSON.stringify(updatedDeleted));
            } catch {}
          }

          // 1. user_imported_playlists
          const rawImported = window.localStorage.getItem('user_imported_playlists');
          const list = rawImported ? JSON.parse(rawImported) : [];
          if (!list.some((p: any) => p.id === playlist.id || p.id === cleanId)) {
            list.unshift(fullPlaylist);
            window.localStorage.setItem('user_imported_playlists', JSON.stringify(list));
          } else {
            const updatedList = list.map((p: any) => (p.id === playlist.id || p.id === cleanId ? fullPlaylist : p));
            window.localStorage.setItem('user_imported_playlists', JSON.stringify(updatedList));
          }

          // 2. spotifree_saved_library_playlists
          const rawSaved = window.localStorage.getItem('spotifree_saved_library_playlists');
          const savedList: string[] = rawSaved ? JSON.parse(rawSaved) : [];
          if (!savedList.includes(playlist.id)) {
            savedList.push(playlist.id);
            window.localStorage.setItem('spotifree_saved_library_playlists', JSON.stringify(savedList));
          }

          // 3. sync with cloud Firestore
          import('../services/spotifreeAuth').then(({ syncSpotifreeAccount, getSavedSpotifreeAccount }) => {
            const savedAcc = getSavedSpotifreeAccount?.();
            const cloudDeleted = Array.isArray(savedAcc?.deletedPlaylistIds) ? savedAcc.deletedPlaylistIds : updatedDeleted;
            const cleanDeleted = cloudDeleted.filter((x: string) => {
              if (!x) return false;
              const c = x.replace(/^spotify:(playlist|album):/i, '').split('?')[0].trim();
              return x !== playlist.id && x !== cleanId && c !== cleanId;
            });
            syncSpotifreeAccount({
              playlists: updatedPlaylists,
              deletedPlaylistIds: cleanDeleted,
            }).catch(() => {});
          });
        } catch (e) {
          console.warn('Error saving playlist to user library storage:', e);
        }
      }

      return {
        playlists: updatedPlaylists,
        playlistDetailsCache: {
          ...s.playlistDetailsCache,
          [playlist.id]: fullPlaylist,
          [cleanId]: fullPlaylist,
        },
      };
    });
  },

  createPlaylist: (name?: string, initialTracks?: Track[]) => {
    const s = get();
    const count = s.playlists.filter((p) => (p as any).is_custom).length + 1;
    const playlistName = (name && name.trim()) ? name.trim() : `Mi lista n.º ${count}`;
    const initialList = Array.isArray(initialTracks) ? [...initialTracks] : [];
    const coverUrl = initialList[0]?.album?.images?.[0]?.url || '';
    const newId = `custom-playlist-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const newPlaylist: Playlist = {
      id: newId,
      name: playlistName,
      description: '',
      images: coverUrl ? [{ url: coverUrl }] : [],
      owner: { display_name: s.user?.display_name || 'Tú', id: s.user?.id || 'user' },
      tracks: { total: initialList.length, items: initialList },
      color: '#303030',
      is_pinned: false,
      is_custom: true,
    } as any;

    const updated = deduplicateUserPlaylists([newPlaylist, ...s.playlists]);

    if (typeof window !== 'undefined') {
      try {
        // 0. Cache tracks for this playlist immediately
        if (initialList.length > 0) {
          window.localStorage.setItem(`spotifree_playlist_tracks_${newId}`, JSON.stringify(initialList));
        }

        // 1. user_imported_playlists
        const rawImported = window.localStorage.getItem('user_imported_playlists');
        const list = rawImported ? JSON.parse(rawImported) : [];
        const nextImported = [newPlaylist, ...list.filter((p: any) => p.id !== newPlaylist.id)];
        window.localStorage.setItem('user_imported_playlists', JSON.stringify(nextImported));

        // 2. spotifree_saved_library_playlists
        const rawSaved = window.localStorage.getItem('spotifree_saved_library_playlists');
        const savedList: string[] = rawSaved ? JSON.parse(rawSaved) : [];
        if (!savedList.includes(newPlaylist.id)) {
          savedList.unshift(newPlaylist.id);
          window.localStorage.setItem('spotifree_saved_library_playlists', JSON.stringify(savedList));
        }

        // 3. User cache
        const userId = s.user?.id || window.localStorage.getItem('spotifree_active_user_id') || 'active';
        const rawCache = window.localStorage.getItem(`spotifree_playlist_cache_${userId}`);
        const cacheObj = rawCache ? JSON.parse(rawCache) : {};
        cacheObj[newPlaylist.id] = newPlaylist;
        window.localStorage.setItem(`spotifree_playlist_cache_${userId}`, JSON.stringify(cacheObj));
        window.localStorage.setItem('spotifree_playlist_cache_active', JSON.stringify(cacheObj));

        // 4. Session sync
        const rawExtracted = window.localStorage.getItem('spotify_extracted_session');
        if (rawExtracted) {
          const parsed = JSON.parse(rawExtracted);
          parsed.playlists = deduplicateUserPlaylists([newPlaylist, ...(parsed.playlists || [])]);
          window.localStorage.setItem('spotify_extracted_session', JSON.stringify(parsed));
        }

        // 5. Cloud account sync
        import('../services/spotifreeAuth').then(({ syncSpotifreeAccount }) => {
          syncSpotifreeAccount({ playlists: updated }).catch(() => {});
        });
      } catch (e) {
        console.error('Error creating playlist in storage:', e);
      }
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
    const cleanId = (id || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
    set((s) => {
      const isLikedTarget = (pid: string, pname?: string) =>
        pid === 'liked-songs' ||
        pid === 'user-liked-songs' ||
        pid.includes('collection:tracks') ||
        /^(canciones que te gustan|canciones que me gustan|tus me gusta|liked songs|liked tracks)$/i.test((pname || '').trim());

      const isTargetLiked = id === 'liked-songs' || isLikedTarget(id, updates.name);
      const existingInCache = s.playlistDetailsCache[id];
      const existingInList = s.playlists.find((p) => p.id === id || (isTargetLiked && isLikedTarget(p.id, p.name)));
      const baseEntry = existingInCache || existingInList || { id, name: isTargetLiked ? 'Canciones que te gustan' : 'Playlist', tracks: { total: 0, items: [] } };
      // Version history: the songs it had before this change (only playlists in the library)
      if (existingInList && updates.tracks?.items) {
        try {
          const before = existingInCache?.tracks?.items?.length ? existingInCache : existingInList;
          recordPlaylistVersion({ id: existingInList.id, tracks: before.tracks }, updates.tracks.items);
        } catch {}
      }
      const updatedCacheEntry = { ...baseEntry, ...updates } as Playlist;

      let found = false;
      const updatedPlaylists = s.playlists.map((p) => {
        if (p.id === id || (isTargetLiked && isLikedTarget(p.id, p.name))) {
          found = true;
          return { ...p, ...updates, id: isTargetLiked ? 'liked-songs' : p.id };
        }
        return p;
      });
      // Updating a playlist that is not in the library (a mix being viewed, its covers being
      // resolved…) never saves it there: only the save button (addCustomPlaylist) does that.
      if (!found && isTargetLiked) updatedPlaylists.unshift(updatedCacheEntry);

      if (typeof window !== 'undefined') {
        try {
          // 1. user_imported_playlists
          const rawImported = window.localStorage.getItem('user_imported_playlists');
          const list = rawImported ? JSON.parse(rawImported) : [];
          const idx = list.findIndex((p: any) => p.id === id || (cleanId && p.id === cleanId) || (isTargetLiked && isLikedTarget(p.id, p.name)));
          if (idx >= 0) {
            list[idx] = { ...list[idx], ...updates, id: isTargetLiked ? 'liked-songs' : list[idx].id };
            window.localStorage.setItem('user_imported_playlists', JSON.stringify(list));
          } else if (isTargetLiked) {
            list.unshift(updatedCacheEntry);
            window.localStorage.setItem('user_imported_playlists', JSON.stringify(list));
          }

          // 2. Playlist details cache
          const userId = s.user?.id || window.localStorage.getItem('spotifree_active_user_id') || 'active';
          const rawCache = window.localStorage.getItem(`spotifree_playlist_cache_${userId}`);
          const cacheObj = rawCache ? JSON.parse(rawCache) : {};
          cacheObj[id] = updatedCacheEntry;
          if (cleanId && cleanId !== id) {
            cacheObj[cleanId] = updatedCacheEntry;
          }
          window.localStorage.setItem(`spotifree_playlist_cache_${userId}`, JSON.stringify(cacheObj));
          window.localStorage.setItem('spotifree_playlist_cache_active', JSON.stringify(cacheObj));

          // 3. spotify_extracted_session
          const rawExtracted = window.localStorage.getItem('spotify_extracted_session');
          if (rawExtracted) {
            const parsed = JSON.parse(rawExtracted);
            if (Array.isArray(parsed.playlists)) {
              let extFound = false;
              parsed.playlists = parsed.playlists.map((p: any) => {
                if (p.id === id || (cleanId && p.id === cleanId) || (isTargetLiked && isLikedTarget(p.id, p.name))) {
                  extFound = true;
                  return { ...p, ...updates, id: isTargetLiked ? 'liked-songs' : p.id };
                }
                return p;
              });
              if (!extFound && isTargetLiked) {
                parsed.playlists.unshift(updatedCacheEntry);
              }
            }
            if (parsed.cachedPlaylistDetails) {
              parsed.cachedPlaylistDetails[id] = updatedCacheEntry;
              if (cleanId && cleanId !== id) {
                parsed.cachedPlaylistDetails[cleanId] = updatedCacheEntry;
              }
            }
            window.localStorage.setItem('spotify_extracted_session', JSON.stringify(parsed));
          }

          // 4. spotifree_account_session_${userId}
          const rawAccountSession = window.localStorage.getItem(`spotifree_account_session_${userId}`);
          if (rawAccountSession) {
            const parsed = JSON.parse(rawAccountSession);
            if (Array.isArray(parsed.playlists)) {
              let accFound = false;
              parsed.playlists = parsed.playlists.map((p: any) => {
                if (p.id === id || (cleanId && p.id === cleanId) || (isTargetLiked && isLikedTarget(p.id, p.name))) {
                  accFound = true;
                  return { ...p, ...updates, id: isTargetLiked ? 'liked-songs' : p.id };
                }
                return p;
              });
              if (!accFound && isTargetLiked) {
                parsed.playlists.unshift(updatedCacheEntry);
              }
            }
            window.localStorage.setItem(`spotifree_account_session_${userId}`, JSON.stringify(parsed));
          }

          // 5. Cloud Firestore
          import('../services/spotifreeAuth').then(({ syncSpotifreeAccount }) => {
            syncSpotifreeAccount({ playlists: updatedPlaylists }).catch(() => {});
          });

          // 6. Broadcast cross-tab and cross-window instantaneous update
          broadcastCrossTabEvent('spotifree_playlist_updated', {
            id,
            cleanId,
            updates,
            updatedPlaylist: updatedCacheEntry,
          });
        } catch (e) {
          console.error('Error persisting playlist updates:', e);
        }
      }

      return {
        playlists: updatedPlaylists,
        playlistDetailsCache: {
          ...s.playlistDetailsCache,
          [id]: updatedCacheEntry,
        },
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
    if (!id) return;
    const cleanId = (id || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
    const matchId = (pid: string) => {
      if (!pid) return false;
      if (pid === id || pid === cleanId) return true;
      const pClean = pid.replace(/^spotify:playlist:/i, '').split('?')[0].trim();
      return pClean === cleanId;
    };

    // Recoverable for 90 days (Ajustes › Recuperar playlists): a copy with its songs goes to the trash
    try {
      const s0 = get();
      const victim = s0.playlistDetailsCache[id] || s0.playlistDetailsCache[cleanId] || s0.playlists.find((p) => matchId(p.id));
      const listed = s0.playlists.find((p) => matchId(p.id));
      if (victim) addToTrash({ ...(listed || {}), ...victim, is_new: (listed as any)?.is_new ?? (victim as any).is_new } as Playlist);
    } catch {}

    set((s) => {
      const remainingPlaylists = s.playlists.filter((p) => !matchId(p.id));
      const newCache = { ...s.playlistDetailsCache };
      delete newCache[id];
      delete newCache[cleanId];
      delete newCache[`spotify:playlist:${cleanId}`];

      if (typeof window !== 'undefined') {
        try {
          // 0. Permanent blacklist of deleted playlist IDs
          const rawDeleted = window.localStorage.getItem('spotifree_deleted_playlist_ids');
          const deletedList: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
          if (!deletedList.includes(id)) deletedList.push(id);
          if (cleanId && !deletedList.includes(cleanId)) deletedList.push(cleanId);
          window.localStorage.setItem('spotifree_deleted_playlist_ids', JSON.stringify(deletedList));

          // 1. Remove from user_imported_playlists
          const rawImported = window.localStorage.getItem('user_imported_playlists');
          if (rawImported) {
            const list = JSON.parse(rawImported);
            const updated = list.filter((p: any) => !matchId(p.id));
            window.localStorage.setItem('user_imported_playlists', JSON.stringify(updated));
          }
          // 2. Remove from spotifree_saved_library_playlists
          const rawSaved = window.localStorage.getItem('spotifree_saved_library_playlists');
          if (rawSaved) {
            const list = JSON.parse(rawSaved);
            const updated = list.filter((pId: string) => !matchId(pId));
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
          window.localStorage.removeItem(`spotifree_downloaded_${cleanId}`);
          window.localStorage.removeItem(`spotifree_offline_playlist_${id}`);
          window.localStorage.removeItem(`spotifree_offline_playlist_${cleanId}`);
          const rawDl = window.localStorage.getItem('spotifree_downloaded_playlists_list');
          if (rawDl) {
            const list = JSON.parse(rawDl).filter((x: string) => !matchId(x));
            window.localStorage.setItem('spotifree_downloaded_playlists_list', JSON.stringify(list));
          }

          // 5. Cloud sync to Spotifree account if logged in
          import('../services/spotifreeAuth').then(({ syncSpotifreeAccount }) => {
            syncSpotifreeAccount({
              playlists: remainingPlaylists,
              deletedPlaylistIds: deletedList,
              // the trash travels with the account, so it can be recovered from another device
              stats: trashForCloud(),
            } as any).catch(() => {});
          });

          // 6. Global event for live UI navigation and cross-tab synchronization
          broadcastCrossTabEvent('spotifree_playlist_deleted', { id: cleanId, rawId: id });
        } catch (e) {
          console.error('Error deleting playlist from storage:', e);
        }
      }

      return {
        playlists: remainingPlaylists,
        playlistDetailsCache: newCache,
        dynamicShelves: s.dynamicShelves.map((shelf) => ({
          ...shelf,
          cards: shelf.cards.filter((c) => !matchId(c.id)),
        })),
        quickAccessCards: s.quickAccessCards.filter((q) => !matchId(q.id)),
      };
    });
  },

  applyCookieSession: (session: any, cookie: string, userOverride?: any) => {
    if (typeof window === 'undefined' || !session?.user) return;
    let saved: any = null;
    try {
      saved = JSON.parse(window.localStorage.getItem('spotify_extracted_session') || 'null');
    } catch {}
    const sameAccount = !saved?.user?.id || !session.user.id || saved.user.id === session.user.id;
    let imported: Playlist[] = [];
    try {
      imported = JSON.parse(window.localStorage.getItem('user_imported_playlists') || '[]');
    } catch {}
    const freshPlaylists: Playlist[] = Array.isArray(session.playlists) ? session.playlists : [];
    const savedPlaylists: Playlist[] = sameAccount && Array.isArray(saved?.playlists) ? saved.playlists : [];
    const current = sameAccount ? get().playlists : [];
    const today = localDayStamp();
    window.localStorage.setItem('user_spotify_cookie', cookie);
    window.localStorage.removeItem('spotify_logged_out');
    window.localStorage.setItem(
      'spotify_extracted_session',
      JSON.stringify({
        ...(sameAccount ? saved || {} : {}),
        ...session,
        playlists: mergeFreshSpotifyPlaylists(savedPlaylists, freshPlaylists, imported, { addEdits: false }),
        _cookie: cookie,
        _extractedDate: today,
      })
    );
    if (session.user.id) window.localStorage.setItem('spotifree_active_user_id', session.user.id);
    set({
      isAuthenticated: true,
      user: userOverride || session.user,
      playlists: mergeFreshSpotifyPlaylists(current.length ? current : savedPlaylists, freshPlaylists, imported),
      dynamicShelves: session.shelves?.length ? session.shelves : get().dynamicShelves,
      quickAccessCards: session.quickAccess?.length ? session.quickAccess : get().quickAccessCards,
      // The account's taste (Spotify's top artists / songs and recent plays) for its recommendations
      ...(Array.isArray(session.topArtists) && session.topArtists.length ? { topArtists: session.topArtists } : {}),
      ...(Array.isArray(session.topTracks) && session.topTracks.length ? { topTracks: session.topTracks } : {}),
      ...(Array.isArray(session.recentlyPlayed) && session.recentlyPlayed.length ? { recentlyPlayed: session.recentlyPlayed } : {}),
      isLoading: false,
    });
    startDailySpotifyRefreshTimer();
  },

  refreshSpotifySession: async (force = false) => {
    if (typeof window === 'undefined') return false;
    const cookie = window.localStorage.getItem('user_spotify_cookie') || window.localStorage.getItem('spotify_sp_dc') || '';
    if (!cookie || !validateSpotifyCookie(cookie).valid) return false;
    let saved: any = null;
    try {
      saved = JSON.parse(window.localStorage.getItem('spotify_extracted_session') || 'null');
    } catch {}
    const today = localDayStamp();
    // Also once for sessions read before the home rows had their full "Mostrar todos" lists
    const hasFullHome = (saved?.homeSectionLimit || 0) >= EXPECTED_HOME_SECTION_LIMIT;
    // …and once for sessions read before the account's taste (top artists / recent plays) came with it
    const hasTaste = Array.isArray(saved?.topArtists);
    if (!force && saved?._extractedDate === today && hasFullHome && hasTaste) return false;
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      try {
        const fresh: any = await extractSpotifySessionFromCookie(cookie);
        if (!fresh || !fresh.user) return false;
        // The same account? (a different cookie/account is a new login, handled elsewhere)
        if (saved?.user?.id && fresh.user.id && saved.user.id !== fresh.user.id) return false;
        let imported: Playlist[] = [];
        try {
          imported = JSON.parse(window.localStorage.getItem('user_imported_playlists') || '[]');
        } catch {}
        const freshPlaylists: Playlist[] = Array.isArray(fresh.playlists) ? fresh.playlists : [];
        const savedPlaylists: Playlist[] = Array.isArray(saved?.playlists) ? saved.playlists : [];
        const current = get().playlists.length ? get().playlists : savedPlaylists;
        const merged = mergeFreshSpotifyPlaylists(current, freshPlaylists, imported);

        // Spotify's own list of the account: previous lists + the new ones (never drops any)
        const sessionPlaylists = mergeFreshSpotifyPlaylists(savedPlaylists, freshPlaylists, imported, { addEdits: false });
        window.localStorage.setItem(
          'spotify_extracted_session',
          JSON.stringify({ ...(saved || {}), ...fresh, user: saved?.user || fresh.user, playlists: sessionPlaylists, _cookie: cookie, _extractedDate: today })
        );

        // Fresh songs for lists the read brought with songs (overlays still apply on top)
        const cache = { ...get().playlistDetailsCache };
        for (const p of freshPlaylists) {
          if (p?.id && p.tracks?.items?.length && cache[p.id]) cache[p.id] = { ...cache[p.id], tracks: p.tracks };
        }
        if (fresh.cachedPlaylistDetails) {
          for (const [id, p] of Object.entries<any>(fresh.cachedPlaylistDetails)) {
            if (p?.tracks?.items?.length) cache[id] = { ...(cache[id] || {}), ...p, ...(cache[id]?.name && imported.some((x) => x.id === id) ? { name: cache[id].name, images: cache[id].images } : {}) };
          }
        }
        try {
          const uid = get().user?.id || window.localStorage.getItem('spotifree_active_user_id') || 'active';
          window.localStorage.setItem(`spotifree_playlist_cache_${uid}`, JSON.stringify(cache));
          window.localStorage.setItem('spotifree_playlist_cache_active', JSON.stringify(cache));
        } catch {}

        set({
          playlists: merged,
          playlistDetailsCache: cache,
          // Recommendations are Spotify's, not the user's: they are replaced every day
          dynamicShelves: fresh.shelves && fresh.shelves.length > 0 ? fresh.shelves : get().dynamicShelves,
          quickAccessCards: fresh.quickAccess && fresh.quickAccess.length ? fresh.quickAccess : get().quickAccessCards,
          // The account's taste for its Spotifree playlists
          ...(Array.isArray(fresh.topArtists) && fresh.topArtists.length ? { topArtists: fresh.topArtists } : {}),
          ...(Array.isArray(fresh.topTracks) && fresh.topTracks.length ? { topTracks: fresh.topTracks } : {}),
          ...(Array.isArray(fresh.recentlyPlayed) && fresh.recentlyPlayed.length ? { recentlyPlayed: fresh.recentlyPlayed } : {}),
        });
        console.info(`[Spotify] Cuenta actualizada (${today}): ${freshPlaylists.length} listas, ${merged.length} en tu biblioteca`);
        return true;
      } catch (e) {
        console.warn('[Spotify] Daily refresh failed:', e);
        if (!get().dynamicShelves.length) set({ dynamicShelves: buildExtractedShelves(get().user?.display_name || '') });
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  },

  removeTrackFromPlaylist: (playlistId: string, trackId: string, trackObj?: Track) => {
    if (!playlistId || !trackId) return;
    const cleanPl = (playlistId || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
    const cleanTrack = (trackId || '').replace(/^spotify:track:/i, '').split('?')[0].trim();

    const isLikedPl =
      cleanPl === 'liked-songs' ||
      cleanPl === 'tracks' ||
      cleanPl === 'collection:tracks' ||
      cleanPl === 'collection-tracks' ||
      cleanPl === 'user-liked-songs' ||
      /^(canciones que te gustan|canciones que me gustan|tus me gusta|liked songs|liked tracks)$/i.test(cleanPl);

    // 1. Remove from all storage layers and add to blacklist
    removeCustomTrackFromStorage(playlistId, trackId, undefined, trackObj);
    removeCustomTrackFromStorage(cleanPl, cleanTrack, undefined, trackObj);
    if (isLikedPl) {
      import('../utils/userStorage').then(({ removeCustomLikedSong }) => {
        removeCustomLikedSong(trackId, undefined, trackObj);
        removeCustomLikedSong(cleanTrack, undefined, trackObj);
      }).catch(() => {});
    }

    // 2. Update store playlists and playlistDetailsCache in state
    let updatedPlaylistsList: Playlist[] = [];
    set((s) => {
      const matchPl = (p: Playlist) => {
        const pClean = (p.id || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
        if (p.id === playlistId || p.id === cleanPl || pClean === cleanPl) return true;
        if (isLikedPl) {
          return (
            p.id === 'liked-songs' ||
            p.id === 'user-liked-songs' ||
            p.id === 'tracks' ||
            p.id.includes('collection:tracks') ||
            p.id.includes('collection-tracks') ||
            /^(canciones que te gustan|canciones que me gustan|tus me gusta|liked songs|liked tracks)$/i.test((p.name || '').trim())
          );
        }
        return false;
      };

      const filterItems = (items: Track[] = []) =>
        items.filter((t) => {
          const tClean = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
          const matchId = t.id === trackId || t.id === cleanTrack || tClean === cleanTrack || t.id === `spotify:track:${cleanTrack}`;
          const matchName = trackObj && t.name?.toLowerCase().trim() === trackObj.name?.toLowerCase().trim() &&
            t.artists?.[0]?.name?.toLowerCase().trim() === trackObj.artists?.[0]?.name?.toLowerCase().trim();
          return !matchId && !matchName;
        });

      const updatedPlaylists = s.playlists.map((p) => {
        if (matchPl(p)) {
          const newItems = filterItems(p.tracks?.items || []);
          // Version history (the full list as it was before removing the song)
          try {
            const full = s.playlistDetailsCache[p.id]?.tracks?.items?.length ? s.playlistDetailsCache[p.id] : p;
            if (!isLikedPl) recordPlaylistVersion({ id: p.id, tracks: full.tracks }, filterItems(full.tracks?.items || []));
          } catch {}
          return {
            ...p,
            tracks: { total: newItems.length, items: newItems },
          };
        }
        return p;
      });

      const updatedCache = { ...s.playlistDetailsCache };
      const cacheKeys = [
        playlistId,
        cleanPl,
        `spotify:playlist:${cleanPl}`,
        ...(isLikedPl ? ['liked-songs', 'user-liked-songs', 'collection:tracks', 'tracks'] : []),
      ];
      for (const k of cacheKeys) {
        if (updatedCache[k]?.tracks?.items) {
          const newItems = filterItems(updatedCache[k].tracks.items);
          updatedCache[k] = {
            ...updatedCache[k],
            tracks: { total: newItems.length, items: newItems },
          };
        }
      }

      updatedPlaylistsList = updatedPlaylists;
      return {
        playlists: updatedPlaylists,
        playlistDetailsCache: updatedCache,
      };
    });

    // 2b. Sync with Cloud Firestore
    import('../services/spotifreeAuth')
      .then(({ syncSpotifreeAccount }) => {
        let cleanLikedIds: string[] | undefined = undefined;
        if (isLikedPl) {
          const playerStore = (window as any).__usePlayerStore?.getState?.();
          const currentLikedIds: string[] = playerStore?.likedTrackIds || [];
          cleanLikedIds = currentLikedIds.filter((id: string) => {
            const c = (id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
            return id !== trackId && id !== cleanTrack && c !== cleanTrack && id !== `spotify:track:${cleanTrack}`;
          });
          (window as any).__usePlayerStore?.setState?.({ likedTrackIds: cleanLikedIds });
        }
        syncSpotifreeAccount({
          playlists: updatedPlaylistsList,
          ...(cleanLikedIds !== undefined ? { likedTracks: cleanLikedIds } : {}),
        }).catch(() => {});
      })
      .catch(() => {});

    // 3. Dispatch global event for live views and cross-tab synchronization
    broadcastCrossTabEvent('spotifree_track_removed', {
      playlistId: cleanPl,
      rawPlaylistId: playlistId,
      trackId: cleanTrack,
      rawTrackId: trackId,
      trackObj,
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

      // One-time sanitization of user_imported_playlists on initialization to purge leaked viewed-only playlists
      if (typeof window !== 'undefined' && Array.isArray(importedPlaylists) && importedPlaylists.length > 0) {
        const sanitized = sanitizeImportedPlaylists(importedPlaylists);
        if (sanitized.length !== importedPlaylists.length) {
          importedPlaylists = sanitized;
          try {
            window.localStorage.setItem('user_imported_playlists', JSON.stringify(sanitized));
          } catch {}
        }
      }

      if (userCookie && validateSpotifyCookie(userCookie).valid) {
        const cleanCookie = cleanSpDc(userCookie);
        let session: any = null;
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
          const rawUnique = combinedPlaylists.filter(
            (p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx
          ).map((p: Playlist) => {
            if (cachedPlaylists[p.id]?.tracks?.items?.length) {
              return { ...p, tracks: cachedPlaylists[p.id].tracks };
            }
            return p;
          });
          const uniquePlaylists = deduplicateUserPlaylists(rawUnique);

          // Clean up any extraneous DJ playlists from user_imported_playlists
          if (typeof window !== 'undefined') {
            try {
              const cleanedImported = importedPlaylists.filter(
                (p) => p && p.id !== 'spotify-dj' && p.id !== 'dj' && p.name?.toLowerCase().trim() !== 'dj'
              );
              importedPlaylists = cleanedImported;
              window.localStorage.setItem('user_imported_playlists', JSON.stringify(cleanedImported));
            } catch {}
          }

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
          const topCandidates = (uniquePlaylists[0]?.tracks?.items || []).slice(0, 6);
          if (topCandidates.length > 0) {
            import('../services/audioEngine').then(({ audioEngine }) => {
              audioEngine.warmupInitialTracks(topCandidates);
            }).catch(() => {});
          }

          // Load per-user stats so profile stats are isolated per account
          if (session.user?.id) {
            try { useStatsStore.getState().loadStatsForUser(session.user.id); } catch {}
          }

          // Daily automatic refresh with the saved cookie: Spotify's recommendations (home
          // shelves, mixes, new lists) follow the real account, merged without undoing the
          // user's changes. Also re-checked while the app stays open across days.
          if (
            !session.playlists ||
            session.playlists.length === 0 ||
            session._extractedDate !== localDayStamp() ||
            (session.homeSectionLimit || 0) < EXPECTED_HOME_SECTION_LIMIT
          ) {
            get().refreshSpotifySession(true).catch(() => {});
          }
          startDailySpotifyRefreshTimer();
          return;
        }

        // If no cached session, extract from cookie
        try {
          session = await extractSpotifySessionFromCookie(userCookie);
          if (typeof window !== 'undefined' && session) {
            window.localStorage.setItem('spotify_extracted_session', JSON.stringify({
              ...session,
              _cookie: userCookie,
              _extractedDate: new Date().toISOString().slice(0, 10),
            }));
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
          const rawUnique = combinedPlaylists.filter(
            (p, idx, arr) => arr.findIndex((x) => x.id === p.id) === idx
          );
          const uniquePlaylists = deduplicateUserPlaylists(rawUnique);

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
          const topCandidates = (uniquePlaylists[0]?.tracks?.items || []).slice(0, 6);
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

        // Same list the user saw before reloading: Liked Songs + DJ + their lists (minus deleted ones)
        const guestPlaylists = deduplicateUserPlaylists(importedPlaylists);
        const shelves = buildDynamicShelves(
          guestUser,
          guestPlaylists,
          'Tus listas importadas',
          [],
          []
        );

        set({
          isAuthenticated: true,
          user: guestUser,
          playlists: guestPlaylists,
          dynamicShelves: shelves,
          quickAccessCards: guestPlaylists
            .filter((p) => p.id !== 'spotify-dj' && (p.id !== 'liked-songs' || (p.tracks?.items?.length || 0) > 0))
            .slice(0, 8)
            .map((p) => ({
              id: p.id,
              name: p.name,
              image: getPlaylistCover(p),
              color: (p as any).color || '#303030',
            })),
          isLoading: false,
        });
        return;
      }

      // 4. If Cloud Account is logged in without Spotify session yet
      if (cloudAcc) {
        const cloudUser = {
          id: cloudAcc.uid || cloudAcc.email,
          display_name: cloudAcc.displayName || 'Usuario',
          email: cloudAcc.email,
          images: cloudAcc.avatarUrl ? [{ url: cloudAcc.avatarUrl }] : [],
          bannerUrl: cloudAcc.bannerUrl || null,
          followers: { total: 0 },
        };
        const allPl = Array.isArray(cloudAcc.playlists) && cloudAcc.playlists.length > 0 ? cloudAcc.playlists : importedPlaylists;
        const uniquePl = deduplicateUserPlaylists(allPl);
        set({
          isAuthenticated: true,
          user: cloudUser as any,
          playlists: uniquePl,
          dynamicShelves: buildDynamicShelves(cloudUser, uniquePl, 'Recomendado para ti'),
          quickAccessCards: uniquePl.filter((p) => p.id !== 'spotify-dj').slice(0, 6).map((p) => ({
            id: p.id,
            name: p.name,
            image: getPlaylistCover(p),
            color: (p as any).color || '#303030',
          })),
          playlistDetailsCache: {},
          isLoading: false,
        });
        return;
      }

      // 5. Default: Visitor / new device has NO active session -> completely LOGGED OUT
      set({
        isAuthenticated: false,
        user: null,
        playlists: [],
        dynamicShelves: DEFAULT_PUBLIC_SHELVES,
        quickAccessCards: [],
        playlistDetailsCache: {},
        isLoading: false,
      });
      return;
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
      window.localStorage.removeItem('spotifree_liked_tracks');
      window.localStorage.removeItem('spotifree_guest_liked_songs');
      window.localStorage.setItem('spotify_logged_out', 'true');
      window.sessionStorage.removeItem('spotify_403_premium');
    }
    set({
      isAuthenticated: false,
      user: null,
      playlists: [],
      dynamicShelves: DEFAULT_PUBLIC_SHELVES,
      quickAccessCards: [],
      authWarning: null,
      isLoading: false,
    });
    // Reset player liked tracks and stats
    try {
      import('./usePlayerStore').then(({ usePlayerStore }) => {
        usePlayerStore.setState({ likedTrackIds: [] });
      });
    } catch {}
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

