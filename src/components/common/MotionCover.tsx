/**
 * Album cover that comes alive when the album has an Apple Music animated cover: the still image
 * shows at once and the silent video loop fades in over it once it is playing. Loads only while
 * on screen and when the "Portadas animadas" setting allows it.
 */
import React, { useEffect, useRef, useState } from 'react';
import type { Track } from '../../types/spotify';
import { MOTION_COVER_EVENT, getMotionCover, motionCoversAllowed, type MotionCover as Motion } from '../../services/motionCover';

interface Props {
  track: Track | null | undefined;
  src?: string | null;
  alt?: string;
  className?: string;
  imgClassName?: string;
  onImgError?: React.ReactEventHandler<HTMLImageElement>;
}

export const MotionCover: React.FC<Props> = ({ track, src, alt = '', className = '', imgClassName = '', onImgError }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [motion, setMotion] = useState<Motion | null>(null);
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const [allowed, setAllowed] = useState(() => motionCoversAllowed());

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

  // Find the album's animated cover
  useEffect(() => {
    setMotion(null);
    setReady(false);
    if (!allowed || !track) return;
    let alive = true;
    getMotionCover(track).then((m) => {
      if (alive) setMotion(m);
    });
    return () => {
      alive = false;
    };
  }, [track?.id, allowed]);

  // Play it (hls.js where the browser can't play HLS itself)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !motion || !visible || !allowed) return;
    let hls: any = null;
    let cancelled = false;
    const start = () => {
      video.muted = true;
      video.play().catch(() => {});
    };
    // hls.js wherever it works (it picks the H.264 versions); the browser's own HLS only where
    // hls.js can't run (iPhone). Chrome says "maybe" to HLS but can't play these streams itself.
    // Light build: no subtitles / DRM / alternate audio, which covers never use
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

  return (
    <div ref={boxRef} className={`relative overflow-hidden ${className}`}>
      {src ? <img src={src} alt={alt} onError={onImgError} className={`w-full h-full object-cover ${imgClassName}`} /> : null}
      {motion && allowed && (
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          poster={motion.poster || undefined}
          onPlaying={() => setReady(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'} ${imgClassName}`}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default MotionCover;
