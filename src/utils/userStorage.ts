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
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    // Fallback: If user-specific key is empty, check guest key and copy over
    if (key !== 'spotifree_guest_liked_songs') {
      const guestRaw = window.localStorage.getItem('spotifree_guest_liked_songs');
      if (guestRaw) {
        const guestParsed = JSON.parse(guestRaw);
        if (Array.isArray(guestParsed) && guestParsed.length > 0) {
          try {
            window.localStorage.setItem(key, JSON.stringify(guestParsed));
          } catch {}
          return guestParsed;
        }
      }
    }
  } catch {}
  return [];
}

/**
 * Saves or prepends a track into the user's private liked songs collection.
 */
export function saveCustomLikedSong(track: Track, userId?: string): Track[] {
  if (typeof window === 'undefined' || !track) return [];
  try {
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
  if (typeof window === 'undefined') return [];
  try {
    const targetId = userId || getActiveUserId();
    const key = targetId && targetId !== 'guest' && targetId !== 'spotify-user'
      ? `spotifree_playlist_tracks_${targetId}_${playlistId}`
      : `spotifree_playlist_tracks_${playlistId}`;
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
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
  if (typeof window === 'undefined') return;
  try {
    const targetId = userId || getActiveUserId();
    const key = targetId && targetId !== 'guest' && targetId !== 'spotify-user'
      ? `spotifree_playlist_tracks_${targetId}_${playlistId}`
      : `spotifree_playlist_tracks_${playlistId}`;
    const raw = window.localStorage.getItem(key);
    let list: Track[] = raw ? JSON.parse(raw) : [];
    if (!list.some((t) => t.id === track.id || (t.name === track.name && t.artists[0]?.name === track.artists[0]?.name))) {
      list.push({ ...track, added_at: track.added_at || 'Hoy' });
      window.localStorage.setItem(key, JSON.stringify(list));
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
  } catch {}
}

export function getRemovedTrackIdsForPlaylist(playlistId: string): Set<string> {
  if (typeof window === 'undefined' || !playlistId) return new Set();
  try {
    const cleanPl = (playlistId || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
    const raw = window.localStorage.getItem(`spotifree_removed_tracks_${cleanPl}`);
    if (raw) {
      const list: string[] = JSON.parse(raw);
      return new Set(list.map((id) => (id || '').replace(/^spotify:track:/i, '').split('?')[0].trim()));
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
