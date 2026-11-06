import type { Playlist } from '../types/spotify';

/**
 * Spotify's look for a playlist without artwork: dark grey square with an outlined music note.
 * (Using the "Canciones que te gustan" heart for every empty list made them look like Liked Songs.)
 */
export const EMPTY_PLAYLIST_COVER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23282828"/><path d="M128 102v74.5a22 22 0 1 0 10 18.5V128l52-11v47.5a22 22 0 1 0 10 18.5V89z" fill="none" stroke="%237f7f7f" stroke-width="7" stroke-linejoin="round"/></svg>';

const LIKED_COVER = 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';

/** Best cover for a playlist: its own image, else the first track's album art, else the empty cover. */
export function getPlaylistCover(p: Partial<Playlist> | null | undefined): string {
  if (!p) return EMPTY_PLAYLIST_COVER;
  if (p.id === 'liked-songs') return LIKED_COVER;
  const own = p.images?.find((i) => i?.url)?.url;
  // Older builds saved the Liked Songs heart as the cover of brand-new playlists: ignore it there
  if (own && !(own === LIKED_COVER && p.id !== 'liked-songs')) return own;
  const items = p.tracks?.items || [];
  for (const t of items) {
    const art = t?.album?.images?.[0]?.url;
    if (art) return art;
  }
  return EMPTY_PLAYLIST_COVER;
}
