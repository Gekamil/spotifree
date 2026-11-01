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

export interface LyricWord {
  timeMs: number;
  text: string;
}

export interface SyncedLine {
  timeMs: number;
  endTimeMs: number;
  text: string;
  words: LyricWord[];
}

export function parseEnhancedLyrics(lrcText: string): SyncedLine[] {
  if (!lrcText) return [];
  const rawLines = lrcText.split('\n');
  const tempLines: Array<{ timeMs: number; text: string; rawContent: string }> = [];

  for (const raw of rawLines) {
    const lineMatch = raw.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/);
    if (lineMatch) {
      const min = parseInt(lineMatch[1], 10);
      const sec = parseFloat(`${lineMatch[2]}.${lineMatch[3]}`);
      const timeMs = Math.round((min * 60 + sec) * 1000);
      const content = lineMatch[4].trim();
      if (content) {
        tempLines.push({
          timeMs,
          text: content.replace(/<\d{2}:\d{2}\.\d{2,3}>/g, '').trim(),
          rawContent: content,
        });
      }
    }
  }

  tempLines.sort((a, b) => a.timeMs - b.timeMs);

  const parsedLines: SyncedLine[] = [];
  const wordTokenRegex = /<(\d{2}):(\d{2})\.(\d{2,3})>([^<]*)/g;

  for (let i = 0; i < tempLines.length; i++) {
    const item = tempLines[i];
    const nextItem = tempLines[i + 1];
    const endTimeMs = nextItem ? nextItem.timeMs : item.timeMs + 4500;
    const words: LyricWord[] = [];

    wordTokenRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = wordTokenRegex.exec(item.rawContent)) !== null) {
      const wMin = parseInt(match[1], 10);
      const wSec = parseFloat(`${match[2]}.${match[3]}`);
      const wTimeMs = Math.round((wMin * 60 + wSec) * 1000);
      const wText = match[4];
      if (wText) {
        words.push({ timeMs: wTimeMs, text: wText });
      }
    }

    if (words.length === 0) {
      const tokens = item.text.split(/(\s+)/).filter(Boolean);
      const totalChars = tokens.reduce((acc, t) => acc + (t.trim().length > 0 ? t.length : 0), 0);
      const rawGap = Math.max(800, endTimeMs - item.timeMs);
      const lineDuration = Math.max(600, Math.min(rawGap * 0.78, 4800));
      let elapsedMs = 0;

      for (let j = 0; j < tokens.length; j++) {
        const token = tokens[j];
        const isSpace = token.trim().length === 0;
        const charWeight = isSpace ? 0.2 : token.length;
        const fraction = totalChars > 0 ? charWeight / (totalChars + 0.2 * tokens.length) : 1 / tokens.length;
        const wTimeMs = item.timeMs + Math.round(elapsedMs);
        words.push({ timeMs: wTimeMs, text: token });
        elapsedMs += fraction * lineDuration;
      }
    }

    parsedLines.push({
      timeMs: item.timeMs,
      endTimeMs,
      text: item.text,
      words,
    });
  }

  return parsedLines;
}
