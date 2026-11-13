import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Track } from '../../types/spotify';
import { PlayNativeIcon, CloseNativeIcon } from '../icons/SpotifyNativeIcons';
import { handleImageError } from '../../utils/imageFallback';
import { fetchTrackCanvas } from '../../services/spotifyApi';

interface PlaylistClipsMiniPlayerProps {
  tracks: Track[];
  initialTrackIndex?: number;
  playlistTitle?: string;
  isOpen: boolean;
  onClose: () => void;
  onPlayFullTrack: (track: Track, allTracks: Track[]) => void;
  skipShuffle?: boolean;
}

const PREVIEW_AUDIO_CACHE = new Map<string, string | null>();

/**
 * Resolves 30-second studio audio preview URL for any track
 * querying iTunes and Deezer clean preview APIs.
 */
async function fetchTrackPreviewAudio(track: Track): Promise<string | null> {
  if (track.preview_url) return track.preview_url;
  const cacheKey = track.id || `${track.name}_${track.artists?.[0]?.name}`;
  if (PREVIEW_AUDIO_CACHE.has(cacheKey)) {
    return PREVIEW_AUDIO_CACHE.get(cacheKey) || null;
  }

  const cleanName = (track.name || '')
    .replace(/\s*\(.*?\)/g, '')
    .replace(/\s*\[.*?\]/g, '')
    .trim();
  const artistName = (track.artists?.[0]?.name || '').replace(/feat\..*$/i, '').trim();
  const term = `${cleanName} ${artistName}`.trim();

  // 1. Try iTunes search first (super fast and reliable worldwide)
  try {
    const itunesRes = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=1`,
      { signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined }
    );
    if (itunesRes.ok) {
      const itunesData = await itunesRes.json();
      const pUrl = itunesData.results?.[0]?.previewUrl;
      if (pUrl) {
        PREVIEW_AUDIO_CACHE.set(cacheKey, pUrl);
        return pUrl;
      }
    }
  } catch {}

  // 2. Try Deezer search fallback
  try {
    const dzRes = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(term)}&limit=1`,
      { signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined }
    );
    if (dzRes.ok) {
      const dzData = await dzRes.json();
      const pUrl = dzData.data?.[0]?.preview;
      if (pUrl) {
        PREVIEW_AUDIO_CACHE.set(cacheKey, pUrl);
        return pUrl;
      }
    }
  } catch {}

  PREVIEW_AUDIO_CACHE.set(cacheKey, null);
  return null;
}

export const PlaylistClipsMiniPlayer: React.FC<PlaylistClipsMiniPlayerProps> = ({
  tracks,
  initialTrackIndex = 0,
  playlistTitle = 'Playlist',
  isOpen,
  onClose,
  onPlayFullTrack,
  skipShuffle = false,
}) => {
  const [shuffledTracks, setShuffledTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [canvasUrl, setCanvasUrl] = useState<string | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mainVideoRef = useRef<HTMLVideoElement | null>(null);
  const ambientVideoRef = useRef<HTMLVideoElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef<number>(0);
  const isHoldingRef = useRef<boolean>(false);
  const prevIsOpenRef = useRef<boolean>(false);

  // Shuffle playlist tracks into a random order on open, unless skipShuffle or specific initial index is requested
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      if (tracks.length > 0) {
        if (skipShuffle || typeof initialTrackIndex === 'number' && initialTrackIndex > 0) {
          setShuffledTracks(tracks);
          setCurrentIndex(initialTrackIndex ?? 0);
        } else {
          // Fisher-Yates true random shuffle of the playlist tracks
          const randomized = [...tracks];
          for (let i = randomized.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [randomized[i], randomized[j]] = [randomized[j], randomized[i]];
          }
          setShuffledTracks(randomized);
          setCurrentIndex(initialTrackIndex || 0);
        }
      }
      setSecondsElapsed(0);
      setIsPaused(false);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, tracks, initialTrackIndex, skipShuffle]);

  const currentList = shuffledTracks.length > 0 ? shuffledTracks : tracks;
  const currentTrack = currentList[currentIndex] || currentList[0];

  // Initialize and tear down dedicated audio element
  useEffect(() => {
    if (!isOpen) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, [isOpen]);

  // Handle Mute state changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
    }
  }, [isMuted]);

  // Fetch Canvas Video & Preview Audio when current track changes
  useEffect(() => {
    if (!isOpen || !currentTrack) return;
    let cancelled = false;

    setCanvasUrl(null);
    setPreviewAudioUrl(null);
    setSecondsElapsed(0);

    // Stop and silence previous audio immediately
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.volume = 0;
      audioRef.current.src = '';
    }

    const artistName = currentTrack.artists?.[0]?.name || '';

    // 1. Fetch Spotify Canvas MP4
    fetchTrackCanvas(currentTrack.id, currentTrack.name, artistName).then((cUrl) => {
      if (!cancelled) {
        setCanvasUrl(cUrl);
      }
    });

    // 2. Fetch 30-second studio audio preview
    fetchTrackPreviewAudio(currentTrack).then((audioUrl) => {
      if (!cancelled && audioUrl) {
        setPreviewAudioUrl(audioUrl);
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.currentTime = 0;
          audioRef.current.muted = isMuted;
          audioRef.current.volume = 0; // Starts at 0 to smoothly fade in!
          if (!isPaused) {
            audioRef.current.play().catch(() => {});
          }
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, currentTrack?.id, currentTrack?.name]);

  // Play / Pause synchronization for preview audio
  useEffect(() => {
    if (!audioRef.current || !previewAudioUrl) return;
    if (isPaused) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  }, [isPaused, previewAudioUrl]);

  // Synchronize playback state between main video and ambient cinema backdrop
  useEffect(() => {
    if (mainVideoRef.current) {
      if (isPaused) {
        mainVideoRef.current.pause();
      } else {
        mainVideoRef.current.play().catch(() => {});
      }
    }
    if (ambientVideoRef.current) {
      if (isPaused) {
        ambientVideoRef.current.pause();
      } else {
        ambientVideoRef.current.play().catch(() => {});
      }
    }
  }, [isPaused, canvasUrl]);

  // Prevent time drift between main canvas video and ambient cinema backdrop
  const handleVideoTimeUpdate = () => {
    if (mainVideoRef.current && ambientVideoRef.current) {
      const delta = Math.abs(mainVideoRef.current.currentTime - ambientVideoRef.current.currentTime);
      if (delta > 0.15) {
        ambientVideoRef.current.currentTime = mainVideoRef.current.currentTime;
      }
    }
  };

  // 15-second snippet progress timer with smooth volume fade in & fade out
  useEffect(() => {
    if (!isOpen || isPaused || !currentTrack) return;

    const interval = setInterval(() => {
      setSecondsElapsed((prev) => {
        const next = prev + 0.05;
        if (next >= 15) {
          handleNextTrack();
          return 0;
        }

        // Apply smooth audio volume fade:
        // 0.0s - 1.5s: Fade in from 0.0 to 1.0
        // 1.5s - 13.0s: Full volume 1.0
        // 13.0s - 15.0s: Fade out from 1.0 to 0.0
        if (audioRef.current && !isMuted) {
          let targetVol = 1;
          if (next < 1.5) {
            targetVol = Math.max(0, Math.min(1, next / 1.5));
          } else if (next > 13.0) {
            targetVol = Math.max(0, Math.min(1, (15 - next) / 2.0));
          }
          audioRef.current.volume = targetVol;
        }

        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isOpen, isPaused, currentTrack?.id, currentIndex, currentList.length, isMuted]);

  const handleNextTrack = () => {
    if (currentList.length === 0) return;
    if (audioRef.current && !isMuted) {
      audioRef.current.volume = 0;
    }
    setSecondsElapsed(0);
    setCurrentIndex((prev) => (prev + 1) % currentList.length);
  };

  const handlePrevTrack = () => {
    if (currentList.length === 0) return;
    if (audioRef.current && !isMuted) {
      audioRef.current.volume = 0;
    }
    setSecondsElapsed(0);
    setCurrentIndex((prev) => (prev - 1 + currentList.length) % currentList.length);
  };

  const handleClose = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    onClose();
  };

  const handlePlayFull = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    onPlayFullTrack(currentTrack, currentList);
    onClose();
  };

  // Touch Swipe Handlers & Hold to Pause
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchDeltaXRef.current = 0;
    isHoldingRef.current = true;
    setIsPaused(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current !== null) {
      touchDeltaXRef.current = e.touches[0].clientX - touchStartXRef.current;
    }
  };

  const handleTouchEnd = () => {
    isHoldingRef.current = false;
    setIsPaused(false);
    if (touchStartXRef.current !== null) {
      if (touchDeltaXRef.current < -50) {
        handleNextTrack();
      } else if (touchDeltaXRef.current > 50) {
        handlePrevTrack();
      }
      touchStartXRef.current = null;
      touchDeltaXRef.current = 0;
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') handleClose();
      if (e.key === 'ArrowRight') handleNextTrack();
      if (e.key === 'ArrowLeft') handlePrevTrack();
      if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((p) => !p);
      }
      if (e.key.toLowerCase() === 'm') {
        setIsMuted((m) => !m);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentList.length, isPaused]);

  if (!isOpen || !currentTrack) return null;
  if (typeof document === 'undefined') return null;

  const coverUrl =
    currentTrack.album?.images?.[0]?.url ||
    (currentTrack as any)?.image ||
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80';

  // Visible stories bars (windowed for large playlists)
  const maxVisibleBars = 12;
  let startIdx = 0;
  let endIdx = currentList.length;
  if (currentList.length > maxVisibleBars) {
    startIdx = Math.max(0, Math.min(currentIndex - Math.floor(maxVisibleBars / 2), currentList.length - maxVisibleBars));
    endIdx = startIdx + maxVisibleBars;
  }
  const visibleTracks = currentList.slice(startIdx, endIdx);

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-xl animate-in fade-in duration-200 select-none font-['SpotifyMixUI'] overflow-hidden"
      onClick={handleClose}
    >
      {/* Dynamic Ambient Cinema Backdrop - Reflects canvas video or cover colors onto the dark backdrop */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-0">
        {canvasUrl ? (
          <video
            ref={ambientVideoRef}
            key={`ambient-video-${canvasUrl}`}
            src={canvasUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-[700px] h-[700px] md:w-[850px] md:h-[850px] object-cover filter blur-[100px] scale-150 opacity-60 pointer-events-none transition-opacity duration-700 ease-in-out"
          />
        ) : (
          <img
            key={`ambient-glow-${currentTrack.id}`}
            src={coverUrl}
            alt=""
            className="w-[700px] h-[700px] md:w-[850px] md:h-[850px] object-cover filter blur-[140px] opacity-25 scale-125 transition-all duration-1000 ease-in-out pointer-events-none"
          />
        )}
      </div>

      {/* Main Centered Content Wrapper with Desktop Arrow Buttons */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-4">
        <div className="flex items-center gap-4 md:gap-6 lg:gap-8">
          {/* Desktop Left Navigation Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrevTrack();
            }}
            className="hidden md:flex w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-white/90 hover:text-white items-center justify-center transition-all cursor-pointer backdrop-blur-xl shadow-2xl hover:scale-105 shrink-0"
            title="Canción anterior (←)"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
            </svg>
          </button>

          {/* Sleek Stories Card (Borders removed for authentic Spotify look) */}
          <div
            className="relative w-full max-w-[340px] sm:max-w-[360px] md:max-w-[380px] h-[580px] md:h-[640px] max-h-[86vh] rounded-[28px] overflow-hidden bg-[#121212] shadow-[0_25px_70px_rgba(0,0,0,0.95)] flex flex-col justify-between select-none animate-in zoom-in-95 duration-200 shrink-0"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={() => {
              isHoldingRef.current = true;
              setIsPaused(true);
            }}
            onMouseUp={() => {
              isHoldingRef.current = false;
              setIsPaused(false);
            }}
          >
            {/* Top Story Progress Bars & Minimal Header */}
            <div className="absolute top-0 inset-x-0 z-40 p-3 pt-3.5 bg-gradient-to-b from-black/90 via-black/40 to-transparent pointer-events-none">
              {/* Story Pill Indicators */}
              <div className="flex items-center gap-1 w-full mb-2.5">
                {visibleTracks.map((_, i) => {
                  const actualIdx = startIdx + i;
                  let fillWidth = '0%';
                  if (actualIdx < currentIndex) fillWidth = '100%';
                  else if (actualIdx === currentIndex) fillWidth = `${(secondsElapsed / 15) * 100}%`;

                  return (
                    <div key={actualIdx} className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden">
                      <div
                        className="h-full bg-white transition-all duration-100 ease-linear shadow-[0_0_6px_rgba(255,255,255,0.7)]"
                        style={{ width: fillWidth }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Clean Spotify-style Header */}
              <div className="flex items-center justify-between pointer-events-auto">
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <p className="text-[12px] font-bold text-white tracking-tight truncate drop-shadow-md">
                    {playlistTitle}
                  </p>
                  {canvasUrl && (
                    <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[9px] font-semibold text-white/80 shrink-0">
                      Canvas
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Mute / Unmute Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMuted(!isMuted);
                    }}
                    className="w-7 h-7 rounded-full bg-black/40 hover:bg-black/70 active:scale-95 text-white/80 hover:text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-md"
                    title={isMuted ? 'Activar sonido (M)' : 'Silenciar sonido (M)'}
                  >
                    {isMuted ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                      </svg>
                    )}
                  </button>

                  {/* Close Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClose();
                    }}
                    className="w-7 h-7 rounded-full bg-black/40 hover:bg-black/70 active:scale-95 text-white/80 hover:text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-md"
                    title="Cerrar clips"
                  >
                    <CloseNativeIcon size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Visual Stage: Spotify Canvas Video Loop OR Minimal Album Cover */}
            <div className="relative flex-1 w-full overflow-hidden bg-black flex items-center justify-center">
              {canvasUrl ? (
                <video
                  ref={mainVideoRef}
                  key={canvasUrl}
                  src={canvasUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  onTimeUpdate={handleVideoTimeUpdate}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />
              ) : (
                <div className="relative w-full h-full flex flex-col items-center justify-center p-6 overflow-hidden">
                  {/* Soft Ambient Backdrop */}
                  <img
                    src={coverUrl}
                    alt={currentTrack.name}
                    onError={handleImageError}
                    className="absolute inset-0 w-full h-full object-cover filter blur-3xl scale-125 opacity-40 pointer-events-none transition-all duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/60 pointer-events-none" />

                  {/* Clean Floating Album Art without borders */}
                  <div className="relative z-10 w-48 h-48 md:w-52 md:h-52 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.9)] animate-in fade-in zoom-in-95 duration-300">
                    <img
                      src={coverUrl}
                      alt={currentTrack.name}
                      onError={handleImageError}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              )}

              {/* Pause Indicator */}
              {isPaused && (
                <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-[11px] font-bold text-white/90 animate-in fade-in duration-150 pointer-events-none">
                  Pausado
                </div>
              )}

              {/* Left / Right Tap zones for mobile/in-card navigation */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevTrack();
                }}
                className="absolute inset-y-16 left-0 w-1/4 cursor-pointer z-30 group flex items-center justify-start pl-2"
                title="Anterior (o pulsa ←)"
              >
                <div className="w-8 h-8 rounded-full bg-black/40 text-white/70 group-hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md md:hidden">
                  ‹
                </div>
              </div>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextTrack();
                }}
                className="absolute inset-y-16 right-0 w-1/4 cursor-pointer z-30 group flex items-center justify-end pr-2"
                title="Siguiente (o pulsa →)"
              >
                <div className="w-8 h-8 rounded-full bg-black/40 text-white/70 group-hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md md:hidden">
                  ›
                </div>
              </div>
            </div>

            {/* Bottom Metadata & Authentic Spotify "Escuchar canción completa" Button */}
            <div className="relative z-40 p-4 pt-6 bg-gradient-to-t from-black via-black/90 to-transparent space-y-3.5">
              <div className="min-w-0 pr-1">
                <h3 className="text-base font-bold text-white font-['SpotifyMixUITitle'] truncate drop-shadow-md">
                  {currentTrack.name}
                </h3>
                <p className="text-xs font-medium text-[#b3b3b3] truncate mt-0.5">
                  {currentTrack.artists?.map((a) => a.name).join(', ') || 'Artista desconocido'}
                </p>
              </div>

              {/* Clean Spotify-native CTA Button (Sentence case, rounded pill, natural) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayFull();
                }}
                className="w-full py-3.5 px-6 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-[1.02] active:scale-[0.98] text-black font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-[#1ed760]/20 transition-all cursor-pointer"
              >
                <PlayNativeIcon size={16} className="text-black fill-current" />
                <span>Escuchar canción completa</span>
              </button>
            </div>
          </div>

          {/* Desktop Right Navigation Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNextTrack();
            }}
            className="hidden md:flex w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 active:scale-90 text-white/90 hover:text-white items-center justify-center transition-all cursor-pointer backdrop-blur-xl shadow-2xl hover:scale-105 shrink-0"
            title="Siguiente canción (→)"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
