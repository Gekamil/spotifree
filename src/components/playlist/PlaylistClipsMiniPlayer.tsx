import React, { useState, useEffect, useRef } from 'react';
import type { Track } from '../../types/spotify';
import { audioEngine } from '../../services/audioEngine';
import { PlayNativeIcon, CloseNativeIcon } from '../icons/SpotifyNativeIcons';
import { handleImageError } from '../../utils/imageFallback';

interface PlaylistClipsMiniPlayerProps {
  tracks: Track[];
  initialTrackIndex?: number;
  playlistTitle?: string;
  isOpen: boolean;
  onClose: () => void;
  onPlayFullTrack: (track: Track, allTracks: Track[]) => void;
}

export const PlaylistClipsMiniPlayer: React.FC<PlaylistClipsMiniPlayerProps> = ({
  tracks,
  initialTrackIndex = 0,
  playlistTitle = 'Playlist',
  isOpen,
  onClose,
  onPlayFullTrack,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialTrackIndex);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef<number>(0);

  // Sync index if initialTrackIndex changes on reopen
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialTrackIndex, tracks.length - 1)));
      setSecondsElapsed(0);
      setIsPaused(false);
    }
  }, [isOpen, initialTrackIndex, tracks.length]);

  const currentTrack = tracks[currentIndex] || tracks[0];

  // Resolve video clip for current track
  useEffect(() => {
    if (!isOpen || !currentTrack) return;
    let cancelled = false;
    setVideoId(null);
    setIsLoadingVideo(true);

    const cleanTitle = currentTrack.name
      .replace(/\s*\(.*?\)/g, '')
      .replace(/\s*\[.*?\]/g, '')
      .trim();
    const cleanArtist = (currentTrack.artists?.[0]?.name || '').replace(/feat\..*$/i, '').trim();
    const query = `${cleanTitle} ${cleanArtist} official video`;

    audioEngine
      .resolveVideoIdForTrack(query, `clip-${currentTrack.id}`)
      .then((vid) => {
        if (!cancelled) {
          if (vid) {
            setVideoId(vid);
          } else {
            // Fallback to general track audio video
            return audioEngine.resolveVideoIdForTrack(`${currentTrack.name} ${cleanArtist}`, currentTrack.id);
          }
        }
      })
      .then((fallbackVid) => {
        if (!cancelled && fallbackVid) {
          setVideoId(fallbackVid);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingVideo(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, currentTrack?.id, currentTrack?.name]);

  // 15-second snippet progress timer
  useEffect(() => {
    if (!isOpen || isPaused || !currentTrack) return;

    const interval = setInterval(() => {
      setSecondsElapsed((prev) => {
        if (prev >= 15) {
          // Advance to next track
          handleNextTrack();
          return 0;
        }
        return prev + 0.1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, isPaused, currentTrack?.id, currentIndex, tracks.length]);

  const handleNextTrack = () => {
    if (tracks.length === 0) return;
    setSecondsElapsed(0);
    setCurrentIndex((prev) => (prev + 1) % tracks.length);
  };

  const handlePrevTrack = () => {
    if (tracks.length === 0) return;
    setSecondsElapsed(0);
    setCurrentIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchDeltaXRef.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current !== null) {
      touchDeltaXRef.current = e.touches[0].clientX - touchStartXRef.current;
    }
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current !== null) {
      if (touchDeltaXRef.current < -50) {
        // Swiped left -> next
        handleNextTrack();
      } else if (touchDeltaXRef.current > 50) {
        // Swiped right -> prev
        handlePrevTrack();
      }
      touchStartXRef.current = null;
      touchDeltaXRef.current = 0;
    }
  };

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNextTrack();
      if (e.key === 'ArrowLeft') handlePrevTrack();
      if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, tracks.length]);

  if (!isOpen || !currentTrack) return null;

  const coverUrl =
    currentTrack.album?.images?.[0]?.url ||
    (currentTrack as any)?.image ||
    'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80';

  // Visible stories bars (windowed for large playlists)
  const maxVisibleBars = 12;
  let startIdx = 0;
  let endIdx = tracks.length;
  if (tracks.length > maxVisibleBars) {
    startIdx = Math.max(0, Math.min(currentIndex - Math.floor(maxVisibleBars / 2), tracks.length - maxVisibleBars));
    endIdx = startIdx + maxVisibleBars;
  }
  const visibleTracks = tracks.slice(startIdx, endIdx);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Floating Glassmorphic Mini-Player Container */}
      <div
        className="relative w-full max-w-[340px] sm:max-w-[360px] h-[550px] max-h-[85vh] rounded-[28px] overflow-hidden bg-[#121212]/90 border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.9)] flex flex-col justify-between backdrop-blur-2xl select-none animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Top Story Progress Bars */}
        <div className="absolute top-0 inset-x-0 z-30 p-3 pt-3.5 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none">
          <div className="flex items-center gap-1 w-full mb-2">
            {visibleTracks.map((_, i) => {
              const actualIdx = startIdx + i;
              let fillWidth = '0%';
              if (actualIdx < currentIndex) fillWidth = '100%';
              else if (actualIdx === currentIndex) fillWidth = `${(secondsElapsed / 15) * 100}%`;

              return (
                <div key={actualIdx} className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-100 ease-linear"
                    style={{ width: fillWidth }}
                  />
                </div>
              );
            })}
          </div>

          {/* Header Info: Playlist name & Close button */}
          <div className="flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <span className="w-2 h-2 rounded-full bg-[#1ed760] animate-pulse shrink-0" />
              <p className="text-[11px] font-bold text-white uppercase tracking-wider truncate drop-shadow">
                Clip 15s • {playlistTitle}
              </p>
              {isLoadingVideo && (
                <span className="text-[9px] text-[#1ed760] font-bold animate-pulse shrink-0">
                  • HD
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-white/70 font-semibold">
                {Math.floor(15 - secondsElapsed)}s
              </span>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-black/40 hover:bg-black/70 active:scale-95 text-white/90 hover:text-white flex items-center justify-center transition-all cursor-pointer shadow"
                title="Cerrar clips"
              >
                <CloseNativeIcon size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Video / Visual Content Stage */}
        <div className="relative flex-1 w-full overflow-hidden bg-black flex items-center justify-center">
          {videoId ? (
            <div className="w-full h-full relative overflow-hidden pointer-events-none">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=0&controls=0&playsinline=1&rel=0&start=32&end=47&disablekb=1&fs=0&loop=1`}
                title={`${currentTrack.name} Preview Clip`}
                className="w-[140%] h-[140%] -ml-[20%] -mt-[20%] border-0 pointer-events-none object-cover"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          ) : (
            /* Atmospheric Cover with animated visualizer if video is loading/fallback */
            <div className="relative w-full h-full flex flex-col items-center justify-center p-6 overflow-hidden">
              <img
                src={coverUrl}
                alt={currentTrack.name}
                onError={handleImageError}
                className="absolute inset-0 w-full h-full object-cover filter blur-xl scale-125 opacity-50 pointer-events-none"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/60 pointer-events-none" />

              <div className="relative z-10 w-44 h-44 rounded-2xl overflow-hidden shadow-2xl border border-white/20 mb-4 animate-in fade-in">
                <img
                  src={coverUrl}
                  alt={currentTrack.name}
                  onError={handleImageError}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Soundwaves indicator */}
              <div className="flex items-center gap-1 h-5 z-10">
                <div className="w-1 bg-[#1ed760] rounded-full animate-[bounce_0.8s_infinite] h-4" />
                <div className="w-1 bg-[#1ed760] rounded-full animate-[bounce_1.1s_infinite_0.2s] h-5" />
                <div className="w-1 bg-[#1ed760] rounded-full animate-[bounce_0.7s_infinite_0.4s] h-3" />
                <div className="w-1 bg-[#1ed760] rounded-full animate-[bounce_1.2s_infinite_0.1s] h-5" />
                <div className="w-1 bg-[#1ed760] rounded-full animate-[bounce_0.9s_infinite_0.3s] h-4" />
              </div>
            </div>
          )}

          {/* Left / Right Tap zones for navigation */}
          <div
            onClick={handlePrevTrack}
            className="absolute inset-y-16 left-0 w-1/4 cursor-pointer z-20 group flex items-center justify-start pl-2"
            title="Anterior (o pulsa ←)"
          >
            <div className="w-8 h-8 rounded-full bg-black/40 text-white/70 group-hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md">
              ‹
            </div>
          </div>
          <div
            onClick={handleNextTrack}
            className="absolute inset-y-16 right-0 w-1/4 cursor-pointer z-20 group flex items-center justify-end pr-2"
            title="Siguiente (o pulsa →)"
          >
            <div className="w-8 h-8 rounded-full bg-black/40 text-white/70 group-hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md">
              ›
            </div>
          </div>
        </div>

        {/* Bottom Metadata & "Escuchar la canción completa" Button */}
        <div className="relative z-30 p-4 bg-gradient-to-t from-black via-black/90 to-transparent space-y-3 pt-6 border-t border-white/5">
          <div className="min-w-0">
            <h3 className="text-base font-black text-white font-['SpotifyMixUITitle'] truncate drop-shadow">
              {currentTrack.name}
            </h3>
            <p className="text-xs font-semibold text-[#b3b3b3] truncate mt-0.5">
              {currentTrack.artists?.map((a) => a.name).join(', ') || 'Artista desconocido'}
            </p>
          </div>

          {/* Full Song Button */}
          <button
            onClick={() => {
              onPlayFullTrack(currentTrack, tracks);
              onClose();
            }}
            className="w-full py-3 px-4 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-102 active:scale-98 text-black font-extrabold text-xs tracking-wide uppercase flex items-center justify-center gap-2 shadow-xl shadow-[#1ed760]/20 transition-all cursor-pointer"
          >
            <PlayNativeIcon size={16} className="text-black fill-current" />
            <span>Escuchar la canción completa</span>
          </button>
        </div>
      </div>
    </div>
  );
};
