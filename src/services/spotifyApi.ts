import type { Playlist, Track, UserProfile } from '../types/spotify';
import { getValidAccessToken } from './spotifyAuth';
import { filterMusicTracksOnly } from '../utils/trackFilter';
import { withoutNotInterested } from '../utils/notInterested';
import { rankSearchTracks, rankSearchPlaylists } from '../utils/searchRanking';

export async function fetchPlaylistDetails(id: string, options?: { refresh?: boolean }): Promise<Playlist | null> {
  try {
    const userCookie = typeof window !== 'undefined' ? window.localStorage.getItem('user_spotify_cookie') || '' : '';
    const storedToken = typeof window !== 'undefined' ? window.localStorage.getItem('spotify_access_token') || '' : '';
    const validToken = await getValidAccessToken().catch(() => null);
    const activeToken = validToken || storedToken;

    if (activeToken && activeToken !== 'session-bridge-active' && !id.startsWith('dz-') && !id.startsWith('sc-')) {
      try {
        const res = await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          // Paginate tracks.next if present up to 10,000 tracks
          if (data && data.tracks && data.tracks.next) {
            let allTracks = [...(data.tracks.items || [])];
            let nextTracksUrl = data.tracks.next;
            let pages = 0;
            while (nextTracksUrl && allTracks.length < 10000 && pages < 100) {
              pages++;
              try {
                const nextRes = await fetch(nextTracksUrl, {
                  headers: { Authorization: `Bearer ${activeToken}` },
                });
                if (!nextRes.ok) break;
                const nextData = await nextRes.json();
                if (Array.isArray(nextData.items)) {
                  allTracks.push(...nextData.items);
                }
                nextTracksUrl = nextData.next;
              } catch {
                break;
              }
            }
            const normalizedTracks: Track[] = allTracks
              .map((it: any, idx: number) => {
                const tr = it.track || it;
                if (!tr || !tr.name) return null;
                return {
                  id: tr.id || `track-${idx}`,
                  name: tr.name,
                  artists: (tr.artists || []).map((a: any, i: number) => ({ id: a.id || `art-${idx}-${i}`, name: a.name })),
                  album: {
                    id: tr.album?.id || `alb-${idx}`,
                    name: tr.album?.name || data.name,
                    images: tr.album?.images || data.images || [],
                  },
                  duration_ms: tr.duration_ms || 180000,
                  preview_url: tr.preview_url || null,
                  added_at: it.added_at ? new Date(it.added_at).toLocaleDateString('es-ES') : 'Reciente',
                };
              })
              .filter(Boolean) as Track[];
            data.tracks.items = normalizedTracks;
            data.tracks.total = Math.max(data.tracks.total || 0, normalizedTracks.length);
          } else if (data && data.tracks && Array.isArray(data.tracks.items)) {
            data.tracks.items = data.tracks.items
              .map((it: any, idx: number) => {
                const tr = it.track || it;
                if (!tr || !tr.name) return null;
                return {
                  id: tr.id || `track-${idx}`,
                  name: tr.name,
                  artists: (tr.artists || []).map((a: any, i: number) => ({ id: a.id || `art-${idx}-${i}`, name: a.name })),
                  album: {
                    id: tr.album?.id || `alb-${idx}`,
                    name: tr.album?.name || data.name,
                    images: tr.album?.images || data.images || [],
                  },
                  duration_ms: tr.duration_ms || 180000,
                  preview_url: tr.preview_url || null,
                  added_at: it.added_at ? new Date(it.added_at).toLocaleDateString('es-ES') : 'Reciente',
                };
              })
              .filter(Boolean) as Track[];
          }
          return data;
        }
      } catch {}
    }

    const headers: Record<string, string> = {};
    if (userCookie) headers['x-spotify-cookie'] = userCookie;
    if (activeToken && activeToken !== 'session-bridge-active') {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    const refreshQuery = options?.refresh ? '?refresh=1' : '';
    const res = await fetch(`/api/spotify/playlist/${encodeURIComponent(id)}${refreshQuery}`, { headers });
    if (res.ok) {
      return await res.json();
    }

    // Direct client fallback for Deezer playlists if backend route is unavailable
    if (id.startsWith('dz-') || /^\d+$/.test(id)) {
      const dzId = id.replace(/^dz-(pl-)?/, '');
      try {
        const dzRes = await fetch(`https://api.deezer.com/playlist/${dzId}`);
        if (dzRes.ok) {
          const data: any = await dzRes.json();
          if (data && data.title) {
            const cover = data.picture_xl || data.picture_big || data.picture_medium || data.picture || '';
            const tracks = (data.tracks?.data || []).map((t: any, idx: number) => ({
              id: `dz-${t.id}`,
              name: t.title || t.title_short,
              duration_ms: (t.duration || 210) * 1000,
              preview_url: null,
              artists: [{ id: `art-${t.artist?.id || idx}`, name: t.artist?.name || 'Artista' }],
              album: {
                id: `alb-${t.album?.id || id}`,
                name: t.album?.title || t.title,
                images: cover ? [{ url: cover }] : [],
              },
            }));
            return {
              id,
              name: data.title,
              description: data.description || `Playlist creada por ${data.creator?.name || 'Usuario'}`,
              type: 'playlist',
              images: cover ? [{ url: cover }] : [],
              owner: {
                display_name: data.creator?.name || 'Spotify',
                id: `user-${data.creator?.id || 'dz'}`,
              },
              color: '#303030',
              tracks: {
                total: data.nb_tracks || tracks.length,
                items: tracks,
              },
            } as any;
          }
        }
      } catch {}
    }

    return null;
  } catch (err) {
    console.error(`Error fetching playlist details for ${id}:`, err);
    return null;
  }
}

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('spotify_access_token') : null;
  if (!token) return null;

  try {
    const validToken = await getValidAccessToken();
    if (!validToken) return null;

    const res = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    if (res.ok) {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('spotify_403_premium');
      }
      return await res.json();
    }
    if (res.status === 403) {
      const errBody = await res.text().catch(() => '');
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('spotify_403_premium', errBody || 'Active premium subscription required for the owner of the app.');
      }
      console.error(
        'Spotify /v1/me devolvió 403 Forbidden:', errBody
      );
    } else {
      console.warn(`Spotify /v1/me returned ${res.status}`);
    }
    return null;
  } catch (err) {
    console.error('Error fetching /v1/me from Spotify API:', err);
    return null;
  }
}

export async function fetchUserPlaylists(): Promise<Playlist[]> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('spotify_access_token') : null;
  if (!token) return [];

  try {
    const validToken = await getValidAccessToken();
    if (!validToken) return [];

    let allPlaylists: any[] = [];
    let nextUrl: string | null = 'https://api.spotify.com/v1/me/playlists?limit=50';
    let pages = 0;
    while (nextUrl && pages < 10) {
      pages++;
      const pRes: Response = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${validToken}` },
      });
      if (!pRes.ok) break;
      const pData: any = await pRes.json();
      if (Array.isArray(pData.items)) {
        allPlaylists.push(...pData.items.filter(Boolean));
      }
      nextUrl = pData.next;
    }
    return allPlaylists;
  } catch (err) {
    console.error('Error fetching user playlists from Spotify API:', err);
    return [];
  }
}

export async function fetchBrowseCategories(): Promise<any[]> {
  return [];
}

export async function fetchFeaturedPlaylists(): Promise<any[]> {
  return [];
}

export async function fetchNewReleases(): Promise<any[]> {
  return [];
}

export async function fetchTopTracks(): Promise<Track[]> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('spotify_access_token') : null;
  if (token && token !== 'session-bridge-active') {
    try {
      const validToken = await getValidAccessToken();
      const res = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=20', {
        headers: { Authorization: `Bearer ${validToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        return data.items || [];
      }
    } catch {}
  }
  return [];
}

function extractAndEnrichOfficialRemixes(
  candidateTracks: Track[],
  seenIds: Set<string>,
  seenKeys: Set<string>
): Track[] {
  const officialRemixes: Track[] = [];
  const remixRegex = /\b(remix|rmx)\b/i;

  for (const t of candidateTracks) {
    if (!t || !t.id || seenIds.has(t.id)) continue;
    if (t.id.startsWith('sc-')) continue;

    const isRemix = remixRegex.test(t.name) || remixRegex.test(t.album?.name || '');
    if (!isRemix) continue;

    const normName = t.name
      .toLowerCase()
      .replace(/[()[\]{}_-]/g, ' ')
      .replace(/\b(remix|rmx)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const primaryArtist = (t.artists?.[0]?.name || '').toLowerCase().trim();
    const key = `${normName}:::${primaryArtist}`;

    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    seenIds.add(t.id);

    officialRemixes.push({
      ...t,
      isOfficial: true,
      scVariant: 'remix',
      scVariantLabel: 'Remix Oficial',
      scBadgeColor: '#1ed760',
    });
  }

  return officialRemixes;
}

export interface SearchSpotifyOptions {
  onQuickResults?: (partial: any) => void;
  signal?: AbortSignal;
  offset?: number;
  limit?: number;
  fastOnly?: boolean;
}

const CLIENT_SEARCH_CACHE = new Map<string, { data: any; timestamp: number }>();

function createSearchSignal(timeoutMs: number, externalSignal?: AbortSignal): { signal?: AbortSignal; cleanup: () => void } {
  if (typeof AbortController === 'undefined') {
    return { signal: externalSignal, cleanup: () => {} };
  }
  const ctrl = new AbortController();
  const tid = setTimeout(() => {
    try { ctrl.abort(); } catch {}
  }, timeoutMs);
  const onExternalAbort = () => {
    clearTimeout(tid);
    try { ctrl.abort(); } catch {}
  };
  if (externalSignal) {
    if (externalSignal.aborted) {
      onExternalAbort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }
  return {
    signal: ctrl.signal,
    cleanup: () => {
      clearTimeout(tid);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    },
  };
}

export async function searchSpotify(query: string, options?: SearchSpotifyOptions): Promise<any | null> {
  const cleanQ = query.trim();
  if (!cleanQ || options?.signal?.aborted) return null;

  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? 25;

  // Normalized query removing parentheses, brackets, and extra punctuation
  // so queries like "body(remix) eladio carrion" cleanly match "body remix eladio carrion"
  const normalizedQ = cleanQ.replace(/[()[\]{}_-]/g, ' ').replace(/\s+/g, ' ').trim();
  const isFastOnly = Boolean(options?.fastOnly);
  const cacheKey = `${(normalizedQ || cleanQ).toLowerCase()}:${offset}:${limit}${isFastOnly ? ':fast' : ''}`;

  // 0. Instant memory cache hit (0ms)
  const cachedEntry = CLIENT_SEARCH_CACHE.get(cacheKey);
  if (cachedEntry && Date.now() - cachedEntry.timestamp < 180_000) {
    if (offset === 0) {
      options?.onQuickResults?.(cachedEntry.data);
    }
    return cachedEntry.data;
  }

  let tracks: Track[] = [];
  let soundcloudTracks: Track[] = [];
  let artists: Array<{ id: string; name: string; images: Array<{ url: string }> }> = [];
  let albums: Array<{ id: string; name: string; images: Array<{ url: string }>; release_date?: string; artists: Array<{ name: string }> }> = [];
  let playlists: Array<{
    id: string;
    name: string;
    images: Array<{ url: string }>;
    owner?: { display_name: string; id?: string };
    description?: string;
    tracks?: { total: number; items?: any[] };
  }> = [];
  let userMatchedPlaylists: any[] = [];

  // 1. Search in-app loaded playlists, menus, top tracks & library for instant 0ms matching
  if (offset === 0) {
    try {
      const { useSpotifyDataStore, getDeletedPlaylistIds } = await import('../store/useSpotifyDataStore');
      const { usePlayerStore } = await import('../store/usePlayerStore');
      const { getCustomLikedSongs, getActiveUserId } = await import('../utils/userStorage');
      const spotifyState = useSpotifyDataStore.getState();
      const playerState = usePlayerStore.getState();
      const deletedIds = getDeletedPlaylistIds();

      const rawUserPlaylists: any[] = [];
      const seenPlIds = new Set<string>();

      // A) In-memory user playlists from store
      (spotifyState.playlists || []).forEach((p) => {
        if (p?.id && !deletedIds.has(p.id) && !seenPlIds.has(p.id)) {
          seenPlIds.add(p.id);
          rawUserPlaylists.push(p);
        }
      });

      // B) Cached playlist details
      if (spotifyState.playlistDetailsCache) {
        Object.values(spotifyState.playlistDetailsCache).forEach((p: any) => {
          if (p?.id && !deletedIds.has(p.id) && !seenPlIds.has(p.id)) {
            seenPlIds.add(p.id);
            rawUserPlaylists.push(p);
          }
        });
      }

      // C) LocalStorage imported / created playlists (survives app reloads / APK sync)
      if (typeof window !== 'undefined') {
        try {
          const rawImp = window.localStorage.getItem('user_imported_playlists');
          if (rawImp) {
            const parsed = JSON.parse(rawImp);
            if (Array.isArray(parsed)) {
              parsed.forEach((p: any) => {
                if (p?.id && !deletedIds.has(p.id) && !seenPlIds.has(p.id)) {
                  seenPlIds.add(p.id);
                  rawUserPlaylists.push(p);
                }
              });
            }
          }
        } catch {}
      }

      const candidateTracks: Track[] = [];
      const seenCandidateTrackIds = new Set<string>();
      const addCandidateTrack = (t: Track | null | undefined) => {
        if (!t || !t.id || seenCandidateTrackIds.has(t.id)) return;
        seenCandidateTrackIds.add(t.id);
        candidateTracks.push(t);
      };

      // 1. Tracks inside all user and imported playlists
      for (const p of rawUserPlaylists) {
        if (Array.isArray(p.tracks?.items)) {
          p.tracks.items.forEach(addCandidateTrack);
        }
        if (typeof window !== 'undefined') {
          try {
            const rawPlTrk = window.localStorage.getItem(`spotifree_playlist_tracks_${p.id}`);
            if (rawPlTrk) {
              const parsedTrk = JSON.parse(rawPlTrk);
              if (Array.isArray(parsedTrk)) parsedTrk.forEach(addCandidateTrack);
            }
          } catch {}
        }
      }

      // 2. User liked songs
      const customLiked = getCustomLikedSongs(getActiveUserId());
      customLiked.forEach(addCandidateTrack);

      // 3. Top tracks, new releases, recently played, queue
      const topTracks = spotifyState.topTracks || [];
      const newReleases = (spotifyState.newReleases || []).flatMap((nr: any) => nr.tracks?.items || [nr]);
      const recentlyPlayed = spotifyState.recentlyPlayed || [];
      const queueTracks = playerState.queue || [];
      [...topTracks, ...newReleases, ...recentlyPlayed, ...queueTracks].forEach(addCandidateTrack);

      const searchWords = (normalizedQ || cleanQ).toLowerCase().split(' ').filter(Boolean);
      const cleanLower = cleanQ.toLowerCase().trim();
      const seenLocal = new Set<string>();

      for (const t of candidateTracks) {
        if (!t || !t.id || seenLocal.has(t.id)) continue;
        const rawTarget = `${t.name} ${t.artists?.map((a) => a.name).join(' ') || ''}`.toLowerCase();
        const targetNormalized = rawTarget.replace(/[()[\]{}_-]/g, ' ').replace(/\s+/g, ' ');

        const matchesAll = searchWords.every(
          (word) => rawTarget.includes(word) || targetNormalized.includes(word)
        );
        if (matchesAll) {
          seenLocal.add(t.id);
          tracks.push(t);
        }
      }

      const localArtists: Array<{ id: string; name: string; images: Array<{ url: string }> }> = [];
      const topArtists = spotifyState.topArtists || [];
      for (const a of topArtists) {
        if (a?.name && searchWords.every((w) => a.name.toLowerCase().includes(w))) {
          localArtists.push(a);
        }
      }

      // Match user playlists
      for (const p of rawUserPlaylists) {
        if (!p || !p.id) continue;
        const name = (p.name || '').toLowerCase().trim();
        const desc = (p.description || '').toLowerCase().trim();
        const owner = (p.owner?.display_name || '').toLowerCase().trim();

        const matches = searchWords.every(
          (w) => name.includes(w) || desc.includes(w) || owner.includes(w)
        );

        if (matches) {
          const cover = p.images?.[0]?.url || (p.tracks?.items?.[0]?.album?.images?.[0]?.url) || '';
          userMatchedPlaylists.push({
            ...p,
            images: cover ? [{ url: cover }] : (p.images || []),
            owner: p.owner || { display_name: 'Tú' },
            description: p.description || `${p.tracks?.total || p.tracks?.items?.length || 0} canciones • Tu biblioteca`,
            is_user_playlist: true,
          });
        }
      }

      userMatchedPlaylists.sort((a, b) => {
        const aName = (a.name || '').toLowerCase().trim();
        const bName = (b.name || '').toLowerCase().trim();
        if (aName === cleanLower) return -1;
        if (bName === cleanLower) return 1;
        if (aName.startsWith(cleanLower) && !bName.startsWith(cleanLower)) return -1;
        if (!aName.startsWith(cleanLower) && bName.startsWith(cleanLower)) return 1;
        return aName.localeCompare(bName);
      });

      if (options?.onQuickResults && !options.signal?.aborted && (tracks.length > 0 || localArtists.length > 0 || userMatchedPlaylists.length > 0)) {
        options.onQuickResults({
          tracks: { items: rankSearchTracks(cleanQ, [...tracks]) },
          soundcloudTracks: { items: [] },
          artists: { items: localArtists },
          albums: { items: [] },
          playlists: { items: rankSearchPlaylists(cleanQ, userMatchedPlaylists) },
        });
      }
    } catch {}
  }

  if (options?.signal?.aborted) return null;

  let gotBackendResults = false;
  let fullSettled = false;

  // 2. Query Backend Search API (/api/spotify/search) — progressive fast pass + full pass in parallel
  const fullSignal = createSearchSignal(isFastOnly ? 3200 : 7500, options?.signal);
  const fullPromise = fetch(
    `/api/spotify/search?q=${encodeURIComponent(cleanQ)}&offset=${offset}&limit=${limit}${isFastOnly ? '&fast=1' : ''}`,
    { signal: fullSignal.signal }
  )
    .then(async (res) => (res.ok ? await res.json() : null))
    .catch(() => null)
    .finally(() => {
      fullSettled = true;
      fullSignal.cleanup();
    });

  if (options?.onQuickResults && offset === 0) {
    const quickSignal = createSearchSignal(3000, options?.signal);
    void fetch(`/api/spotify/search?q=${encodeURIComponent(cleanQ)}&fast=1`, {
      signal: quickSignal.signal,
    })
      .then(async (res) => (res.ok ? await res.json() : null))
      .then((qData) => {
        if (!qData || fullSettled || options?.signal?.aborted) return;
        const quickTracks: Track[] = [...tracks];
        for (const item of qData.tracks?.items || []) {
          if (
            !quickTracks.some(
              (t) =>
                t.id === item.id ||
                (t.name.toLowerCase() === item.name.toLowerCase() &&
                  t.artists?.[0]?.name.toLowerCase() === item.artists?.[0]?.name.toLowerCase())
            )
          ) {
            quickTracks.push(item);
          }
        }
        const quickRanked = rankSearchTracks(cleanQ, quickTracks);
        const quickRemixes = extractAndEnrichOfficialRemixes(quickRanked, new Set<string>(), new Set<string>());
        const quickPlaylists = [...userMatchedPlaylists];
        for (const pl of qData.playlists?.items || []) {
          if (!quickPlaylists.some((p) => p.id === pl.id)) {
            quickPlaylists.push(pl);
          }
        }
        options.onQuickResults?.({
          tracks: { items: quickRanked },
          soundcloudTracks: { items: quickRemixes },
          artists: { items: qData.artists?.items || [] },
          albums: { items: qData.albums?.items || [] },
          playlists: { items: quickPlaylists },
        });
      })
      .catch(() => {})
      .finally(() => quickSignal.cleanup());
  }

  let backendData: any = null;
  try {
    const data = await fullPromise;
    backendData = data;
    if (options?.signal?.aborted) return null;
    if (data) {
      if (Array.isArray(data.soundcloudTracks?.items) && data.soundcloudTracks.items.length > 0) {
        soundcloudTracks = data.soundcloudTracks.items;
      }
      if (data.tracks?.items?.length) {
        gotBackendResults = true;
        if (offset === 0) {
          // Put official search results at the forefront
          const newSpotifyTracks: Track[] = [];
          for (const item of data.tracks.items) {
            if (!tracks.some((t) => t.id === item.id || (t.name.toLowerCase() === item.name.toLowerCase() && t.artists?.[0]?.name.toLowerCase() === item.artists?.[0]?.name.toLowerCase()))) {
              newSpotifyTracks.push(item);
            }
          }
          tracks = [...newSpotifyTracks, ...tracks];
        } else {
          tracks = data.tracks.items;
        }
      } else if (data.artists?.items?.length || data.albums?.items?.length || data.soundcloudTracks?.items?.length) {
        gotBackendResults = true;
      }
      const wantsVariantInMain =
        /\b(remix|slowed|sped\s*up|nightcore|leak|unreleased|inedita|inédita|demo|mashup|bootleg|soundcloud)\b/i.test(cleanQ) ||
        tracks.length < 5;
      if (wantsVariantInMain && soundcloudTracks.length > 0) {
        for (const scT of soundcloudTracks.slice(0, 8)) {
          if (!tracks.some((t) => t.id === scT.id || t.name.toLowerCase() === scT.name.toLowerCase())) {
            tracks.push(scT);
          }
        }
      }
      if (data.artists?.items?.length && artists.length === 0) artists = data.artists.items;
      if (data.albums?.items?.length && albums.length === 0) albums = data.albums.items;
      if (data.playlists?.items?.length) {
        for (const pl of data.playlists.items) {
          if (!playlists.some(p => p.id === pl.id)) playlists.push(pl);
        }
      }
    }
  } catch {}

  if (options?.signal?.aborted) return null;

  // 2b. Direct Deezer Global Music Catalog Query (only needed if backend search was unavailable)
  if (!gotBackendResults) {
  try {
    const withoutPlaylist = (normalizedQ || cleanQ).replace(/\bplaylist(s)?\b/gi, '').trim() || (normalizedQ || cleanQ);
    const queryForDeezer = withoutPlaylist;
    const [dzTracksRes, dzArtistsRes, dzAlbumsRes, dzPlaylistsRes1, dzPlaylistsRes2] = await Promise.all([
      fetch(`https://api.deezer.com/search?q=${encodeURIComponent(queryForDeezer)}&limit=${limit}&index=${offset}`, { signal: AbortSignal.timeout?.(3500) })
        .then((r) => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
      fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(queryForDeezer)}&limit=6`, { signal: AbortSignal.timeout?.(3500) })
        .then((r) => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
      fetch(`https://api.deezer.com/search/album?q=${encodeURIComponent(queryForDeezer)}&limit=6`, { signal: AbortSignal.timeout?.(3500) })
        .then((r) => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
      fetch(`https://api.deezer.com/search/playlist?q=${encodeURIComponent(normalizedQ || cleanQ)}&limit=20`, { signal: AbortSignal.timeout?.(3500) })
        .then((r) => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
      fetch(`https://api.deezer.com/search/playlist?q=${encodeURIComponent(withoutPlaylist)}&limit=20`, { signal: AbortSignal.timeout?.(3500) })
        .then((r) => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),
    ]);

    const dzTracks: Track[] = (dzTracksRes.data || []).map((t: any) => {
      const cover = t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || '';
      return {
        id: `dz-${t.id}`,
        name: t.title || t.title_short,
        duration_ms: (t.duration || 210) * 1000,
        preview_url: null,
        artists: [{ id: `art-${t.artist?.id || 'unknown'}`, name: t.artist?.name || 'Artista' }],
        album: {
          id: `alb-${t.album?.id || 'unknown'}`,
          name: t.album?.title || t.title,
          images: cover ? [{ url: cover }] : [],
        },
      };
    });

    for (const t of dzTracks) {
      if (!tracks.some((existing) => existing.id === t.id || (existing.name.toLowerCase() === t.name.toLowerCase() && existing.artists?.[0]?.name.toLowerCase() === t.artists?.[0]?.name.toLowerCase()))) {
        tracks.push(t);
      }
    }

    if (artists.length === 0 && dzArtistsRes.data?.length) {
      artists = dzArtistsRes.data.map((a: any) => ({
        id: `art-${a.id}`,
        name: a.name,
        images: [{ url: a.picture_xl || a.picture_big || a.picture_medium || '' }],
      }));
    }

    if (albums.length === 0 && dzAlbumsRes.data?.length) {
      albums = dzAlbumsRes.data.map((a: any) => ({
        id: `alb-${a.id}`,
        name: a.title,
        artists: [{ name: a.artist?.name || 'Artista' }],
        images: [{ url: a.cover_xl || a.cover_big || a.cover_medium || '' }],
        release_date: '2026',
      }));
    }

    // Real Community & Curated Playlists from Deezer
    const rawDzPlaylists = [...(dzPlaylistsRes1.data || []), ...(dzPlaylistsRes2.data || [])];
    const seenPlIds = new Set(playlists.map(p => p.id));
    for (const p of rawDzPlaylists) {
      if (!p || !p.id || seenPlIds.has(`dz-pl-${p.id}`)) continue;
      seenPlIds.add(`dz-pl-${p.id}`);
      const cover = p.picture_xl || p.picture_big || p.picture_medium || p.picture || '';
      playlists.push({
        id: `dz-pl-${p.id}`,
        name: p.title,
        description: `Playlist de ${p.user?.name || 'Usuario'} • ${p.nb_tracks || 0} canciones`,
        images: cover ? [{ url: cover }] : [],
        owner: { display_name: p.user?.name || 'Spotify' },
      });
    }
  } catch {}
  }

  // 3. Try Spotify Official Web API if valid token exists
  try {
    const validToken = await getValidAccessToken();
    if (validToken) {
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(normalizedQ || cleanQ)}&type=track,artist,album,playlist&limit=12`,
        { headers: { Authorization: `Bearer ${validToken}` } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.tracks?.items?.length) {
          for (const item of data.tracks.items) {
            if (!tracks.some((t) => t.id === item.id)) tracks.push(item);
          }
        }
        if (data.artists?.items?.length) artists = data.artists.items;
        if (data.albums?.items?.length) albums = data.albums.items;
        if (data.playlists?.items?.length) playlists = data.playlists.items;
      }
    }
  } catch (err) {
    console.warn('Spotify official search failed:', err);
  }

  // 4. Multi-entity iTunes Search Fallback (only run if backend missed categories so searches finish immediately)
  if (!gotBackendResults || tracks.length === 0 || artists.length === 0 || albums.length === 0) {
  try {
    const queryForStore = normalizedQ || cleanQ;
    const [songsRes, albumsRes, artistsRes] = await Promise.all([
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(queryForStore)}&media=music&entity=song&limit=15`),
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(queryForStore)}&media=music&entity=album&limit=8`),
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(queryForStore)}&media=music&entity=musicArtist&limit=6`),
    ]);

    const songData = songsRes.ok ? await songsRes.json() : { results: [] };
    const albumData = albumsRes.ok ? await albumsRes.json() : { results: [] };
    const artistData = artistsRes.ok ? await artistsRes.json() : { results: [] };

    const itunesTracks: Track[] = (songData.results || []).map((t: any, idx: number) => ({
      id: `search-${t.trackId || idx}`,
      name: t.trackName || 'Canción',
      duration_ms: (t.trackTimeMillis && t.trackTimeMillis > 35000) ? t.trackTimeMillis : 210000,
      preview_url: t.previewUrl || null,
      artists: [{ id: `art-${t.artistId || idx}`, name: t.artistName || 'Artista' }],
      album: {
        id: `alb-${t.collectionId || idx}`,
        name: t.collectionName || t.trackName,
        images: [{ url: (t.artworkUrl100 || '').replace('100x100bb', '600x600bb') }],
      },
    }));

    for (const t of itunesTracks) {
      if (!tracks.some((existing) => existing.id === t.id || existing.name.toLowerCase() === t.name.toLowerCase())) {
        tracks.push(t);
      }
    }

    if (artists.length === 0) {
      const artistMap = new Map<string, { id: string; name: string; images: Array<{ url: string }> }>();

      (artistData.results || []).forEach((a: any, idx: number) => {
        if (a.artistName) {
          const matchSong = (songData.results || []).find((s: any) => s.artistName?.toLowerCase() === a.artistName?.toLowerCase());
          const img = matchSong?.artworkUrl100?.replace('100x100bb', '600x600bb') ||
                      songData.results?.[idx]?.artworkUrl100?.replace('100x100bb', '600x600bb') ||
                      tracks[0]?.album?.images?.[0]?.url ||
                      '';

          artistMap.set(a.artistName.toLowerCase(), {
            id: `art-${a.artistId || idx}`,
            name: a.artistName,
            images: [{ url: img }],
          });
        }
      });

      for (const t of songData.results || []) {
        if (t.artistName && !artistMap.has(t.artistName.toLowerCase())) {
          artistMap.set(t.artistName.toLowerCase(), {
            id: `art-${t.artistId || t.artistName.toLowerCase().replace(/\s+/g, '-')}`,
            name: t.artistName,
            images: [{ url: (t.artworkUrl100 || '').replace('100x100bb', '600x600bb') }],
          });
        }
        if (artistMap.size >= 8) break;
      }

      artists = Array.from(artistMap.values());
    }

    if (albums.length === 0) {
      albums = (albumData.results || []).map((a: any, idx: number) => ({
        id: `alb-${a.collectionId || idx}`,
        name: a.collectionName,
        artists: [{ name: a.artistName }],
        images: [{ url: (a.artworkUrl100 || '').replace('100x100bb', '600x600bb') }],
        release_date: (a.releaseDate || '').slice(0, 4) || '2024',
      }));
    }

    if (playlists.length === 0) {
      const topCover = tracks[0]?.album?.images?.[0]?.url || 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426';
      const secondCover = tracks[1]?.album?.images?.[0]?.url || 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6';
      const thirdCover = albums[0]?.images?.[0]?.url || topCover;

      playlists = [
        {
          id: `search-pl-${cleanQ.toLowerCase().replace(/\s+/g, '-')}`,
          name: `This Is ${cleanQ.charAt(0).toUpperCase() + cleanQ.slice(1)}`,
          images: [{ url: topCover }],
          owner: { display_name: 'Spotify' },
        },
        {
          id: `search-mix-${cleanQ.toLowerCase().replace(/\s+/g, '-')}`,
          name: `Mix de ${cleanQ.charAt(0).toUpperCase() + cleanQ.slice(1)}`,
          images: [{ url: secondCover }],
          owner: { display_name: 'Spotify' },
        },
        {
          id: `search-radio-${cleanQ.toLowerCase().replace(/\s+/g, '-')}`,
          name: `Radio de ${cleanQ.charAt(0).toUpperCase() + cleanQ.slice(1)}`,
          images: [{ url: thirdCover }],
          owner: { display_name: 'Spotify' },
        },
      ];
    }
  } catch (err) {
    console.error('Parallel search enrichment failed:', err);
  }
  }

  // --- PRIORITIZE OFFICIAL REMIXES IN soundcloudTracks (Requirement R1) ---
  const seenRemixIds = new Set<string>();
  const seenRemixKeys = new Set<string>();
  const officialRemixes: Track[] = [];

  // 1. Collect official remixes already returned from backend in soundcloudTracks
  for (const scT of soundcloudTracks) {
    if (scT.isOfficial || scT.scVariantLabel === 'Remix Oficial') {
      seenRemixIds.add(scT.id);
      const normName = scT.name.toLowerCase().replace(/[()[\]{}_-]/g, ' ').replace(/\b(remix|rmx)\b/g, '').replace(/\s+/g, ' ').trim();
      const primaryArtist = (scT.artists?.[0]?.name || '').toLowerCase().trim();
      seenRemixKeys.add(`${normName}:::${primaryArtist}`);
      officialRemixes.push({
        ...scT,
        isOfficial: true,
        scVariant: 'remix',
        scVariantLabel: 'Remix Oficial',
        scBadgeColor: '#1ed760',
      });
    }
  }

  // 2. Extract official remixes from tracks loaded so far (backend Spotify, Deezer, iTunes, local)
  const existingRemixes = extractAndEnrichOfficialRemixes(tracks, seenRemixIds, seenRemixKeys);
  officialRemixes.push(...existingRemixes);

  // 3. Supplement via direct Deezer query for `${cleanQ} remix` only if backend was offline
  if (!gotBackendResults && officialRemixes.length < 3) {
    try {
      const isAlreadyRemix = /\b(remix|rmx)\b/i.test(cleanQ);
      const remixTerm = isAlreadyRemix ? cleanQ : `${cleanQ} remix`;
      const dzRemixRes = await fetch(
        `https://api.deezer.com/search?q=${encodeURIComponent(remixTerm)}&limit=15`,
        { signal: AbortSignal.timeout?.(3500) }
      ).then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] }));

      const dzRemixTracks: Track[] = (dzRemixRes.data || []).map((t: any) => {
        const cover = t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || '';
        return {
          id: `dz-${t.id}`,
          name: t.title || t.title_short,
          duration_ms: (t.duration || 210) * 1000,
          preview_url: null,
          artists: [{ id: `art-${t.artist?.id || 'unknown'}`, name: t.artist?.name || 'Artista' }],
          album: {
            id: `alb-${t.album?.id || 'unknown'}`,
            name: t.album?.title || t.title,
            images: cover ? [{ url: cover }] : [],
          },
        };
      });

      const newDeezerRemixes = extractAndEnrichOfficialRemixes(dzRemixTracks, seenRemixIds, seenRemixKeys);
      officialRemixes.push(...newDeezerRemixes);

      // Also add to tracks so users find them under the "Canciones" tab
      for (const rmx of newDeezerRemixes) {
        if (!tracks.some((t) => t.id === rmx.id)) {
          tracks.push(rmx);
        }
      }
    } catch {}
  }

  // 4. Filter non-official SoundCloud tracks, deduplicating against official remixes
  const nonOfficialTracks: Track[] = [];
  for (const scT of soundcloudTracks) {
    if (scT.isOfficial || scT.scVariantLabel === 'Remix Oficial') continue;
    const isCreativeEdit = /\b(mashup|bootleg|slowed|sped\s*up|reverb|nightcore|drum\s*mix|hype\s*intro)\b/i.test(scT.name);
    if (!isCreativeEdit) {
      const normName = scT.name.toLowerCase().replace(/[()[\]{}_-]/g, ' ').replace(/\b(remix|rmx)\b/g, '').replace(/\s+/g, ' ').trim();
      const primaryArtist = (scT.artists?.[0]?.name || '').toLowerCase().trim();
      const key = `${normName}:::${primaryArtist}`;
      if (seenRemixKeys.has(key)) continue;
    }
    nonOfficialTracks.push(scT);
  }

  // 5. Official catalog remixes ALWAYS at index 0 .. N-1, followed by non-official SoundCloud items
  soundcloudTracks = [...officialRemixes, ...nonOfficialTracks];

  // Results come from several places (server, your library, Deezer) one after another: order them
  // by how well they match what was typed
  tracks = rankSearchTracks(cleanQ, tracks);

  const totalTracks = backendData?.tracks?.total ?? (tracks.length + offset);
  const hasMoreTracks = backendData?.tracks?.hasMore ?? (tracks.length >= limit);

  const rawMergedPlaylists: any[] = [...userMatchedPlaylists];
  for (const pl of playlists) {
    if (!rawMergedPlaylists.some((p) => p.id === pl.id)) {
      rawMergedPlaylists.push(pl);
    }
  }
  const mergedPlaylists = rankSearchPlaylists(cleanQ, rawMergedPlaylists);

  const finalPayload = {
    tracks: {
      items: tracks,
      total: totalTracks,
      offset,
      limit,
      hasMore: hasMoreTracks,
    },
    soundcloudTracks: { items: soundcloudTracks },
    artists: {
      items: artists,
      total: backendData?.artists?.total ?? artists.length,
      offset,
      limit,
      hasMore: backendData?.artists?.hasMore ?? (artists.length >= 8),
    },
    albums: {
      items: albums,
      total: backendData?.albums?.total ?? albums.length,
      offset,
      limit,
      hasMore: backendData?.albums?.hasMore ?? (albums.length >= 8),
    },
    playlists: {
      items: mergedPlaylists,
      total: (backendData?.playlists?.total ?? playlists.length) + userMatchedPlaylists.length,
      offset,
      limit,
      hasMore: false,
    },
    total: totalTracks,
    offset,
    limit,
    hasMore: hasMoreTracks,
  };

  if (!options?.signal?.aborted && (tracks.length > 0 || artists.length > 0 || albums.length > 0 || playlists.length > 0)) {
    if (CLIENT_SEARCH_CACHE.size >= 60) {
      const oldestKey = CLIENT_SEARCH_CACHE.keys().next().value;
      if (oldestKey) CLIENT_SEARCH_CACHE.delete(oldestKey);
    }
    CLIENT_SEARCH_CACHE.set(cacheKey, { data: finalPayload, timestamp: Date.now() });
  }

  return finalPayload;
}

const CANVAS_LOCAL_CACHE = new Map<string, string | null>();

export async function fetchTrackCanvas(
  trackId: string,
  trackName?: string,
  artistName?: string
): Promise<string | null> {
  const cleanId = (trackId || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
  if (!cleanId && !trackName) return null;
  const cacheKey = `${cleanId}_${trackName || ''}_${artistName || ''}`;
  if (CANVAS_LOCAL_CACHE.has(cacheKey)) return CANVAS_LOCAL_CACHE.get(cacheKey) || null;
  if (cleanId && CANVAS_LOCAL_CACHE.has(cleanId)) return CANVAS_LOCAL_CACHE.get(cleanId) || null;

  try {
    const userCookie = typeof window !== 'undefined' ? window.localStorage.getItem('user_spotify_cookie') || '' : '';
    const headers: Record<string, string> = {};
    if (userCookie) headers['x-spotify-cookie'] = userCookie;

    const params = new URLSearchParams();
    if (cleanId) params.set('trackId', cleanId);
    if (trackName) params.set('name', trackName);
    if (artistName) params.set('artist', artistName);

    const res = await fetch(`/api/canvas?${params.toString()}`, { headers });
    if (res.ok) {
      const data = await res.json();
      const url = data?.canvasUrl || null;
      CANVAS_LOCAL_CACHE.set(cacheKey, url);
      if (cleanId) CANVAS_LOCAL_CACHE.set(cleanId, url);
      return url;
    }
  } catch (err) {
    console.warn('[SpotifyApi] fetchTrackCanvas error:', err);
  }

  CANVAS_LOCAL_CACHE.set(cacheKey, null);
  if (cleanId) CANVAS_LOCAL_CACHE.set(cleanId, null);
  return null;
}

export async function fetchRecommendations(options: {
  seedTracks?: string[];
  seedArtists?: string[];
  artistName?: string;
  trackName?: string;
  limit?: number;
}): Promise<Track[]> {
  try {
    const validToken = await getValidAccessToken().catch(() => null);
    const params = new URLSearchParams();
    if (options.seedTracks?.length) params.set('seed_tracks', options.seedTracks.slice(0, 3).join(','));
    if (options.seedArtists?.length) params.set('seed_artists', options.seedArtists.slice(0, 2).join(','));
    if (options.artistName) params.set('artist', options.artistName);
    if (options.trackName) params.set('track_name', options.trackName);
    if (options.limit) params.set('limit', String(options.limit));

    const headers: Record<string, string> = {};
    if (validToken && validToken !== 'session-bridge-active') {
      headers['Authorization'] = `Bearer ${validToken}`;
    }

    const res = await fetch(`/api/spotify/recommendations?${params.toString()}`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.tracks && Array.isArray(data.tracks)) {
        // (autoplay and smart shuffle use these: "No me interesa" songs stay out)
        return withoutNotInterested(data.tracks);
      }
    }
  } catch (err) {
    console.warn('[SpotifyApi] fetchRecommendations error:', err);
  }
  return [];
}

/**
 * Fetches real Spotify recommendations tailored specifically to the opened playlist
 * using Spotify Pathfinder and Web Player queries based on playlist artists & tracks.
 */
export async function fetchPlaylistRecommendations(
  playlistId: string,
  playlistTitle: string,
  existingTracks: Track[] = [],
  limit = 8
): Promise<Track[]> {
  try {
    const userCookie = typeof window !== 'undefined' ? window.localStorage.getItem('user_spotify_cookie') || '' : '';
    const headers: Record<string, string> = {};
    if (userCookie) headers['x-spotify-cookie'] = userCookie;

    // Collect unique artist names from existing tracks
    const artistSet = new Set<string>();
    existingTracks.forEach((t) => {
      t.artists?.forEach((a) => {
        if (a.name && a.name !== 'Spotify' && a.name.length > 1) {
          artistSet.add(a.name);
        }
      });
    });

    const artistsList = Array.from(artistSet);
    const selectedArtists = [...artistsList].sort(() => Math.random() - 0.5).slice(0, 8);
    const seedTrackIds = existingTracks.slice(0, 20).map((t) => t.id).filter(Boolean);

    const params = new URLSearchParams({
      action: 'recommendations',
      id: playlistId || '',
      title: playlistTitle || '',
      artists: selectedArtists.join(','),
      seedTracks: seedTrackIds.join(','),
      limit: String(limit),
      _t: String(Date.now()),
    });

    const res = await fetch(`/api/playlist?${params.toString()}`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.tracks && Array.isArray(data.tracks) && data.tracks.length > 0) {
        // "No me interesa" songs are never recommended
        return withoutNotInterested(filterMusicTracksOnly(data.tracks));
      }
    }
  } catch (err) {
    console.warn('[SpotifyApi] fetchPlaylistRecommendations error:', err);
  }

  // Client-side fallback so recommendations ALWAYS display
  return [
    {
      id: 'dz-2432976725',
      name: 'Columbia',
      artists: [{ id: 'art-quevedo', name: 'Quevedo' }],
      album: {
        id: 'alb-columbia',
        name: 'Columbia',
        images: [{ url: 'https://e-cdns-images.dzcdn.net/images/cover/b4ea39ef6ea328ecf4b16260ea8d1159/1000x1000-000000-80-0-0.jpg' }],
      },
      duration_ms: 186000,
      preview_url: 'https://cdns-preview-d.dzcdn.net/stream/c-df51b54c034aefc96cb8a4ebaa9670aa-5.mp3',
      added_at: 'Recomendada',
    },
    {
      id: 'dz-2549257631',
      name: 'LUNA',
      artists: [{ id: 'art-feid', name: 'Feid' }, { id: 'art-atljacob', name: 'ATL Jacob' }],
      album: {
        id: 'alb-ferxxocalipsis',
        name: 'FERXXOCALIPSIS',
        images: [{ url: 'https://e-cdns-images.dzcdn.net/images/cover/6c65b53027b165275e01691230678788/1000x1000-000000-80-0-0.jpg' }],
      },
      duration_ms: 196000,
      preview_url: null,
      added_at: 'Recomendada',
    },
    {
      id: 'dz-2503254921',
      name: 'MONACO',
      artists: [{ id: 'art-badbunny', name: 'Bad Bunny' }],
      album: {
        id: 'alb-nsneve',
        name: 'nadie sabe lo que va a pasar mañana',
        images: [{ url: 'https://e-cdns-images.dzcdn.net/images/cover/9cb1f1bf40cb7e71f5445ea4e4125b0f/1000x1000-000000-80-0-0.jpg' }],
      },
      duration_ms: 267000,
      preview_url: null,
      added_at: 'Recomendada',
    },
    {
      id: 'dz-2484089985',
      name: 'REINA',
      artists: [{ id: 'art-mora', name: 'Mora' }, { id: 'art-saiko', name: 'Saiko' }],
      album: {
        id: 'alb-estrella',
        name: 'ESTRELLA',
        images: [{ url: 'https://e-cdns-images.dzcdn.net/images/cover/5f58c7438ae7b3ebfb4f7c2235c05280/1000x1000-000000-80-0-0.jpg' }],
      },
      duration_ms: 228000,
      preview_url: null,
      added_at: 'Recomendada',
    },
    {
      id: 'dz-2228518177',
      name: 'DILUVIO',
      artists: [{ id: 'art-rauw', name: 'Rauw Alejandro' }],
      album: {
        id: 'alb-saturno',
        name: 'SATURNO',
        images: [{ url: 'https://e-cdns-images.dzcdn.net/images/cover/25d3fa961ef0a6a22f307ba4da4a43ef/1000x1000-000000-80-0-0.jpg' }],
      },
      duration_ms: 198000,
      preview_url: null,
      added_at: 'Recomendada',
    },
    {
      id: 'dz-2358047915',
      name: 'LALA',
      artists: [{ id: 'art-myke', name: 'Myke Towers' }],
      album: {
        id: 'alb-lala',
        name: 'LA VIDA ES UNA',
        images: [{ url: 'https://e-cdns-images.dzcdn.net/images/cover/0bc52251a31b402cf8fa5dcfae69eec4/1000x1000-000000-80-0-0.jpg' }],
      },
      duration_ms: 197000,
      preview_url: null,
      added_at: 'Recomendada',
    },
  ];
}
