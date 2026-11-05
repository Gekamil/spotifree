import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Track } from '../../types/spotify';
import { SpotifyDJVisualizer } from './SpotifyDJVisualizer';
import { InteractiveMusicWaves } from './InteractiveMusicWaves';
import { useAIDJStore, prefetchQuickVibeVoices } from '../../services/aiDJService';
import { getUserDynamicVibeChips } from '../../services/musicTaggingService';
import { usePlayerStore } from '../../store/usePlayerStore';
import {
  PlayNativeIcon,
  PauseNativeIcon,
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

const DEFAULT_QUICK_CHIPS = [
  'Más movido',
  'Algo chill',
  'Reggaetón',
  'Clásicos',
  'Trap / Urbano',
  'Sorpréndeme',
];

export const AIDJView: React.FC<AIDJViewProps> = ({ onBack, isMobile = false, onOpenPlayer }) => {
  const vibeChips = useMemo(() => {
    try {
      return getUserDynamicVibeChips();
    } catch {
      return DEFAULT_QUICK_CHIPS;
    }
  }, []);
  const {
    visualizerState,
    voiceLevel,
    isMicListening,
    djTracks,
    currentSetTitle,
    setDJThemeColor,
    isDJModeActive,
    startDJSession,
    startVoiceListening,
    stopVoiceListening,
    handleUserPrompt,
  } = useAIDJStore();

  const {
    currentTrack,
    isPlaying,
    progressMs,
    durationMs,
    playTrack,
    togglePlay,
    likedTrackIds,
    toggleLike,
    queue,
  } = usePlayerStore();

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

  // Pre-cache all quick vibe voices for instant playback
  useEffect(() => {
    prefetchQuickVibeVoices();
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
  const [promptInput, setPromptInput] = useState('');
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

  // Initialize DJ session if not active or empty
  useEffect(() => {
    if (!isDJModeActive || djTracks.length === 0) {
      startDJSession(false);
    }
  }, [isDJModeActive, djTracks.length, startDJSession]);

  const toggleMic = () => {
    if (isMicListening) {
      stopVoiceListening();
    } else {
      startVoiceListening();
    }
  };

  const handleSendPrompt = (textToSend?: string) => {
    const q = (textToSend || promptInput).trim();
    if (!q) return;
    handleUserPrompt(q);
    setPromptInput('');
  };

  const tracksToDisplay: Track[] = djTracks && djTracks.length > 0 ? djTracks : queue;

  const handleTrackClick = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track, tracksToDisplay, 'dj-session');
    }
  };

  const isCurrentLiked = currentTrack ? likedTrackIds.includes(currentTrack.id) : false;
  const currentDuration = durationMs || currentTrack?.duration_ms || 180000;
  const currentProgress = Math.min(progressMs, currentDuration);
  const progressPercent = currentDuration > 0 ? (currentProgress / currentDuration) * 100 : 0;
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
      className="relative w-full h-full max-h-full text-white flex flex-col justify-between overflow-y-auto scrollbar-none select-none font-['SpotifyMixUI'] animate-in fade-in duration-300 p-2 sm:p-3 pb-8 sm:pb-4"
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
          onClick={onBack}
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

        {/* Balance spacer */}
        <div className="w-10 h-10" />
      </header>

      {/* Center: The Hollow Smooth Organic Green-Cyan DJ Ring Centered (Photo 2) */}
      <main className="flex-1 flex flex-col items-center justify-between px-4 text-center max-w-xl mx-auto w-full z-10 py-2 min-h-0">
        <div className="flex-1 flex flex-col items-center justify-center w-full my-auto">
          <div className="flex items-center justify-center pointer-events-none select-none">
            <SpotifyDJVisualizer
              size={isMobile ? 220 : 240}
              state={visualizerState}
              voiceLevel={voiceLevel}
              themeColor={ambientColor}
            />
          </div>

          {isMicListening && (
            <div className="mt-3 flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#00f2fe]/15 border border-[#00f2fe]/40 backdrop-blur-md animate-pulse">
              <span className="w-2 h-2 rounded-full bg-[#00f2fe]" />
              <span className="text-xs font-bold text-[#00f2fe] font-['SpotifyMixUI']">
                Te escucho...
              </span>
            </div>
          )}
        </div>

        {/* Text Chat / Prompt Input Bar in Frosted Glass ("Cristal") */}
        <div className="w-full max-w-md sm:max-w-xl space-y-2 mt-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendPrompt();
            }}
            className="flex items-center gap-2 bg-white/[0.08] hover:bg-white/[0.12] border border-white/20 focus-within:border-white/45 rounded-full px-3 py-1.5 backdrop-blur-xl shadow-[0_8px_28px_rgba(0,0,0,0.35)] transition-all"
          >
            <button
              type="button"
              onClick={toggleMic}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                isMicListening
                  ? 'bg-[#00f2fe] text-black shadow-[0_0_14px_rgba(0,242,254,0.9)] animate-pulse'
                  : 'text-white/70 hover:text-white bg-white/10 hover:bg-white/20'
              }`}
              title={isMicListening ? 'Detener micrófono' : 'Hablar por micrófono'}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
              </svg>
            </button>

            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder={isMicListening ? "Te escucho... habla conmigo" : "Escribe al DJ (ej. más reggaeton, algo chill)..."}
              className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder-white/50 outline-none font-['SpotifyMixUI'] px-1"
            />

            <button
              type="submit"
              disabled={!promptInput.trim()}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                promptInput.trim()
                  ? 'bg-white text-black hover:scale-105 active:scale-95'
                  : 'text-white/30 bg-white/5 cursor-not-allowed'
              }`}
              title="Enviar petición"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </form>

          {/* Quick Vibe Chips in Frosted Glass ("Cristal") - Dynamically curated from user library */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap justify-center py-1 px-1 max-w-full">
            {vibeChips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleSendPrompt(chip)}
                className="px-2.5 sm:px-3 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.18] active:scale-95 text-[10.5px] sm:text-[11px] font-bold text-white/90 border border-white/15 backdrop-blur-md shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* =========================================================================
            CLASSIC SPOTIFY MINI-PLAYER ("El minireproductor de toda la vida estilo cristal")
            ========================================================================= */}
        {currentTrack && (
          <div
            onClick={handleOpenPlayer}
            className="w-full max-w-md sm:max-w-xl mt-3 h-14 rounded-[12px] flex items-center justify-between px-3 overflow-hidden cursor-pointer select-none transition-all duration-300 active:scale-[0.99] font-['SpotifyMixUI'] shadow-[0_16px_40px_rgba(0,0,0,0.7)] border border-white/25 backdrop-blur-3xl sticky bottom-1 shrink-0 z-20 bg-white/[0.12] hover:bg-white/[0.16]"
            style={{
              backgroundColor: `${ambientColor || '#181818'}70`,
            }}
            title="Toca para abrir reproductor completo con letra y detalles"
          >
            {/* 2px Bottom Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/20 rounded-b-[10px] overflow-hidden pointer-events-none">
              <div
                className="h-full bg-white transition-all duration-200 ease-linear"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Left: Artwork + Track details */}
            <div className="flex items-center min-w-0 flex-1 mr-2">
              <div className="w-10 h-10 rounded-[6px] shrink-0 overflow-hidden bg-[#181818] shadow-md">
                <img
                  src={activeArtwork}
                  alt={currentTrack.name}
                  onError={handleImageError}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex flex-col justify-center min-w-0 ml-3 flex-1 pr-1 text-left">
                <span className="font-bold text-white text-[13px] leading-tight truncate block font-['SpotifyMixUITitle']">
                  {currentTrack.name}
                </span>
                <span className="text-[11px] text-white/70 truncate leading-tight mt-0.5">
                  {currentTrack.artists?.map((a) => a.name).join(', ') || 'Artista'}
                </span>
              </div>
            </div>

            {/* Right: Actions (Like + Play/Pause + Cola) */}
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => toggleLike(currentTrack.id, currentTrack)}
                className="w-8 h-8 flex items-center justify-center text-[#b3b3b3] hover:text-white active:scale-95 transition-transform cursor-pointer"
                title={isCurrentLiked ? 'Quitar de tus Me Gusta' : 'Añadir a tus Me Gusta'}
              >
                {isCurrentLiked ? (
                  <CheckTrackNativeIcon size={20} className="text-[#1ed760]" />
                ) : (
                  <AddTrackNativeIcon size={20} className="text-white/80" />
                )}
              </button>

              <button
                onClick={togglePlay}
                className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white active:scale-90 transition-all cursor-pointer"
                title={isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPlaying ? (
                  <PauseNativeIcon size={20} className="text-white" />
                ) : (
                  <PlayNativeIcon size={20} className="text-white ml-0.5" />
                )}
              </button>

              <button
                onClick={() => setShowQueueDrawer(true)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                  showQueueDrawer ? 'text-[#1ed760] bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
                title="Ver cola del DJ"
              >
                <QueueNativeIcon size={18} />
              </button>
            </div>
          </div>
        )}
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
                return (
                  <div
                    key={`${track.id}-${idx}`}
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
                      <div className="truncate">
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
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
