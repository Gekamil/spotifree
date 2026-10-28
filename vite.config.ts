import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

// @ts-ignore
import { resolveAudio, streamAudioFromUrl } from './scripts/audioService.mjs';
// @ts-ignore
import { resolveSpotifyPlaylist } from './api/playlist.js';

const PLAYLIST_CACHE = new Map<string, any>();
const YT_CACHE = new Map<string, string>();
let currentPlayingTrackId: string | null = null;


function toHDImage(url: string | null | undefined): string {
  if (!url) return 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';
  return url
    .replace(/\/ab67616d[0-9a-f]{8}([0-9a-f]{24})/, '/ab67616d0000b273$1')
    .replace(/\/ab67706f[0-9a-f]{8}([0-9a-f]{24})/, '/ab67706f00000002$1')
    .replace(/\/ab676161[0-9a-f]{8}([0-9a-f]{24})/, '/ab6761610000e5eb$1')
    .replace(/\/ab67706c[0-9a-f]{8}([0-9a-f]{24})/, '/ab67706c0000d72c$1')
    .replace('mosaic.scdn.co/60/', 'mosaic.scdn.co/640/')
    .replace('mosaic.scdn.co/300/', 'mosaic.scdn.co/640/')
    .replace('liked-songs-64.png', 'liked-songs-640.jpg')
    .replace('liked-songs-300.png', 'liked-songs-640.jpg');
}

async function resolveYouTubeVideoId(query: string): Promise<string | null> {
  const cleanQ = query.trim().toLowerCase();
  if (YT_CACHE.has(cleanQ)) {
    return YT_CACHE.get(cleanQ) || null;
  }

  // 1. Prioritize YouTube Music search (official music tracks only, zero shorts/podcasts)
  try {
    const ytmRes = await fetch('https://music.youtube.com/youtubei/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
        query,
        params: 'Eg-KAQwIARAAGAAgACgAMABqChAEEAMQCRAFEAo%3D', // Pure songs/audio tracks only!
      }),
    });
    if (ytmRes.ok) {
      const data: any = await ytmRes.json();
      const sections = data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
      for (const sec of sections) {
        const shelf = sec.musicShelfRenderer || sec.musicCardShelfRenderer;
        if (shelf) {
          if (shelf.title?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId) {
            const vId = shelf.title.runs[0].navigationEndpoint.watchEndpoint.videoId;
            YT_CACHE.set(cleanQ, vId);
            return vId;
          }
          for (const item of shelf.contents || []) {
            const itemRenderer = item.musicResponsiveListItemRenderer;
            const playNav = itemRenderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint;
            const videoId = playNav?.watchEndpoint?.videoId || itemRenderer?.navigationEndpoint?.watchEndpoint?.videoId;
            if (videoId) {
              YT_CACHE.set(cleanQ, videoId);
              return videoId;
            }
          }
        }
      }
      // General match in json text
      const text = JSON.stringify(data);
      const matches = Array.from(text.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)).map((m) => m[1]);
      if (matches.length > 0) {
        const videoId = matches[0];
        YT_CACHE.set(cleanQ, videoId);
        return videoId;
      }
    }
  } catch {}

  // 2. Fallback to YouTube web search
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' audio')}`;
  try {
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    });
    const html = await res.text();
    const matches = Array.from(html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g)).map((m) => m[1]);
    const videoId = matches[0] || null;
    if (videoId) {
      YT_CACHE.set(cleanQ, videoId);
    }
    return videoId;
  } catch (err) {
    console.error('YT search error:', err);
    return null;
  }
}

function parseEmbedHtml(html: string, cleanId: string) {
  const scriptMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!scriptMatch) {
    throw new Error('Embed NEXT_DATA not found in page');
  }

  const data = JSON.parse(scriptMatch[1]);
  const entity = data.props?.pageProps?.state?.data?.entity;

  if (!entity) {
    throw new Error('Entity missing from Spotify Embed');
  }

  const coverUrl = toHDImage(
    entity.visualIdentity?.image?.[0]?.url ||
    entity.coverArt?.sources?.[0]?.url ||
    'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'
  );

  const tracks = (entity.trackList || []).map((t: any, idx: number) => {
    const rawUri = t.uri || '';
    const trackId = rawUri.split(':').pop() || `track-${idx}`;
    const artistNames = t.subtitle ? t.subtitle.split(', ') : ['Spotify'];

    return {
      id: trackId,
      name: t.title,
      artists: artistNames.map((name: string, i: number) => ({
        id: `artist-${idx}-${i}`,
        name: name.trim(),
      })),
      album: {
        id: `album-${cleanId}`,
        name: entity.name,
        images: [{ url: coverUrl }],
      },
      duration_ms: t.duration || 180000,
      preview_url: t.audioPreview?.url || null,
      added_at: 'Reciente',
    };
  });

  const isArtistEntity = entity.type === 'artist' || cleanId === '3x7gz85amxEplGx7LQxE7Z' || cleanId === '5lwmRuXgjX8xIwlnauTZIP';

  const playlistData = {
    id: cleanId,
    name: entity.name,
    description: entity.description || (isArtistEntity ? 'Artista' : ''),
    type: entity.type || (cleanId === '4f0YTBqSbvM1iJpuY9r3yQ' ? 'album' : isArtistEntity ? 'artist' : 'playlist'),
    images: [{ url: coverUrl }],
    owner: {
      display_name: isArtistEntity ? 'Spotify' : (entity.type === 'album' && entity.subtitle ? entity.subtitle : (entity.owner?.name || (cleanId === '7b3MrCWtettvBKlfBSdorn' ? 'Jorgeperezvk' : 'Spotify'))),
      id: isArtistEntity ? 'spotify' : (cleanId === '7b3MrCWtettvBKlfBSdorn' ? 'user' : (entity.owner?.id || 'spotify')),
    },
    color: '#303030',
    tracks: {
      total: tracks.length,
      items: tracks,
    },
  };

  PLAYLIST_CACHE.set(cleanId, playlistData);
  return playlistData;
}

const ID_ALIASES: Record<string, string> = {
  'el-nuevo-urbano': '37i9dQZF1DWZdsS73T1ogG',
  '37i9dQZF1DWZdsS73T1ogG': '37i9dQZF1DWZdsS73T1ogG',
  'jl-2026': '7b3MrCWtettvBKlfBSdorn',
  'j-l-2026': '7b3MrCWtettvBKlfBSdorn',
  'j-l-2026-': '7b3MrCWtettvBKlfBSdorn',
  '7b3MrCWtettvBKlfBSdorn': '7b3MrCWtettvBKlfBSdorn',
  'zizi': '4f0YTBqSbvM1iJpuY9r3yQ',
  '4f0YTBqSbvM1iJpuY9r3yQ': '4f0YTBqSbvM1iJpuY9r3yQ',
  'miticas': '37i9dQZF1DX2EiUAL7Wdfc',
  '37i9dQZF1DX2EiUAL7Wdfc': '37i9dQZF1DX2EiUAL7Wdfc',
  'mix-diario-1': '37i9dQZF1E35QYVMBRlDph',
  'daily-mix-1': '37i9dQZF1E35QYVMBRlDph',
  '37i9dQZF1E35QYVMBRlDph': '37i9dQZF1E35QYVMBRlDph',
  'romeo---prince': '43GWp9FbN9nHihudedyVQM',
  'romeo-prince': '43GWp9FbN9nHihudedyVQM',
  '43GWp9FbN9nHihudedyVQM': '43GWp9FbN9nHihudedyVQM',
  '--nuestro-amor----2024-25-': '7HsL4sBaR3dJMa0UJ5e4zG',
  'nuestro-amor': '7HsL4sBaR3dJMa0UJ5e4zG',
  '7HsL4sBaR3dJMa0UJ5e4zG': '7HsL4sBaR3dJMa0UJ5e4zG',
  'tus-canciones-m-s-escuchadas-en-2025': 'tus-canciones-mas-escuchadas-2025',
  'tus-canciones-mas-escuchadas-2025': 'tus-canciones-mas-escuchadas-2025',
  'romeo-santos': '5lwmRuXgjX8xIwlnauTZIP',
  '3x7gz85amxEplGx7LQxE7Z': '3x7gz85amxEplGx7LQxE7Z',
  '5lwmRuXgjX8xIwlnauTZIP': '5lwmRuXgjX8xIwlnauTZIP',
  'trueno': '1fctva4iZegL9J1oVff86V',
  '1fctva4iZegL9J1oVff86V': '1fctva4iZegL9J1oVff86V',
  'boza': '0b53P1eMhI1j9vKxR9sXF4',
  '0b53P1eMhI1j9vKxR9sXF4': '0b53P1eMhI1j9vKxR9sXF4',
  'bad-bunny': '4q3ewBCX7sLwd24euqV69X',
  '4q3ewBCX7sLwd24euqV69X': '4q3ewBCX7sLwd24euqV69X',
  'ozuna': '1i8SpTcr70v7Y3btflSACe',
  '1i8SpTcr70v7Y3btflSACe': '1i8SpTcr70v7Y3btflSACe',
  'quevedo': '52iwsT98xCoGgiGntTiR7K',
  '52iwsT98xCoGgiGntTiR7K': '52iwsT98xCoGgiGntTiR7K',
  'feid': '2LRoIwbOP2MeT09LGI8bFH',
  'prince-royce': '3yc59JusNII7NZqAea92ep',
  '3yc59JusNII7NZqAea92ep': '3yc59JusNII7NZqAea92ep',
  'my-top-tracks': 'my-top-tracks-playlist',
  'my-top-tracks-playlist': 'my-top-tracks-playlist',
};

async function scrapeSpotifyEmbed(playlistId: string) {
  const cleanId = playlistId
    .replace(/^spotify:playlist:/, '')
    .replace(/^spotify:album:/, '')
    .replace(/^spotify:collection:/, '')
    .split('?')[0];

  if (PLAYLIST_CACHE.has(cleanId)) {
    return PLAYLIST_CACHE.get(cleanId);
  }

  // Special case: nueva-carpeta
  if (cleanId === 'nueva-carpeta') {
    const folderData = {
      id: 'nueva-carpeta',
      name: 'Nueva carpeta',
      description: 'Carpeta',
      images: [],
      owner: { display_name: 'Jorgeperezvk', id: 'user' },
      color: '#282828',
      tracks: { total: 0, items: [] },
    };
    PLAYLIST_CACHE.set(cleanId, folderData);
    return folderData;
  }

  // 1. Liked songs special case (private collection)
  if (cleanId === 'liked-songs' || cleanId === 'tracks') {
    const likedPlaylist = {
      id: 'liked-songs',
      name: 'Canciones que te gustan',
      description: 'Tu lista de «Canciones que te gustan» es privada en Spotify.',
      images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
      owner: { display_name: 'Tú', id: 'me' },
      color: '#5018F0',
      tracks: {
        total: 0,
        items: [],
      },
    };
    PLAYLIST_CACHE.set('liked-songs', likedPlaylist);
    return likedPlaylist;
  }

  const canonicalId = ID_ALIASES[cleanId] || cleanId;

  // 2. Check local real extracted tracks dataset (instant & with real track album artwork)
  const allTracksFile = path.resolve('src/data/allRealPlaylistTracks.json');
  if (fs.existsSync(allTracksFile)) {
    try {
      const allTracks = JSON.parse(fs.readFileSync(allTracksFile, 'utf8'));
      const match =
        allTracks[cleanId] ||
        allTracks[canonicalId] ||
        (canonicalId === '7b3MrCWtettvBKlfBSdorn' && (allTracks['jl-2026'] || allTracks['j-l-2026'])) ||
        (canonicalId === '37i9dQZF1DWZdsS73T1ogG' && allTracks['el-nuevo-urbano']) ||
        (canonicalId === '4f0YTBqSbvM1iJpuY9r3yQ' && allTracks['zizi']) ||
        (canonicalId === '37i9dQZF1DX2EiUAL7Wdfc' && allTracks['miticas']) ||
        (canonicalId === '37i9dQZF1E35QYVMBRlDph' && (allTracks['mix-diario-1'] || allTracks['daily-mix-1']));

      if (match && match.tracks && match.tracks.length > 0) {
        const coverImg = toHDImage(match.image || match.images?.[0]?.url);
        const result = {
          id: cleanId,
          name: match.name,
          description: match.description || '',
          type: match.type || (cleanId === '4f0YTBqSbvM1iJpuY9r3yQ' ? 'album' : cleanId === '3x7gz85amxEplGx7LQxE7Z' ? 'artist' : 'playlist'),
          images: [{ url: coverImg }],
          owner: {
            display_name: match.owner?.display_name || (typeof match.owner === 'string' ? match.owner : canonicalId === '7b3MrCWtettvBKlfBSdorn' ? 'Jorgeperezvk' : 'Spotify'),
            id: (canonicalId === '7b3MrCWtettvBKlfBSdorn' || canonicalId === '7HsL4sBaR3dJMa0UJ5e4zG') ? 'user' : (match.owner?.id || 'spotify'),
          },
          color: match.color || '#303030',
          tracks: {
            total: match.tracks.length,
            items: match.tracks.map((t: any) => ({
              ...t,
              album: {
                ...t.album,
                images: [{ url: toHDImage(t.album?.images?.[0]?.url || coverImg) }],
              },
            })),
          },
        };
        PLAYLIST_CACHE.set(cleanId, result);
        return result;
      }
    } catch (e) {
      console.error('Error reading allRealPlaylistTracks:', e);
    }
  }

  // 3. Fallback to Spotify embed via HTTP fetch (clean, headless, zero browser tabs)
  const KNOWN_ARTIST_IDS = new Set([
    '5lwmRuXgjX8xIwlnauTZIP', // Romeo Santos
    '3x7gz85amxEplGx7LQxE7Z',
    '1fctva4iZegL9J1oVff86V', // Trueno
    '0b53P1eMhI1j9vKxR9sXF4', // Boza
    '4q3ewBCX7sLwd24euqV69X', // Bad Bunny
    '1i8SpTcr70v7Y3btflSACe', // Ozuna
    '52iwsT98xCoGgiGntTiR7K', // Quevedo
    '2LRoIwbOP2MeT09LGI8bFH', // Feid
    '3yc59JusNII7NZqAea92ep', // Prince Royce
  ]);

  const lookupId = canonicalId;
  const cleanEmbedId = lookupId.replace(/^(art-|artist-|alb-)/, '');
  const isArtistEntity =
    KNOWN_ARTIST_IDS.has(cleanEmbedId) ||
    KNOWN_ARTIST_IDS.has(lookupId) ||
    lookupId === 'romeo-santos' ||
    lookupId === 'trueno' ||
    lookupId === 'boza' ||
    lookupId === 'ozuna' ||
    lookupId === 'quevedo' ||
    lookupId === 'feid' ||
    lookupId.startsWith('art-') ||
    lookupId.startsWith('artist-');
  const isAlbum = lookupId === '4f0YTBqSbvM1iJpuY9r3yQ' || lookupId.startsWith('alb-');
  const embedType = isArtistEntity ? 'artist' : isAlbum ? 'album' : 'playlist';
  const url = `https://open.spotify.com/embed/${embedType}/${cleanEmbedId}`;

  let response: any = null;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
  } catch {}

  if (response && response.ok) {
    try {
      return parseEmbedHtml(await response.text(), cleanId);
    } catch {}
  }

  // Try alternate embed types (album, artist, playlist)
  const altTypes = ['album', 'artist', 'playlist'].filter((t) => t !== embedType);
  for (const altType of altTypes) {
    try {
      const altRes = await fetch(`https://open.spotify.com/embed/${altType}/${cleanEmbedId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      if (altRes.ok) {
        return parseEmbedHtml(await altRes.text(), cleanId);
      }
    } catch {}
  }

  // Check if cleanId matches any card in feed files
  try {
    const feedFiles = ['src/data/liveExtractedFeed.json', 'src/data/liveExtractedSession.json'];
    for (const ff of feedFiles) {
      const feedPath = path.resolve(ff);
      if (fs.existsSync(feedPath)) {
        const feedData = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
        for (const s of feedData.shelves || []) {
          const foundCard = (s.cards || []).find((c: any) => c.id === cleanId || c.id === lookupId);
          if (foundCard) {
            if (foundCard.id && !foundCard.id.startsWith('card-') && foundCard.id !== cleanId) {
              return await scrapeSpotifyEmbed(foundCard.id);
            }
            const fallbackCard = {
              id: cleanId,
              name: foundCard.title,
              description: foundCard.subtitle || '',
              type: foundCard.isRadio ? 'radio' : 'playlist',
              images: [{ url: toHDImage(foundCard.image) }],
              owner: { display_name: 'Spotify', id: 'spotify' },
              color: '#303030',
              tracks: { total: 0, items: [] },
            };
            PLAYLIST_CACHE.set(cleanId, fallbackCard);
            return fallbackCard;
          }
        }
      }
    }
  } catch {}

  // Safe fallback to prevent endpoint 500
  const safeFallback = {
    id: cleanId,
    name: cleanId.replace(/[-_]/g, ' '),
    description: 'Lista de Spotify',
    type: isArtistEntity ? 'artist' : isAlbum ? 'album' : 'playlist',
    images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
    owner: { display_name: 'Spotify', id: 'spotify' },
    color: '#303030',
    tracks: { total: 0, items: [] },
  };
  PLAYLIST_CACHE.set(cleanId, safeFallback);
  return safeFallback;
}

async function extractLiveFeedFromSpotify() {
  let browser: any = null;
  try {
    browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9222',
      defaultViewport: null,
    });

    const pages = await browser.pages();
    const spotifyPage = pages.find((p: any) => p.url().includes('open.spotify.com'));
    if (!spotifyPage) return null;

    const data = await spotifyPage.evaluate(() => {
      const doc: any = (globalThis as any).document;

      // 1. User
      const userBtn = doc.querySelector('[data-testid="user-widget-link"]') ||
                      doc.querySelector('[data-testid="username-first-letter"]');
      const userName = userBtn ? (userBtn.getAttribute('aria-label') || userBtn.textContent) : 'Jorgeperezvk';

      // 2. Playback state
      const playPauseBtn = doc.querySelector('[data-testid="control-button-playpause"]');
      const isPlayingLive = playPauseBtn?.getAttribute('aria-label')?.toLowerCase().includes('paus') ?? false;
      const nowPlayingWidget = doc.querySelector('[data-testid="now-playing-widget"]');
      let trackName = null;
      let artistName = null;
      let trackImage = null;
      if (nowPlayingWidget) {
        const links: any[] = Array.from(nowPlayingWidget.querySelectorAll('a'));
        if (links.length >= 1) {
          trackName = links[0]?.textContent?.trim() || null;
          artistName = links.slice(1).map((a: any) => a.textContent?.trim()).join(', ') || null;
        }
        trackImage = nowPlayingWidget.querySelector('img')?.src || null;
      }

      // 3. User Library Playlists from Sidebar
      const titleElements: any[] = Array.from(doc.querySelectorAll('[id^="listrow-title-spotify:"]'));
      const userPlaylists: any[] = [];
      for (const el of titleElements) {
        const uri = el.id.replace('listrow-title-', '');
        const name = el.textContent?.trim();
        const row = el.closest('[role="row"]');
        const sub = row?.querySelector('.e-101040-legacy-list-row__subtitle, p:not([id^="listrow-title-"]), span:not([id^="listrow-title-"])')?.textContent?.trim() || '';
        const img = row?.querySelector('img')?.src || '';
        const isPinned = !!row?.querySelector('[aria-label*="Fijad"], svg[data-encore-id="icon-pin"]');
        const id = uri === 'spotify:collection:tracks' ? 'liked-songs' : uri.split(':').pop();
        if (id && name && !userPlaylists.some((p) => p.id === id)) {
          userPlaylists.push({
            id,
            uri,
            name,
            description: sub || `De ${userName}`,
            images: [{ url: img }],
            is_pinned: isPinned,
            owner: { display_name: userName, id: 'user' },
            tracks: { total: id === 'liked-songs' ? 23 : 0 },
          });
        }
      }

      // 4. Quick Access Shortcuts (Directly from Spotify's top shortcuts)
      const shortcutImages: any[] = Array.from(doc.querySelectorAll('[data-testid="shortcut-image"]'));
      const quickAccess: any[] = [];
      for (const img of shortcutImages) {
        const card = img.closest('[data-testid="shortcut-card"], [data-encore-id="card"]') || img.parentElement?.parentElement?.parentElement?.parentElement;
        const anchor = card?.querySelector('a[href*="/playlist/"], a[href*="/album/"], a[href*="/artist/"]') || (card?.tagName === 'A' ? card : null);
        const href = anchor ? anchor.getAttribute('href') : '';
        const name = card?.innerText?.split('\n').filter(Boolean)[0] || anchor?.textContent?.trim() || '';
        const id = href ? href.split('/').filter(Boolean).pop()?.split('?')[0] : null;
        if (id && name && !quickAccess.some((q) => q.id === id)) {
          quickAccess.push({ id, name, image: img.src, href });
        }
      }

      // 5. Shelves / Carousels (Extracting real component shelves with exact prefix & title)
      const shelfSections: any[] = Array.from(doc.querySelectorAll('section[data-testid="component-shelf"]'));
      const shelves: any[] = [];

      for (let sIdx = 0; sIdx < shelfSections.length; sIdx++) {
        const sec = shelfSections[sIdx];
        const h2 = sec.querySelector('h2');
        if (!h2) continue;
        const h2Text = h2.textContent?.trim() || '';
        if (!h2Text || h2Text.toLowerCase() === 'puede que te guste') continue;

        const pText = sec.querySelector('p')?.textContent?.trim() || '';

        let prefix = '';
        let title = h2Text;
        let subtitle = '';

        if (pText.toLowerCase().startsWith('hecho para')) {
          prefix = 'Hecho para';
          title = h2Text;
        } else if (pText.toLowerCase().startsWith('más como')) {
          prefix = 'Más como';
          title = h2Text;
        } else if (pText.includes('Música sin fin')) {
          title = h2Text;
          subtitle = pText;
        } else if (pText) {
          subtitle = pText;
        }

        const cardElements: any[] = Array.from(sec.querySelectorAll('[data-encore-id="card"]'));
        const cards: any[] = [];

        for (let cIdx = 0; cIdx < cardElements.length; cIdx++) {
          const el = cardElements[cIdx];
          const anchor = el.querySelector('a[href*="/playlist/"], a[href*="/album/"], a[href*="/artist/"], a[href*="/episode/"]') || el.querySelector('a');
          const href = anchor ? anchor.getAttribute('href') : null;
          const id = href ? href.split('/').filter(Boolean).pop()?.split('?')[0] : `card-${sIdx}-${cIdx}`;

          const cardTitle = el.querySelector('[data-encore-id="cardTitle"]')?.textContent?.trim() || anchor?.textContent?.trim() || `Item ${cIdx+1}`;
          const cardSubtitle = el.querySelector('[data-encore-id="cardSubtitle"]')?.textContent?.trim() || el.querySelector('p')?.textContent?.trim() || '';
          const img = el.querySelector('img[data-testid="card-image"], img')?.src || null;
          const video = el.querySelector('video')?.src || el.querySelector('video')?.currentSrc || null;
          const isRadio = cardTitle.toLowerCase().includes('radio') ||
                          cardSubtitle.toLowerCase().includes('radio') ||
                          title.toLowerCase().includes('emisoras');

          cards.push({
            id,
            title: cardTitle,
            subtitle: cardSubtitle,
            image: img,
            video,
            isRadio: !!isRadio,
          });
        }

        if (cards.length > 0) {
          // Avoid duplicate shelf titles (e.g. repeated artist shelves)
          let shelfTitle = title;
          if (shelves.some((s) => s.title.toLowerCase() === shelfTitle.toLowerCase() && s.prefix.toLowerCase() === prefix.toLowerCase())) {
            const altArtist = cards.find((c) => c.subtitle && !c.subtitle.toLowerCase().includes(shelfTitle.toLowerCase()))?.subtitle;
            if (altArtist) {
              shelfTitle = altArtist.replace(/^(con|de)\s+/i, '').split(',')[0].trim();
            } else {
              continue;
            }
          }

          shelves.push({
            id: `shelf-${sIdx}-${shelfTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
            prefix,
            title: shelfTitle,
            subtitle,
            hasSeeAll: !!sec.querySelector('a[href*="/section/"], a[href*="/recents"]'),
            cards,
          });
        }
      }

      return { userName, isPlayingLive, trackName, artistName, trackImage, userPlaylists, quickAccess, shelves };
    });

    return data;
  } catch (err) {
    return null;
  } finally {
    if (browser) browser.disconnect();
  }
}

function dynamicSpotifyPlugin(): Plugin {
  return {
    name: 'dynamic-spotify-plugin',
    configureServer(server) {
      // 1. Dynamic Playlist Details Endpoint (/api/spotify/playlist/:id)
      server.middlewares.use('/api/spotify/playlist', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        const urlParts = req.url?.split('/').filter(Boolean) || [];
        const rawId = urlParts[0] || '';

        if (!rawId) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Missing playlist ID' }));
        }

        try {
          const cookie = (req.headers['x-spotify-cookie'] as string) || '';
          const authHeader = (req.headers['authorization'] as string) || '';
          const token = authHeader.replace(/^Bearer\s+/i, '');

          let playlist = null;
          try {
            playlist = await resolveSpotifyPlaylist(rawId, { cookie, token });
          } catch {}

          if (!playlist || !playlist.tracks || playlist.tracks.total === 0) {
            const fallback = await scrapeSpotifyEmbed(rawId);
            if (fallback && fallback.tracks && fallback.tracks.total > 0) {
              playlist = fallback;
            }
          }

          res.statusCode = 200;
          return res.end(JSON.stringify(playlist || { id: rawId, tracks: { total: 0, items: [] } }));
        } catch (err: any) {
          console.error(`Error resolving playlist ${rawId}:`, err.message);
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: err.message }));
        }
      });

      // 2. Dynamic Audio Resolver Endpoint (/api/audio/resolve)
      server.middlewares.use('/api/audio/resolve', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        const url = new URL(req.url || '', 'http://localhost');
        const title = url.searchParams.get('title') || '';
        const artist = url.searchParams.get('artist') || '';
        const q = url.searchParams.get('q') || `${title} ${artist}`;

        if (!q.trim()) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Missing query' }));
        }

        try {
          const videoId = await resolveYouTubeVideoId(q);
          res.statusCode = 200;
          return res.end(JSON.stringify({ videoId }));
        } catch (err: any) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: err.message }));
        }
      });

      // 2b. Direct Native Audio Stream (/api/audio/stream) - 0% ADS, NO 59s STALL, DESKTOP & MOBILE
      server.middlewares.use('/api/audio/stream', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');

        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Headers', 'Range');
          res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
          res.statusCode = 204;
          return res.end();
        }

        const url = new URL(req.url || '', 'http://localhost');
        const target = url.searchParams.get('id') || url.searchParams.get('q') || url.searchParams.get('v') || url.searchParams.get('trackId') || '';

        if (!target.trim()) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Missing audio query or id' }));
        }

        try {
          const info = await resolveAudio(target);
          if (!info || !info.url) {
            res.statusCode = 404;
            return res.end(JSON.stringify({ error: 'Stream URL not found' }));
          }
          currentPlayingTrackId = info.id;
          streamAudioFromUrl(info.url, req, res);
        } catch (err: any) {
          console.error('[AudioStream error]:', err.message);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        }
      });

      // 2c. Audio Play metadata resolver (/api/audio/play)
      server.middlewares.use('/api/audio/play', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', async () => {
          try {
            const { query, videoId, title, artist } = JSON.parse(body || '{}');
            const target = videoId || query || `${title || ''} ${artist || ''}`.trim();
            if (!target) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ error: 'Missing target query or videoId' }));
            }

            const info = await resolveAudio(target);
            currentPlayingTrackId = info.id;

            res.statusCode = 200;
            return res.end(JSON.stringify({
              success: true,
              videoId: info.id,
              duration: info.duration,
              title: info.title,
              streamUrl: `/api/audio/stream?id=${encodeURIComponent(info.id)}`,
            }));
          } catch (err: any) {
            console.error('Audio play error:', err.message);
            res.statusCode = 500;
            return res.end(JSON.stringify({ error: err.message }));
          }
        });
      });

      // 2d. Audio Status (/api/audio/status)
      server.middlewares.use('/api/audio/status', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        res.statusCode = 200;
        return res.end(JSON.stringify({
          isPlaying: true,
          currentTime: 0,
          duration: 0,
          ended: false,
          isAd: false,
          videoId: currentPlayingTrackId,
        }));
      });

      // 2e. Audio Control (/api/audio/control)
      server.middlewares.use('/api/audio/control', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          res.statusCode = 200;
          return res.end(JSON.stringify({ success: true }));
        });
      });

      // 2e. Synced & Plain Lyrics API (LRCLIB Integration)
      server.middlewares.use('/api/lyrics', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        const url = new URL(req.url || '', 'http://localhost');
        const title = (url.searchParams.get('title') || '').trim();
        const artist = (url.searchParams.get('artist') || '').trim();

        if (!title) {
          res.statusCode = 200;
          return res.end(JSON.stringify({ syncedLyrics: null, plainLyrics: null }));
        }

        try {
          const lrcUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
          const lrcRes = await fetch(lrcUrl, {
            headers: { 'User-Agent': 'Spotifree/1.0' },
            signal: AbortSignal.timeout(4000),
          });
          if (lrcRes.ok) {
            const data = await lrcRes.json();
            res.statusCode = 200;
            return res.end(JSON.stringify(data));
          }

          // Fallback search
          const sUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(title + ' ' + artist)}`;
          const sRes = await fetch(sUrl, {
            headers: { 'User-Agent': 'Spotifree/1.0' },
            signal: AbortSignal.timeout(4000),
          });
          if (sRes.ok) {
            const list = await sRes.json();
            if (Array.isArray(list) && list.length > 0) {
              res.statusCode = 200;
              return res.end(JSON.stringify(list[0]));
            }
          }
        } catch (e) {}

        res.statusCode = 200;
        return res.end(JSON.stringify({ syncedLyrics: null, plainLyrics: null }));
      });

      // 3. Play Track on Remote Spotify Web (/api/spotify/play) - Decoupled silent stub
      server.middlewares.use('/api/spotify/play', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        // Return immediately without navigating or focusing any user browser tabs
        res.statusCode = 200;
        return res.end(JSON.stringify({ success: true, decoupled: true }));
      });

      // 3b. Dynamic Music Search (/api/spotify/search)
      server.middlewares.use('/api/spotify/search', async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        const url = new URL(req.url || '', 'http://localhost');
        const q = (url.searchParams.get('q') || '').trim();

        if (!q) {
          res.statusCode = 200;
          return res.end(JSON.stringify({ tracks: { items: [] } }));
        }

        try {
          // 1. Search local library first
          const localResults: any[] = [];
          const allTracksFile = path.resolve('src/data/allRealPlaylistTracks.json');
          if (fs.existsSync(allTracksFile)) {
            try {
              const allTracksData = JSON.parse(fs.readFileSync(allTracksFile, 'utf8'));
              const qLower = q.toLowerCase();
              for (const plKey of Object.keys(allTracksData)) {
                const pl = allTracksData[plKey];
                for (const t of pl.tracks || []) {
                  const matchName = t.name?.toLowerCase().includes(qLower);
                  const matchArtist = t.artists?.some((a: any) => a.name?.toLowerCase().includes(qLower));
                  if ((matchName || matchArtist) && !localResults.some((ex) => ex.name.toLowerCase() === t.name.toLowerCase())) {
                    localResults.push(t);
                  }
                }
              }
            } catch {}
          }

          // 2. Query iTunes music search API for instant global song search
          const itunesItems: any[] = [];
          try {
            const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=25`;
            const itunesRes = await fetch(itunesUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
            });

            if (itunesRes.ok) {
              const itunesData: any = await itunesRes.json();
              for (const t of itunesData.results || []) {
                const trackId = `itunes-${t.trackId}`;
                const hdImage = (t.artworkUrl100 || '').replace('100x100bb', '600x600bb');
                if (!localResults.some((lr) => lr.name.toLowerCase() === t.trackName.toLowerCase())) {
                  itunesItems.push({
                    id: trackId,
                    name: t.trackName,
                    duration_ms: t.trackTimeMillis || 210000,
                    preview_url: t.previewUrl || null,
                    artists: [{ id: `art-${t.artistId}`, name: t.artistName }],
                    album: {
                      id: `alb-${t.collectionId}`,
                      name: t.collectionName || t.trackName,
                      images: [{ url: hdImage }],
                    },
                  });
                }
              }
            }
          } catch (itunesErr) {
            console.warn('External iTunes search unreachable, falling back to local dataset:', itunesErr);
          }

          const combined = [...localResults.slice(0, 5), ...itunesItems];
          res.statusCode = 200;
          return res.end(JSON.stringify({ tracks: { items: combined } }));
        } catch (err: any) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: err.message, tracks: { items: [] } }));
        }
      });

      // 3. Real Live Session Sync Endpoint (/api/session-sync & /api/spotify/session)
      const handleSession = async (req: any, res: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          return res.end();
        }

        const liveData = await extractLiveFeedFromSpotify();
        const cacheFile = path.resolve('src/data/liveExtractedFeed.json');

        const sessionFile = path.resolve('src/data/liveExtractedSession.json');

        let feed: any = null;
        if (liveData && liveData.shelves && liveData.shelves.length >= 5) {
          feed = liveData;
          try {
            fs.writeFileSync(cacheFile, JSON.stringify(feed, null, 2));
          } catch {}
        } else if (fs.existsSync(cacheFile)) {
          try {
            const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            if (cached && cached.shelves && cached.shelves.length >= 5) {
              feed = cached;
            }
          } catch {}
        }

        if (!feed || !feed.shelves || feed.shelves.length < 5) {
          try {
            const fallbackSession = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
            feed = {
              userName: fallbackSession.user?.display_name || 'Jorgeperezvk',
              userId: fallbackSession.user?.id || 'e6yr34zzwnf1yybcw49po6nrw',
              userPlaylists: fallbackSession.playlists || [],
              quickAccess: fallbackSession.quickAccess || [],
              shelves: fallbackSession.shelves || [],
            };
            try {
              fs.writeFileSync(cacheFile, JSON.stringify(feed, null, 2));
            } catch {}
          } catch {}
        }

        const connectedUserName = feed?.userName || 'Jorgeperezvk';

        // Real user playlists from profile & sidebar
        const realPlaylists = (feed?.userPlaylists && feed.userPlaylists.length > 0)
          ? feed.userPlaylists.map((p: any) => ({
              id: p.id,
              name: p.name,
              description: p.description || `De ${connectedUserName}`,
              images: [{ url: toHDImage(p.images?.[0]?.url) }],
              owner: { display_name: p.owner?.display_name || connectedUserName, id: 'user' },
              tracks: { total: p.tracks?.total || 0 },
              color: p.id === 'liked-songs' ? '#5018F0' : '#303030',
              is_pinned: p.is_pinned ?? false,
            }))
          : [
              {
                id: 'liked-songs',
                name: 'Canciones que te gustan',
                description: '23 canciones',
                images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
                owner: { display_name: connectedUserName, id: 'user' },
                tracks: { total: 23 },
                color: '#5018F0',
                is_pinned: true,
              },
            ];

        // Process HD Quick Access cards
        const quickAccessCards = (feed?.quickAccess && feed.quickAccess.length > 0)
          ? feed.quickAccess.map((q: any) => ({
              id: q.id,
              name: q.name,
              image: toHDImage(q.image),
              color: '#303030',
            }))
          : [];

        // Process HD Shelves
        const realShelves = (feed?.shelves && feed.shelves.length > 0)
          ? feed.shelves.map((s: any) => ({
              id: s.id,
              prefix: s.prefix || '',
              title: s.title,
              subtitle: s.subtitle || '',
              hasSeeAll: s.hasSeeAll,
              cards: s.cards.map((c: any) => ({
                id: c.id,
                title: c.title,
                subtitle: c.subtitle,
                image: toHDImage(c.image),
                video: c.video,
                isRadio: c.isRadio,
              })),
            }))
          : [];

        const responseData = {
          connected: true,
          user: {
            id: feed?.userId || 'e6yr34zzwnf1yybcw49po6nrw',
            display_name: connectedUserName,
            avatarLetter: connectedUserName.charAt(0).toUpperCase(),
          },
          accessToken: 'session-bridge-active',
          playlists: realPlaylists,
          quickAccess: quickAccessCards,
          shelves: realShelves,
          recentlyPlayed: [],
          featuredMessage: `Hecho para ${connectedUserName}`,
          playback: {
            isPlaying: feed?.isPlaying || false,
            item: feed?.nowPlaying || null,
          },
          queue: [],
        };

        res.statusCode = 200;
        return res.end(JSON.stringify(responseData));
      };

      server.middlewares.use('/api/session-sync', handleSession);
      server.middlewares.use('/api/spotify/session', handleSession);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), dynamicSpotifyPlugin()],
  server: {
    host: true,
    port: 5173,
  },
});
