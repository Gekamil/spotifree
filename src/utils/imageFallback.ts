import React from 'react';

export const DEFAULT_FALLBACK_COVER =
  'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';

export const INLINE_SVG_FALLBACK =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23282828"/><circle cx="150" cy="150" r="75" fill="%23181818"/><circle cx="150" cy="150" r="28" fill="%23121212"/><path d="M142 125v40c-2.4-1.2-5.4-2-8.5-2-9.6 0-17.5 6.3-17.5 14s7.8 14 17.5 14 17.5-6.3 17.5-14v-35l25-5v-17l-34 5z" fill="%23b3b3b3"/></svg>';

export function handleImageError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  const target = e.currentTarget;
  target.referrerPolicy = 'no-referrer';
  target.onerror = null;
  target.src = INLINE_SVG_FALLBACK;
}
