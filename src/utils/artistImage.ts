export const ARTIST_IMAGE_CACHE = new Map<string, string>();

if (typeof window !== 'undefined') {
  try {
    const saved = window.localStorage.getItem('spotifree_artist_images');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === 'string') ARTIST_IMAGE_CACHE.set(k.toLowerCase(), v);
      });
    }
  } catch {}
}

export function persistArtistImage(artistName: string, url: string) {
  if (!artistName || !url) return;
  const key = artistName.toLowerCase().trim();
  ARTIST_IMAGE_CACHE.set(key, url);
  if (typeof window !== 'undefined') {
    try {
      const obj: Record<string, string> = {};
      let count = 0;
      for (const [k, v] of ARTIST_IMAGE_CACHE.entries()) {
        obj[k] = v;
        if (++count > 500) break;
      }
      window.localStorage.setItem('spotifree_artist_images', JSON.stringify(obj));
    } catch {}
  }
}

/**
 * Resolves the genuine independent headshot / profile picture of an artist.
 * Does NOT use track album artwork.
 */
export async function getArtistPicture(artistName: string): Promise<string | null> {
  const clean = (artistName || '').trim();
  if (!clean) return null;
  const key = clean.toLowerCase();

  if (ARTIST_IMAGE_CACHE.has(key)) {
    return ARTIST_IMAGE_CACHE.get(key)!;
  }

  // 1. Dedicated Backend API Endpoint (Deezer artist photo with full CORS)
  try {
    const res = await fetch(`/api/artist-image?name=${encodeURIComponent(clean)}`, {
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.picture) {
        persistArtistImage(clean, data.picture);
        return data.picture;
      }
    }
  } catch {}

  // 2. iTunes artist search fallback (direct in browser, has CORS: *)
  try {
    const itunesRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(clean)}&media=music&entity=song&limit=1`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (itunesRes.ok) {
      const itData = await itunesRes.json();
      if (itData.results?.[0]?.artworkUrl100) {
        const pic = itData.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
        persistArtistImage(clean, pic);
        return pic;
      }
    }
  } catch {}

  return null;
}
