import React, { useState } from 'react';
import type { Track } from '../types/spotify';

export const TRACK_COVER_CACHE = new Map<string, string>();

if (typeof window !== 'undefined') {
  try {
    const saved = window.localStorage.getItem('spotifree_track_covers');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === 'string') TRACK_COVER_CACHE.set(k, v);
      });
    }
  } catch {}
}

export function persistTrackCover(id: string, url: string) {
  if (!id || !url) return;
  TRACK_COVER_CACHE.set(id, url);
  if (typeof window !== 'undefined') {
    try {
      const obj: Record<string, string> = {};
      let count = 0;
      for (const [k, v] of TRACK_COVER_CACHE.entries()) {
        obj[k] = v;
        if (++count > 1500) break;
      }
      window.localStorage.setItem('spotifree_track_covers', JSON.stringify(obj));
    } catch {}
  }
}

/**
 * Returns the best available artwork URL for a track,
 * prioritizing the dedicated track cache, then album images.
 * NEVER returns the parent playlist cover or generic playlist thumbnail!
 */
export function getTrackCoverUrl(track: Track, fallbackPlaylistCover?: string): string | undefined {
  if (!track) return undefined;
  if (TRACK_COVER_CACHE.has(track.id)) {
    return TRACK_COVER_CACHE.get(track.id);
  }

  const albumCover = track.album?.images?.[0]?.url;
  if (albumCover) {
    if (albumCover.includes('liked-songs')) {
      return undefined;
    }
    // If the cover is identical to the playlist cover, do not use it
    if (fallbackPlaylistCover && (albumCover === fallbackPlaylistCover || albumCover.endsWith(fallbackPlaylistCover.slice(-25)))) {
      return undefined;
    }
    return albumCover;
  }

  if ((track as any).image && !fallbackPlaylistCover) return (track as any).image;
  if ((track as any).albumArt && !fallbackPlaylistCover) return (track as any).albumArt;

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
      allUpdates.set(t.id, TRACK_COVER_CACHE.get(t.id)!);
      return false;
    }
    const currentCover = t.album?.images?.[0]?.url;
    const isSameAsPlaylist = currentCover && playlistCover && (currentCover === playlistCover || currentCover.endsWith(playlistCover.slice(-25)));
    return !currentCover || isSameAsPlaylist;
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

        const cleanName = t.name.replace(/\s*\(.*?\)/g, '').replace(/\s*\[.*?\]/g, '').trim();
        const artist = t.artists?.[0]?.name || '';
        const q = `${cleanName} ${artist}`.trim();

        // 1. iTunes Search API (100% browser CORS compatible, 600x600 HD album artwork, ~120ms response)
        try {
          const itunesRes = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=1`,
            { signal: AbortSignal.timeout(2500) }
          );
          if (itunesRes.ok) {
            const itunesData = await itunesRes.json();
            if (itunesData.results?.[0]?.artworkUrl100) {
              const hd = itunesData.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
              persistTrackCover(t.id, hd);
              return { id: t.id, url: hd };
            }
          }
        } catch {}

        // 2. Spotify oEmbed fallback (official Spotify album cover, CORS enabled)
        const isSpotifyId = /^[0-9a-zA-Z]{22}$/.test(t.id);
        if (isSpotifyId) {
          try {
            const res = await fetch(
              `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${t.id}`,
              { signal: AbortSignal.timeout(2500) }
            );
            if (res.ok) {
              const data = await res.json();
              if (data.thumbnail_url) {
                persistTrackCover(t.id, data.thumbnail_url);
                return { id: t.id, url: data.thumbnail_url };
              }
            }
          } catch {}
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
