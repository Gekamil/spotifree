/**
 * "Importar playlist": reads the songs (title, artist, duration) of a public playlist from
 * YouTube Music, YouTube, Apple Music, Deezer or SoundCloud. The app then finds each song in the catalog and creates
 * a Spotifree playlist. Spotify links are handled by the app itself.
 * Used by api/playlist.js (?action=import&url=...) and the dev server.
 */

import { resolveSoundCloudUrl } from './musicFallback.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MAX_TRACKS = 10000;

function walk(o, fn, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 60) return;
  fn(o);
  for (const k of Object.keys(o)) walk(o[k], fn, depth + 1);
}
const runsText = (runs) => (runs || []).map((r) => r.text).join('');

/** "3:37" / "1:02:03" -> seconds */
function toSec(s) {
  const p = String(s || '').split(':').map(Number);
  if (!p.length || p.some((n) => !Number.isFinite(n))) return 0;
  return p.reduce((a, n) => a * 60 + n, 0);
}

/** Video titles carry extras: "(Official Music Video)", "[Lyrics]", "| Prod. X"... */
export function cleanSongTitle(t) {
  return String(t || '')
    .replace(/\s*[([](official|oficial|lyric|lyrics|letra|audio|video|vídeo|visualizer|visualiser|music video|videoclip|hd|4k|mv)[^)\]]*[)\]]/gi, '')
    // "Song - Lyric Video", "Song - Official MV", "Song / Video Klip"
    .replace(/\s+[-–/]\s*(official|oficial|lyric|lyrics|letra|audio|video|vídeo|videoclip|video klip|mv)\b.*$/i, '')
    .replace(/\s+(official\s+)?(mv|music video)$/i, '')
    .replace(/\s*\|.*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function detectSource(raw) {
  let u;
  try {
    u = new URL(String(raw || '').trim());
  } catch {
    const trimmed = String(raw || '').trim();
    const uriMatch = trimmed.match(/^spotify:(playlist|album):([A-Za-z0-9]+)$/i);
    if (uriMatch) {
      return { source: 'spotify', kind: uriMatch[1].toLowerCase(), id: uriMatch[2] };
    }
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  if (host === 'open.spotify.com') {
    const m = /\/(playlist|album)\/([A-Za-z0-9]+)/.exec(u.pathname);
    return m ? { source: 'spotify', kind: m[1], id: m[2] } : null;
  }
  if (host === 'spotify.link') {
    return { source: 'spotify-short', url: u.toString() };
  }
  if (host === 'music.youtube.com' || host === 'youtube.com' || host === 'youtu.be') {
    const list = u.searchParams.get('list');
    if (list) return { source: host === 'music.youtube.com' ? 'ytmusic' : 'youtube', id: list };
    // Album pages: /browse/MPREb_...
    const b = /\/browse\/(MPREb[\w-]+|VL[\w-]+)/.exec(u.pathname);
    if (b) return { source: 'ytmusic', browseId: b[1] };
    return null;
  }
  if (host === 'music.apple.com' || host === 'itunes.apple.com') {
    if (/\/(playlist|album)\//.test(u.pathname)) return { source: 'apple', url: u.toString() };
  }
  // Deezer: deezer.com/es/playlist/123, deezer.com/album/123; short links are followed first
  if (host === 'deezer.com') {
    const m = /\/(playlist|album)\/(\d+)/.exec(u.pathname);
    if (m) return { source: 'deezer', kind: m[1], id: m[2] };
    return null;
  }
  if (host === 'link.deezer.com' || host === 'deezer.page.link' || host === 'dzr.page.link') {
    return { source: 'deezer-short', url: u.toString() };
  }
  // SoundCloud: sets/playlists and user tracks
  if (host === 'soundcloud.com') {
    return { source: 'soundcloud', url: u.toString() };
  }
  if (host === 'on.soundcloud.com') {
    return { source: 'soundcloud-short', url: u.toString() };
  }
  // Amazon Music doesn't publish its playlists in a readable form
  if (/(^|\.)music\.amazon\./.test(host) || host.startsWith('amazon.') || host === 'amzn.to') {
    return { source: 'amazon' };
  }
  return null;
}

/** Deezer's public API (https://api.deezer.com): a playlist's or album's songs */
async function readDeezer({ kind, id }) {
  const r = await fetch(`https://api.deezer.com/${kind}/${id}`, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`Deezer answered ${r.status}`);
  const data = await r.json();
  if (data?.error) throw new Error(data.error.message || 'Deezer error');
  const tracks = [];
  const add = (list) => {
    for (const t of list || []) {
      if (tracks.length >= MAX_TRACKS) break;
      if (!t?.title) continue;
      const artistName = t.artist?.name || data.artist?.name || 'Artista';
      const coverUrl = t.album?.cover_xl || t.album?.cover_big || data.cover_xl || data.picture_xl || '';
      tracks.push({
        id: `dz-${t.id}`,
        title: t.title,
        artist: artistName,
        durationSec: Number(t.duration) || 0,
        trackObj: {
          id: `dz-${t.id}`,
          name: t.title,
          artists: [{ id: `art-${t.artist?.id || 'dz'}`, name: artistName }],
          album: {
            id: `alb-${t.album?.id || id}`,
            name: t.album?.title || data.title,
            images: coverUrl ? [{ url: coverUrl }] : [],
          },
          duration_ms: (Number(t.duration) || 210) * 1000,
          preview_url: t.preview || null,
        },
      });
    }
  };
  add(data.tracks?.data);
  // Long playlists come in pages
  let next = data.tracks?.next;
  for (let page = 0; next && tracks.length < MAX_TRACKS && page < 400; page++) {
    const p = await (await fetch(next, { headers: { 'User-Agent': UA } })).json();
    add(p?.data);
    next = p?.next;
  }
  return {
    name: data.title || 'Playlist de Deezer',
    image: data.picture_xl || data.cover_xl || data.picture_big || data.cover_big || '',
    tracks,
  };
}

async function ytmBrowse(body) {
  const r = await fetch('https://music.youtube.com/youtubei/v1/browse?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://music.youtube.com', Referer: 'https://music.youtube.com/', 'User-Agent': UA },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20240318.01.00', hl: 'es', gl: 'ES' } },
      ...body,
    }),
  });
  if (!r.ok) throw new Error(`YouTube Music answered ${r.status}`);
  return r.json();
}

function ytmRows(json, out) {
  let token = null;
  walk(json, (o) => {
    if (o.musicResponsiveListItemRenderer) {
      const m = o.musicResponsiveListItemRenderer;
      const cols = (m.flexColumns || []).map((c) => runsText(c.musicResponsiveListItemFlexColumnRenderer?.text?.runs));
      const fixed = (m.fixedColumns || []).map((c) => runsText(c.musicResponsiveListItemFixedColumnRenderer?.text?.runs));
      const title = cleanSongTitle(cols[0]);
      // Album pages have no artist column per song (the album artist is in the header)
      const artist = String(cols[1] || '').split(' • ')[0].trim();
      const videoId = m.playlistItemData?.videoId || '';
      if (title && out.length < MAX_TRACKS) out.push({ title, artist, durationSec: toSec(fixed[0]), videoId });
    }
    if (!token && o.continuationCommand?.token) token = o.continuationCommand.token;
    if (!token && o.nextContinuationData?.continuation) token = o.nextContinuationData.continuation;
  });
  return token;
}

async function readYouTubeMusic({ id, browseId }) {
  const target = browseId || (id.startsWith('VL') ? id : `VL${id}`);
  const first = await ytmBrowse({ browseId: target });
  let title = '';
  let headerArtist = '';
  let image = '';
  walk(first, (o) => {
    const h = o.musicResponsiveHeaderRenderer || o.musicDetailHeaderRenderer;
    if (h && !title) {
      title = runsText(h.title?.runs);
      headerArtist = runsText(h.straplineTextOne?.runs) || '';
      const thumbs = h.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || h.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails;
      if (Array.isArray(thumbs) && thumbs.length) image = thumbs[thumbs.length - 1].url;
    }
  });
  const tracks = [];
  let token = ytmRows(first, tracks);
  for (let page = 0; token && tracks.length < MAX_TRACKS && page < 100; page++) {
    const next = await ytmBrowse({ continuation: token });
    token = ytmRows(next, tracks);
  }
  if (headerArtist) for (const t of tracks) if (!t.artist) t.artist = headerArtist;
  return { name: title || 'Playlist importada', image, tracks };
}

async function readAppleMusic({ url }) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9' } });
  if (!r.ok) throw new Error(`Apple Music answered ${r.status}`);
  const html = await r.text();
  const m = /<script[^>]*id="serialized-server-data"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('Apple Music page without data');
  const data = JSON.parse(m[1]);
  const tracks = [];
  const seen = new Set();
  walk(data, (o) => {
    if (typeof o.title === 'string' && typeof o.artistName === 'string' && tracks.length < MAX_TRACKS) {
      const key = `${o.title}|${o.artistName}`;
      if (seen.has(key)) return;
      seen.add(key);
      let durSec = 0;
      if (typeof o.duration === 'number') {
        durSec = o.duration > 1000 ? Math.round(o.duration / 1000) : Math.round(o.duration);
      } else if (typeof o.durationInMillis === 'number') {
        durSec = Math.round(o.durationInMillis / 1000);
      }
      if (durSec <= 35) durSec = 210; // Ignore 30s preview metadata, default to standard studio song length
      tracks.push({ title: o.title, artist: o.artistName, durationSec: durSec });
    }
  });
  const og = /<meta property="og:title" content="([^"]*)"/.exec(html);
  const img = /<meta property="og:image" content="([^"]*)"/.exec(html);
  const name = (og ? og[1] : '').replace(/\s+(en|on) Apple Music$/i, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  return { name: name || 'Playlist importada', image: img ? img[1] : '', tracks };
}

/** { source, name, image, tracks: [{ title, artist, durationSec, videoId?, trackObj? }] } */
export async function readExternalPlaylist(rawUrl) {
  let src = detectSource(rawUrl);
  if (!src) throw new Error('unsupported');
  if (src.source === 'amazon') throw new Error('amazon');

  // Follow short links (Spotify, SoundCloud, Deezer) to destination address
  if (src.source === 'spotify-short' || src.source === 'soundcloud-short' || src.source === 'deezer-short') {
    const r = await fetch(src.url, { redirect: 'follow', headers: { 'User-Agent': UA } });
    src = detectSource(r.url);
    if (!src) throw new Error('unsupported');
  }

  if (src.source === 'spotify') {
    return { source: 'spotify', spotify: { kind: src.kind, id: src.id }, name: '', image: '', tracks: [] };
  }

  if (src.source === 'soundcloud') {
    const sc = await resolveSoundCloudUrl(src.url);
    if (!sc) {
      throw new Error('No se pudo leer la playlist de SoundCloud. Comprueba que sea pública.');
    }
    if (sc.kind === 'track' && sc.track) {
      return {
        source: 'soundcloud',
        name: sc.track.name || 'Pista de SoundCloud',
        image: sc.track.album?.images?.[0]?.url || '',
        tracks: [{
          id: sc.track.id,
          title: sc.track.name,
          artist: sc.track.artists?.[0]?.name || 'SoundCloud',
          durationSec: Math.round((sc.track.duration_ms || 210000) / 1000),
          album: sc.track.album?.name,
          coverUrl: sc.track.album?.images?.[0]?.url,
          trackObj: sc.track,
        }],
      };
    }
    if (sc.kind === 'playlist' && sc.playlist) {
      const pl = sc.playlist;
      const plCover = pl.images?.[0]?.url || '';
      const tracks = (pl.tracks?.items || []).map((t, idx) => {
        const coverUrl = t.album?.images?.[0]?.url || plCover;
        const populatedTrackObj = {
          ...t,
          album: {
            ...t.album,
            images: t.album?.images?.length ? t.album.images : (coverUrl ? [{ url: coverUrl }] : []),
          },
        };
        return {
          id: t.id || `sc-${idx}`,
          title: t.name,
          artist: t.artists?.[0]?.name || (pl.owner?.display_name || 'SoundCloud'),
          durationSec: Math.round((t.duration_ms || 210000) / 1000),
          album: t.album?.name || pl.name,
          coverUrl,
          trackObj: populatedTrackObj,
        };
      });
      return {
        source: 'soundcloud',
        name: pl.name || 'Playlist de SoundCloud',
        image: plCover,
        tracks,
      };
    }
    throw new Error('No se pudo encontrar canciones en el enlace de SoundCloud.');
  }

  const res =
    src.source === 'apple' ? await readAppleMusic(src) : src.source === 'deezer' ? await readDeezer(src) : await readYouTubeMusic(src);
  return { source: src.source, ...res };
}
