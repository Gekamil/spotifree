import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { Track } from '../../types/spotify';
import { SpotifyDJVisualizer } from './SpotifyDJVisualizer';
import { InteractiveMusicWaves } from './InteractiveMusicWaves';
import { useAIDJStore, prefetchQuickVibeVoices } from '../../services/aiDJService';
import { getUserDynamicVibeChips } from '../../services/musicTaggingService';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useShallow } from 'zustand/react/shallow';
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

/** The mini player's 2 px progress line: the only part of the DJ screen that follows the song's progress */
const DJMiniProgress: React.FC<{ fallbackDurationMs?: number }> = ({ fallbackDurationMs }) => {
  const progressMs = usePlayerStore((s) => s.progressMs);
  const durationMs = usePlayerStore((s) => s.durationMs);
  const duration = durationMs || fallbackDurationMs || 180000;
  const pct = duration > 0 ? (Math.min(progressMs, duration) / duration) * 100 : 0;
  return (
    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/20 rounded-b-[10px] overflow-hidden pointer-events-none">
      <div className="h-full bg-white origin-left will-change-transform" style={{ transform: `scaleX(${pct / 100})` }} />
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
    segments,
    activeSegmentId,
    isThinking,
    nextSegment,
    requestedSongName,
    requestedTrack,
    similarTracks,
    chatHistory,
    showSimilarPanel,
    setShowSimilarPanel,
  } = useAIDJStore();
  const activeSegment = segments.find((s) => s.id === activeSegmentId) || null;
  const activeSegIdx = activeSegment ? segments.indexOf(activeSegment) : -1;
  const upcomingSegment = activeSegIdx >= 0 ? segments[activeSegIdx + 1] || null : null;

  // (No progressMs here: it changes 10 times a second and would redraw the whole DJ screen;
  // the mini player's bar reads it on its own, see DJMiniProgress)
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
    likedTrackIds,
    toggleLike,
    queue,
  } = usePlayerStore(
    useShallow((s) => ({ currentTrack: s.currentTrack, isPlaying: s.isPlaying, playTrack: s.playTrack, togglePlay: s.togglePlay, likedTrackIds: s.likedTrackIds, toggleLike: s.toggleLike, queue: s.queue }))
  );

  const [showQueueDrawer, setShowQueueDrawer] = useState(false);
  const [isQueueRendered, setIsQueueRendered] = useState(false);
  const [isQueueAnimated, setIsQueueAnimated] = useState(false);
  const [queueDragY, setQueueDragY] = useState(0);
  const [isQueueDragging, setIsQueueDragging] = useState(false);
  const djQueueStartYRef = useRef(0);
  const djQueueCurrentYRef = useRef(0);
  const djQueueScrollRef = useRef<HTMLDivElement>(null);

  // Chat Drawer state
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [isChatRendered, setIsChatRendered] = useState(false);
  const [isChatAnimated, setIsChatAnimated] = useState(false);
  const [chatDragY, setChatDragY] = useState(0);
  const [isChatDragging, setIsChatDragging] = useState(false);
  const djChatStartYRef = useRef(0);
  const djChatCurrentYRef = useRef(0);
  const djChatScrollRef = useRef<HTMLDivElement>(null);

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

  const handleDJChatTouchStart = (e: React.TouchEvent) => {
    djChatStartYRef.current = e.touches[0].clientY;
    djChatCurrentYRef.current = e.touches[0].clientY;
    setIsChatDragging(true);
  };

  const handleDJChatBodyTouchStart = (e: React.TouchEvent) => {
    if (djChatScrollRef.current && djChatScrollRef.current.scrollTop <= 5) {
      djChatStartYRef.current = e.touches[0].clientY;
      djChatCurrentYRef.current = e.touches[0].clientY;
      setIsChatDragging(true);
    }
  };

  const handleDJChatTouchMove = (e: React.TouchEvent) => {
    if (!isChatDragging) return;
    const delta = e.touches[0].clientY - djChatStartYRef.current;
    if (delta > 0) {
      djChatCurrentYRef.current = e.touches[0].clientY;
      setChatDragY(delta);
    }
  };

  const handleDJChatTouchEnd = () => {
    if (!isChatDragging) return;
    setIsChatDragging(false);
    const delta = djChatCurrentYRef.current - djChatStartYRef.current;
    if (delta > 75) {
      setShowChatDrawer(false);
    }
    setChatDragY(0);
  };

  // Smooth bottom sheet glide transition for the chat drawer
  useEffect(() => {
    if (showChatDrawer) {
      setIsChatRendered(true);
      const raf = requestAnimationFrame(() => {
        setIsChatAnimated(true);
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsChatAnimated(false);
      const timer = setTimeout(() => {
        setIsChatRendered(false);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [showChatDrawer]);

  // Auto-scroll chat history to latest message when opened or new message arrives
  useEffect(() => {
    if (showChatDrawer && djChatScrollRef.current) {
      djChatScrollRef.current.scrollTop = djChatScrollRef.current.scrollHeight;
    }
  }, [chatHistory, showChatDrawer]);
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

  // Leaving before the DJ starts talking calls the greeting off
  useEffect(() => () => useAIDJStore.getState().cancelDJIntroIfNotStarted(), []);

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

        {/* Symmetric header spacer matching Spotify DJ clean header (no top-right circle) */}
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

          {/* Live captions of what the DJ says, or the block that is on now */}
          <div className="mt-4 w-full max-w-md min-h-[64px] flex flex-col items-center justify-start px-2" aria-live="polite">
            {isThinking ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md">
                <span className="flex gap-1" aria-hidden="true">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-bounce" />
                </span>
                <span className="text-xs font-bold text-white/90">Preparando tu sesión</span>
              </div>
            ) : isSpeaking ? (
              // No subtitles: while the DJ talks, only the voice and the visualizer
              null
            ) : activeSegment && !isMicListening ? (
              <div className="flex flex-col items-center gap-2 animate-in fade-in duration-500">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/60">Ahora</span>
                <span className="text-base font-black text-white font-['SpotifyMixUITitle'] leading-tight text-center">
                  {activeSegment.title}
                </span>
                <button
                  type="button"
                  onClick={() => void nextSegment()}
                  className="mt-1 flex items-center gap-2 pl-2.5 pr-3.5 py-1.5 rounded-full bg-white text-black text-xs font-bold hover:scale-105 active:scale-95 transition-transform cursor-pointer shadow-lg"
                  title={upcomingSegment ? `Siguiente: ${upcomingSegment.title}` : 'El DJ prepara algo diferente'}
                >
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
                    <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z" />
                    <path d="M8 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" />
                  </svg>
                  Cambiar de rollo
                </button>
                {upcomingSegment && (
                  <span className="text-[11px] text-white/55">Luego: {upcomingSegment.title}</span>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* =========================================================================
            RECOMMENDED SIMILAR TITLES CAROUSEL / CARD ("Títulos similares")
            ========================================================================= */}
        {similarTracks && similarTracks.length > 0 && showSimilarPanel && (
          <div className="w-full max-w-md sm:max-w-xl my-2 p-3 sm:p-3.5 rounded-2xl bg-white/[0.08] hover:bg-white/[0.11] border border-white/20 backdrop-blur-2xl shadow-[0_12px_36px_rgba(0,0,0,0.45)] text-left transition-all animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1ed760] shadow-[0_0_8px_#1ed760] animate-pulse shrink-0" />
                <h4 className="text-xs sm:text-[13px] font-black text-white font-['SpotifyMixUITitle'] truncate">
                  Títulos similares a «{requestedSongName || currentTrack?.name}»
                </h4>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowQueueDrawer(true)}
                  className="text-[11px] font-bold text-[#1ed760] hover:underline cursor-pointer"
                >
                  Ver en cola ({similarTracks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setShowSimilarPanel(false)}
                  className="w-5 h-5 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors cursor-pointer"
                  title="Ocultar sugerencias"
                >
                  <CloseNativeIcon size={12} />
                </button>
              </div>
            </div>

            {/* Horizontal scroll cards */}
            <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
              {similarTracks.map((tr) => {
                const isThisPlaying = currentTrack?.id === tr.id;
                const art = getBestTrackArtwork(tr);
                return (
                  <div
                    key={tr.id}
                    onClick={() => handleTrackClick(tr)}
                    className={`group w-28 sm:w-32 shrink-0 p-2 rounded-xl transition-all cursor-pointer ${
                      isThisPlaying
                        ? 'bg-white/20 border border-[#1ed760]/60 shadow-[0_0_12px_rgba(30,215,96,0.25)]'
                        : 'bg-white/5 hover:bg-white/15 border border-white/10'
                    }`}
                  >
                    <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-[#242424] mb-2 shadow-md">
                      <img
                        src={art}
                        alt={tr.name}
                        onError={handleImageError}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div
                        className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${
                          isThisPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-[#1ed760] text-black flex items-center justify-center shadow-lg transform group-hover:scale-110 active:scale-95 transition-transform">
                          {isThisPlaying && isPlaying ? (
                            <PauseNativeIcon size={16} className="text-black" />
                          ) : (
                            <PlayNativeIcon size={16} className="text-black ml-0.5" />
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-[12px] font-bold text-white truncate font-['SpotifyMixUITitle'] leading-tight">
                      {tr.name}
                    </p>
                    <p className="text-[10.5px] text-white/65 truncate mt-0.5">
                      {tr.artists?.[0]?.name || 'Artista'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Vibe Chips - Dynamically curated from user library */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center py-1 px-1 max-w-full z-10 mt-auto">
          {vibeChips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => handleSendPrompt(chip)}
              className="px-3 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.18] active:scale-95 text-[11px] sm:text-[12px] font-bold text-white/90 border border-white/15 backdrop-blur-md shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Interactive DJ Prompt Input & Voice Controls */}
        <div className="w-full max-w-md sm:max-w-xl flex items-center gap-2 px-1 z-10 mt-1">
          <button
            type="button"
            onClick={toggleMic}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-md ${
              isMicListening
                ? 'bg-[#00f2fe] text-black shadow-[0_0_16px_rgba(0,242,254,0.9)] animate-pulse scale-105'
                : 'bg-white/15 hover:bg-white/25 text-white active:scale-95 border border-white/20'
            }`}
            title={isMicListening ? 'Detener micrófono' : 'Hablar al DJ con tu voz'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
            </svg>
          </button>

          <div className="flex-1 flex items-center bg-white/10 hover:bg-white/15 focus-within:bg-white/20 border border-white/20 focus-within:border-white/50 rounded-full px-3 py-1.5 transition-all shadow-inner backdrop-blur-xl">
            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendPrompt();
              }}
              placeholder="Pide un estilo, artista o canción al DJ..."
              className="w-full bg-transparent text-white placeholder-white/50 text-xs sm:text-sm font-medium outline-none"
            />
            {promptInput.trim() && (
              <button
                type="button"
                onClick={() => handleSendPrompt()}
                className="w-6 h-6 rounded-full bg-[#1ed760] text-black flex items-center justify-center shrink-0 ml-1 active:scale-90 transition-transform cursor-pointer"
                title="Enviar petición"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowChatDrawer(true)}
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-md ${
              showChatDrawer
                ? 'bg-[#1ed760] text-black'
                : 'bg-white/10 hover:bg-white/20 text-white/90 active:scale-95 border border-white/15'
            }`}
            title="Ver chat e historial con el DJ"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </button>
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
            <DJMiniProgress fallbackDurationMs={currentTrack?.duration_ms} />

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
                const blockStart = tracksToDisplay === djTracks && segments.length > 1 ? segments.find((s) => s.startIndex === idx) : undefined;
                const isRequested = requestedTrack && (track.id === requestedTrack.id || (track.name.toLowerCase() === requestedTrack.name.toLowerCase() && track.artists?.[0]?.name?.toLowerCase() === requestedTrack.artists?.[0]?.name?.toLowerCase()));
                const isSimilar = similarTracks && similarTracks.some((st) => st.id === track.id || st.name.toLowerCase() === track.name.toLowerCase());
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
                        <div className="flex items-center gap-1.5 truncate">
                          <p className={`text-sm font-semibold truncate ${isPlayingThis ? 'text-[#1ed760]' : 'text-white'}`}>
                            {track.name}
                          </p>
                          {isRequested && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#1ed760] text-black shrink-0">
                              Tu petición
                            </span>
                          )}
                          {isSimilar && !isRequested && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/20 text-[#1ed760] shrink-0">
                              Similar
                            </span>
                          )}
                        </div>
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

      {/* Sliding Chat / Floating Popup Window matching official Spotify DJ */}
      {isChatRendered && (
        <div
          className={`fixed inset-0 z-50 flex flex-col justify-end sm:block transition-colors duration-300 ${
            isChatAnimated ? 'bg-black/60 backdrop-blur-sm sm:bg-transparent sm:backdrop-blur-none pointer-events-auto' : 'bg-transparent pointer-events-none'
          }`}
          onClick={() => setShowChatDrawer(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: chatDragY > 0 ? `translateY(${chatDragY}px)` : undefined,
              transition: isChatDragging ? 'none' : undefined,
            }}
            className={`bg-[#181818] sm:fixed sm:bottom-20 sm:right-6 sm:w-[420px] sm:max-h-[580px] sm:rounded-[24px] sm:border sm:border-white/15 sm:bg-[#181818]/95 sm:backdrop-blur-2xl sm:shadow-[0_24px_70px_rgba(0,0,0,0.95)] rounded-t-3xl max-h-[82vh] flex flex-col p-4 sm:p-5 pb-6 sm:pb-5 transform transition-all duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] ${
              isChatAnimated
                ? 'translate-y-0 opacity-100 scale-100 sm:translate-y-0 sm:opacity-100 sm:scale-100'
                : 'translate-y-full opacity-50 scale-[0.98] sm:translate-y-4 sm:opacity-0 sm:scale-95'
            }`}
          >
            {/* Top Drag Indicator Pill (Mobile only) */}
            <div
              onTouchStart={handleDJChatTouchStart}
              onTouchMove={handleDJChatTouchMove}
              onTouchEnd={handleDJChatTouchEnd}
              className="w-10 h-1 bg-white/30 hover:bg-white/50 rounded-full mx-auto mb-3.5 cursor-grab active:cursor-grabbing active:scale-95 transition-all sm:hidden"
              onClick={() => setShowChatDrawer(false)}
              title="Cerrar chat"
            />

            {/* Header */}
            <div
              onTouchStart={handleDJChatTouchStart}
              onTouchMove={handleDJChatTouchMove}
              onTouchEnd={handleDJChatTouchEnd}
              className="flex items-center justify-between pb-3.5 border-b border-white/10"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#1ed760] text-black font-black flex items-center justify-center text-xs shadow-md">
                  DJ
                </div>
                <div>
                  <h3 className="text-base font-black text-white font-['SpotifyMixUITitle']">
                    Chat con tu DJ
                  </h3>
                  <p className="text-xs text-[#a7a7a7]">Peticiones y canciones similares</p>
                </div>
              </div>
              <button
                onClick={() => setShowChatDrawer(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer active:scale-90 transition-transform"
                title="Cerrar chat"
              >
                <CloseNativeIcon size={16} />
              </button>
            </div>

            {/* Chat Messages Body */}
            <div
              ref={djChatScrollRef}
              onTouchStart={handleDJChatBodyTouchStart}
              onTouchMove={handleDJChatTouchMove}
              onTouchEnd={handleDJChatTouchEnd}
              className="flex-1 overflow-y-auto space-y-3.5 my-3 pr-1"
            >
              {chatHistory.length === 0 ? (
                <div className="flex flex-col items-start text-left space-y-2 py-2">
                  <div className="max-w-[92%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed bg-[#242424] text-white rounded-tl-sm border border-white/5 shadow-md">
                    <p>
                      {activeSegment?.intro || `¡Hey! Empezamos con lo que más te suena estos días. Pídeme cualquier canción o rollo musical.`}
                    </p>
                  </div>
                  <span className="text-[10px] text-[#727272] px-1">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="w-full pt-3">
                    <p className="text-xs text-[#a7a7a7] mb-2 font-medium">Sugerencias para pedir al DJ:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['Ponme Feid', 'Algo de Bad Bunny', 'Música para entrenar', 'Pop de los 2000s'].map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => handleSendPrompt(suggestion)}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all active:scale-95 cursor-pointer"
                        >
                          «{suggestion}»
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                chatHistory.map((msg) => {
                  const isDJ = msg.sender === 'dj';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isDJ ? 'items-start' : 'items-end'} text-left`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 text-xs sm:text-sm leading-relaxed ${
                          isDJ
                            ? 'bg-[#242424] text-white rounded-tl-sm border border-white/5'
                            : 'bg-[#1ed760] text-black font-medium rounded-tr-sm'
                        }`}
                      >
                        <p>{msg.text}</p>

                        {/* If this DJ response included a requested song */}
                        {isDJ && msg.requestedTrack && (
                          <div className="mt-2.5 pt-2 border-t border-white/10">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-[#1ed760] block mb-1.5">
                              Canción solicitada
                            </span>
                            <div
                              onClick={() => handleTrackClick(msg.requestedTrack!)}
                              className="flex items-center gap-2.5 p-1.5 rounded-lg bg-black/40 hover:bg-black/60 cursor-pointer transition-all border border-white/10"
                            >
                              <img
                                src={getBestTrackArtwork(msg.requestedTrack)}
                                alt={msg.requestedTrack.name}
                                className="w-9 h-9 rounded object-cover shrink-0 bg-[#333]"
                                onError={handleImageError}
                              />
                              <div className="truncate flex-1 min-w-0">
                                <p className="font-bold text-white text-xs truncate">
                                  {msg.requestedTrack.name}
                                </p>
                                <p className="text-[11px] text-[#a7a7a7] truncate">
                                  {msg.requestedTrack.artists?.map((a) => a.name).join(', ')}
                                </p>
                              </div>
                              <div className="w-7 h-7 rounded-full bg-[#1ed760] text-black flex items-center justify-center shrink-0">
                                <PlayNativeIcon size={12} className="ml-0.5 text-black" />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* If this DJ response included similar tracks */}
                        {isDJ && msg.similarTracks && msg.similarTracks.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-white/10">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-[#a7a7a7] block mb-1.5">
                              Títulos similares recomendados
                            </span>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {msg.similarTracks.slice(0, 6).map((simTrack) => (
                                <div
                                  key={simTrack.id}
                                  onClick={() => handleTrackClick(simTrack)}
                                  className="flex items-center gap-2 p-1.5 rounded-md bg-black/30 hover:bg-black/50 cursor-pointer transition-colors"
                                >
                                  <img
                                    src={getBestTrackArtwork(simTrack)}
                                    alt={simTrack.name}
                                    className="w-7 h-7 rounded object-cover shrink-0 bg-[#333]"
                                    onError={handleImageError}
                                  />
                                  <div className="truncate flex-1 min-w-0">
                                    <p className="font-semibold text-white text-[11px] truncate">
                                      {simTrack.name}
                                    </p>
                                    <p className="text-[10px] text-[#a7a7a7] truncate">
                                      {simTrack.artists?.map((a) => a.name).join(', ')}
                                    </p>
                                  </div>
                                  <span className="text-[10px] text-[#727272] shrink-0 tabular-nums">
                                    {formatDuration(simTrack.duration_ms || 180000)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] text-[#727272] mt-1 px-1">
                        {msg.timestamp}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Vibe Chips inside drawer */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 px-0.5 scrollbar-none shrink-0 mb-1">
              {vibeChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleSendPrompt(chip)}
                  className="px-2.5 py-1 rounded-full bg-white/[0.07] hover:bg-white/[0.15] active:scale-95 text-[11px] font-bold text-white/85 border border-white/10 transition-all cursor-pointer whitespace-nowrap shrink-0"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Voice toggle button */}
            <div className="flex items-center justify-center pt-2 pb-1 shrink-0">
              <button
                type="button"
                onClick={toggleMic}
                className={`px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold transition-all cursor-pointer ${
                  isMicListening
                    ? 'bg-[#00f2fe] text-black shadow-[0_0_14px_rgba(0,242,254,0.9)] animate-pulse'
                    : 'text-white bg-white/10 hover:bg-white/20'
                }`}
                title={isMicListening ? 'Detener micrófono' : 'Hablar con el DJ'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                </svg>
                <span>{isMicListening ? 'Escuchando...' : 'Hablar al DJ'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
