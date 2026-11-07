/**
 * Consolidated Spotifree Audio API: Resolve & Stream
 * Serves /api/audio/resolve and /api/audio/stream
 */

const RESOLVE_CACHE = new Map();

function getVerifiedVideoId(q, title = '', artist = '') {
  if (!q && !title) return null;
  const full = `${q} ${title} ${artist}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  // ONLY match Quevedo - La Graciosa if BOTH Quevedo AND Graciosa are in the query
  if (full.includes('graciosa') && (full.includes('quevedo') || full.includes('elvis crespo') || full.includes('buenas noches'))) {
    return 'LZPLBSRnxSY';
  }
  // ONLY match Quevedo - Planteamiento Erróneo if BOTH Quevedo AND Planteamiento are in the query
  if (full.includes('planteamiento') && (full.includes('quevedo') || full.includes('erroneo') || full.includes('buenas noches'))) {
    return 'aWewyeC49e8';
  }
  return null;
}

function cleanQuery(query) {
  return query
    .replace(/\s*-\s*Remastered(\s*\d+)?/gi, '')
    .replace(/\s*\(Remastered(\s*\d+)?\)/gi, '')
    .replace(/\s*\[Explicit\]/gi, '')
    .replace(/\s*\(Explicit\)/gi, '')
    .replace(/\s*\(Bonus Track\)/gi, '')
    .replace(/\s*-\s*Radio Edit/gi, '')
    .replace(/\s*-\s*Single Version/gi, '')
    .replace(/\s*-\s*Original Mix/gi, '')
    .replace(/\s*\((with|feat\.|ft\.|featuring)\s+.*?\)/gi, '')
    .replace(/\s*\[(with|feat\.|ft\.|featuring)\s+.*?\]/gi, '')
    .replace(/\s*\(Deluxe.*?\)/gi, '')
    .replace(/\s*\[Deluxe.*?\]/gi, '')
    .replace(/\s*\(Anniversary.*?\)/gi, '')
    .replace(/\s*ft\..*$/gi, '')
    .replace(/\s*video\s*oficial\s*videoclip/gi, '')
    .replace(/\s*official\s*video/gi, '')
    .replace(/\s*music\s*video/gi, '')
    .replace(/\s*videoclip/gi, '')
    .replace(/\s*\(audio\s*oficial\)/gi, '')
    .replace(/\s*\[audio\s*oficial\]/gi, '')
    .replace(/\s*\(audio\)/gi, '')
    .replace(/\s*\[audio\]/gi, '')
    .replace(/\s*\(letra\)/gi, '')
    .replace(/\s*\[letra\]/gi, '')
    .replace(/\s*\(video\s*con\s*letra\)/gi, '')
    .replace(/\s*\[video\s*con\s*letra\)/gi, '')
    .replace(/\s*\(visualizer\)/gi, '')
    .replace(/\s*\[visualizer\]/gi, '')
    .replace(/\s*\(official\s*audio\)/gi, '')
    .replace(/\s*\[official\s*audio\]/gi, '')
    .replace(/\s*\(lyric\s*video\)/gi, '')
    .replace(/\s*\[lyric\s*video\]/gi, '')
    .trim();
}

function fetchWithTimeout(url, opts, ms = 3500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

const INVIDIOUS_INSTANCES = [
  'https://invidious.privacyredirect.com',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yt.drgnz.club',
];

function parseDurationSec(durStr) {
  if (!durStr) return 0;
  const parts = durStr.trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function scoreCandidate(query, expectedTitle, expectedArtist, candTitle, candArtist, candDurationSec = 0, expectedDurationSec = 0) {
  if (!candTitle) return -100;

  const normalize = (s) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();

  const cTitle = normalize(candTitle);
  const cArtist = normalize(candArtist);

  let expT = normalize(expectedTitle);
  let expA = normalize(expectedArtist);
  if (!expT) {
    expT = normalize(query);
  }

  let score = 0;

  // 1. Severe penalties for unwanted content (covers, karaoke, reaction, etc.)
  if (/\b(cover|karaoke|tributo|instrumental|reaction|reaccion|tutorial|acordes|piano cover|guitar cover|parodia)\b/i.test(cTitle)) {
    score -= 100;
  }
  // Penalize live concerts if the user did not ask for a live version
  if (/\b(live|en vivo|en directo|directo|concierto|acoustic live)\b/i.test(cTitle) && !/\b(live|en vivo)\b/i.test(expT)) {
    score -= 50;
  }
  // Penalize remix if the original track is not a remix
  if (/\b(remix|mashup)\b/i.test(cTitle) && !/\b(remix)\b/i.test(expT)) {
    score -= 30;
  }

  // 2. High priority for Studio Releases (- Topic / Official Audio) vs Music Videos with skits/intros
  const isTopic = /\b(topic)\b/i.test(candArtist.toLowerCase()) || candArtist.includes(' - Topic') || candTitle.includes(' - Topic');
  const isOfficialAudio = /\b(official audio|audio oficial|original mix|audio track|tema oficial|cancion oficial)\b/i.test(candTitle.toLowerCase());
  const isMusicVideo = /\b(video oficial|official video|videoclip|official music video|music video|clip oficial|video musical)\b/i.test(candTitle.toLowerCase());

  if (isTopic) {
    // Record-label auto-generated art track: EXACT studio version, 0s intro monologue, exact millisecond duration
    score += 85;
  } else if (isOfficialAudio) {
    // Verified studio audio release from official channel
    score += 75;
  } else if (isMusicVideo) {
    // Music videos often have monologue/skit intros or dialogue that ruins lyric sync -> heavy down-ranking
    score -= 40;
  }

  if (/\b(vevo)\b/i.test(candArtist.toLowerCase())) {
    score += 15;
  }

  // Penalize videos with explicit mentions of intro / short film / skit
  if (/\b(short film|pelicula|skit|dialogo|intro extended|with intro|con intro)\b/i.test(candTitle.toLowerCase())) {
    score -= 80;
  }

  // 3. Duration alignment with Spotify track (eliminates video clip intro skits and cut versions)
  if (expectedDurationSec > 0 && candDurationSec > 0) {
    const diff = candDurationSec - expectedDurationSec;
    const absDiff = Math.abs(diff);

    if (absDiff <= 2) {
      score += 65; // Perfect studio duration match!
    } else if (absDiff <= 4) {
      score += 40;
    } else if (absDiff <= 7) {
      score += 15;
    } else if (diff > 8) {
      // Candidate is noticeably longer than Spotify track -> video intro dialogue or outro skit!
      score -= Math.min(100, 30 + (diff - 8) * 5);
    } else if (diff < -10) {
      // Candidate is too short (cut/radio edit or incomplete)
      score -= 75;
    }
  }

  // 4. Title word matching
  const tWords = expT.split(/\s+/).filter((w) => w.length > 2);
  let tMatches = 0;
  for (const w of tWords) {
    if (cTitle.includes(w)) tMatches++;
  }
  if (tWords.length > 0 && tMatches === 0) {
    score -= 80;
  } else {
    const tRatio = tWords.length > 0 ? tMatches / tWords.length : 1;
    score += tRatio * 50;
  }

  // 5. Artist word matching (CRITICAL: prevents returning a completely different artist)
  if (expA) {
    const aWords = expA.split(/\s+/).filter((w) => w.length > 2);
    let aMatches = 0;
    for (const w of aWords) {
      if (cArtist.includes(w) || cTitle.includes(w)) aMatches++;
    }
    if (aWords.length > 0 && aMatches === 0) {
      score -= 80;
    } else {
      const aRatio = aWords.length > 0 ? aMatches / aWords.length : 0;
      score += aRatio * 40;
    }
  }

  // 6. Exact substring matches
  if (expT && cTitle.includes(expT)) {
    score += 25;
  }

  return score;
}

// YouTube Music search filtered to "Songs": only the audio uploads of each song
// (MUSIC_VIDEO_TYPE_ATV, the album audio with no video intro / outro)
const YTM_SONGS_PARAMS = 'EgWKAQIIAWoMEA4QChADEAQQCRAF';

async function ytmSearch(q, params) {
  const res = await fetchWithTimeout(
    'https://music.youtube.com/youtubei/v1/search',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20240318.01.00', hl: 'es', gl: 'ES' } },
        query: q,
        ...(params ? { params } : {}),
      }),
    },
    3500
  );
  if (!res.ok) throw new Error('YTM non-ok');
  const data = await res.json();
  const sections =
    data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
  const out = [];
  const typeOf = (we) => we?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType || '';
  for (const sec of sections) {
    if (sec.musicCardShelfRenderer) {
      const card = sec.musicCardShelfRenderer;
      const we =
        card.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint ||
        card.onTap?.watchEndpoint ||
        card.buttons?.[0]?.buttonRenderer?.command?.watchEndpoint;
      const sub = card.subtitle?.runs?.map((x) => x.text).join('') || '';
      if (we?.videoId) {
        const dm = sub.match(/\b(\d+:\d{2})\b/);
        out.push({ videoId: we.videoId, type: typeOf(we), title: card.title?.runs?.[0]?.text || '', artist: sub, durationSec: dm ? parseDurationSec(dm[1]) : 0, top: true });
      }
    }
    for (const item of sec.musicShelfRenderer?.contents || []) {
      const r = item.musicResponsiveListItemRenderer;
      const we =
        r?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint ||
        r?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint;
      const videoId = we?.videoId || r?.playlistItemData?.videoId;
      if (!videoId) continue;
      const title = r?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || '';
      const sub = r?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((x) => x.text).join('') || '';
      const durText = r?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs?.[0]?.text || sub;
      const dm = durText.match(/\b(\d+:\d{2})\b/);
      out.push({ videoId, type: typeOf(we), title, artist: sub, durationSec: dm ? parseDurationSec(dm[1]) : 0, top: false });
    }
  }
  return out.filter((c) => /^[a-zA-Z0-9_-]{11}$/.test(c.videoId));
}

function matchWords(s = '') {
  return normForMatch(s).split(' ').filter((w) => w.length > 2 && !['feat', 'the', 'con', 'and', 'remastered', 'version'].includes(w));
}

/**
 * Every upload of a song found on YouTube Music, best first. Audio-only uploads (the album
 * audio) win over video clips, which often add intros, skits and outros; the length must
 * agree with Spotify's. `match` = same song (title, artist and length agree).
 */
async function collectCandidates(q, expectedTitle = '', expectedArtist = '', excludeSet = new Set(), expectedDurationSec = 0) {
  const [songs, general] = await Promise.all([
    ytmSearch(q, YTM_SONGS_PARAMS).catch(() => []),
    ytmSearch(q).catch(() => []),
  ]);
  const byId = new Map();
  const tWords = matchWords(expectedTitle || q);
  const aWords = matchWords(expectedArtist);
  for (const c of [...songs, ...general]) {
    if (excludeSet.has(c.videoId)) continue;
    const isAudio = c.type === 'MUSIC_VIDEO_TYPE_ATV';
    let score = scoreCandidate(q, expectedTitle, expectedArtist, c.title, c.artist, c.durationSec, expectedDurationSec);
    if (isAudio) score += 85;
    else if (c.type === 'MUSIC_VIDEO_TYPE_OMV') score -= 10;
    if (c.top) score += 10;
    const hay = `${c.title} ${c.artist}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ');
    // Artist = the uploader/performer field ("Romeo Santos • Album • 3:56"), not the title:
    // covers say "Song (Romeo Santos)" in the title but are by someone else
    const performer = c.artist
      .replace(/^(Canción|Song|Vídeo|Video|Episodio|Episode)\s*•\s*/i, '')
      .split(' • ')[0]
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ');
    const titleHit = tWords.length === 0 || tWords.some((w) => hay.includes(w));
    // Whole words: "Princesita" is not "Prince"
    const performerWords = new Set(performer.split(/\s+/).filter(Boolean));
    const hayWords = new Set(hay.split(/\s+/).filter(Boolean));
    const artistHit =
      aWords.length === 0 ||
      aWords.some((w) => performerWords.has(w)) ||
      (!performer.trim() && aWords.some((w) => hayWords.has(w)));
    if (!artistHit) score -= 40;
    const expNorm = normForMatch(`${expectedTitle} ${q}`);
    const isCoverLike =
      /\b(karaoke|cover|in the style of|made popular|tribute|tributo|instrumental|backing track|8d|sped up|slowed|nightcore)\b/i.test(c.title) &&
      !/\b(karaoke|cover|instrumental|sped up|slowed)\b/i.test(expNorm);
    if (isCoverLike) score -= 60;
    const durOk = !expectedDurationSec || !c.durationSec || Math.abs(c.durationSec - expectedDurationSec) <= 15;
    const cand = {
      videoId: c.videoId,
      title: c.title,
      artist: c.artist,
      durationSec: c.durationSec,
      kind: isAudio ? 'audio' : 'video',
      score: Math.round(score),
      match: titleHit && artistHit && durOk && !isCoverLike,
    };
    const prev = byId.get(c.videoId);
    if (!prev || prev.score < cand.score) byId.set(c.videoId, cand);
  }
  return [...byId.values()].sort((a, b) => Number(b.match) - Number(a.match) || b.score - a.score);
}

async function resolveViaYouTubeMusic(q, expectedTitle = '', expectedArtist = '', excludeSet = new Set(), expectedDurationSec = 0) {
  const cands = await collectCandidates(q, expectedTitle, expectedArtist, excludeSet, expectedDurationSec);
  const best = cands[0];
  if (best && best.score >= 25) return { videoId: best.videoId, title: best.title, artist: best.artist, kind: best.kind };
  return resolveViaYouTubeMusicLegacy(q, expectedTitle, expectedArtist, excludeSet, expectedDurationSec);
}

// Previous single-search resolver, kept as a fallback
async function resolveViaYouTubeMusicLegacy(q, expectedTitle = '', expectedArtist = '', excludeSet = new Set(), expectedDurationSec = 0) {
  const res = await fetchWithTimeout(
    'https://music.youtube.com/youtubei/v1/search',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20240318.01.00',
            hl: 'es',
            gl: 'ES',
          },
        },
        query: q,
      }),
    },
    3000
  );

  if (!res.ok) throw new Error('YTM non-ok');
  const data = await res.json();

  const sections =
    data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents || [];

  const candidates = [];

  for (const sec of sections) {
    // 1. Check Top Result Card (official #1 match on YouTube Music)
    if (sec.musicCardShelfRenderer) {
      const card = sec.musicCardShelfRenderer;
      const cardTitle = card.title?.runs?.[0]?.text || '';
      const cardSub = card.subtitle?.runs?.map((x) => x.text).join('') || '';
      const cardVid =
        card.onTap?.watchEndpoint?.videoId ||
        card.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
        card.buttons?.[0]?.buttonRenderer?.command?.watchEndpoint?.videoId;
      if (cardVid && /^[a-zA-Z0-9_-]{11}$/.test(cardVid) && !excludeSet.has(cardVid)) {
        const durMatch = cardSub.match(/\b(\d+:\d{2})\b/);
        const candDurSec = durMatch ? parseDurationSec(durMatch[1]) : 0;
        const score = scoreCandidate(q, expectedTitle, expectedArtist, cardTitle, cardSub, candDurSec, expectedDurationSec) + 15;
        candidates.push({ videoId: cardVid, score, title: cardTitle, artist: cardSub });
      }
    }

    // 2. Check responsive list items in musicShelfRenderer
    if (sec.musicShelfRenderer) {
      for (const item of sec.musicShelfRenderer.contents || []) {
        const renderer = item.musicResponsiveListItemRenderer;
        const playNav =
          renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content
            ?.musicPlayButtonRenderer?.playNavigationEndpoint;
        const videoId =
          renderer?.playlistItemData?.videoId ||
          playNav?.watchEndpoint?.videoId ||
          renderer?.navigationEndpoint?.watchEndpoint?.videoId ||
          renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;
        if (videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId) && !excludeSet.has(videoId)) {
          const itemTitle =
            renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text || '';
          const itemArtist =
            renderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((x) => x.text).join('') || '';
          const durText = renderer?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs?.[0]?.text || itemArtist;
          const durMatch = durText.match(/\b(\d+:\d{2})\b/);
          const candDurSec = durMatch ? parseDurationSec(durMatch[1]) : 0;
          const score = scoreCandidate(q, expectedTitle, expectedArtist, itemTitle, itemArtist, candDurSec, expectedDurationSec);
          candidates.push({ videoId, score, title: itemTitle, artist: itemArtist });
        }
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length > 0 && candidates[0].score >= 25) {
    return { videoId: candidates[0].videoId, title: candidates[0].title, artist: candidates[0].artist };
  }

  throw new Error('YTM: no confident videoId found');
}

async function resolveViaYouTubeSearch(q, expectedTitle = '', expectedArtist = '', excludeSet = new Set(), expectedDurationSec = 0) {
  const searchSuffix = q.toLowerCase().includes('topic') ? '' : ' Topic';
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q + searchSuffix)}`;
  const res = await fetchWithTimeout(
    url,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    },
    3500
  );

  if (!res.ok) throw new Error('YT search non-ok');
  const html = await res.text();

  const candidates = [];

  // 1. Try parsing ytInitialData for structured videoRenderer items
  const jsonMatch = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      const contents =
        data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]
          ?.itemSectionRenderer?.contents || [];

      for (const item of contents) {
        const r = item.videoRenderer;
        if (r && r.videoId && /^[a-zA-Z0-9_-]{11}$/.test(r.videoId) && !excludeSet.has(r.videoId)) {
          const title = r.title?.runs?.[0]?.text || '';
          const artist = r.ownerText?.runs?.[0]?.text || '';
          const lengthStr = r.lengthText?.simpleText || '';
          const candDurSec = parseDurationSec(lengthStr);
          const score = scoreCandidate(q, expectedTitle, expectedArtist, title, artist, candDurSec, expectedDurationSec);
          candidates.push({ videoId: r.videoId, score, title, artist });
        }
      }
    } catch {}
  }

  // 2. Fallback: Parse <a> tags with titles
  if (candidates.length === 0) {
    const linkRegex = /href="\/watch\?v=([a-zA-Z0-9_-]{11})"[^>]*title="([^"]+)"/g;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const vid = match[1];
      const title = match[2];
      if (!excludeSet.has(vid)) {
        const score = scoreCandidate(q, expectedTitle, expectedArtist, title, '', 0, expectedDurationSec);
        candidates.push({ videoId: vid, score, title, artist: '' });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length > 0 && candidates[0].score >= 25) {
    return { videoId: candidates[0].videoId };
  }

  throw new Error('YT search: no confident videoId found');
}

function normForMatch(s = '') {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s*[([].*?[)\]]/g, '')
    .replace(/\b(feat|ft)\.?\s.*$/i, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Deezer's official 30 s MP3 preview of a song (bytes), or null. */
async function getDeezerPreview(title, artist) {
  const t = normForMatch(title);
  const a = normForMatch(artist);
  if (!t) return null;
  const queries = a ? [`artist:"${a}" track:"${t}"`, `${a} ${t}`] : [t];
  for (const q of queries) {
    try {
      const sRes = await fetchWithTimeout(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=5`, { headers: { 'User-Agent': 'Spotifree/1.0' } }, 5000);
      if (!sRes.ok) continue;
      const data = await sRes.json();
      const hits = (data?.data || []).filter((h) => h?.preview);
      const hit =
        hits.find((h) => {
          const ht = normForMatch(h.title);
          const ha = normForMatch(h.artist?.name);
          return (ht.includes(t) || t.includes(ht)) && (!a || ha.includes(a) || a.includes(ha));
        }) || (a ? null : hits[0]);
      if (!hit) continue;
      const pRes = await fetchWithTimeout(hit.preview, {}, 8000);
      if (!pRes.ok) continue;
      const buf = Buffer.from(await pRes.arrayBuffer());
      if (buf.length > 60000) return buf;
    } catch {}
  }
  return null;
}

async function getInvidiousAudioUrl(videoId) {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetchWithTimeout(`${base}/api/v1/videos/${videoId}?fields=adaptiveFormats`, {}, 5000);
      if (!res.ok) continue;
      const data = await res.json();
      const formats = data.adaptiveFormats || [];
      const audio = formats
        .filter(f => f.type?.startsWith('audio/') && f.url)
        .sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0));
      if (audio[0]?.url) return audio[0].url;
    } catch {}
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const action = req.query?.action || (url.pathname.includes('/stream') ? 'stream' : 'resolve');

  // 1. STREAM ACTION
  if (action === 'stream') {
    const q = (req.query?.q || '').trim();
    if (!q) return res.status(400).json({ error: 'Missing query q' });

    try {
      let videoId = null;
      try {
        const result = await resolveViaYouTubeMusic(q);
        videoId = result?.videoId;
      } catch {
        const result = await resolveViaYouTubeSearch(q);
        videoId = result?.videoId;
      }

      if (!videoId) return res.status(404).json({ error: 'Video not found' });
      const audioUrl = await getInvidiousAudioUrl(videoId);
      if (!audioUrl) return res.status(404).json({ error: 'Audio stream not found' });

      return res.redirect(302, audioUrl);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 1b. CHUNK ACTION: first ~3 MB of the audio, same-origin + CORS, for in-browser analysis
  // of BPM / key / structure (the decoded chunk usually covers the whole song at 128 kbps).
  // YouTube blocks most server IPs ("confirm you're not a bot"), so when the full audio is
  // not reachable we fall back to Deezer's official 30 s preview of the same song: enough
  // for a real BPM / key / energy measurement (but not for positions inside the song, so it
  // is flagged with X-Audio-Source: preview).
  if (action === 'chunk') {
    const id = (req.query?.id || '').trim();
    const q = (req.query?.q || '').trim();
    const title = (req.query?.title || '').trim();
    const artist = (req.query?.artist || '').trim();
    if (!id && !q && !title) return res.status(400).json({ error: 'Missing id or q' });
    res.setHeader('Access-Control-Expose-Headers', 'X-Audio-Source');
    try {
      let videoId = /^[\w-]{11}$/.test(id) ? id : null;
      if (!videoId && q && !title) {
        try {
          videoId = (await resolveViaYouTubeMusic(q))?.videoId || null;
        } catch {
          try { videoId = (await resolveViaYouTubeSearch(q))?.videoId || null; } catch {}
        }
      }
      if (videoId) {
        // Bounded: public instances are usually down, don't make the preview fallback wait
        const audioUrl = await Promise.race([
          getInvidiousAudioUrl(videoId).catch(() => null),
          new Promise((r) => setTimeout(() => r(null), 6000)),
        ]);
        if (audioUrl) {
          const upstream = await fetchWithTimeout(audioUrl, { headers: { Range: 'bytes=0-3145727' } }, 15000).catch(() => null);
          if (upstream && upstream.ok) {
            const buf = Buffer.from(await upstream.arrayBuffer());
            if (buf.length > 60000) {
              res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/webm');
              res.setHeader('X-Audio-Source', 'full');
              res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
              return res.status(200).send(buf);
            }
          }
        }
      }
      const preview = await getDeezerPreview(title || q, artist);
      if (preview) {
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('X-Audio-Source', 'preview');
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
        return res.status(200).send(preview);
      }
      return res.status(404).json({ error: 'Audio stream not found' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 1c. CANDIDATES ACTION: every upload of a song, best first (used to switch the audio source
  // automatically when the playing video is not the song, and by hand from the "..." menu)
  if (action === 'candidates') {
    const title = (req.query?.title || '').trim();
    const artist = (req.query?.artist || '').trim();
    const q = cleanQuery((req.query?.q || `${title} ${artist}`).trim());
    const rawDur = req.query?.duration;
    const dur = rawDur ? (Number(rawDur) > 1000 ? Math.round(Number(rawDur) / 1000) : Math.round(Number(rawDur))) : 0;
    if (!q) return res.status(400).json({ error: 'Missing query' });
    try {
      const list = await collectCandidates(q, title, artist, new Set(), dur);
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      return res.status(200).json({ candidates: list.slice(0, 12) });
    } catch (err) {
      return res.status(500).json({ error: err.message, candidates: [] });
    }
  }

  // 2. RESOLVE ACTION (Default)
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800');

  const rawQ = (req.query?.q || req.query?.query || '').trim();
  const rawTitle = (req.query?.title || '').trim();
  const rawArtist = (req.query?.artist || '').trim();

  const rawDuration = req.query?.duration || req.query?.duration_ms || req.query?.durationSec;
  const expectedDurationSec = rawDuration ? (Number(rawDuration) > 1000 ? Math.round(Number(rawDuration) / 1000) : Math.round(Number(rawDuration))) : 0;

  if (!rawQ && !rawTitle) {
    return res.status(400).json({ error: 'Missing query' });
  }

  const excludeParam = (req.query?.exclude || '').trim();
  const excludeSet = new Set(excludeParam ? excludeParam.split(',').map((s) => s.trim()) : []);

  const q = cleanQuery(rawQ || `${rawTitle} ${rawArtist}`.trim());
  const cacheKey = `${q.toLowerCase()}__${expectedDurationSec}`;

  const verifiedId =
    getVerifiedVideoId(q) ||
    getVerifiedVideoId(rawQ) ||
    getVerifiedVideoId(`${rawTitle} ${rawArtist}`);

  if (verifiedId && !excludeSet.has(verifiedId)) {
    return res.status(200).json({ success: true, videoId: verifiedId, verified: true });
  }

  if (excludeSet.size === 0 && RESOLVE_CACHE.has(cacheKey)) {
    const cached = RESOLVE_CACHE.get(cacheKey);
    return res.status(200).json({ success: true, ...cached, cached: true });
  }

  try {
    let result = null;
    try {
      result = await resolveViaYouTubeMusic(q, rawTitle, rawArtist, excludeSet, expectedDurationSec);
    } catch {
      result = await resolveViaYouTubeSearch(q, rawTitle, rawArtist, excludeSet, expectedDurationSec);
    }

    if (result && result.videoId && !excludeSet.has(result.videoId)) {
      if (excludeSet.size === 0) {
        RESOLVE_CACHE.set(cacheKey, result);
      }
      return res.status(200).json({ success: true, ...result });
    }
  } catch (err) {
    try {
      const simplified = q.split(' ').slice(0, 4).join(' ');
      if (simplified !== q) {
        const retryResult = await resolveViaYouTubeMusic(simplified, rawTitle, rawArtist, excludeSet, expectedDurationSec);
        if (retryResult?.videoId && !excludeSet.has(retryResult.videoId)) {
          if (excludeSet.size === 0) {
            RESOLVE_CACHE.set(cacheKey, retryResult);
          }
          return res.status(200).json({ success: true, ...retryResult });
        }
      }
    } catch {}
  }

  return res.status(404).json({ error: 'No se pudo resolver el audio para esta pista' });
}
