/**
 * Album cover that comes alive when the album has an Apple Music animated cover:
 * - Shows the static artwork by default ("el logo solo como antes").
 * - Displays a subtle indicator text/badge when an animated motion cover is available.
 * - Smoothly crossfades between static artwork and animated video upon click/tap.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { Track } from '../../types/spotify';
import { MOTION_COVER_EVENT, getMotionCover, motionCoversAllowed, type MotionCover as Motion } from '../../services/motionCover';

const MOTION_ON_KEY = 'spotifree_motion_cover_on';

interface Props {
  track: Track | null | undefined;
  src?: string | null;
  alt?: string;
  className?: string;
  imgClassName?: string;
  onImgError?: React.ReactEventHandler<HTMLImageElement>;
  interactive?: boolean;
  showIndicator?: boolean;
}

export const MotionCover: React.FC<Props> = ({
  track,
  src,
  alt = '',
  className = '',
  imgClassName = '',
  onImgError,
  interactive = true,
  showIndicator = true,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [motion, setMotion] = useState<Motion | null>(null);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const [allowed, setAllowed] = useState(() => motionCoversAllowed());
  const [isMotionActive, setIsMotionActive] = useState(false);

  useEffect(() => {
    const on = () => setAllowed(motionCoversAllowed());
    window.addEventListener(MOTION_COVER_EVENT, on);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      window.removeEventListener(MOTION_COVER_EVENT, on);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Find the album's animated cover. Reset motion active state on track change to start with static cover.
  useEffect(() => {
    setMotion(null);
    setReady(false);
    setIsMotionActive(false);
    if (!allowed || !track) return;
    let alive = true;
    getMotionCover(track).then((m) => {
      if (alive) setMotion(m);
    });
    return () => {
      alive = false;
    };
  }, [track?.id, allowed]);

  // Play it in the background so it's ready for instant crossfade when toggled
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !motion || !visible || !allowed) return;
    let hls: any = null;
    let cancelled = false;
    const start = () => {
      video.muted = true;
      video.play().catch(() => {});
    };
    // Spotify Canvas (.mp4): the browser plays it directly, no hls.js needed
    if (motion.kind === 'mp4') {
      video.src = motion.video;
      start();
      return () => {
        cancelled = true;
        try {
          video.pause();
        } catch {}
        video.removeAttribute('src');
        setReady(false);
      };
    }
    // hls.js wherever it works; browser's own HLS on Safari/iOS
    import('hls.js/light').then(({ default: Hls }) => {
      if (cancelled) return;
      if (!Hls.isSupported()) {
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = motion.video;
          start();
        }
        return;
      }
      hls = new Hls({ capLevelToPlayerSize: true, startLevel: 0, maxBufferLength: 12, enableWorker: true });
      hls.loadSource(motion.video);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, start);
      hls.on(Hls.Events.ERROR, (_e: unknown, d: any) => {
        if (d?.fatal) {
          hls?.destroy();
          hls = null;
          setMotion(null);
        }
      });
    });
    return () => {
      cancelled = true;
      try {
        video.pause();
      } catch {}
      if (hls) hls.destroy();
      else video.removeAttribute('src');
      setReady(false);
    };
  }, [motion, visible, allowed]);

  const handleToggle = (e: React.MouseEvent) => {
    if (!motion || !allowed || !interactive) return;
    // Don't toggle if user clicked on other interactive elements
    e.stopPropagation();
    setIsMotionActive((prev) => {
      const next = !prev;
      // Remembered: once turned on, the next songs with an animated cover start animated
      try {
        localStorage.setItem(MOTION_ON_KEY, next ? '1' : '0');
      } catch {}
      return next;
    });
  };

  // The user's last choice applies to every new song
  useEffect(() => {
    if (!motion) return;
    try {
      if (localStorage.getItem(MOTION_ON_KEY) === '1') setIsMotionActive(true);
    } catch {}
  }, [motion]);

  const hasMotion = Boolean(motion && allowed);

  return (
    <div
      ref={boxRef}
      onClick={hasMotion && interactive ? handleToggle : undefined}
      className={`relative overflow-hidden group select-none ${hasMotion && interactive ? 'cursor-pointer' : ''} ${className}`}
    >
      {/* 1. Static Artwork Layer (always present underneath for instant fallback & smooth crossfade) */}
      {src ? (
        <img
          src={src}
          alt={alt}
          onError={onImgError}
          className={`w-full h-full object-cover transition-opacity duration-700 ease-in-out ${imgClassName}`}
        />
      ) : null}

      {/* 2. Apple Music Motion Cover Video Layer (smooth crossfade in/out over static artwork) */}
      {hasMotion && (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          poster={motion?.poster || src || undefined}
          onPlaying={() => setReady(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${
            isMotionActive && ready ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          } ${imgClassName}`}
          aria-hidden="true"
        />
      )}

      {/* 3. Subtle Indicator Badge (shows when animated motion cover is available) */}
      {/* 3. Small Spotify-style pill in the corner when the album has an animated cover */}
      {hasMotion && showIndicator && (
        <button
          type="button"
          onClick={handleToggle}
          className={`absolute top-2.5 right-2.5 z-30 h-7 pl-2 pr-2.5 rounded-full flex items-center gap-1 text-[11px] font-bold backdrop-blur-md shadow-[0_2px_10px_rgba(0,0,0,0.45)] transition-all duration-300 active:scale-90 cursor-pointer ${
            isMotionActive ? 'bg-white text-black' : 'bg-black/55 text-white hover:bg-black/75'
          }`}
          title={isMotionActive ? 'Ver la portada fija' : 'Ver la portada animada'}
          aria-pressed={isMotionActive}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            {isMotionActive ? (
              <path d="M2.7 1A.7.7 0 0 0 2 1.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7z" />
            ) : (
              <path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288z" />
            )}
          </svg>
          Animada
        </button>
      )}
    </div>
  );
};

export default MotionCover;
