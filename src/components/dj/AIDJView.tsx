import React, { useState, useEffect, useRef } from 'react';
import type { Track } from '../../types/spotify';
import { SpotifyDJVisualizer } from './SpotifyDJVisualizer';
import { InteractiveMusicWaves } from './InteractiveMusicWaves';
import { useAIDJStore, prefetchQuickVibeVoices } from '../../services/aiDJService';
import { aiDJVoiceService } from '../../services/aiDJVoiceService';
import { getUserDynamicVibeChips } from '../../services/musicTaggingService';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useShallow } from 'zustand/react/shallow';
import {
  PlayNativeIcon,
  PauseNativeIcon,
  PrevNativeIcon,
  NextNativeIcon,
  QueueNativeIcon,
  CloseNativeIcon,
  AddTrackNativeIcon,
  CheckTrackNativeIcon,
} from '../icons/SpotifyNativeIcons';
import { formatDuration } from '../../utils/formatters';
import { resolveVibrantColor, extractDominantColorFromImage } from '../../utils/spotifyColor';
import { handleImageError } from '../../utils/imageFallback';
import { getTrackCoverUrl, resolveTrackCoversBatch } from '../../utils/trackCovers';

interface AIDJViewProps {
  onBack: () => void;
  isMobile?: boolean;
  onOpenPlayer?: () => void;
}

const getBestTrackArtwork = (track: Track | null | undefined): string => {
  if (!track) return 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';
  const cached = getTrackCoverUrl(track);
  if (cached && !cached.includes('liked-songs')) return cached;
  if (track.album?.images?.[0]?.url && !track.album.images[0].url.includes('liked-songs')) {
    return track.album.images[0].url;
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
  if (directCover && !directCover.includes('liked-songs')) return directCover;
  return 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';
};

/** Interactive Spotify progress scrubber with elapsed/duration time and seek */
const DJPlaybackScrubber: React.FC<{ fallbackDurationMs?: number }> = ({ fallbackDurationMs }) => {
  const progressMs = usePlayerStore((s) => s.progressMs);
  const durationMs = usePlayerStore((s) => s.durationMs);
  const setProgress = usePlayerStore((s) => s.setProgress);
  const duration = durationMs || fallbackDurationMs || 180000;
  const pct = duration > 0 ? Math.min(100, Math.max(0, (progressMs / duration) * 100)) : 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = 'touches' in e && e.touches[0] ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetMs = ratio * duration;
    setProgress(targetMs);
    try {
      (window as any).__audioEngine?.seek(targetMs / 1000);
    } catch {}
  };

  return (
    <div className="space-y-1 w-full px-0.5" onClick={(e) => e.stopPropagation()}>
      <div
        onClick={handleSeek}
        className="group relative w-full h-2.5 flex items-center cursor-pointer touch-none"
      >
        <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white group-hover:bg-[#1ed760] transition-colors rounded-full"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div
          className="absolute w-2.5 h-2.5 bg-white rounded-full shadow -ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10.5px] font-mono tabular-nums text-white/50 px-0.5">
        <span>{formatDuration(progressMs)}</span>
        <span>{formatDuration(duration)}</span>
      </div>
    </div>
  );
};

const DEFAULT_QUICK_CHIPS = [
  'Más movido',
  'Algo chill',
  'Reggaetón',
  'Clásicos',
  'Trap / Urbano',
  'Sorpréndeme',
];

export const AIDJView: React.FC<AIDJViewProps> = ({ onBack, isMobile = false, onOpenPlayer }) => {
  // Mount instantaneously with default chips, then load personalized chips asynchronously
  const [, setVibeChips] = useState<string[]>(DEFAULT_QUICK_CHIPS);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const dynamic = getUserDynamicVibeChips();
        if (dynamic && dynamic.length > 0) setVibeChips(dynamic);
      } catch {}
    }, 80);
    return () => clearTimeout(t);
  }, []);
  const {
    visualizerState,
    voiceLevel,
    djTracks,
    currentSetTitle,
    setDJThemeColor,
    segments,
    activeSegmentId,
    isThinking,
    nextSegment,
  } = useAIDJStore();
  const activeSegment = segments.find((s) => s.id === activeSegmentId) || null;
  const activeSegIdx = activeSegment ? segments.indexOf(activeSegment) : -1;
  const upcomingSegment = activeSegIdx >= 0 ? segments[activeSegIdx + 1] || null : null;

  // (No progressMs here: it changes 10 times a second and would redraw the whole DJ screen;
  // the integrated player card reads it on its own, see DJPlaybackScrubber)
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
    likedTrackIds,
    toggleLike,
    queue,
    nextTrack,
    previousTrack,
  } = usePlayerStore(
    useShallow((s) => ({
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
      playTrack: s.playTrack,
      togglePlay: s.togglePlay,
      likedTrackIds: s.likedTrackIds,
      toggleLike: s.toggleLike,
      queue: s.queue,
      nextTrack: s.nextTrack,
      previousTrack: s.previousTrack,
    }))
  );

  const [showQueueDrawer, setShowQueueDrawer] = useState(false);
  const [isQueueRendered, setIsQueueRendered] = useState(false);
  const [isQueueAnimated, setIsQueueAnimated] = useState(false);
  const [queueDragY, setQueueDragY] = useState(0);
  const [isQueueDragging, setIsQueueDragging] = useState(false);
  const djQueueStartYRef = useRef(0);
  const djQueueCurrentYRef = useRef(0);
  const djQueueScrollRef = useRef<HTMLDivElement>(null);

  const handleDJQueueTouchStart = (e: React.TouchEvent) => {
    djQueueStartYRef.current = e.touches[0].clientY;
    djQueueCurrentYRef.current = e.touches[0].clientY;
    setIsQueueDragging(true);
  };

  const handleDJQueueBodyTouchStart = (e: React.TouchEvent) => {
    if (djQueueScrollRef.current && djQueueScrollRef.current.scrollTop <= 5) {
      djQueueStartYRef.current = e.touches[0].clientY;
      djQueueCurrentYRef.current = e.touches[0].clientY;
      setIsQueueDragging(true);
    }
  };

  const handleDJQueueTouchMove = (e: React.TouchEvent) => {
    if (!isQueueDragging) return;
    const delta = e.touches[0].clientY - djQueueStartYRef.current;
    if (delta > 0) {
      djQueueCurrentYRef.current = e.touches[0].clientY;
      setQueueDragY(delta);
    }
  };

  const handleDJQueueTouchEnd = () => {
    if (!isQueueDragging) return;
    setIsQueueDragging(false);
    const delta = djQueueCurrentYRef.current - djQueueStartYRef.current;
    if (delta > 75) {
      setShowQueueDrawer(false);
    }
    setQueueDragY(0);
  };

  // Defer pre-caching quick vibe voices to leave 100% bandwidth for track playback and greeting voice
  useEffect(() => {
    const timer = setTimeout(() => {
      prefetchQuickVibeVoices();
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  // Smooth bottom sheet glide transition for the queue
  useEffect(() => {
    if (showQueueDrawer) {
      setIsQueueRendered(true);
      const raf = requestAnimationFrame(() => {
        setIsQueueAnimated(true);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsQueueAnimated(false);
      const timer = setTimeout(() => {
        setIsQueueRendered(false);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [showQueueDrawer]);

  const [ambientColor, setAmbientColor] = useState<string>('#0c52cc');
  const [gradientLayers, setGradientLayers] = useState<{ colorA: string; colorB: string; activeLayer: 'A' | 'B' }>({
    colorA: '#0c52cc',
    colorB: '#0c52cc',
    activeLayer: 'A',
  });
  const [artLayers, setArtLayers] = useState<{ artA: string; artB: string; activeArt: 'A' | 'B' }>({
    artA: '',
    artB: '',
    activeArt: 'A',
  });
  const [, setCoversVersion] = useState(0);

  // Smooth Crossfading of ambient gradient when color changes
  useEffect(() => {
    if (!ambientColor) return;
    setGradientLayers((prev) => {
      if (prev.activeLayer === 'A') {
        if (prev.colorA === ambientColor) return prev;
        return { colorA: prev.colorA, colorB: ambientColor, activeLayer: 'B' };
      } else {
        if (prev.colorB === ambientColor) return prev;
        return { colorA: ambientColor, colorB: prev.colorB, activeLayer: 'A' };
      }
    });
  }, [ambientColor]);

  // Smooth Crossfading of artwork background when track changes
  useEffect(() => {
    const art = getBestTrackArtwork(currentTrack);
    if (!art) return;
    setArtLayers((prev) => {
      if (prev.activeArt === 'A') {
        if (prev.artA === art) return prev;
        return { artA: prev.artA, artB: art, activeArt: 'B' };
      } else {
        if (prev.artB === art) return prev;
        return { artA: art, artB: prev.artB, activeArt: 'A' };
      }
    });
  }, [currentTrack]);

  // Resolve album covers for all DJ tracks in background
  useEffect(() => {
    const list = djTracks && djTracks.length > 0 ? djTracks : queue;
    if (list && list.length > 0) {
      resolveTrackCoversBatch(list).then(() => {
        setCoversVersion((v) => v + 1);
      }).catch(() => {});
    }
  }, [djTracks, queue]);

  // Dynamically extract dominant color from current track artwork
  useEffect(() => {
    const art = getBestTrackArtwork(currentTrack);
    if (art && !art.includes('liked-songs')) {
      extractDominantColorFromImage(art).then((hex) => {
        if (hex) {
          setAmbientColor(hex);
          setDJThemeColor(hex);
        } else if (currentTrack?.id) {
          const col = resolveVibrantColor(currentTrack.id, currentTrack.name);
          setAmbientColor(col);
          setDJThemeColor(col);
        }
      });
    } else if (currentTrack?.id) {
      const col = resolveVibrantColor(currentTrack.id, currentTrack.name);
      setAmbientColor(col);
      setDJThemeColor(col);
    }
  }, [currentTrack, setDJThemeColor]);

  // Initialize DJ session if not active or empty, and unlock audio immediately
  useEffect(() => {
    aiDJVoiceService.unlockAudioForMobile();
    const dj = useAIDJStore.getState();
    if ((!dj.isDJModeActive || dj.djTracks.length === 0) && !dj.isThinking) {
      void dj.startDJSession(false, { speakFirst: true });
    } else if (dj.djTracks.length > 0 && !dj.isThinking) {
      const p = usePlayerStore.getState();
      if (!p.isPlaying) {
        const trackToPlay = dj.djTracks[0];
        if (trackToPlay) {
          p.playTrack(trackToPlay, dj.djTracks, 'dj-session');
        }
      }
    }
    return () => {
      useAIDJStore.getState().cancelDJIntroIfNotStarted();
    };
  }, []);

  const tracksToDisplay: Track[] = djTracks && djTracks.length > 0 ? djTracks : queue;

  const handleTrackClick = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track, tracksToDisplay, 'dj-session');
    }
  };

  const isCurrentLiked = currentTrack ? likedTrackIds.includes(currentTrack.id) : false;
  const activeArtwork = getBestTrackArtwork(currentTrack);

  const isSpeaking = visualizerState === 'speaking' || visualizerState === 'listening';

  const handleOpenPlayer = () => {
    if (onOpenPlayer) {
      onOpenPlayer();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spotifree_open_full_player'));
    }
  };

  return (
    <div
      className="relative w-full h-full max-h-screen text-white flex flex-col justify-between overflow-hidden select-none font-['SpotifyMixUI'] animate-in fade-in duration-300 p-2 sm:p-3 pb-3 sm:pb-3"
      style={{
        backgroundColor: '#050b18',
      }}
    >
      {/* =========================================================================
          BACKGROUND LAYER 1: DUAL CROSSFADING ARTWORK (Butter-smooth transitions)
          ========================================================================= */}
      {artLayers.artA && (
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden transition-opacity duration-1000 ease-in-out"
          style={{
            backgroundImage: `url(${artLayers.artA})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(55px) brightness(0.24) saturate(1.4)',
            transform: 'scale(1.15)',
            opacity: artLayers.activeArt === 'A' ? 1 : 0,
          }}
        />
      )}
      {artLayers.artB && (
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden transition-opacity duration-1000 ease-in-out"
          style={{
            backgroundImage: `url(${artLayers.artB})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(55px) brightness(0.24) saturate(1.4)',
            transform: 'scale(1.15)',
            opacity: artLayers.activeArt === 'B' ? 1 : 0,
          }}
        />
      )}

      {/* =========================================================================
          BACKGROUND LAYER 2: INTERACTIVE MUSIC WAVES (Audio frequency glow)
          ========================================================================= */}
      <InteractiveMusicWaves
        isPlaying={isPlaying}
        isSpeaking={isSpeaking}
        voiceLevel={voiceLevel}
        themeColor={ambientColor || '#1ed760'}
        className="opacity-70"
      />

      {/* =========================================================================
          BACKGROUND LAYER 3: DUAL CROSSFADING AMBIENT AURA GLOW
          ========================================================================= */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-1000 ease-in-out"
        style={{
          background: `radial-gradient(circle at 50% 36%, ${gradientLayers.colorA}99 0%, ${gradientLayers.colorA}44 48%, #050b18fa 92%)`,
          opacity: gradientLayers.activeLayer === 'A' ? 1 : 0,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-1000 ease-in-out"
        style={{
          background: `radial-gradient(circle at 50% 36%, ${gradientLayers.colorB}99 0%, ${gradientLayers.colorB}44 48%, #050b18fa 92%)`,
          opacity: gradientLayers.activeLayer === 'B' ? 1 : 0,
        }}
      />

      {/* Top Header matching Photo 2 (Clean header without lines) */}
      <header className="flex items-center justify-between px-2 py-1.5 z-20 shrink-0">
        <button
          onClick={() => {
            useAIDJStore.getState().cancelDJIntroIfNotStarted();
            onBack();
          }}
          className="w-10 h-10 rounded-full bg-black/25 hover:bg-black/45 backdrop-blur-md flex items-center justify-center text-white transition-all cursor-pointer active:scale-95"
          title="Minimizar"
        >
          <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor">
            <path d="M11.03.47a.75.75 0 0 1 0 1.06L4.56 8l6.47 6.47a.75.75 0 1 1-1.06 1.06L2.44 8 9.97.47a.75.75 0 0 1 1.06 0" />
          </svg>
        </button>

        <div className="text-center truncate px-4">
          <span className="text-[11px] font-black uppercase tracking-widest text-white/80 font-['SpotifyMixUITitle'] block">
            DJ
          </span>
          <span className="text-xs font-bold text-white truncate max-w-[220px] block mt-0.5">
            {currentSetTitle || 'Lo que has estado escuchando'}
          </span>
        </div>

        {/* Symmetric header spacer matching Spotify DJ clean header (no top-right circle) */}
        <div className="w-10 h-10" />
      </header>

      {/* Center: The Hollow Smooth Organic Green-Cyan DJ Ring Centered (Photo 2) */}
      <main className="flex-1 flex flex-col items-center justify-between px-3 sm:px-4 text-center max-w-xl mx-auto w-full z-10 py-2 sm:py-3 min-h-0">
        <div className="flex-1 flex flex-col items-center justify-center w-full my-auto min-h-0">
          <div
            onClick={() => {
              if (isSpeaking) {
                aiDJVoiceService.stopSpeaking();
              } else if (isPlaying) {
                void nextSegment();
              } else {
                togglePlay();
              }
            }}
            className="flex items-center justify-center cursor-pointer select-none active:scale-95 transition-transform"
            title={isSpeaking ? 'Silenciar voz' : isPlaying ? 'Cambiar de rollo' : 'Reproducir'}
          >
            <SpotifyDJVisualizer
              size={isMobile ? 220 : 260}
              state={visualizerState}
              voiceLevel={voiceLevel}
              themeColor={ambientColor}
              forceWaves={visualizerState === 'speaking' || visualizerState === 'listening'}
            />
          </div>

          {/* Status caption / Live badge */}
          <div className="mt-4 w-full max-w-md flex flex-col items-center justify-center px-2" aria-live="polite">
            {isThinking ? (
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md shadow-lg animate-in fade-in">
                <span className="flex gap-1" aria-hidden="true">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760] animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760] animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760] animate-bounce" />
                </span>
                <span className="text-xs font-bold text-white tracking-wide font-['SpotifyMixUI']">
                  Pensando tu sesión...
                </span>
              </div>
            ) : isSpeaking ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1ed760]/15 border border-[#1ed760]/30 backdrop-blur-md animate-in fade-in">
                <span className="w-2 h-2 rounded-full bg-[#1ed760] animate-pulse" />
                <span className="text-xs font-bold text-white tracking-wide font-['SpotifyMixUI']">
                  El DJ está hablando
                </span>
              </div>
            ) : activeSegment ? (
              <div className="flex flex-col items-center animate-in fade-in duration-300">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#1ed760] font-['SpotifyMixUITitle']">
                  EN DIRECTO
                </span>
                <span className="text-base sm:text-lg font-black text-white font-['SpotifyMixUITitle'] leading-tight text-center max-w-sm truncate mt-0.5">
                  {activeSegment.title}
                </span>
                {upcomingSegment && (
                  <span className="text-xs text-white/50 mt-1 truncate max-w-xs">
                    Luego: {upcomingSegment.title}
                  </span>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* =========================================================================
            SPOTIFY LIVE SESSIONS INTEGRATED PLAYER CARD
            ========================================================================= */}
        <div className="w-full max-w-md sm:max-w-lg mx-auto bg-[#181818]/90 sm:bg-[#181818]/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-3 sm:p-4 shadow-[0_16px_40px_rgba(0,0,0,0.65)] shrink-0 z-20 space-y-3 transition-all mb-1 sm:mb-2">
          {/* Top Row: Track Artwork + Name/Artist + Like Button */}
          <div className="flex items-center justify-between gap-3">
            <div
              onClick={handleOpenPlayer}
              className="flex items-center min-w-0 flex-1 cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-[8px] overflow-hidden bg-[#242424] shrink-0 shadow-md mr-3 relative">
                <img
                  src={activeArtwork}
                  alt={currentTrack?.name || 'DJ'}
                  onError={handleImageError}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="flex flex-col justify-center min-w-0 text-left">
                <span className="font-bold text-white text-[13.5px] sm:text-[14px] leading-tight truncate font-['SpotifyMixUITitle'] group-hover:underline">
                  {currentTrack?.name || (isThinking ? 'Preparando música...' : 'DJ Spotifree')}
                </span>
                <span className="text-[11.5px] sm:text-xs text-[#b3b3b3] truncate leading-tight mt-0.5 font-['SpotifyMixUI']">
                  {currentTrack?.artists?.map((a) => a.name).join(', ') || 'Spotifree DJ'}
                </span>
              </div>
            </div>

            {currentTrack && (
              <button
                type="button"
                onClick={() => toggleLike(currentTrack.id, currentTrack)}
                className="w-8 h-8 flex items-center justify-center text-[#b3b3b3] hover:text-white active:scale-95 transition-transform cursor-pointer shrink-0"
                title={isCurrentLiked ? 'Quitar de tus Me Gusta' : 'Añadir a tus Me Gusta'}
              >
                {isCurrentLiked ? (
                  <CheckTrackNativeIcon size={20} className="text-[#1ed760]" />
                ) : (
                  <AddTrackNativeIcon size={20} className="text-white/80" />
                )}
              </button>
            )}
          </div>

          {/* Middle Row: Spotify Scrubber Progress Bar */}
          <DJPlaybackScrubber fallbackDurationMs={currentTrack?.duration_ms} />

          {/* Bottom Row: Native Spotify Transport Controls */}
          <div className="flex items-center justify-between pt-0.5">
            {/* Left: Cambiar rollo button */}
            <button
              type="button"
              onClick={() => void nextSegment()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-[11px] sm:text-xs font-bold text-white transition-all cursor-pointer border border-white/10 shrink-0"
              title={upcomingSegment ? `Siguiente: ${upcomingSegment.title}` : 'Cambiar de rollo'}
            >
              <span className="text-[#1ed760] text-xs">✦</span>
              <span>Cambiar rollo</span>
            </button>

            {/* Center: Prev + Play/Pause + Next */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={previousTrack}
                className="w-9 h-9 flex items-center justify-center text-[#b3b3b3] hover:text-white active:scale-90 transition-all cursor-pointer"
                title="Anterior"
              >
                <PrevNativeIcon size={20} />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white hover:scale-105 active:scale-95 text-black flex items-center justify-center shadow-lg transition-transform cursor-pointer"
                title={isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPlaying ? (
                  <PauseNativeIcon size={22} className="text-black" />
                ) : (
                  <PlayNativeIcon size={22} className="text-black ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={nextTrack}
                className="w-9 h-9 flex items-center justify-center text-[#b3b3b3] hover:text-white active:scale-90 transition-all cursor-pointer"
                title="Siguiente"
              >
                <NextNativeIcon size={20} />
              </button>
            </div>

            {/* Right: Queue Drawer Button */}
            <button
              type="button"
              onClick={() => setShowQueueDrawer(true)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0 ${
                showQueueDrawer ? 'text-[#1ed760] bg-white/15' : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
              title="Ver cola del DJ"
            >
              <QueueNativeIcon size={19} />
            </button>
          </div>
        </div>
      </main>

      {/* Queue Drawer */}
      {isQueueRendered && (
        <div
          className={`fixed inset-0 z-50 bg-black/65 backdrop-blur-sm sm:backdrop-blur-none sm:bg-black/20 flex flex-col justify-end sm:block select-none transition-opacity duration-350 ease-out ${
            isQueueAnimated ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onClick={() => setShowQueueDrawer(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: queueDragY > 0 ? `translateY(${queueDragY}px)` : undefined,
              transition: isQueueDragging ? 'none' : undefined,
            }}
            className={`bg-[#121212] sm:bg-[#181818]/95 sm:backdrop-blur-2xl rounded-t-3xl sm:rounded-2xl max-h-[76vh] sm:max-h-[520px] sm:w-[420px] sm:absolute sm:bottom-20 sm:left-6 sm:border sm:border-white/15 sm:shadow-[0_24px_70px_rgba(0,0,0,0.9)] flex flex-col p-4 sm:p-5 pb-8 sm:pb-5 transform transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] ${
              isQueueAnimated
                ? 'translate-y-0 opacity-100 scale-100'
                : 'translate-y-full opacity-50 scale-[0.98] sm:translate-y-4 sm:opacity-0 sm:scale-95'
            }`}
          >
            {/* Top Drag Indicator Pill (Mobile only) */}
            <div
              onTouchStart={handleDJQueueTouchStart}
              onTouchMove={handleDJQueueTouchMove}
              onTouchEnd={handleDJQueueTouchEnd}
              className="w-10 h-1 bg-white/30 hover:bg-white/50 rounded-full mx-auto mb-3.5 cursor-grab active:cursor-grabbing active:scale-95 transition-all sm:hidden"
              onClick={() => setShowQueueDrawer(false)}
              title="Cerrar cola"
            />

            {/* Header */}
            <div
              onTouchStart={handleDJQueueTouchStart}
              onTouchMove={handleDJQueueTouchMove}
              onTouchEnd={handleDJQueueTouchEnd}
              className="flex items-center justify-between pb-3.5 border-b border-white/10"
            >
              <div>
                <h3 className="text-base font-black text-white font-['SpotifyMixUITitle']">
                  Cola del DJ • {tracksToDisplay.length} canciones
                </h3>
                <p className="text-xs text-[#a7a7a7] mt-0.5">{currentSetTitle || 'Sesión en vivo'}</p>
              </div>
              <button
                onClick={() => setShowQueueDrawer(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer active:scale-90 transition-transform"
                title="Cerrar cola"
              >
                <CloseNativeIcon size={16} />
              </button>
            </div>

            <div
              ref={djQueueScrollRef}
              onTouchStart={handleDJQueueBodyTouchStart}
              onTouchMove={handleDJQueueTouchMove}
              onTouchEnd={handleDJQueueTouchEnd}
              className="flex-1 overflow-y-auto space-y-1 mt-3 pr-1"
            >
              {tracksToDisplay.map((track, idx) => {
                const isPlayingThis = isPlaying && currentTrack?.id === track.id;
                const trackArt = getBestTrackArtwork(track);
                const blockStart = tracksToDisplay === djTracks && segments.length > 1 ? segments.find((s) => s.startIndex === idx) : undefined;
                return (
                  <React.Fragment key={`${track.id}-${idx}`}>
                  {blockStart && (
                    <p className={`px-2.5 text-[11px] font-bold uppercase tracking-widest ${idx === 0 ? 'pt-0.5' : 'pt-3'} pb-1 ${blockStart.id === activeSegmentId ? 'text-[#1ed760]' : 'text-[#a7a7a7]'}`}>
                      {blockStart.title}
                    </p>
                  )}
                  <div
                    onClick={() => handleTrackClick(track)}
                    className={`flex items-center justify-between p-2.5 rounded-lg hover:bg-white/10 cursor-pointer transition-colors ${
                      isPlayingThis ? 'bg-white/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs text-[#727272] w-5 text-center font-['SpotifyMixUI'] tabular-nums">
                        {isPlayingThis ? (
                          <div className="w-3 h-3 flex items-end gap-[1.5px] pb-0.5 mx-auto">
                            <span className="w-[2px] bg-[#1ed760] rounded-full animate-spotify-eq-1" />
                            <span className="w-[2px] bg-[#1ed760] rounded-full animate-spotify-eq-2" />
                            <span className="w-[2px] bg-[#1ed760] rounded-full animate-spotify-eq-3" />
                          </div>
                        ) : (
                          idx + 1
                        )}
                      </span>
                      <img
                        src={trackArt}
                        alt={track.name}
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        onError={handleImageError}
                        loading="lazy"
                        className="w-10 h-10 rounded-md object-cover shrink-0 bg-[#282828]"
                      />
                      <div className="truncate flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isPlayingThis ? 'text-[#1ed760]' : 'text-white'}`}>
                          {track.name}
                        </p>
                        <p className="text-xs text-[#a7a7a7] truncate">
                          {track.artists?.map((a) => a.name).join(', ')}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-[#727272] tabular-nums shrink-0 ml-3">
                      {formatDuration(track.duration_ms || 180000)}
                    </span>
                  </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
