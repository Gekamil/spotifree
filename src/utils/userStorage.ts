import type { Track } from '../types/spotify';

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
    // Fallback: If user-specific key is empty, check guest key and copy over
    if (songs.length === 0 && key !== 'spotifree_guest_liked_songs') {
      const guestRaw = window.localStorage.getItem('spotifree_guest_liked_songs');
      if (guestRaw) {
        const guestParsed = JSON.parse(guestRaw);
        if (Array.isArray(guestParsed) && guestParsed.length > 0) {
          try {
            window.localStorage.setItem(key, JSON.stringify(guestParsed));
          } catch {}
          songs = guestParsed;
        }
      }
    }

    const removedIds = getRemovedTrackIdsForPlaylist('liked-songs');
    if (removedIds.size === 0) return songs;
    return songs.filter((t) => {
      const tClean = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
      return !removedIds.has(t.id) && !removedIds.has(tClean);
    });
  } catch {}
  return [];
}

/**
 * Saves or prepends a track into the user's private liked songs collection.
 */
export function saveCustomLikedSong(track: Track, userId?: string): Track[] {
  if (typeof window === 'undefined' || !track) return [];
  try {
    // Un-blacklist if previously removed
    const clean = (track.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
    const rawBlacklist = window.localStorage.getItem('spotifree_removed_tracks_liked-songs');
    if (rawBlacklist) {
      try {
        const bl: string[] = JSON.parse(rawBlacklist);
        const filtered = bl.filter((id) => {
          const c = (id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
          return id !== track.id && id !== clean && c !== clean;
        });
        window.localStorage.setItem('spotifree_removed_tracks_liked-songs', JSON.stringify(filtered));
      } catch {}
    }

    const key = getUserLikedSongsKey(userId);
    const current = getCustomLikedSongs(userId);
    const exists = current.some(
      (t) => t.id === track.id || (t.name === track.name && t.artists[0]?.name === track.artists[0]?.name)
    );
    if (!exists) {
      const trackWithDate: Track = {
        ...track,
        added_at: track.added_at || 'Hoy',
      };
      const updated = [trackWithDate, ...current];
      window.localStorage.setItem(key, JSON.stringify(updated));
      return updated;
    }
    return current;
  } catch {}
  return [];
}

/**
 * Removes a track from the user's private liked songs collection.
 */
export function removeCustomLikedSong(trackId: string, userId?: string): Track[] {
  if (typeof window === 'undefined' || !trackId) return [];
  try {
    const key = getUserLikedSongsKey(userId);
    const current = getCustomLikedSongs(userId);
    const clean = trackId.replace(/^spotify:track:/i, '').split('?')[0].trim();
    const updated = current.filter((t) => {
      const tClean = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
      return t.id !== trackId && tClean !== clean && t.id !== `spotify:track:${clean}`;
    });
    window.localStorage.setItem(key, JSON.stringify(updated));
    if (key !== 'spotifree_custom_liked_songs') {
      window.localStorage.setItem('spotifree_custom_liked_songs', JSON.stringify(updated));
    }
    if (key !== 'spotifree_custom_liked_songs_active') {
      window.localStorage.setItem('spotifree_custom_liked_songs_active', JSON.stringify(updated));
    }

    // Blacklist in liked-songs so it never resurrects on refresh
    const rawBlacklist = window.localStorage.getItem('spotifree_removed_tracks_liked-songs');
    let blacklist: string[] = rawBlacklist ? JSON.parse(rawBlacklist) : [];
    if (!blacklist.includes(clean)) blacklist.push(clean);
    if (!blacklist.includes(trackId)) blacklist.push(trackId);
    if (!blacklist.includes(`spotify:track:${clean}`)) blacklist.push(`spotify:track:${clean}`);
    window.localStorage.setItem('spotifree_removed_tracks_liked-songs', JSON.stringify(blacklist));

    // Remove from spotifree_liked_tracks array
    const rawLikedTracks = window.localStorage.getItem('spotifree_liked_tracks');
    if (rawLikedTracks) {
      try {
        const lList: string[] = JSON.parse(rawLikedTracks);
        const fList = lList.filter((id) => {
          const c = (id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
          return id !== trackId && id !== clean && c !== clean;
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
            return id !== trackId && id !== clean && c !== clean;
          });
          changed = true;
        }
        if (Array.isArray(parsed.playlists)) {
          parsed.playlists = parsed.playlists.map((p: any) => {
            const isLikedPl =
              p.id === 'liked-songs' ||
              p.id === 'user-liked-songs' ||
              p.id === 'tracks' ||
              p.id?.includes('collection:tracks');
            if (isLikedPl && p.tracks?.items) {
              const filtered = p.tracks.items.filter((t: any) => {
                const c = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
                return t.id !== trackId && t.id !== clean && c !== clean;
              });
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
    removeCustomTrackFromStorage('liked-songs', trackId, userId);

    window.dispatchEvent(
      new CustomEvent('spotifree_track_removed', {
        detail: { playlistId: 'liked-songs', trackId },
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
      return !removedIds.has(t.id) && !removedIds.has(tClean);
    });
  } catch {}
  return [];
}

/**
 * Saves a track to a playlist or liked songs for a specific user.
 */
export function saveCustomTrackToStorage(playlistId: string, isLiked: boolean, track: Track, userId?: string): void {
  if (isLiked) {
    saveCustomLikedSong(track, userId);
    return;
  }
  if (typeof window === 'undefined' || !playlistId || !track) return;
  try {
    const targetId = userId || getActiveUserId();
    const cleanTrack = (track.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
    const cleanPl = (playlistId || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();

    // Un-blacklist if previously removed
    const blacklistKey = `spotifree_removed_tracks_${cleanPl}`;
    const rawBlacklist = window.localStorage.getItem(blacklistKey);
    if (rawBlacklist) {
      try {
        const bl: string[] = JSON.parse(rawBlacklist);
        const filtered = bl.filter((id) => {
          const c = (id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
          return id !== track.id && id !== cleanTrack && c !== cleanTrack;
        });
        window.localStorage.setItem(blacklistKey, JSON.stringify(filtered));
      } catch {}
    }

    const key = targetId && targetId !== 'guest' && targetId !== 'spotify-user'
      ? `spotifree_playlist_tracks_${targetId}_${playlistId}`
      : `spotifree_playlist_tracks_${playlistId}`;
    const raw = window.localStorage.getItem(key);
    let list: Track[] = raw ? JSON.parse(raw) : [];
    if (!list.some((t) => t.id === track.id || (t.name === track.name && t.artists[0]?.name === track.artists[0]?.name))) {
      list.push({ ...track, added_at: track.added_at || 'Hoy' });
      window.localStorage.setItem(key, JSON.stringify(list));
      if (cleanPl !== playlistId) {
        window.localStorage.setItem(`spotifree_playlist_tracks_${targetId}_${cleanPl}`, JSON.stringify(list));
      }
    }
  } catch {}
}

export function removeCustomTrackFromStorage(playlistId: string, trackId: string, userId?: string): void {
  if (typeof window === 'undefined' || !playlistId || !trackId) return;
  try {
    const targetId = userId || getActiveUserId();
    const cleanTrack = (trackId || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
    const cleanPl = (playlistId || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();

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
          const filtered = list.filter((t) => {
            const tClean = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
            return t.id !== trackId && t.id !== cleanTrack && tClean !== cleanTrack;
          });
          window.localStorage.setItem(key, JSON.stringify(filtered));
        } catch {}
      }
    }

    // 2. Blacklist this track for this playlist so it never resurrects from initial cache or server
    const blacklistKey = `spotifree_removed_tracks_${cleanPl}`;
    const rawBlacklist = window.localStorage.getItem(blacklistKey);
    let blacklist: string[] = rawBlacklist ? JSON.parse(rawBlacklist) : [];
    if (!blacklist.includes(cleanTrack)) blacklist.push(cleanTrack);
    if (!blacklist.includes(trackId)) blacklist.push(trackId);
    window.localStorage.setItem(blacklistKey, JSON.stringify(blacklist));

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
              const filtered = p.tracks.items.filter((t: any) => {
                const tClean = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
                return t.id !== trackId && t.id !== cleanTrack && tClean !== cleanTrack;
              });
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
          const targetKey = cacheObj[playlistId] ? playlistId : cacheObj[cleanPl] ? cleanPl : null;
          if (targetKey && cacheObj[targetKey]?.tracks?.items) {
            const filtered = cacheObj[targetKey].tracks.items.filter((t: any) => {
              const tClean = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
              return t.id !== trackId && t.id !== cleanTrack && tClean !== cleanTrack;
            });
            cacheObj[targetKey] = {
              ...cacheObj[targetKey],
              tracks: { total: filtered.length, items: filtered },
            };
            window.localStorage.setItem(ck, JSON.stringify(cacheObj));
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
                const filtered = p.tracks.items.filter((t: any) => {
                  const tClean = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
                  return t.id !== trackId && t.id !== cleanTrack && tClean !== cleanTrack;
                });
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
              const filtered = parsed.cachedPlaylistDetails[key].tracks.items.filter((t: any) => {
                const tClean = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
                return t.id !== trackId && t.id !== cleanTrack && tClean !== cleanTrack;
              });
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
                const filtered = p.tracks.items.filter((t: any) => {
                  const tClean = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
                  return t.id !== trackId && t.id !== cleanTrack && tClean !== cleanTrack;
                });
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
          playlistId === 'liked-songs';

        if (isLikedPl && Array.isArray(parsed.likedTracks)) {
          const prevLen = parsed.likedTracks.length;
          parsed.likedTracks = parsed.likedTracks.filter((id: string) => {
            const c = (id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
            return id !== trackId && id !== cleanTrack && c !== cleanTrack;
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
              (isLikedPl && (p.id === 'liked-songs' || pClean === 'liked-songs'));
            if (match && p.tracks?.items) {
              changed = true;
              const filtered = p.tracks.items.filter((t: any) => {
                const tClean = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
                return t.id !== trackId && t.id !== cleanTrack && tClean !== cleanTrack;
              });
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
      cleanPl === 'user-liked-songs';
    const targetKey = isLiked ? 'liked-songs' : cleanPl;
    const raw = window.localStorage.getItem(`spotifree_removed_tracks_${targetKey}`);
    if (raw) {
      const list: string[] = JSON.parse(raw);
      const set = new Set<string>();
      list.forEach((id) => {
        if (!id) return;
        set.add(id);
        const c = id.replace(/^spotify:track:/i, '').split('?')[0].trim();
        if (c) {
          set.add(c);
          set.add(`spotify:track:${c}`);
        }
      });
      return set;
    }
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
