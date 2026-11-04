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
  artist: string,
  durationSec?: number
): Promise<{ syncedLyrics: string | null; plainLyrics: string | null }> {
  const rawTitle = (title || '').trim();
  const rawArtist = (artist || '').trim();
  if (!rawTitle) return { syncedLyrics: null, plainLyrics: null };

  const cleanTitle = cleanTrackTitle(rawTitle);
  const cleanArtist = cleanArtistName(rawArtist);
  const durSec = durationSec && durationSec > 0 ? Math.round(durationSec) : 0;
  const cacheKey = `${cleanTitle.toLowerCase()}___${cleanArtist.toLowerCase()}${durSec ? `_${durSec}` : ''}`;

  if (LYRICS_CACHE.has(cacheKey)) {
    return LYRICS_CACHE.get(cacheKey)!;
  }

  // 1. Query internal API endpoint
  try {
    const res = await fetch(
      `/api/lyrics?title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}${durSec ? `&duration=${durSec}` : ''}`,
      {
        signal: AbortSignal.timeout(3500),
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data && (data.syncedLyrics || data.plainLyrics)) {
        persistLyrics(cacheKey, data);
        return data;
      }
    }
  } catch {}

  // 2. Client-side direct LRCLIB exact match with duration
  try {
    let lrcUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
    if (durSec > 0) lrcUrl += `&duration=${durSec}`;
    const lrcRes = await fetch(lrcUrl, {
      headers: { 'User-Agent': 'Spotifree/1.0' },
      signal: AbortSignal.timeout(3500),
    });
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
        let best = null;
        if (durSec > 0) {
          best = searchData.find((s) => s.syncedLyrics && Math.abs((s.duration || 0) - durSec) <= 4);
        }
        if (!best) {
          best = searchData.find((s) => s.syncedLyrics) || searchData[0];
        }
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
  let globalOffsetMs = 0;

  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // Check [offset:+/-xxx] header
    const offsetMatch = trimmed.match(/^\[offset:\s*([+-]?\d+)\]/i);
    if (offsetMatch) {
      globalOffsetMs = parseInt(offsetMatch[1], 10) || 0;
      continue;
    }

    // Match all timestamps on the line, e.g. [01:23.45] or [00:15.20][01:30.40] or [1:23.4]
    const timestampRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    while ((match = timestampRegex.exec(trimmed)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      let fracMs = 0;
      if (match[3]) {
        if (match[3].length === 1) fracMs = parseInt(match[3], 10) * 100;
        else if (match[3].length === 2) fracMs = parseInt(match[3], 10) * 10;
        else fracMs = parseInt(match[3].slice(0, 3), 10);
      }
      timestamps.push((min * 60 + sec) * 1000 + fracMs);
      lastIndex = timestampRegex.lastIndex;
    }

    if (timestamps.length > 0) {
      const content = trimmed.slice(lastIndex).trim();
      const cleanText = content.replace(/<\d{1,2}:\d{2}(?:[.:]\d{1,3})?>/g, '').trim();
      if (cleanText) {
        for (const ts of timestamps) {
          tempLines.push({
            timeMs: Math.max(0, ts + globalOffsetMs),
            text: cleanText,
            rawContent: content,
          });
        }
      }
    }
  }

  tempLines.sort((a, b) => a.timeMs - b.timeMs);

  const parsedLines: SyncedLine[] = [];
  const wordTokenRegex = /<(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?>([^<]*)/g;

  for (let i = 0; i < tempLines.length; i++) {
    const item = tempLines[i];
    const nextItem = tempLines[i + 1];
    const endTimeMs = nextItem ? nextItem.timeMs : item.timeMs + 4500;
    const words: LyricWord[] = [];

    wordTokenRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = wordTokenRegex.exec(item.rawContent)) !== null) {
      const wMin = parseInt(match[1], 10);
      const wSec = parseInt(match[2], 10);
      let wFrac = 0;
      if (match[3]) {
        if (match[3].length === 1) wFrac = parseInt(match[3], 10) * 100;
        else if (match[3].length === 2) wFrac = parseInt(match[3], 10) * 10;
        else wFrac = parseInt(match[3].slice(0, 3), 10);
      }
      const wTimeMs = Math.max(0, (wMin * 60 + wSec) * 1000 + wFrac + globalOffsetMs);
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
