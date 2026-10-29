import type { Track } from '../types/spotify';

export const JORGE_DEFAULT_USER_ID = 'e6yr34zzwnf1yybcw49po6nrw';

/**
 * Returns the currently active Spotify user ID.
 */
export function getActiveUserId(): string {
  if (typeof window === 'undefined') return JORGE_DEFAULT_USER_ID;
  try {
    const savedId = window.localStorage.getItem('spotifree_active_user_id');
    if (savedId && savedId.trim()) return savedId.trim();

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
  return JORGE_DEFAULT_USER_ID;
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
 */
export function getUserLikedSongsKey(userId?: string): string {
  const targetId = userId || getActiveUserId();
  if (targetId && targetId !== 'spotify-user' && targetId !== 'guest') {
    return `spotifree_custom_liked_songs_${targetId}`;
  }
  return 'spotifree_custom_liked_songs';
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
      if (Array.isArray(parsed)) return parsed;
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
    const updated = current.filter((t) => t.id !== trackId);
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
    const key = targetId && targetId !== 'spotify-user'
      ? `spotifree_playlist_tracks_${targetId}_${playlistId}`
      : `spotifree_playlist_tracks_${playlistId}`;
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    // Fallback for default session
    if (!targetId || targetId === JORGE_DEFAULT_USER_ID) {
      const legacyRaw = window.localStorage.getItem(`spotifree_playlist_tracks_${playlistId}`);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        if (Array.isArray(parsed)) return parsed;
      }
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
    const key = targetId && targetId !== 'spotify-user'
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
