/**
 * Consolidated Spotifree Audio API: Resolve & Stream
 * Serves /api/audio/resolve and /api/audio/stream
 */
import {
  extractViaMonochrome,
  extractViaSoundCloud,
  mimeToAudioExt,
  scoreInstrumentalCandidate,
  findInstrumentalOnMonochrome,
  findInstrumentalOnSoundCloud,
} from './_lib/musicFallback.js';

const RESOLVE_CACHE = new Map();
const INSTRUMENTAL_CACHE = new Map();
let YT_BOT_BLOCKED_UNTIL = 0;

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

let INVIDIOUS_INSTANCES = [
  'https://yt.chocolatemoo53.com',
  'https://invidious.tiekoetter.com',
  'https://invidious.nerdvpn.de',
  'https://inv.nadeko.net',
  'https://invidious.privacyredirect.com',
];
let LAST_INSTANCES_FETCH = 0;

async function getHealthyInvidiousInstances() {
  if (Date.now() - LAST_INSTANCES_FETCH < 3600000 && INVIDIOUS_INSTANCES.length > 2) {
    return INVIDIOUS_INSTANCES;
  }
  try {
    const res = await fetchWithTimeout('https://api.invidious.io/instances.json', {}, 3500);
    if (res.ok) {
      const data = await res.json();
      const healthy = (data || [])
        .filter(([, meta]) => meta?.type === 'https' && meta?.api === true && !meta?.monitor?.down && (meta?.monitor?.uptime ?? 100) > 80 && meta?.uri)
        .map(([, meta]) => meta.uri);
      if (healthy.length > 0) {
        INVIDIOUS_INSTANCES = [...new Set(['https://yt.chocolatemoo53.com', ...healthy])];
        LAST_INSTANCES_FETCH = Date.now();
      }
    }
  } catch {}
  return INVIDIOUS_INSTANCES;
}

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
  if (expectedDurationSec > 35 && candDurationSec > 0) {
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

async function ytWebSearch(searchQuery) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
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
  if (!res.ok) return [];
  const html = await res.text();
  const out = [];

  const jsonMatch = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]);
      const contents =
        data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]
          ?.itemSectionRenderer?.contents || [];

      for (const item of contents) {
        const r = item.videoRenderer;
        if (r && r.videoId && /^[a-zA-Z0-9_-]{11}$/.test(r.videoId)) {
          out.push({
            videoId: r.videoId,
            title: r.title?.runs?.[0]?.text || '',
            artist: r.ownerText?.runs?.[0]?.text || '',
            durationSec: parseDurationSec(r.lengthText?.simpleText || ''),
          });
        }
      }
    } catch {}
  }

  if (out.length === 0) {
    const linkRegex = /href="\/watch\?v=([a-zA-Z0-9_-]{11})"[^>]*title="([^"]+)"/g;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      out.push({ videoId: match[1], title: match[2], artist: '', durationSec: 0 });
    }
  }

  return out;
}

async function resolveViaYouTubeSearch(q, expectedTitle = '', expectedArtist = '', excludeSet = new Set(), expectedDurationSec = 0) {
  const searchSuffix = q.toLowerCase().includes('topic') ? '' : ' Topic';
  const items = await ytWebSearch(q + searchSuffix);
  if (items.length === 0) throw new Error('YT search non-ok');

  const candidates = items
    .filter((item) => !excludeSet.has(item.videoId))
    .map((item) => ({
      ...item,
      score: scoreCandidate(q, expectedTitle, expectedArtist, item.title, item.artist, item.durationSec, expectedDurationSec),
    }));

  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length > 0 && candidates[0].score >= 25) {
    return { videoId: candidates[0].videoId };
  }

  throw new Error('YT search: no confident videoId found');
}

async function findBestInstrumentalSource({ title = '', artist = '', expectedDurationSec = 0 }) {
  const cleanTitle = cleanQuery(title);
  if (!cleanTitle) return null;
  const cacheKey = `${normForMatch(cleanTitle)}|${normForMatch(artist)}|${expectedDurationSec}`;
  const cached = INSTRUMENTAL_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < 3600_000) {
    return cached.value;
  }

  const baseQ = `${cleanTitle} ${artist}`.trim();
  const [ytmItems, ytInstItems, ytSinVocesItems, monoBest, scBest] = await Promise.all([
    ytmSearch(`${baseQ} instrumental`).catch(() => []),
    ytWebSearch(`${baseQ} instrumental`).catch(() => []),
    ytWebSearch(`${baseQ} karaoke sin voces`).catch(() => []),
    findInstrumentalOnMonochrome({ title: cleanTitle, artist, expectedDurationSec }).catch(() => null),
    findInstrumentalOnSoundCloud({ title: cleanTitle, artist, expectedDurationSec }).catch(() => null),
  ]);

  const pool = [];
  if (monoBest) pool.push(monoBest);
  if (scBest) pool.push(scBest);

  const seenYt = new Set();
  for (const item of [...ytmItems, ...ytInstItems, ...ytSinVocesItems]) {
    if (!item?.videoId || seenYt.has(item.videoId)) continue;
    seenYt.add(item.videoId);
    const ev = scoreInstrumentalCandidate(
      { candTitle: item.title || '', candArtist: item.artist || '', candDurationSec: item.durationSec || 0 },
      { title: cleanTitle, artist, expectedDurationSec }
    );
    if (ev.matched) {
      pool.push({
        sourceId: item.videoId,
        title: item.title || '',
        artist: item.artist || artist,
        durationSec: item.durationSec || 0,
        score: ev.score,
        provider: 'youtube',
      });
    }
  }

  pool.sort((a, b) => b.score - a.score);
  const winner = pool[0] ? { ...pool[0], label: 'Sin voces' } : null;

  if (INSTRUMENTAL_CACHE.size > 150) INSTRUMENTAL_CACHE.clear();
  INSTRUMENTAL_CACHE.set(cacheKey, { value: winner, fetchedAt: Date.now() });
  return winner;
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

const AUDIO_INFO_CACHE = new Map();
const YT_PLAYER_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
let INNERTUBE_VISIONOS_PROMISE = null;
let INNERTUBE_IOS_PROMISE = null;
let INNERTUBE_VR_PROMISE = null;
let CACHED_VISITOR_DATA = { value: '', fetchedAt: 0 };

function mimeToExt(mime = '') {
  return mimeToAudioExt(mime);
}

function pickBestAudioFormat(formats = [], preferCompact = false) {
  const audios = formats.filter((f) => {
    const mime = f.mime_type || f.mimeType || f.type || '';
    return mime.startsWith('audio/') && f.url;
  });
  if (audios.length === 0) return null;

  const parseNum = (v) => parseInt(String(v || '0'), 10) || 0;
  const enriched = audios.map((f) => {
    const mime = (f.mime_type || f.mimeType || f.type || 'audio/mp4').split(';')[0].trim();
    const clen = parseNum(f.content_length ?? f.contentLength ?? f.clen);
    const bitrate = parseNum(f.bitrate);
    const itag = String(f.itag || '');
    return { url: f.url, mime, clen, bitrate, itag, ext: mimeToExt(mime) };
  });

  if (preferCompact) {
    // Under ~3.9 MB fits inside a single Vercel serverless response even without Range chunking
    const underCap = enriched.filter((f) => f.clen > 0 && f.clen <= 3_900_000).sort((a, b) => b.bitrate - a.bitrate);
    if (underCap.length > 0) return underCap[0];
  }

  // Standard priority: M4A 128kbps AAC (itag 140) -> higher/other M4A -> WebM Opus -> compact fallback
  const itag140 = enriched.find((f) => f.itag === '140');
  if (itag140) return itag140;
  const m4aBest = enriched.filter((f) => f.mime.includes('mp4')).sort((a, b) => b.bitrate - a.bitrate)[0];
  if (m4aBest) return m4aBest;
  return enriched.sort((a, b) => b.bitrate - a.bitrate)[0];
}

async function getInnertubeClient(clientType) {
  const { Innertube } = await import('youtubei.js');
  return Innertube.create({ client_type: clientType, retrieve_player: false });
}

async function getVisitorDataCached() {
  if (CACHED_VISITOR_DATA.value && Date.now() - CACHED_VISITOR_DATA.fetchedAt < 1800_000) {
    return CACHED_VISITOR_DATA.value;
  }
  try {
    const res = await fetchWithTimeout(
      'https://www.youtube.com/sw.js_data',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
      },
      3000
    );
    if (res.ok) {
      const text = await res.text();
      const match = text.match(/"(Cg[a-zA-Z0-9_%-]{20,})"/);
      if (match?.[1]) {
        CACHED_VISITOR_DATA = { value: match[1], fetchedAt: Date.now() };
        return match[1];
      }
    }
  } catch {}
  return '';
}

async function extractViaRawInnertube(videoId, preferCompact = false) {
  const visitorData = await getVisitorDataCached();
  const profiles = [
    {
      name: 'raw-visionos',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
      clientNameHeader: '101',
      clientVersion: '1.02',
      client: {
        clientName: 'VISIONOS',
        clientVersion: '1.02',
        deviceMake: 'Apple',
        deviceModel: 'RealityDevice17,1',
        osName: 'visionOS',
        osVersion: '26.5.23O471',
        visitorData,
        hl: 'es',
        gl: 'ES',
      },
    },
    {
      name: 'raw-ios',
      userAgent: 'com.google.ios.youtube/20.11.6 (iPhone10,4; U; CPU iOS 16_7_7 like Mac OS X)',
      clientNameHeader: '5',
      clientVersion: '20.11.6',
      client: {
        clientName: 'iOS',
        clientVersion: '20.11.6',
        deviceMake: 'Apple',
        deviceModel: 'iPhone10,4',
        osName: 'iOS',
        osVersion: '16.7.7.20H330',
        visitorData,
        hl: 'es',
        gl: 'ES',
      },
    },
    {
      name: 'raw-android-vr',
      userAgent: 'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
      clientNameHeader: '28',
      clientVersion: '1.65.10',
      client: {
        clientName: 'ANDROID_VR',
        clientVersion: '1.65.10',
        deviceMake: 'Oculus',
        deviceModel: 'Quest 3',
        osName: 'Android',
        osVersion: '12L',
        androidSdkVersion: 32,
        visitorData,
        hl: 'es',
        gl: 'ES',
      },
    },
  ];

  for (const prof of profiles) {
    try {
      const res = await fetchWithTimeout(
        `https://www.youtube.com/youtubei/v1/player?key=${YT_PLAYER_KEY}&prettyPrint=false`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': prof.userAgent,
            'X-YouTube-Client-Name': prof.clientNameHeader,
            'X-YouTube-Client-Version': prof.clientVersion,
            ...(visitorData ? { 'X-Goog-Visitor-Id': visitorData } : {}),
          },
          body: JSON.stringify({
            videoId,
            context: { client: prof.client },
            contentCheckOk: true,
            racyCheckOk: true,
          }),
        },
        4500
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (data?.playabilityStatus?.status !== 'OK') {
        const status = String(data?.playabilityStatus?.status || '');
        const reason = String(data?.playabilityStatus?.reason || '').toLowerCase();
        if (status === 'LOGIN_REQUIRED' && (reason.includes('bot') || reason.includes('sign in'))) {
          YT_BOT_BLOCKED_UNTIL = Date.now() + 300_000;
          return { botBlocked: true };
        }
        continue;
      }
      const formats = [...(data.streamingData?.adaptiveFormats || []), ...(data.streamingData?.formats || [])];
      const chosen = pickBestAudioFormat(formats, preferCompact);
      if (chosen) return { ...chosen, source: prof.name };
    } catch {}
  }
  return null;
}

async function getInvidiousAudioInfo(videoId, preferCompact = false) {
  const instances = await getHealthyInvidiousInstances();
  for (const base of instances.slice(0, 3)) {
    try {
      const res = await fetchWithTimeout(`${base}/api/v1/videos/${videoId}?fields=adaptiveFormats,formatStreams`, {}, 3500);
      if (!res.ok) continue;
      const data = await res.json();
      const formats = [...(data.adaptiveFormats || []), ...(data.formatStreams || [])];
      const chosen = pickBestAudioFormat(formats, preferCompact);
      if (chosen?.url) return { ...chosen, source: 'invidious' };
    } catch {}
  }
  return null;
}

async function extractBestAudioInfo(videoId, preferCompact = false, forceFresh = false) {
  if (!videoId) return null;
  if (!forceFresh && YT_BOT_BLOCKED_UNTIL > Date.now()) {
    return null;
  }
  const cacheKey = `${videoId}_${preferCompact ? 'compact' : 'best'}`;
  const cached = !forceFresh ? AUDIO_INFO_CACHE.get(cacheKey) : null;
  if (cached && Date.now() - cached.fetchedAt < 600_000) {
    return cached;
  }

  // 1. youtubei.js VISIONOS client (streams full multi-MB tracks cleanly without 1MB PO-Token cutoff!)
  try {
    if (!INNERTUBE_VISIONOS_PROMISE) INNERTUBE_VISIONOS_PROMISE = getInnertubeClient('VISIONOS').catch(() => null);
    const ytVis = await INNERTUBE_VISIONOS_PROMISE;
    if (ytVis) {
      const info = await ytVis.getBasicInfo(videoId, { client: 'VISIONOS' });
      const status = String(info?.playability_status?.status || '');
      const reason = String(info?.playability_status?.reason || '').toLowerCase();
      if (status === 'LOGIN_REQUIRED' && (reason.includes('bot') || reason.includes('sign in'))) {
        YT_BOT_BLOCKED_UNTIL = Date.now() + 300_000;
        return null;
      }
      const formats = [...(info.streaming_data?.adaptive_formats || []), ...(info.streaming_data?.formats || [])];
      const chosen = pickBestAudioFormat(formats, preferCompact);
      if (chosen) {
        const entry = { ...chosen, source: 'innertube-visionos', fetchedAt: Date.now() };
        AUDIO_INFO_CACHE.set(cacheKey, entry);
        return entry;
      }
    }
  } catch (e) {
    INNERTUBE_VISIONOS_PROMISE = null;
    const msg = String(e?.message || e || '').toLowerCase();
    if (msg.includes('bot') || msg.includes('login_required')) {
      YT_BOT_BLOCKED_UNTIL = Date.now() + 300_000;
      return null;
    }
    console.warn('[api/audio] youtubei VISIONOS failed:', e?.message || e);
  }

  // 2. Raw Innertube JSON (VISIONOS -> iOS -> ANDROID_VR)
  const rawResult = await extractViaRawInnertube(videoId, preferCompact);
  if (rawResult?.botBlocked) {
    return null;
  }
  if (rawResult) {
    const entry = { ...rawResult, fetchedAt: Date.now() };
    AUDIO_INFO_CACHE.set(cacheKey, entry);
    return entry;
  }

  // 3. youtubei.js IOS client
  try {
    if (!INNERTUBE_IOS_PROMISE) INNERTUBE_IOS_PROMISE = getInnertubeClient('IOS').catch(() => null);
    const ytIos = await INNERTUBE_IOS_PROMISE;
    if (ytIos) {
      const info = await ytIos.getBasicInfo(videoId, { client: 'IOS' });
      const formats = [...(info.streaming_data?.adaptive_formats || []), ...(info.streaming_data?.formats || [])];
      const chosen = pickBestAudioFormat(formats, preferCompact);
      if (chosen) {
        const entry = { ...chosen, source: 'innertube-ios', fetchedAt: Date.now() };
        AUDIO_INFO_CACHE.set(cacheKey, entry);
        return entry;
      }
    }
  } catch (e) {
    INNERTUBE_IOS_PROMISE = null;
    console.warn('[api/audio] youtubei IOS failed:', e?.message || e);
  }

  // 4. youtubei.js ANDROID_VR client
  try {
    if (!INNERTUBE_VR_PROMISE) INNERTUBE_VR_PROMISE = getInnertubeClient('ANDROID_VR').catch(() => null);
    const ytVr = await INNERTUBE_VR_PROMISE;
    if (ytVr) {
      const info = await ytVr.getBasicInfo(videoId, { client: 'ANDROID_VR' });
      const formats = [...(info.streaming_data?.adaptive_formats || []), ...(info.streaming_data?.formats || [])];
      const chosen = pickBestAudioFormat(formats, preferCompact);
      if (chosen) {
        const entry = { ...chosen, source: 'innertube-vr', fetchedAt: Date.now() };
        AUDIO_INFO_CACHE.set(cacheKey, entry);
        return entry;
      }
    }
  } catch (e) {
    INNERTUBE_VR_PROMISE = null;
    console.warn('[api/audio] youtubei ANDROID_VR failed:', e?.message || e);
  }

  // 5. Healthy Invidious fallback
  const inv = await getInvidiousAudioInfo(videoId, preferCompact);
  if (inv) {
    const entry = { ...inv, fetchedAt: Date.now() };
    AUDIO_INFO_CACHE.set(cacheKey, entry);
    return entry;
  }

  return null;
}

function parseByteRangeHeader(rangeHeader, totalLength) {
  if (!rangeHeader || typeof rangeHeader !== 'string') return null;
  const m = rangeHeader.match(/bytes=(\d+)-(\d*)/i);
  if (!m) return null;
  const start = parseInt(m[1], 10);
  if (isNaN(start) || start < 0) return null;
  const MAX_VERCEL_CHUNK = 3_145_728; // 3 MB safe under Vercel 4.5 MB payload cap
  let end = m[2] ? parseInt(m[2], 10) : start + MAX_VERCEL_CHUNK - 1;
  if (end - start + 1 > MAX_VERCEL_CHUNK) {
    end = start + MAX_VERCEL_CHUNK - 1;
  }
  if (totalLength > 0 && end >= totalLength) {
    end = totalLength - 1;
  }
  if (end < start) return null;
  return { start, end };
}

function normalizeDownloadFilename(rawName, ext) {
  const base = (rawName || 'cancion').replace(/\.(mp3|m4a|webm|ogg|flac|mp4|wav)$/i, '').trim() || 'cancion';
  return `${base}.${ext}`;
}

async function fetchYouTubeOEmbedMeta(videoId) {
  try {
    const res = await fetchWithTimeout(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&format=json`,
      {},
      3000
    );
    if (!res.ok) return null;
    const data = await res.json();
    return { title: data?.title || '', artist: data?.author_name || '' };
  } catch {
    return null;
  }
}

async function resolveBestAudioStreamSource({
  q = '',
  rawTitle = '',
  rawArtist = '',
  expectedDurationSec = 0,
  explicitId = '',
  preferCompact = false,
}) {
  if (/^mono:\d{10,25}$/.test(explicitId)) {
    const mono = await extractViaMonochrome({ explicitId });
    return mono ? { audioInfo: mono, videoId: mono.id } : { audioInfo: null, videoId: explicitId };
  }
  if (/^sc[:\-]\d+$/.test(explicitId)) {
    const sc = await extractViaSoundCloud({ q, title: rawTitle, artist: rawArtist, expectedDurationSec, explicitId });
    return sc ? { audioInfo: sc, videoId: sc.id } : { audioInfo: null, videoId: explicitId };
  }

  let videoId = /^[\w-]{11}$/.test(explicitId) ? explicitId : null;
  const ytBlockedNow = YT_BOT_BLOCKED_UNTIL > Date.now();

  if (!ytBlockedNow) {
    if (!videoId) {
      const verified = getVerifiedVideoId(q, rawTitle, rawArtist);
      if (verified) {
        videoId = verified;
      } else {
        try {
          const result = await resolveViaYouTubeMusic(q, rawTitle, rawArtist, new Set(), expectedDurationSec);
          videoId = result?.videoId;
        } catch {
          try {
            const result = await resolveViaYouTubeSearch(q, rawTitle, rawArtist, new Set(), expectedDurationSec);
            videoId = result?.videoId;
          } catch {}
        }
      }
    }

    if (videoId) {
      const ytInfo = await extractBestAudioInfo(videoId, preferCompact, false);
      if (ytInfo?.url) {
        return { audioInfo: ytInfo, videoId };
      }
    }
  }

  // Fallback query enrichment if only an explicit YouTube ID was passed without text
  let searchQ = q;
  let searchTitle = rawTitle;
  let searchArtist = rawArtist;
  if (!searchQ && !searchTitle && videoId) {
    const meta = await fetchYouTubeOEmbedMeta(videoId);
    if (meta?.title) {
      searchTitle = meta.title;
      searchArtist = meta.artist;
      searchQ = `${meta.title} ${meta.artist}`.trim();
    }
  }

  // Datacenter-safe Tier 2: Monochrome lossless catalog
  const mono = await extractViaMonochrome({
    q: searchQ,
    title: searchTitle,
    artist: searchArtist,
    expectedDurationSec,
  });
  if (mono?.url) {
    return { audioInfo: mono, videoId: mono.id || videoId || '' };
  }

  // Datacenter-safe Tier 3: SoundCloud non-SNIP full tracks
  const sc = await extractViaSoundCloud({
    q: searchQ,
    title: searchTitle,
    artist: searchArtist,
    expectedDurationSec,
  });
  if (sc?.url) {
    return { audioInfo: sc, videoId: sc.id || videoId || '' };
  }

  return { audioInfo: null, videoId };
}

function sendBufferedAudioResponse({ req, res, buf, totalLen, startOffset, audioInfo, videoId, action, rawFilename, isRange }) {
  const outExt = audioInfo.ext || mimeToExt(audioInfo.mime);
  const finalName = normalizeDownloadFilename(rawFilename, outExt);
  const isPartial = Boolean(isRange) || (totalLen > 0 && buf.length < totalLen);

  res.status(isPartial ? 206 : 200);
  res.setHeader('Content-Type', audioInfo.mime || 'audio/mp4');
  res.setHeader('Content-Length', String(buf.length));
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('X-Video-Id', videoId || '');
  res.setHeader('X-Stream-Id', audioInfo.id || videoId || '');
  res.setHeader('X-Total-Length', String(totalLen));
  res.setHeader('X-Audio-Source', audioInfo.source || 'full');
  res.setHeader('X-Audio-Mime', audioInfo.mime || 'audio/mp4');
  res.setHeader('X-Audio-Ext', outExt);
  if (audioInfo.directCors && audioInfo.url && !String(audioInfo.url).startsWith('sc-hls:')) {
    res.setHeader('X-Direct-Audio-Url', audioInfo.url);
  }
  res.setHeader('Cache-Control', 'no-store');
  if (isPartial) {
    res.setHeader('Content-Range', `bytes ${startOffset}-${startOffset + buf.length - 1}/${totalLen}`);
  }
  if (action === 'download') {
    res.setHeader('Content-Disposition', `attachment; filename="${finalName}"`);
  }
  return res.send(buf);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Content-Length, Content-Range, Accept-Ranges, Content-Disposition, X-Video-Id, X-Stream-Id, X-Total-Length, X-Audio-Source, X-Audio-Mime, X-Audio-Ext, X-Direct-Audio-Url'
  );

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const action = req.query?.action || (url.pathname.includes('/stream') ? 'stream' : url.pathname.includes('/download') ? 'download' : 'resolve');

  // 1. STREAM OR DOWNLOAD ACTION
  if (action === 'stream' || action === 'download') {
    const rawQ = (req.query?.q || req.query?.query || '').trim();
    const rawTitle = (req.query?.title || '').trim();
    const rawArtist = (req.query?.artist || '').trim();
    const rawDuration = req.query?.duration || req.query?.duration_ms || req.query?.durationSec;
    let expectedDurationSec = rawDuration
      ? Number(rawDuration) > 1000
        ? Math.round(Number(rawDuration) / 1000)
        : Math.round(Number(rawDuration))
      : 0;
    if (expectedDurationSec <= 35) expectedDurationSec = 0;

    const q = cleanQuery(rawQ || `${rawTitle} ${rawArtist}`.trim());
    const explicitId = (req.query?.videoId || req.query?.id || '').trim();
    const rawFilename = req.query?.filename ? decodeURIComponent(req.query.filename) : (rawTitle || q || 'cancion');
    const allowPreview = req.query?.allowPreview === '1';

    if (!q && !explicitId) return res.status(400).json({ error: 'Missing query q or videoId' });

    try {
      const clientRangeHeader = req.headers.range;
      const preferCompact = !clientRangeHeader;

      let { audioInfo, videoId } = await resolveBestAudioStreamSource({
        q,
        rawTitle,
        rawArtist,
        expectedDurationSec,
        explicitId,
        preferCompact,
      });

      // Retry once forcing fresh stream extraction if cached URL fails upstream
      for (let attempt = 0; attempt < 2 && audioInfo; attempt++) {
        if (audioInfo.streamBuffer && Buffer.isBuffer(audioInfo.streamBuffer)) {
          const fullLen = audioInfo.streamBuffer.length;
          const parsedRange = parseByteRangeHeader(clientRangeHeader, fullLen);
          const sliceStart = parsedRange ? parsedRange.start : 0;
          const defaultSliceEnd = Math.min(fullLen - 1, 3_145_727);
          const sliceEnd = parsedRange ? parsedRange.end : (fullLen > 3_800_000 ? defaultSliceEnd : fullLen - 1);
          const sliceBuf = audioInfo.streamBuffer.subarray(sliceStart, sliceEnd + 1);
          return sendBufferedAudioResponse({
            req,
            res,
            buf: sliceBuf,
            totalLen: fullLen,
            startOffset: sliceStart,
            audioInfo,
            videoId,
            action,
            rawFilename,
            isRange: Boolean(clientRangeHeader) || sliceBuf.length < fullLen,
          });
        }
        if (!audioInfo.url) break;

        const parsedRange = parseByteRangeHeader(clientRangeHeader, audioInfo.clen);
        const defaultCap = 3_800_000;
        const upstreamRange = parsedRange
          ? `bytes=${parsedRange.start}-${parsedRange.end}`
          : audioInfo.clen > 0
          ? `bytes=0-${Math.min(audioInfo.clen - 1, defaultCap - 1)}`
          : `bytes=0-${defaultCap - 1}`;

        try {
          const upstream = await fetchWithTimeout(
            audioInfo.url,
            {
              headers: {
                Range: upstreamRange,
              },
            },
            15000
          );

          if (upstream.ok || upstream.status === 206) {
            const buf = Buffer.from(await upstream.arrayBuffer());
            if (buf.length > 0 && (parsedRange || buf.length > 10000)) {
              const upRange = upstream.headers.get('content-range') || '';
              const totalMatch = upRange.match(/\/(\d+)$/);
              const totalLen = totalMatch ? parseInt(totalMatch[1], 10) : audioInfo.clen || buf.length;
              return sendBufferedAudioResponse({
                req,
                res,
                buf,
                totalLen,
                startOffset: parsedRange ? parsedRange.start : 0,
                audioInfo,
                videoId,
                action,
                rawFilename,
                isRange: Boolean(clientRangeHeader),
              });
            }
          }
          // Upstream 403/410 -> force refresh cached YouTube URL or fall back to Monochrome/SoundCloud
          if (attempt === 0) {
            const refreshed = (videoId && /^[\w-]{11}$/.test(videoId))
              ? await extractBestAudioInfo(videoId, preferCompact, true)
              : null;
            audioInfo = refreshed?.url
              ? refreshed
              : (await extractViaMonochrome({ q, title: rawTitle, artist: rawArtist, expectedDurationSec })) ||
                (await extractViaSoundCloud({ q, title: rawTitle, artist: rawArtist, expectedDurationSec }));
            if (audioInfo?.id) videoId = audioInfo.id;
            continue;
          }
        } catch (streamErr) {
          console.warn('[api/audio] Upstream audio proxy failed:', streamErr?.message || streamErr);
          if (attempt === 0) {
            const refreshed = (videoId && /^[\w-]{11}$/.test(videoId))
              ? await extractBestAudioInfo(videoId, preferCompact, true)
              : null;
            audioInfo = refreshed?.url
              ? refreshed
              : (await extractViaMonochrome({ q, title: rawTitle, artist: rawArtist, expectedDurationSec })) ||
                (await extractViaSoundCloud({ q, title: rawTitle, artist: rawArtist, expectedDurationSec }));
            if (audioInfo?.id) videoId = audioInfo.id;
            continue;
          }
        }
        break;
      }

      // Only return 30s preview if caller explicitly allowed preview mode; NEVER disguise 30s preview as full download!
      if (allowPreview) {
        try {
          const queryParts = q.split(/\s*[-–—]\s*/);
          const title = rawTitle || (queryParts.length > 1 ? queryParts[1] : q);
          const artist = rawArtist || (queryParts.length > 1 ? queryParts[0] : '');
          const deezerBuf = await getDeezerPreview(title, artist);
          if (deezerBuf && deezerBuf.length > 50000) {
            res.status(200);
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Content-Length', String(deezerBuf.length));
            res.setHeader('X-Audio-Source', 'preview');
            return res.send(deezerBuf);
          }
        } catch {}
      }

      return res.status(404).json({
        error: 'No se pudo extraer el audio completo de la canción',
        videoId: videoId || null,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // 1b. CHUNK ACTION: first ~3 MB of the audio, same-origin + CORS, for in-browser analysis
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
      if (videoId || q || title) {
        const resolved = await Promise.race([
          resolveBestAudioStreamSource({
            q: q || `${title} ${artist}`.trim(),
            rawTitle: title,
            rawArtist: artist,
            explicitId: videoId || '',
            preferCompact: false,
          }).catch(() => null),
          new Promise((r) => setTimeout(() => r(null), 6500)),
        ]);
        const audioInfo = resolved?.audioInfo;
        if (audioInfo?.streamBuffer && Buffer.isBuffer(audioInfo.streamBuffer)) {
          const sliceBuf = audioInfo.streamBuffer.subarray(0, 3_145_728);
          res.setHeader('Content-Type', audioInfo.mime || 'audio/mp4');
          res.setHeader('X-Audio-Source', audioInfo.source || 'full');
          res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
          return res.status(200).send(sliceBuf);
        }
        if (audioInfo?.url) {
          const upstream = await fetchWithTimeout(audioInfo.url, { headers: { Range: 'bytes=0-3145727' } }, 15000).catch(() => null);
          if (upstream && (upstream.ok || upstream.status === 206)) {
            const buf = Buffer.from(await upstream.arrayBuffer());
            if (buf.length > 60000) {
              res.setHeader('Content-Type', audioInfo.mime || upstream.headers.get('content-type') || 'audio/mp4');
              res.setHeader('X-Audio-Source', audioInfo.source || 'full');
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

  // 1c-bis. INSTRUMENTAL ACTION: verifies whether an authentic no-vocals / instrumental backing track exists
  if (action === 'instrumental') {
    const title = (req.query?.title || '').trim();
    const artist = (req.query?.artist || '').trim();
    const rawDur = req.query?.duration;
    let dur = rawDur ? (Number(rawDur) > 1000 ? Math.round(Number(rawDur) / 1000) : Math.round(Number(rawDur))) : 0;
    if (dur <= 35) dur = 0;
    if (!title) return res.status(400).json({ found: false, candidate: null, error: 'Missing title' });
    try {
      const candidate = await findBestInstrumentalSource({ title, artist, expectedDurationSec: dur });
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
      return res.status(200).json({ found: Boolean(candidate), candidate: candidate || null });
    } catch (err) {
      return res.status(200).json({ found: false, candidate: null, error: err?.message });
    }
  }

  // 1c. CANDIDATES ACTION: every upload of a song, best first (used to switch the audio source
  // automatically when the playing video is not the song, and by hand from the "..." menu)
  if (action === 'candidates') {
    const title = (req.query?.title || '').trim();
    const artist = (req.query?.artist || '').trim();
    const q = cleanQuery((req.query?.q || `${title} ${artist}`).trim());
    const rawDur = req.query?.duration;
    let dur = rawDur ? (Number(rawDur) > 1000 ? Math.round(Number(rawDur) / 1000) : Math.round(Number(rawDur))) : 0;
    if (dur <= 35) dur = 0; // Ignore iTunes / Apple 30s preview metadata
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
  let expectedDurationSec = rawDuration ? (Number(rawDuration) > 1000 ? Math.round(Number(rawDuration) / 1000) : Math.round(Number(rawDuration))) : 0;
  if (expectedDurationSec <= 35) expectedDurationSec = 0; // Ignore iTunes / Apple 30s preview metadata

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
