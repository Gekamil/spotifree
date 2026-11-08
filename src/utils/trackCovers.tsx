import React, { useState } from 'react';
import type { Track } from '../types/spotify';

export const TRACK_COVER_CACHE = new Map<string, string>();

/**
 * Detects whether a URL is a playlist cover, mosaic, or generic placeholder
 * instead of an actual song album artwork.
 */
export function isPlaylistOrGenericCover(url?: string | null, playlistCover?: string | null): boolean {
  if (!url) return true;
  if (url.includes('liked-songs')) return true;
  if (url.includes('mosaic.scdn.co')) return true;
  if (url.includes('pickasso.spotifycdn.com')) return true;
  // Spotify User & Editorial playlist cover hashes: ab67706c, ab67706f, ab67706d
  if (url.includes('ab67706c') || url.includes('ab67706f') || url.includes('ab67706d')) return true;
  if (url.includes('/img/daily/') || url.includes('/img/radio/')) return true;
  if (playlistCover && (url === playlistCover || url.endsWith(playlistCover.slice(-25)))) return true;
  return false;
}

// v2: the old cache could hold covers of other songs by the same artist (loose search). It is
// dropped once; covers are found again with the exact-match rules below.
const COVERS_KEY = 'spotifree_track_covers_v2';
if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem('spotifree_track_covers');
  } catch {}
  try {
    const saved = window.localStorage.getItem(COVERS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      let cleaned = false;
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === 'string' && !isPlaylistOrGenericCover(v)) {
          TRACK_COVER_CACHE.set(k, v);
        } else {
          cleaned = true;
          delete parsed[k];
        }
      });
      // Purge corrupt playlist covers from localStorage immediately
      if (cleaned) {
        window.localStorage.setItem(COVERS_KEY, JSON.stringify(parsed));
      }
    }
  } catch {}
}

export function persistTrackCover(id: string, url: string, playlistCover?: string) {
  if (!id || !url || isPlaylistOrGenericCover(url, playlistCover)) return;
  TRACK_COVER_CACHE.set(id, url);
  if (typeof window !== 'undefined') {
    try {
      const obj: Record<string, string> = {};
      let count = 0;
      for (const [k, v] of TRACK_COVER_CACHE.entries()) {
        obj[k] = v;
        if (++count > 1500) break;
      }
      window.localStorage.setItem(COVERS_KEY, JSON.stringify(obj));
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// Exact cover search: the right song or nothing (a placeholder is better than a wrong cover)
// ---------------------------------------------------------------------------
const normCover = (s = '') =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s*[([].*?[)\]]/g, '')
    .replace(/\s+-\s+.*$/, '')
    .replace(/\b(feat|ft|featuring|with)\b\.?.*$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function sameTitle(a: string, b: string): boolean {
  const x = normCover(a);
  const y = normCover(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 6 && long.startsWith(short);
}

function sameArtist(trackArtists: string[], candidate: string): boolean {
  const c = normCover(candidate);
  if (!c) return false;
  return trackArtists.some((a) => {
    const n = normCover(a);
    return n.length >= 2 && (c.includes(n) || n.includes(c));
  });
}

/** Artists of a track as plain names ("A, B & C" split too) */
function artistNames(t: Track): string[] {
  const out: string[] = [];
  for (const a of t.artists || []) for (const p of String(a?.name || '').split(/\s*[,&]\s*/)) if (p) out.push(p);
  return out;
}

/**
 * The cover of exactly this song: Spotify's own (oEmbed) for Spotify tracks; otherwise an
 * iTunes result with the same title and the same artist. Never "another song by the artist".
 */
export async function findExactCover(t: Track): Promise<string | null> {
  if (!t?.name) return null;
  const cleanId = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0];
  if (/^[0-9a-zA-Z]{22}$/.test(cleanId)) {
    try {
      const res = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${cleanId}`, {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.thumbnail_url && !isPlaylistOrGenericCover(data.thumbnail_url)) return data.thumbnail_url;
      }
    } catch {}
  }
  const artists = artistNames(t);
  if (!artists.length || artists[0].toLowerCase() === 'spotify') return null;
  try {
    const q = `${normCover(t.name)} ${normCover(artists[0])}`.trim();
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=10`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hits = (data.results || []).filter((r: any) => r?.artworkUrl100 && sameTitle(r.trackName, t.name) && sameArtist(artists, r.artistName));
    if (!hits.length) return null;
    const album = normCover(t.album?.name);
    const best = (album && hits.find((r: any) => normCover(r.collectionName) === album)) || hits[0];
    return String(best.artworkUrl100).replace('100x100bb', '600x600bb');
  } catch {
    return null;
  }
}

/**
 * Returns the best available artwork URL for a track,
 * prioritizing the dedicated track cache, then album images.
 * NEVER returns the parent playlist cover or generic playlist thumbnail!
 */
export function getTrackCoverUrl(track: Track, fallbackPlaylistCover?: string): string | undefined {
  if (!track) return undefined;
  // 1. The cover the song itself comes with (its real album) always wins
  const albumCover = track.album?.images?.[0]?.url;
  if (albumCover && !isPlaylistOrGenericCover(albumCover, fallbackPlaylistCover)) {
    // If the cover is identical to the playlist cover, do not use it
    if (!fallbackPlaylistCover || (albumCover !== fallbackPlaylistCover && !albumCover.endsWith(fallbackPlaylistCover.slice(-25)))) {
      return albumCover;
    }
  }

  // 2. A cover found for this exact song
  if (TRACK_COVER_CACHE.has(track.id)) {
    const cached = TRACK_COVER_CACHE.get(track.id);
    if (cached && !isPlaylistOrGenericCover(cached, fallbackPlaylistCover)) {
      if (!fallbackPlaylistCover || (cached !== fallbackPlaylistCover && !cached.endsWith(fallbackPlaylistCover.slice(-25)))) {
        return cached;
      }
    }
  }

  const anyT = track as any;
  const directCover =
    anyT.album?.cover_xl ||
    anyT.album?.cover_big ||
    anyT.album?.cover_medium ||
    anyT.cover_xl ||
    anyT.cover_big ||
    anyT.cover_medium ||
    anyT.cover ||
    anyT.image ||
    anyT.imageUrl ||
    anyT.albumArt ||
    anyT.album_cover_url ||
    anyT.thumbnail;

  if (directCover && !isPlaylistOrGenericCover(directCover, fallbackPlaylistCover)) {
    if (!fallbackPlaylistCover || (directCover !== fallbackPlaylistCover && !directCover.endsWith(fallbackPlaylistCover.slice(-25)))) {
      return directCover;
    }
  }

  return undefined;
}

/**
 * Resolves high-resolution album artwork for tracks quickly in parallel.
 * 1. Checks memory & localStorage cache.
 * 2. Queries Deezer Search API (fastest, ~120ms response, high quality 500x500).
 * 3. Queries iTunes Search API (100% reliable 600x600).
 * 4. Queries Spotify oEmbed.
 */
export async function resolveTrackCoversBatch(
  tracks: Track[],
  playlistCover?: string,
  onBatchResolved?: (updates: Map<string, string>) => void
): Promise<Map<string, string>> {
  const allUpdates = new Map<string, string>();
  if (!tracks || tracks.length === 0) return allUpdates;

  // Identify tracks that need artwork resolution
  const toResolve = tracks.filter((t) => {
    if (!t.id) return false;
    if (TRACK_COVER_CACHE.has(t.id)) {
      const cached = TRACK_COVER_CACHE.get(t.id)!;
      if (!isPlaylistOrGenericCover(cached)) {
        allUpdates.set(t.id, cached);
        return false;
      }
    }
    const currentCover = t.album?.images?.[0]?.url;
    const isSameAsPlaylist = currentCover && playlistCover && (currentCover === playlistCover || currentCover.endsWith(playlistCover.slice(-25)));
    return !currentCover || isPlaylistOrGenericCover(currentCover) || isSameAsPlaylist;
  });

  if (allUpdates.size > 0 && onBatchResolved) {
    onBatchResolved(new Map(allUpdates));
  }

  if (toResolve.length === 0) return allUpdates;

  // Concurrency chunk size of 20 for fast parallel resolution
  const chunkSize = 20;
  for (let i = 0; i < toResolve.length; i += chunkSize) {
    const chunk = toResolve.slice(i, i + chunkSize);
    const chunkResults = await Promise.allSettled(
      chunk.map(async (t) => {
        if (TRACK_COVER_CACHE.has(t.id)) {
          return { id: t.id, url: TRACK_COVER_CACHE.get(t.id)! };
        }

        // Direct check on track object properties with strict playlist cover rejection
        const existingDirect = getTrackCoverUrl(t, playlistCover);
        if (existingDirect && !isPlaylistOrGenericCover(existingDirect)) {
          persistTrackCover(t.id, existingDirect);
          return { id: t.id, url: existingDirect };
        }

        // Exactly this song's cover (Spotify oEmbed, or iTunes with the same title AND artist).
        // No "first result" fallbacks: those showed other songs' covers.
        const exact = await findExactCover(t);
        if (exact && !isPlaylistOrGenericCover(exact, playlistCover)) {
          persistTrackCover(t.id, exact, playlistCover);
          return { id: t.id, url: exact };
        }
        return null;
      })
    );

    const chunkUpdates = new Map<string, string>();
    for (const r of chunkResults) {
      if (r.status === 'fulfilled' && r.value) {
        chunkUpdates.set(r.value.id, r.value.url);
        allUpdates.set(r.value.id, r.value.url);
      }
    }

    if (chunkUpdates.size > 0 && onBatchResolved) {
      onBatchResolved(chunkUpdates);
    }
  }

  return allUpdates;
}

export const TrackArtwork: React.FC<{
  src?: string;
  alt: string;
  className?: string;
  size?: number;
}> = ({ src, alt, className = 'w-11 h-11 rounded', size = 44 }) => {
  const [error, setError] = useState(false);

  React.useEffect(() => {
    setError(false);
  }, [src]);

  if (!src || error) {
    return (
      <div
        className={`${className} overflow-hidden bg-[#242424] shrink-0 shadow flex items-center justify-center text-[#727272]`}
        style={{ width: size, height: size }}
      >
        <svg width={Math.round(size * 0.45)} height={Math.round(size * 0.45)} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      referrerPolicy="no-referrer"
      loading="lazy"
      className={`${className} object-cover shrink-0 shadow bg-[#242424]`}
      style={{ width: size, height: size }}
    />
  );
};
