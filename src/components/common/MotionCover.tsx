/**
 * Album cover that comes alive when the album has an Apple Music animated cover:
 * - Shows the static artwork by default.
 * - Long-pressing (mantener pulsado) or tapping on the cover smoothly toggles between
 *   the static artwork and the high-res animated video.
 * - No intrusive button or toggle switch: pure, natural touch on the cover image.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { Track } from '../../types/spotify';
import { MOTION_COVER_EVENT, getMotionCover, motionCoversAllowed, type MotionCover as Motion } from '../../services/motionCover';
import { DEFAULT_FALLBACK_COVER } from '../../utils/imageFallback';

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
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [motion, setMotion] = useState<Motion | null>(null);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const [allowed, setAllowed] = useState(() => motionCoversAllowed());
  const [isMotionActive, setIsMotionActive] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [src, track?.id]);

  const holdTimerRef = useRef<number | null>(null);
  const isHoldActionRef = useRef(false);

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

  const toggleMotion = () => {
    if (!motion || !allowed || !interactive) return;
    setIsMotionActive((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MOTION_ON_KEY, next ? '1' : '0');
      } catch {}
      return next;
    });
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(35);
      } catch {}
    }
  };

  const handleTouchStart = () => {
    if (!hasMotion || !interactive) return;
    isHoldActionRef.current = false;
    holdTimerRef.current = window.setTimeout(() => {
      isHoldActionRef.current = true;
      toggleMotion();
    }, 380);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isHoldActionRef.current) {
      e.preventDefault();
      isHoldActionRef.current = false;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!hasMotion || !interactive) return;
    e.stopPropagation();
    if (isHoldActionRef.current) {
      isHoldActionRef.current = false;
      return;
    }
    toggleMotion();
  };

  // The user's last choice applies to new songs if they left it enabled
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
      onTouchStart={hasMotion && interactive ? handleTouchStart : undefined}
      onTouchEnd={hasMotion && interactive ? handleTouchEnd : undefined}
      onClick={hasMotion && interactive ? handleClick : undefined}
      title={hasMotion ? (isMotionActive ? 'Toca o mantén pulsado para ver la portada estática' : 'Toca o mantén pulsado para activar la portada animada') : undefined}
      className={`relative overflow-hidden group select-none ${
        hasMotion && interactive ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''
      } ${className}`}
    >
      {/* 1. Static Artwork Layer (always present underneath for instant fallback & smooth crossfade) */}
      <img
        src={!imgFailed && src ? src : DEFAULT_FALLBACK_COVER}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={(e) => {
          setImgFailed(true);
          onImgError?.(e);
        }}
        className={`w-full h-full object-cover transition-opacity duration-700 ease-in-out ${imgClassName}`}
      />

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

      {/* 3. Discreet subtle indicator (tiny 5px green dot in corner only when animated cover is available) */}
      {hasMotion && (
        <div
          className={`absolute bottom-2 right-2 pointer-events-none transition-opacity duration-500 flex items-center justify-center ${
            isMotionActive ? 'opacity-90' : 'opacity-40 group-hover:opacity-80'
          }`}
          title={isMotionActive ? 'Portada animada activa' : 'Animación disponible'}
        >
          <span className={`w-2 h-2 rounded-full shadow-lg ${isMotionActive ? 'bg-[#1ed760] animate-pulse ring-2 ring-black/40' : 'bg-white/60'}`} />
        </div>
      )}
    </div>
  );
};

export default MotionCover;
