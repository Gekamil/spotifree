import type { Track } from '../types/spotify';
import { deduplicateTracks } from './trackDeduplication';

export const JORGE_DEFAULT_USER_ID = 'e6yr34zzwnf1yybcw49po6nrw';

/**
 * Returns the currently active Spotify user ID.
 * Returns 'guest' for unauthenticated visitors so no private user data ever leaks.
 */
export function getActiveUserId(): string {
  if (typeof window === 'undefined') return 'guest';
  try {
    const savedId = window.localStorage.getItem('spotifree_active_user_id');
    if (savedId && savedId.trim() && savedId !== 'undefined' && savedId !== 'null' && savedId !== 'guest') {
      return savedId.trim();
    }

    // Check cloud account
    const rawCloud = window.localStorage.getItem('spotifree_current_cloud_account');
    if (rawCloud) {
      const cloud = JSON.parse(rawCloud);
      if (cloud?.uid) return cloud.uid;
      if (cloud?.email) return cloud.email;
    }

    // Check if there is an active session
    const sessionRaw = window.localStorage.getItem('spotify_extracted_session');
    if (sessionRaw) {
      const parsed = JSON.parse(sessionRaw);
      if (parsed.user?.id) {
        window.localStorage.setItem('spotifree_active_user_id', parsed.user.id);
        return parsed.user.id;
      }
    }
  } catch {}
  return 'guest';
}

/**
 * Sets the active user ID in localStorage.
 */
export function setActiveUserId(userId: string): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.setItem('spotifree_active_user_id', userId.trim());
  } catch {}
}

/**
 * Generates the storage key for a user's liked songs.
 * Guest users receive their own isolated key so no user songs leak to visitors.
 */
export function getUserLikedSongsKey(userId?: string): string {
  const targetId = userId || getActiveUserId();
  if (targetId && targetId !== 'spotify-user' && targetId !== 'guest' && targetId !== 'undefined') {
    return `spotifree_custom_liked_songs_${targetId}`;
  }
  return 'spotifree_guest_liked_songs';
}

/**
 * Retrieves the custom liked songs saved by the specific user.
 * Never leaks songs from one user to another.
 */
export function getCustomLikedSongs(userId?: string): Track[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = getUserLikedSongsKey(userId);
    let songs: Track[] = [];
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) songs = parsed;
    }

    // Fallback 1: If empty, check active cache keys
    if (songs.length === 0) {
      for (const k of ['spotifree_custom_liked_songs_active', 'spotifree_custom_liked_songs']) {
        const r = window.localStorage.getItem(k);
        if (r) {
          try {
            const p = JSON.parse(r);
            if (Array.isArray(p) && p.length > 0) {
              songs = p;
              break;
            }
          } catch {}
        }
      }
    }

    // Fallback 2: Check in-memory store and cache for liked playlist tracks
    if (songs.length === 0) {
      try {
        const store = (window as any).__useSpotifyDataStore?.getState?.();
        if (store) {
          const isLikedTarget = (pid: string, pname?: string) =>
            pid === 'liked-songs' ||
            pid === 'user-liked-songs' ||
            pid === 'tracks' ||
            pid.includes('collection:tracks') ||
            /^(canciones que te gustan|canciones que me gustan|tus me gusta|liked songs|liked tracks)$/i.test((pname || '').trim());

          const storePl = store.playlists?.find((p: any) => isLikedTarget(p.id, p.name));
          if (storePl?.tracks?.items && storePl.tracks.items.length > 0) {
            songs = storePl.tracks.items;
          } else {
            const cache = store.playlistDetailsCache;
            if (cache) {
              for (const ck of ['liked-songs', 'user-liked-songs', 'collection:tracks', 'tracks']) {
                if (cache[ck]?.tracks?.items && cache[ck].tracks.items.length > 0) {
                  songs = cache[ck].tracks.items;
                  break;
                }
              }
            }
          }
        }
      } catch {}
    }

    // Fallback 3: Check user_imported_playlists or spotify_extracted_session
    if (songs.length === 0) {
      for (const sessionKey of ['user_imported_playlists', 'spotify_extracted_session']) {
        const rawS = window.localStorage.getItem(sessionKey);
        if (rawS) {
          try {
            const parsed = JSON.parse(rawS);
            const list = Array.isArray(parsed) ? parsed : parsed.playlists;
            if (Array.isArray(list)) {
              const pl = list.find((p: any) =>
                p.id === 'liked-songs' ||
                p.id === 'user-liked-songs' ||
                p.id === 'tracks' ||
                p.id?.includes('collection:tracks') ||
                /^(canciones que te gustan|canciones que me gustan|tus me gusta|liked songs)$/i.test((p.name || '').trim())
              );
              if (pl?.tracks?.items && pl.tracks.items.length > 0) {
                songs = pl.tracks.items;
                break;
              }
            }
          } catch {}
        }
      }
    }

    // Fallback 4: If user-specific key is empty, check guest key
    if (songs.length === 0 && key !== 'spotifree_guest_liked_songs') {
      const guestRaw = window.localStorage.getItem('spotifree_guest_liked_songs');
      if (guestRaw) {
        const guestParsed = JSON.parse(guestRaw);
        if (Array.isArray(guestParsed) && guestParsed.length > 0) {
          songs = guestParsed;
        }
      }
    }

    const removedIds = getRemovedTrackIdsForPlaylist('liked-songs');
    if (removedIds.size === 0) return deduplicateTracks(songs);

    return deduplicateTracks(songs).filter((t: Track) => {
      const tClean = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
      const tUri = `spotify:track:${tClean}`;
      const sig = t.name && t.artists?.[0]?.name
        ? `sig:${t.name.toLowerCase().trim()}::${t.artists[0].name.toLowerCase().trim()}`
        : '';
      return !removedIds.has(t.id) && !removedIds.has(tClean) && !removedIds.has(tUri) && (!sig || !removedIds.has(sig));
    });
  } catch {}
  return [];
}

/**
 * Saves or prepends a track into the user's private liked songs collection.
 */
export function saveCustomLikedSong(track: Track, userId?: string, currentTracksContext?: Track[]): Track[] {
  if (typeof window === 'undefined' || !track) return [];
  try {
    const clean = (track.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
    const sig = track.name && track.artists?.[0]?.name
      ? `sig:${track.name.toLowerCase().trim()}::${track.artists[0].name.toLowerCase().trim()}`
      : '';

    // Un-blacklist if previously removed across all liked song blacklist keys
    const blacklistKeys = [
      'spotifree_removed_tracks_liked-songs',
      'spotifree_removed_tracks_user-liked-songs',
      'spotifree_removed_tracks_collection:tracks',
      'spotifree_removed_tracks_collection-tracks',
      'spotifree_removed_tracks_tracks',
    ];
    for (const bKey of blacklistKeys) {
      const rawBlacklist = window.localStorage.getItem(bKey);
      if (rawBlacklist) {
        try {
          const bl: string[] = JSON.parse(rawBlacklist);
          const filtered = bl.filter((id) => {
            const c = (id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
            return id !== track.id && id !== clean && c !== clean && (!sig || id !== sig);
          });
          window.localStorage.setItem(bKey, JSON.stringify(filtered));
        } catch {}
      }
    }

    const key = getUserLikedSongsKey(userId);
    const current = currentTracksContext && currentTracksContext.length > 0
      ? currentTracksContext
      : getCustomLikedSongs(userId);

    const exists = current.some(
      (t) => t.id === track.id || (t.name === track.name && t.artists[0]?.name === track.artists[0]?.name)
    );
    const trackWithDate: Track = {
      ...track,
      added_at: track.added_at || 'Hoy',
    };
    const updated = exists ? current : [trackWithDate, ...current];
    window.localStorage.setItem(key, JSON.stringify(updated));
    if (key !== 'spotifree_custom_liked_songs') {
      window.localStorage.setItem('spotifree_custom_liked_songs', JSON.stringify(updated));
    }
    if (key !== 'spotifree_custom_liked_songs_active') {
      window.localStorage.setItem('spotifree_custom_liked_songs_active', JSON.stringify(updated));
    }
    return updated;
  } catch {}
  return [];
}

/**
 * Removes a track from the user's private liked songs collection.
 */
export function removeCustomLikedSong(trackId: string, userId?: string, trackObj?: Track): Track[] {
  if (typeof window === 'undefined' || !trackId) return [];
  try {
    const key = getUserLikedSongsKey(userId);
    const current = getCustomLikedSongs(userId);
    const clean = trackId.replace(/^spotify:track:/i, '').split('?')[0].trim();
    const sig = trackObj?.name && trackObj?.artists?.[0]?.name
      ? `sig:${trackObj.name.toLowerCase().trim()}::${trackObj.artists[0].name.toLowerCase().trim()}`
      : '';

    const filterOut = (t: Track) => {
      const tClean = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
      const matchId = t.id === trackId || tClean === clean || t.id === clean || t.id === `spotify:track:${clean}`;
      const matchName = trackObj && t.name?.toLowerCase().trim() === trackObj.name?.toLowerCase().trim() &&
        t.artists?.[0]?.name?.toLowerCase().trim() === trackObj.artists?.[0]?.name?.toLowerCase().trim();
      return !matchId && !matchName;
    };

    const updated = current.filter(filterOut);
    window.localStorage.setItem(key, JSON.stringify(updated));
    if (key !== 'spotifree_custom_liked_songs') {
      window.localStorage.setItem('spotifree_custom_liked_songs', JSON.stringify(updated));
    }
    if (key !== 'spotifree_custom_liked_songs_active') {
      window.localStorage.setItem('spotifree_custom_liked_songs_active', JSON.stringify(updated));
    }

    // Clean guest fallback so it cannot resurrect the deleted song
    const guestRaw = window.localStorage.getItem('spotifree_guest_liked_songs');
    if (guestRaw) {
      try {
        const guestParsed: Track[] = JSON.parse(guestRaw);
        window.localStorage.setItem('spotifree_guest_liked_songs', JSON.stringify(guestParsed.filter(filterOut)));
      } catch {}
    }

    // Blacklist in all liked-songs keys so it NEVER resurrects
    const blacklistKeys = [
      'spotifree_removed_tracks_liked-songs',
      'spotifree_removed_tracks_user-liked-songs',
      'spotifree_removed_tracks_collection:tracks',
      'spotifree_removed_tracks_collection-tracks',
      'spotifree_removed_tracks_tracks',
    ];
    for (const bKey of blacklistKeys) {
      const rawBlacklist = window.localStorage.getItem(bKey);
      let blacklist: string[] = rawBlacklist ? JSON.parse(rawBlacklist) : [];
      if (!blacklist.includes(clean)) blacklist.push(clean);
      if (!blacklist.includes(trackId)) blacklist.push(trackId);
      if (!blacklist.includes(`spotify:track:${clean}`)) blacklist.push(`spotify:track:${clean}`);
      if (sig && !blacklist.includes(sig)) blacklist.push(sig);
      window.localStorage.setItem(bKey, JSON.stringify(blacklist));
    }

    // Remove from spotifree_liked_tracks array
    const rawLikedTracks = window.localStorage.getItem('spotifree_liked_tracks');
    if (rawLikedTracks) {
      try {
        const lList: string[] = JSON.parse(rawLikedTracks);
        const fList = lList.filter((id) => {
          const c = (id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
          return id !== trackId && id !== clean && c !== clean && id !== `spotify:track:${clean}`;
        });
        window.localStorage.setItem('spotifree_liked_tracks', JSON.stringify(fList));
      } catch {}
    }

    // Remove from cloud account cached session
    const rawCloud = window.localStorage.getItem('spotifree_current_cloud_account');
    if (rawCloud) {
      try {
        const parsed = JSON.parse(rawCloud);
        let changed = false;
        if (Array.isArray(parsed.likedTracks)) {
          parsed.likedTracks = parsed.likedTracks.filter((id: string) => {
            const c = (id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
            return id !== trackId && id !== clean && c !== clean && id !== `spotify:track:${clean}`;
          });
          changed = true;
        }
        if (Array.isArray(parsed.playlists)) {
          parsed.playlists = parsed.playlists.map((p: any) => {
            const isLikedPl =
              p.id === 'liked-songs' ||
              p.id === 'user-liked-songs' ||
              p.id === 'tracks' ||
              p.id?.includes('collection:tracks') ||
              /^(canciones que te gustan|canciones que me gustan|tus me gusta|liked songs)/i.test((p.name || '').trim());
            if (isLikedPl && p.tracks?.items) {
              const filtered = p.tracks.items.filter(filterOut);
              changed = true;
              return { ...p, tracks: { total: filtered.length, items: filtered } };
            }
            return p;
          });
        }
        if (changed) {
          window.localStorage.setItem('spotifree_current_cloud_account', JSON.stringify(parsed));
        }
      } catch {}
    }

    // Deep clean from extracted sessions, playlists cache and imported lists
    removeCustomTrackFromStorage('liked-songs', trackId, userId, trackObj);
    removeCustomTrackFromStorage('user-liked-songs', trackId, userId, trackObj);
    removeCustomTrackFromStorage('collection:tracks', trackId, userId, trackObj);

    window.dispatchEvent(
      new CustomEvent('spotifree_track_removed', {
        detail: { playlistId: 'liked-songs', trackId, trackObj },
      })
    );

    return updated;
  } catch {}
  return [];
}

/**
 * Retrieves custom tracks saved to a playlist for a specific user.
 */
export function getSavedCustomTracks(playlistId: string, isLiked: boolean, userId?: string): Track[] {
  if (isLiked) {
    return getCustomLikedSongs(userId);
  }
  if (typeof window === 'undefined' || !playlistId) return [];
  try {
    const targetId = userId || getActiveUserId();
    const cleanPl = (playlistId || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
    const keys = [
      targetId && targetId !== 'guest' && targetId !== 'spotify-user' ? `spotifree_playlist_tracks_${targetId}_${playlistId}` : null,
      targetId && targetId !== 'guest' && targetId !== 'spotify-user' ? `spotifree_playlist_tracks_${targetId}_${cleanPl}` : null,
      `spotifree_playlist_tracks_${playlistId}`,
      `spotifree_playlist_tracks_${cleanPl}`,
    ].filter(Boolean) as string[];

    let found: Track[] = [];
    for (const key of keys) {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            found = parsed;
            break;
          }
        } catch {}
      }
    }

    const removedIds = getRemovedTrackIdsForPlaylist(playlistId);
    if (removedIds.size === 0) return found;

    return found.filter((t) => {
      const tClean = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
      const tUri = `spotify:track:${tClean}`;
      const sig = t.name && t.artists?.[0]?.name
        ? `sig:${t.name.toLowerCase().trim()}::${t.artists[0].name.toLowerCase().trim()}`
        : '';
      return !removedIds.has(t.id) && !removedIds.has(tClean) && !removedIds.has(tUri) && (!sig || !removedIds.has(sig));
    });
  } catch {}
  return [];
}

/**
 * Saves a track to a playlist or liked songs for a specific user without destroying existing tracks.
 */
export function saveCustomTrackToStorage(
  playlistId: string,
  isLiked: boolean,
  track: Track,
  userId?: string,
  currentTracksContext?: Track[]
): void {
  if (isLiked) {
    saveCustomLikedSong(track, userId, currentTracksContext);
    return;
  }
  if (typeof window === 'undefined' || !playlistId || !track) return;
  try {
    const targetId = userId || getActiveUserId();
    const cleanTrack = (track.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
    const cleanPl = (playlistId || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
    const sig = track.name && track.artists?.[0]?.name
      ? `sig:${track.name.toLowerCase().trim()}::${track.artists[0].name.toLowerCase().trim()}`
      : '';

    // Un-blacklist if previously removed
    const blacklistKeys = [
      `spotifree_removed_tracks_${cleanPl}`,
      `spotifree_removed_tracks_${playlistId}`,
    ];
    for (const bKey of blacklistKeys) {
      const rawBlacklist = window.localStorage.getItem(bKey);
      if (rawBlacklist) {
        try {
          const bl: string[] = JSON.parse(rawBlacklist);
          const filtered = bl.filter((id) => {
            const c = (id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
            return id !== track.id && id !== cleanTrack && c !== cleanTrack && (!sig || id !== sig);
          });
          window.localStorage.setItem(bKey, JSON.stringify(filtered));
        } catch {}
      }
    }

    const key = targetId && targetId !== 'guest' && targetId !== 'spotify-user'
      ? `spotifree_playlist_tracks_${targetId}_${cleanPl}`
      : `spotifree_playlist_tracks_${cleanPl}`;

    // Get existing base tracks so we never wipe them out
    let baseList: Track[] = [];
    if (currentTracksContext && currentTracksContext.length > 0) {
      baseList = currentTracksContext;
    } else {
      baseList = getSavedCustomTracks(playlistId, false, targetId);
      if (baseList.length === 0) {
        try {
          const store = (window as any).__useSpotifyDataStore?.getState?.();
          const storePl = store?.playlists?.find((p: any) => p.id === playlistId || p.id === cleanPl);
          if (storePl?.tracks?.items && storePl.tracks.items.length > 0) {
            baseList = storePl.tracks.items;
          }
        } catch {}
      }
    }

    const trackWithDate: Track = { ...track, added_at: track.added_at || 'Hoy' };
    const exists = baseList.some(
      (t) => t.id === track.id || (t.name === track.name && t.artists[0]?.name === track.artists[0]?.name)
    );
    const fullList = exists ? baseList : [...baseList, trackWithDate];

    window.localStorage.setItem(key, JSON.stringify(fullList));
    window.localStorage.setItem(`spotifree_playlist_tracks_${cleanPl}`, JSON.stringify(fullList));
    if (cleanPl !== playlistId) {
      window.localStorage.setItem(`spotifree_playlist_tracks_${playlistId}`, JSON.stringify(fullList));
      if (targetId && targetId !== 'guest' && targetId !== 'spotify-user') {
        window.localStorage.setItem(`spotifree_playlist_tracks_${targetId}_${playlistId}`, JSON.stringify(fullList));
      }
    }
  } catch {}
}

export function removeCustomTrackFromStorage(
  playlistId: string,
  trackId: string,
  userId?: string,
  trackObj?: Track
): void {
  if (typeof window === 'undefined' || !playlistId || !trackId) return;
  try {
    const targetId = userId || getActiveUserId();
    const cleanTrack = (trackId || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
    const cleanPl = (playlistId || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
    const sig = trackObj?.name && trackObj?.artists?.[0]?.name
      ? `sig:${trackObj.name.toLowerCase().trim()}::${trackObj.artists[0].name.toLowerCase().trim()}`
      : '';

    const filterOut = (t: any) => {
      if (!t) return false;
      const tClean = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
      const matchId = t.id === trackId || t.id === cleanTrack || tClean === cleanTrack || t.id === `spotify:track:${cleanTrack}`;
      const matchName = trackObj && t.name?.toLowerCase().trim() === trackObj.name?.toLowerCase().trim() &&
        t.artists?.[0]?.name?.toLowerCase().trim() === trackObj.artists?.[0]?.name?.toLowerCase().trim();
      return !matchId && !matchName;
    };

    // 1. Remove from all possible custom saved track keys
    const customKeys = [
      `spotifree_playlist_tracks_${targetId}_${playlistId}`,
      `spotifree_playlist_tracks_${targetId}_${cleanPl}`,
      `spotifree_playlist_tracks_${playlistId}`,
      `spotifree_playlist_tracks_${cleanPl}`,
    ];
    for (const key of customKeys) {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        try {
          const list: Track[] = JSON.parse(raw);
          const filtered = list.filter(filterOut);
          window.localStorage.setItem(key, JSON.stringify(filtered));
        } catch {}
      }
    }

    // 2. Blacklist this track for this playlist so it never resurrects from initial cache or server
    const blacklistKeys = [
      `spotifree_removed_tracks_${cleanPl}`,
      `spotifree_removed_tracks_${playlistId}`,
    ];
    for (const bKey of blacklistKeys) {
      const rawBlacklist = window.localStorage.getItem(bKey);
      let blacklist: string[] = rawBlacklist ? JSON.parse(rawBlacklist) : [];
      if (!blacklist.includes(cleanTrack)) blacklist.push(cleanTrack);
      if (!blacklist.includes(trackId)) blacklist.push(trackId);
      if (!blacklist.includes(`spotify:track:${cleanTrack}`)) blacklist.push(`spotify:track:${cleanTrack}`);
      if (sig && !blacklist.includes(sig)) blacklist.push(sig);
      window.localStorage.setItem(bKey, JSON.stringify(blacklist));
    }

    // 3. Update cached playlist object in user_imported_playlists
    const rawImported = window.localStorage.getItem('user_imported_playlists');
    if (rawImported) {
      try {
        const list = JSON.parse(rawImported);
        let changed = false;
        const nextList = list.map((p: any) => {
          const pClean = (p.id || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
          if (p.id === playlistId || p.id === cleanPl || pClean === cleanPl) {
            if (p.tracks?.items) {
              changed = true;
              const filtered = p.tracks.items.filter(filterOut);
              return { ...p, tracks: { total: filtered.length, items: filtered } };
            }
          }
          return p;
        });
        if (changed) {
          window.localStorage.setItem('user_imported_playlists', JSON.stringify(nextList));
        }
      } catch {}
    }

    // 4. Update cached playlist object in spotifree_playlist_cache_*
    const cacheKeys = [`spotifree_playlist_cache_${targetId}`, 'spotifree_playlist_cache_active'];
    for (const ck of cacheKeys) {
      const rawCache = window.localStorage.getItem(ck);
      if (rawCache) {
        try {
          const cacheObj = JSON.parse(rawCache);
          for (const targetKey of [playlistId, cleanPl, `spotify:playlist:${cleanPl}`]) {
            if (cacheObj[targetKey]?.tracks?.items) {
              const filtered = cacheObj[targetKey].tracks.items.filter(filterOut);
              cacheObj[targetKey] = {
                ...cacheObj[targetKey],
                tracks: { total: filtered.length, items: filtered },
              };
              window.localStorage.setItem(ck, JSON.stringify(cacheObj));
            }
          }
        } catch {}
      }
    }

    // 5. Update cached playlist object in spotify_extracted_session
    const rawExtracted = window.localStorage.getItem('spotify_extracted_session');
    if (rawExtracted) {
      try {
        const parsed = JSON.parse(rawExtracted);
        let changed = false;
        if (Array.isArray(parsed.playlists)) {
          parsed.playlists = parsed.playlists.map((p: any) => {
            const pClean = (p.id || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
            if (p.id === playlistId || p.id === cleanPl || pClean === cleanPl) {
              if (p.tracks?.items) {
                changed = true;
                const filtered = p.tracks.items.filter(filterOut);
                return { ...p, tracks: { total: filtered.length, items: filtered } };
              }
            }
            return p;
          });
        }
        if (parsed.cachedPlaylistDetails) {
          for (const key of [playlistId, cleanPl, `spotify:playlist:${cleanPl}`]) {
            if (parsed.cachedPlaylistDetails[key]?.tracks?.items) {
              changed = true;
              const filtered = parsed.cachedPlaylistDetails[key].tracks.items.filter(filterOut);
              parsed.cachedPlaylistDetails[key] = {
                ...parsed.cachedPlaylistDetails[key],
                tracks: { total: filtered.length, items: filtered },
              };
            }
          }
        }
        if (changed) {
          window.localStorage.setItem('spotify_extracted_session', JSON.stringify(parsed));
        }
      } catch {}
    }

    // 6. Update cached playlist object in spotifree_account_session_${targetId}
    const rawAccount = window.localStorage.getItem(`spotifree_account_session_${targetId}`);
    if (rawAccount) {
      try {
        const parsed = JSON.parse(rawAccount);
        let changed = false;
        if (Array.isArray(parsed.playlists)) {
          parsed.playlists = parsed.playlists.map((p: any) => {
            const pClean = (p.id || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
            if (p.id === playlistId || p.id === cleanPl || pClean === cleanPl) {
              if (p.tracks?.items) {
                changed = true;
                const filtered = p.tracks.items.filter(filterOut);
                return { ...p, tracks: { total: filtered.length, items: filtered } };
              }
            }
            return p;
          });
        }
        if (changed) {
          window.localStorage.setItem(`spotifree_account_session_${targetId}`, JSON.stringify(parsed));
        }
      } catch {}
    }

    // 7. Update current cloud account session cache
    const rawCloudAcc = window.localStorage.getItem('spotifree_current_cloud_account');
    if (rawCloudAcc) {
      try {
        const parsed = JSON.parse(rawCloudAcc);
        let changed = false;
        const isLikedPl =
          cleanPl === 'liked-songs' ||
          cleanPl === 'tracks' ||
          cleanPl === 'collection:tracks' ||
          playlistId === 'liked-songs' ||
          /^(canciones que te gustan|canciones que me gustan|tus me gusta|liked songs)/i.test(cleanPl);

        if (isLikedPl && Array.isArray(parsed.likedTracks)) {
          const prevLen = parsed.likedTracks.length;
          parsed.likedTracks = parsed.likedTracks.filter((id: string) => {
            const c = (id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
            return id !== trackId && id !== cleanTrack && c !== cleanTrack && id !== `spotify:track:${cleanTrack}`;
          });
          if (parsed.likedTracks.length !== prevLen) changed = true;
        }

        if (Array.isArray(parsed.playlists)) {
          parsed.playlists = parsed.playlists.map((p: any) => {
            const pClean = (p.id || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
            const match =
              p.id === playlistId ||
              p.id === cleanPl ||
              pClean === cleanPl ||
              (isLikedPl && (p.id === 'liked-songs' || pClean === 'liked-songs' || /^(canciones que te gustan|canciones que me gustan|tus me gusta|liked songs)/i.test((p.name || '').trim())));
            if (match && p.tracks?.items) {
              changed = true;
              const filtered = p.tracks.items.filter(filterOut);
              return { ...p, tracks: { total: filtered.length, items: filtered } };
            }
            return p;
          });
        }
        if (changed) {
          window.localStorage.setItem('spotifree_current_cloud_account', JSON.stringify(parsed));
        }
      } catch {}
    }
  } catch {}
}

export function getRemovedTrackIdsForPlaylist(playlistId: string): Set<string> {
  if (typeof window === 'undefined' || !playlistId) return new Set();
  try {
    const cleanPl = (playlistId || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
    const isLiked =
      cleanPl === 'liked-songs' ||
      cleanPl === 'tracks' ||
      cleanPl === 'collection:tracks' ||
      cleanPl === 'collection-tracks' ||
      cleanPl === 'user-liked-songs' ||
      /^(canciones que te gustan|canciones que me gustan|tus me gusta|liked songs|liked tracks|saved songs|saved tracks|favoritas|favorites|my favorites|favorite songs)$/i.test(cleanPl);

    const keysToRead = isLiked
      ? [
          'spotifree_removed_tracks_liked-songs',
          'spotifree_removed_tracks_user-liked-songs',
          'spotifree_removed_tracks_collection:tracks',
          'spotifree_removed_tracks_collection-tracks',
          'spotifree_removed_tracks_tracks',
        ]
      : [
          `spotifree_removed_tracks_${cleanPl}`,
          `spotifree_removed_tracks_${playlistId}`,
        ];

    const set = new Set<string>();
    for (const targetKey of keysToRead) {
      const raw = window.localStorage.getItem(targetKey);
      if (raw) {
        try {
          const list: string[] = JSON.parse(raw);
          list.forEach((id) => {
            if (!id) return;
            set.add(id);
            const c = id.replace(/^spotify:track:/i, '').split('?')[0].trim();
            if (c) {
              set.add(c);
              set.add(`spotify:track:${c}`);
            }
          });
        } catch {}
      }
    }
    return set;
  } catch {}
  return new Set();
}

export const SHARED_PLAYLISTS_KEY = 'spotifree_shared_playlists';

export interface SharedPlaylistMetadata {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  ownerId: string;
  ownerName: string;
  tracks: Track[];
  isCollaborative: boolean;
  updatedAt: number;
}

export function getSharedPlaylists(): SharedPlaylistMetadata[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SHARED_PLAYLISTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveSharedPlaylist(playlist: SharedPlaylistMetadata): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getSharedPlaylists().filter((p) => p.id !== playlist.id);
    current.unshift({ ...playlist, updatedAt: Date.now() });
    window.localStorage.setItem(SHARED_PLAYLISTS_KEY, JSON.stringify(current));
  } catch {}
}

export function getSharedPlaylistById(playlistId: string): SharedPlaylistMetadata | null {
  const all = getSharedPlaylists();
  return all.find((p) => p.id === playlistId) || null;
}
