import React from 'react';

export const DEFAULT_FALLBACK_COVER =
  'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';

export function handleImageError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  const target = e.currentTarget;
  if (target.src !== DEFAULT_FALLBACK_COVER) {
    target.onerror = null;
    target.src = DEFAULT_FALLBACK_COVER;
  }
}
