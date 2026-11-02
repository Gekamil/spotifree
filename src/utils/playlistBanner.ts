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

  // 3. Known Daily Mixes mapping (Daily Mix 1..6)
  const normName = (playlist.name || '').toLowerCase().trim();
  const dailyMixMatch = normName.match(/(?:mix\s*diario|daily\s*mix)\s*([1-6])/i);
  if (dailyMixMatch) {
    const mixNum = dailyMixMatch[1];
    const DAILY_MIX_BANNERS: Record<string, string> = {
      '1': 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/1/ab6761610000e5ebba3ed5da785f99ce7ea6fb0b/es',
      '2': 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/2/ab6761610000e5ebc7688aad1bf03986934d7e26/es',
      '3': 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/3/ab6761610000e5ebc8be3c6e5a824360d1bffc03/es',
      '4': 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/4/ab6761610000e5eb9f6f7c2d12975d2a4b3a0fd8/es',
      '5': 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/5/ab6761610000e5eb3f9c363c3eef1ed52b8043a7/es',
      '6': 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/6/ab6761610000e5ebce4257ca508a2c7e600192ed/es',
    };
    if (DAILY_MIX_BANNERS[mixNum]) {
      return DAILY_MIX_BANNERS[mixNum];
    }
  }

  // 4. Check playlistDetailsCache & live Spotify shelves for this EXACT playlist ID or URI
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
          (c as any).uri === `spotify:playlist:${playlist.id}`
      );
      if (card && card.image && card.image.includes('pickasso.spotifycdn.com')) {
        return card.image;
      }
    }
  } catch {}

  // 5. Aspect-ratio detection: if image object has width significantly greater than height
  const firstImageObj = playlist.images?.[0];
  if (firstImageObj && firstImageObj.width && firstImageObj.height) {
    if (firstImageObj.width > firstImageObj.height * 1.25) {
      return firstImageObj.url;
    }
  }

  // Otherwise, no widescreen banner exists for this playlist -> standard square cover
  return null;
}
