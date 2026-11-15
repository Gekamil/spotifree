import React, { useState, useEffect } from 'react';

interface SpotifyImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  alt: string;
  className?: string;
  skeletonClassName?: string;
  fallbackType?: 'music' | 'artist';
  round?: boolean;
}

/**
 * SpotifyImage
 *
 * Renders an image with Spotify-authentic dark shimmer pulse (spf-skeleton)
 * while loading, smooth opacity fade-in once loaded, and a clean Spotify
 * placeholder icon if the image fails or is empty.
 * Never displays browser broken-image icons.
 */
export const SpotifyImage: React.FC<SpotifyImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  skeletonClassName = '',
  fallbackType = 'music',
  round = false,
  style,
  loading = 'lazy',
  ...rest
}) => {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>(() => {
    if (!src || typeof src !== 'string' || src.trim() === '') return 'error';
    return 'loading';
  });

  const [currentSrc, setCurrentSrc] = useState<string | null>(src || null);

  useEffect(() => {
    if (!src || typeof src !== 'string' || src.trim() === '') {
      setStatus('error');
      setCurrentSrc(null);
    } else if (src !== currentSrc) {
      setCurrentSrc(src);
      setStatus('loading');
    }
  }, [src, currentSrc]);

  const shapeClass = round ? 'rounded-full' : 'rounded-[4px]';

  // If no source or image errored, show authentic dark placeholder
  if (status === 'error' || !currentSrc) {
    return (
      <div
        className={`w-full h-full bg-[#282828] text-[#7f7f7f] flex items-center justify-center select-none overflow-hidden ${shapeClass} ${className}`}
        style={style}
        title={alt}
        aria-label={alt}
      >
        {fallbackType === 'artist' ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="opacity-60">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="opacity-60">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none bg-[#242424] ${shapeClass}`}
      style={style}
    >
      {/* Dark pulse shimmer while loading */}
      {status === 'loading' && (
        <div
          className={`absolute inset-0 spf-skeleton z-10 ${shapeClass} ${skeletonClassName}`}
          aria-hidden="true"
        />
      )}

      <img
        src={currentSrc}
        alt={alt}
        loading={loading}
        referrerPolicy="no-referrer"
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
        className={`${className} ${
          status === 'loaded' ? 'opacity-100' : 'opacity-0'
        } transition-opacity duration-300 ease-out`}
        {...rest}
      />
    </div>
  );
};

export default SpotifyImage;
