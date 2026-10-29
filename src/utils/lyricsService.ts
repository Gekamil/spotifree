const LYRICS_CACHE = new Map<string, { syncedLyrics: string | null; plainLyrics: string | null }>();

if (typeof window !== 'undefined') {
  try {
    const saved = window.localStorage.getItem('spotifree_lyrics_cache');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.entries(parsed).forEach(([k, v]) => {
        if (v && typeof v === 'object') LYRICS_CACHE.set(k, v as any);
      });
    }
  } catch {}
}

function persistLyrics(key: string, data: { syncedLyrics: string | null; plainLyrics: string | null }) {
  LYRICS_CACHE.set(key, data);
  if (typeof window !== 'undefined') {
    try {
      const obj: Record<string, any> = {};
      let count = 0;
      for (const [k, v] of LYRICS_CACHE.entries()) {
        obj[k] = v;
        if (++count > 250) break;
      }
      window.localStorage.setItem('spotifree_lyrics_cache', JSON.stringify(obj));
    } catch {}
  }
}

export function cleanTrackTitle(title: string): string {
  return (title || '')
    .replace(/\s*-\s*Remastered(\s*\d+)?/gi, '')
    .replace(/\s*\(Remastered(\s*\d+)?\)/gi, '')
    .replace(/\s*\[Explicit\]/gi, '')
    .replace(/\s*\(Explicit\)/gi, '')
    .replace(/\s*\(feat\..*?\)/gi, '')
    .replace(/\s*\[feat\..*?\]/gi, '')
    .replace(/\s*\(ft\..*?\)/gi, '')
    .replace(/\s*\[ft\..*?\]/gi, '')
    .replace(/\s*\(Official.*?\)/gi, '')
    .replace(/\s*\[Official.*?\]/gi, '')
    .replace(/\s*\(Video.*?\)/gi, '')
    .replace(/\s*-\s*Radio Edit/gi, '')
    .replace(/\s*-\s*Album Version/gi, '')
    .trim();
}

export function cleanArtistName(artist: string): string {
  return (artist || '')
    .split(/[,&]/)[0]
    .replace(/\s*feat\..*$/i, '')
    .replace(/\s*ft\..*$/i, '')
    .trim();
}

export async function fetchLyricsUnified(
  title: string,
  artist: string
): Promise<{ syncedLyrics: string | null; plainLyrics: string | null }> {
  const rawTitle = (title || '').trim();
  const rawArtist = (artist || '').trim();
  if (!rawTitle) return { syncedLyrics: null, plainLyrics: null };

  const cleanTitle = cleanTrackTitle(rawTitle);
  const cleanArtist = cleanArtistName(rawArtist);
  const cacheKey = `${cleanTitle.toLowerCase()}___${cleanArtist.toLowerCase()}`;

  if (LYRICS_CACHE.has(cacheKey)) {
    return LYRICS_CACHE.get(cacheKey)!;
  }

  // 1. Query internal API endpoint
  try {
    const res = await fetch(`/api/lyrics?title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}`, {
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && (data.syncedLyrics || data.plainLyrics)) {
        persistLyrics(cacheKey, data);
        return data;
      }
    }
  } catch {}

  // 2. Client-side direct LRCLIB exact match
  try {
    const lrcRes = await fetch(
      `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`,
      {
        headers: { 'User-Agent': 'Spotifree/1.0' },
        signal: AbortSignal.timeout(3500),
      }
    );
    if (lrcRes.ok) {
      const lrcData = await lrcRes.json();
      if (lrcData && (lrcData.syncedLyrics || lrcData.plainLyrics)) {
        persistLyrics(cacheKey, lrcData);
        return lrcData;
      }
    }
  } catch {}

  // 3. Client-side broad LRCLIB search query
  try {
    const searchRes = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanTitle} ${cleanArtist}`)}`,
      {
        headers: { 'User-Agent': 'Spotifree/1.0' },
        signal: AbortSignal.timeout(3500),
      }
    );
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (Array.isArray(searchData) && searchData.length > 0) {
        const best = searchData.find((s) => s.syncedLyrics) || searchData[0];
        if (best && (best.syncedLyrics || best.plainLyrics)) {
          persistLyrics(cacheKey, best);
          return best;
        }
      }
    }
  } catch {}

  // 4. Lyrics.ovh fallback (plain lyrics)
  try {
    const ovhRes = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (ovhRes.ok) {
      const ovhData = await ovhRes.json();
      if (ovhData?.lyrics) {
        const result = { syncedLyrics: null, plainLyrics: ovhData.lyrics };
        persistLyrics(cacheKey, result);
        return result;
      }
    }
  } catch {}

  return { syncedLyrics: null, plainLyrics: null };
}
