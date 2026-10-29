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
        if (++count > 1200) break;
      }
      window.localStorage.setItem('spotifree_track_covers', JSON.stringify(obj));
    } catch {}
  }
}

/**
 * Returns the best available artwork URL for a track,
 * prioritizing the dedicated track cache, then album images, then optional fallback.
 */
export function getTrackCoverUrl(track: Track, fallbackPlaylistCover?: string): string | undefined {
  if (!track) return undefined;
  if (TRACK_COVER_CACHE.has(track.id)) {
    return TRACK_COVER_CACHE.get(track.id);
  }

  const albumCover = track.album?.images?.[0]?.url;
  // If track has an album image that is NOT the generic liked-songs or playlist placeholder
  if (albumCover && !albumCover.includes('liked-songs')) {
    // If it's distinct from the fallback playlist cover, or if no fallback, return it
    if (!fallbackPlaylistCover || albumCover !== fallbackPlaylistCover) {
      return albumCover;
    }
  }

  // Check any direct image properties if present
  if ((track as any).image) return (track as any).image;
  if ((track as any).albumArt) return (track as any).albumArt;

  return albumCover || fallbackPlaylistCover;
}

/**
 * Resolves high-resolution album artwork for tracks asynchronously in batches.
 * 1. Checks memory & localStorage cache.
 * 2. Queries Spotify oEmbed for exact track cover.
 * 3. Falls back to iTunes Search API for 600x600 artwork by song + artist name.
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
    const isSameAsPlaylist = currentCover && playlistCover && currentCover === playlistCover;
    return !currentCover || isSameAsPlaylist;
  });

  if (allUpdates.size > 0 && onBatchResolved) {
    onBatchResolved(new Map(allUpdates));
  }

  if (toResolve.length === 0) return allUpdates;

  const chunkSize = 15;
  for (let i = 0; i < toResolve.length; i += chunkSize) {
    const chunk = toResolve.slice(i, i + chunkSize);
    const chunkResults = await Promise.allSettled(
      chunk.map(async (t) => {
        // Step 1: Check cache again
        if (TRACK_COVER_CACHE.has(t.id)) {
          return { id: t.id, url: TRACK_COVER_CACHE.get(t.id)! };
        }

        const isSpotifyId = /^[0-9a-zA-Z]{22}$/.test(t.id);
        if (isSpotifyId) {
          try {
            const res = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${t.id}`);
            if (res.ok) {
              const data = await res.json();
              if (data.thumbnail_url) {
                persistTrackCover(t.id, data.thumbnail_url);
                return { id: t.id, url: data.thumbnail_url };
              }
            }
          } catch {}
        }

        // Step 2: Fallback to iTunes Search API for high-res cover art
        try {
          const artist = t.artists?.[0]?.name || '';
          const q = `${t.name} ${artist}`.trim();
          const itunesRes = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=1`
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
