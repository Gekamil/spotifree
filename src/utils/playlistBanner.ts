import type { Playlist } from '../types/spotify';
import { useSpotifyDataStore } from '../store/useSpotifyDataStore';

/**
 * Dynamically resolves a genuine Spotify widescreen landscape banner for any playlist.
 * Returns null if the playlist only has a standard square cover art.
 * Never guesses or assigns an arbitrary banner from another playlist.
 */
export function resolvePlaylistBanner(playlist: Playlist | null | undefined): string | null {
  if (!playlist) return null;

  // 1. Explicit bannerUrl from backend / Spotify GraphQL Pathfinder / Embed
  if (playlist.bannerUrl && typeof playlist.bannerUrl === 'string') {
    return playlist.bannerUrl;
  }
  if ((playlist as any).header_image && typeof (playlist as any).header_image === 'string') {
    return (playlist as any).header_image;
  }

  // 2. Pickasso images are genuine Spotify landscape banners (Daily Mixes, Artist Radios, Discover Weekly, etc.)
  const firstImg = playlist.images?.[0]?.url || '';
  if (firstImg && firstImg.includes('pickasso.spotifycdn.com')) {
    return firstImg;
  }

  // 3. Check playlistDetailsCache & live Spotify shelves for this exact playlist ID or URI
  try {
    const store = useSpotifyDataStore.getState();
    if (store.playlistDetailsCache && store.playlistDetailsCache[playlist.id]) {
      const cached = store.playlistDetailsCache[playlist.id];
      if (cached?.bannerUrl) return cached.bannerUrl;
      const cImg = cached?.images?.[0]?.url || '';
      if (cImg.includes('pickasso.spotifycdn.com')) return cImg;
    }

    const allShelves = [...(store.dynamicShelves || []), ...((store as any).shelves || [])];
    for (const s of allShelves) {
      if (!Array.isArray(s.cards)) continue;
      const card = s.cards.find(
        (c: any) =>
          c.id === playlist.id ||
          (c as any).uri === `spotify:playlist:${playlist.id}` ||
          (c.title && playlist.name && c.title.toLowerCase().trim() === playlist.name.toLowerCase().trim())
      );
      if (card && card.image && card.image.includes('pickasso.spotifycdn.com')) {
        return card.image;
      }
    }
  } catch {}

  // 4. Aspect-ratio detection: if image object has width significantly greater than height
  const firstImageObj = playlist.images?.[0];
  if (firstImageObj && firstImageObj.width && firstImageObj.height) {
    if (firstImageObj.width > firstImageObj.height * 1.25) {
      return firstImageObj.url;
    }
  }

  // Otherwise, no widescreen banner exists for this playlist -> standard square cover
  return null;
}
