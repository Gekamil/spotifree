import React from 'react';
import { EMPTY_PLAYLIST_COVER } from './playlistCover';

export const DEFAULT_FALLBACK_COVER = EMPTY_PLAYLIST_COVER;

export const INLINE_SVG_FALLBACK =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23282828"/><circle cx="150" cy="150" r="75" fill="%23181818"/><circle cx="150" cy="150" r="28" fill="%23121212"/><path d="M142 125v40c-2.4-1.2-5.4-2-8.5-2-9.6 0-17.5 6.3-17.5 14s7.8 14 17.5 14 17.5-6.3 17.5-14v-35l25-5v-17l-34 5z" fill="%23b3b3b3"/></svg>';

export function handleImageError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  const target = e.currentTarget;
  target.referrerPolicy = 'no-referrer';
  if ((target as any)._fallbackAttempted) {
    target.onerror = null;
    target.src = DEFAULT_FALLBACK_COVER;
    return;
  }
  (target as any)._fallbackAttempted = true;
  const q = target.alt?.trim();
  if (q && q.length > 2 && !q.includes('Playlist') && !q.includes('Liked Songs') && !q.includes('Álbum') && !q.includes('Banner')) {
    fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=1`, {
      signal: AbortSignal.timeout?.(2500),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const img = data?.results?.[0]?.artworkUrl100?.replace('100x100bb', '600x600bb');
        if (img) {
          target.src = img;
        } else {
          target.src = DEFAULT_FALLBACK_COVER;
        }
      })
      .catch(() => {
        target.src = DEFAULT_FALLBACK_COVER;
      });
  } else {
    target.src = DEFAULT_FALLBACK_COVER;
  }
}
