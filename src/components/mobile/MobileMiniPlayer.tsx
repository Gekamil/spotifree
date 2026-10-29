import React, { useState } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import {
  PlayNativeIcon,
  PauseNativeIcon,
  AddTrackNativeIcon,
  CheckTrackNativeIcon,
} from '../icons/SpotifyNativeIcons';
import { handleImageError } from '../../utils/imageFallback';
import { resolveVibrantColor } from '../../utils/spotifyColor';

interface MobileMiniPlayerProps {
  onOpenFullPlayer: () => void;
}

function getDarkenedThemeColor(colorHex: string, factor = 0.28): string {
  if (!colorHex || !colorHex.startsWith('#')) return '#222222';
  let hex = colorHex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const num = parseInt(hex, 16);
  if (isNaN(num)) return '#222222';
  const r = Math.round(((num >> 16) & 255) * factor + 18 * (1 - factor));
  const g = Math.round(((num >> 8) & 255) * factor + 18 * (1 - factor));
  const b = Math.round((num & 255) * factor + 18 * (1 - factor));
  return `rgb(${r}, ${g}, ${b})`;
}

export const MobileMiniPlayer: React.FC<MobileMiniPlayerProps> = ({ onOpenFullPlayer }) => {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    nextTrack,
    previousTrack,
    progressMs,
    durationMs,
    likedTrackIds,
    toggleLike,
  } = usePlayerStore();

  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  if (!currentTrack) return null;

  const isLiked = likedTrackIds.includes(currentTrack.id);
  const percent = durationMs > 0 ? Math.min(100, Math.max(0, (progressMs / durationMs) * 100)) : 0;
  const coverUrl = currentTrack.album?.images?.[0]?.url;

  const vibrantBase = resolveVibrantColor(currentTrack.id, currentTrack.name);
  const cardBgColor = getDarkenedThemeColor(vibrantBase, 0.32);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return;
    const diff = touchStartX - touchEndX;
    if (diff > 45) {
      nextTrack();
    } else if (diff < -45) {
      previousTrack();
    }
    setTouchStartX(null);
    setTouchEndX(null);
  };

  return (
    <div
      onClick={onOpenFullPlayer}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      data-testid="mobile-mini-player"
      className="fixed bottom-[60px] left-2 right-2 h-14 rounded-[8px] z-40 flex items-center justify-between px-2 overflow-hidden cursor-pointer select-none transition-all active:scale-[0.99] font-['SpotifyMixUI'] pointer-events-auto shadow-[0_8px_24px_rgba(0,0,0,0.65)] border border-white/[0.08]"
      style={{
        backgroundColor: cardBgColor,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* 2px Bottom Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/20 rounded-b-[8px] overflow-hidden pointer-events-none">
        <div
          className="h-full bg-white transition-all duration-200 ease-linear"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Left: Artwork + Track details */}
      <div className="flex items-center min-w-0 flex-1 mr-1">
        <div className="w-10 h-10 rounded-[4px] shrink-0 overflow-hidden bg-[#181818] shadow-md ml-0.5">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={currentTrack.name}
              onError={handleImageError}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/40">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-center min-w-0 ml-2.5 flex-1 pr-1 overflow-hidden">
          <div className="overflow-hidden whitespace-nowrap w-full">
            <span
              className={`font-bold text-white text-[13px] leading-tight ${
                (currentTrack.name || '').length > 20 && isPlaying
                  ? 'animate-spotify-marquee'
                  : 'truncate block'
              }`}
            >
              {currentTrack.name}
            </span>
          </div>
          <span className="text-[11.5px] text-white/70 truncate leading-tight mt-0.5">
            {currentTrack.artists?.map((a) => a.name).join(', ') || 'Spotify'}
          </span>
        </div>
      </div>

      {/* Right Controls: Device + Heart + Play/Pause */}
      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* Device indicator button */}
        <button
          className="w-8 h-8 flex items-center justify-center text-[#1ed760] hover:scale-105 active:scale-95 transition-transform"
          title="Escuchando en este teléfono"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11 1.5H5a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 5 14.5h6a1.5 1.5 0 0 0 1.5-1.5V3A1.5 1.5 0 0 0 11 1.5zM5 2.5h6a.5.5 0 0 1 .5.5v9H4.5V3a.5.5 0 0 1 .5-.5zm3 11a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z" />
          </svg>
        </button>

        {/* Favorite / Like button */}
        <button
          onClick={() => toggleLike(currentTrack.id)}
          className="w-8 h-8 flex items-center justify-center text-[#b3b3b3] hover:text-white active:scale-95 transition-transform"
          title={isLiked ? 'Quitar de tus favoritos' : 'Guardar en tus favoritos'}
        >
          {isLiked ? (
            <CheckTrackNativeIcon size={20} className="text-[#1ed760]" />
          ) : (
            <AddTrackNativeIcon size={20} className="text-white/80" />
          )}
        </button>

        {/* Play/Pause button */}
        <button
          onClick={togglePlay}
          className="w-9 h-9 flex items-center justify-center text-white active:scale-90 transition-transform"
          title={isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {isPlaying ? (
            <PauseNativeIcon size={22} className="text-white" />
          ) : (
            <PlayNativeIcon size={22} className="text-white ml-0.5" />
          )}
        </button>
      </div>
    </div>
  );
};
