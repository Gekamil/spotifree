import { create } from 'zustand';
import type { SyntheticEvent } from 'react';
import type { Playlist } from '../types/spotify';
import { ARTIST_IMAGE_CACHE } from './artistImage';
import { TRACK_COVER_CACHE, getTrackCoverUrl } from './trackCovers';
import { useSpotifyDataStore } from '../store/useSpotifyDataStore';

/**
 * Spotify's look for a playlist without artwork: dark grey square with an outlined music note.
 * (Using the "Canciones que te gustan" heart for every empty list made them look like Liked Songs.)
 */
export const EMPTY_PLAYLIST_COVER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23282828"/><path d="M128 102v74.5a22 22 0 1 0 10 18.5V128l52-11v47.5a22 22 0 1 0 10 18.5V89z" fill="none" stroke="%237f7f7f" stroke-width="7" stroke-linejoin="round"/></svg>';

const LIKED_COVER = 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';

/** Spotify's image id of an album cover URL (i.scdn.co), in the 300 px size mosaics use */
function spotifyCoverId(url: string): string | null {
  const m = url.match(/i\.scdn\.co\/image\/ab67616d[0-9a-f]{8}([0-9a-f]{24})/);
  return m ? `ab67616d00001e02${m[1]}` : null;
}

/**
 * Automatic cover, like Spotify's: with 4 or more songs from different albums, a 2×2 collage of
 * the first four (Spotify's own mosaic service); with fewer, the first song's cover; no songs,
 * the empty cover. It follows the songs: add / remove songs and the cover changes.
 */
export function getAutoPlaylistCover(items: any[] | undefined | null): string {
  const covers: string[] = [];
  for (const x of items || []) {
    const t = x?.track && x.track.name ? x.track : x;
    const art = getTrackCoverUrl(t) || t?.album?.images?.[0]?.url || (t?.id && TRACK_COVER_CACHE.get(t.id)) || (t as any)?.image;
    if (art && !covers.includes(art)) covers.push(art);
    if (covers.length === 4) break;
  }
  if (covers.length >= 4) {
    // All four from Spotify: Spotify's own mosaic service
    const ids = covers.map(spotifyCoverId);
    if (ids.every(Boolean)) return `https://mosaic.scdn.co/640/${ids.join('')}`;
    // Other sources (Deezer, Apple…): the same 2×2 collage drawn on the device
    const key = covers.join('|');
    const drawn = collageCache.get(key);
    if (drawn) return drawn;
    void drawCollage(key, covers);
  }
  return covers[0] || EMPTY_PLAYLIST_COVER;
}

// ---------------------------------------------------------------------------
// Collages drawn on the device (for covers that are not Spotify's), cached for the session
// ---------------------------------------------------------------------------
const collageCache = new Map<string, string>();
const drawing = new Set<string>();

/** Re-render when a collage is ready (components read useAutoCovers(s => s.version)) */
export const useAutoCovers = create<{ version: number }>(() => ({ version: 0 }));

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url.replace(/\/\d+x\d+-000000-80-0-0\.jpg$/, '/300x300-000000-80-0-0.jpg');
    setTimeout(() => resolve(null), 3000);
  });
}

async function drawCollage(key: string, covers: string[]) {
  if (typeof document === 'undefined' || drawing.has(key)) return;
  drawing.add(key);
  try {
    const imgs = await Promise.all(covers.slice(0, 4).map(loadImage));
    if (imgs.some((i) => !i)) return;
    const S = 300;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    imgs.forEach((img, i) => {
      const im = img!;
      const s = Math.min(im.naturalWidth, im.naturalHeight);
      ctx.drawImage(im, (im.naturalWidth - s) / 2, (im.naturalHeight - s) / 2, s, s, (i % 2) * (S / 2), Math.floor(i / 2) * (S / 2), S / 2, S / 2);
    });
    collageCache.set(key, c.toDataURL('image/jpeg', 0.85));
    useAutoCovers.setState((st) => ({ version: st.version + 1 }));
  } catch {
    // An image without CORS: the first song's cover stays
  } finally {
    drawing.delete(key);
  }
}

/** Best cover for a playlist: its own image, else the automatic one from its songs. */
export function getPlaylistCover(p: Partial<Playlist> | null | undefined): string {
  if (!p) return EMPTY_PLAYLIST_COVER;
  const pid = p.id || '';
  if (pid === 'liked-songs' || pid === 'collection:tracks' || pid === 'user-liked-songs') return LIKED_COVER;

  // 1. Own photo directly on playlist
  const own = p.images?.find((i) => i?.url)?.url;
  // Older builds saved the Liked Songs heart as the cover of brand-new playlists: ignore it there
  if (own && !(own === LIKED_COVER && pid !== 'liked-songs')) return own;

  // 2. Check cached details from store
  let cached: Partial<Playlist> | undefined;
  try {
    cached = useSpotifyDataStore.getState?.()?.playlistDetailsCache?.[pid];
  } catch {}

  const cachedOwn = cached?.images?.find((i) => i?.url)?.url;
  if (cachedOwn && !(cachedOwn === LIKED_COVER && pid !== 'liked-songs')) return cachedOwn;

  // 3. Check artist photo cache if it's an artist
  const isArt = p.type === 'artist' || p.description === 'Artista' || pid.startsWith('art-') || pid.startsWith('artist-');
  if (isArt) {
    const artistName = (p.name || pid).replace(/^(art-|artist-|sf-artist-)/i, '').trim().toLowerCase();
    const artPic = ARTIST_IMAGE_CACHE.get(artistName);
    if (artPic) return artPic;
  }

  // 4. Check tracks on playlist or cached details or localStorage
  let items = p.tracks?.items;
  if (!items || items.length === 0) {
    items = cached?.tracks?.items;
  }
  if ((!items || items.length === 0) && typeof window !== 'undefined' && pid) {
    try {
      const cleanPid = pid.replace(/^spotify:playlist:/i, '').split('?')[0];
      const raw =
        window.localStorage.getItem(`spotifree_playlist_tracks_${cleanPid}`) ||
        window.localStorage.getItem(`spotifree_playlist_tracks_${pid}`);
      if (raw) items = JSON.parse(raw);
    } catch {}
  }

  return getAutoPlaylistCover(items);
}

/**
 * onError for a playlist's cover <img>: a dead link falls back to the first song's cover and then
 * to the empty-playlist cover, so a playlist never shows a broken image.
 */
export function onPlaylistCoverError(p: Partial<Playlist> | null | undefined) {
  return (e: SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const step = Number(img.dataset.coverStep || '0');
    img.dataset.coverStep = String(step + 1);
    if (step === 0) {
      let items = p?.tracks?.items;
      if (!items || items.length === 0) {
        try {
          items = useSpotifyDataStore.getState?.()?.playlistDetailsCache?.[p?.id || '']?.tracks?.items;
        } catch {}
      }
      const first = (items || [])
        .map((x: any) => {
          const t = x?.track && x.track.name ? x.track : x;
          return getTrackCoverUrl(t) || t?.album?.images?.[0]?.url;
        })
        .find((u: string | undefined) => u && u !== img.src);
      if (first) {
        img.referrerPolicy = 'no-referrer';
        img.src = first;
        return;
      }
    }
    img.onerror = null;
    img.src = EMPTY_PLAYLIST_COVER;
  };
}