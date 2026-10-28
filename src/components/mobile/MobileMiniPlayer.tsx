import React from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { PlayNativeIcon, PauseNativeIcon, AddTrackNativeIcon, CheckTrackNativeIcon } from '../icons/SpotifyNativeIcons';
import { handleImageError } from '../../utils/imageFallback';

interface MobileMiniPlayerProps {
  onOpenFullPlayer: () => void;
}

export const MobileMiniPlayer: React.FC<MobileMiniPlayerProps> = ({ onOpenFullPlayer }) => {
  const { currentTrack, isPlaying, togglePlay, progressMs, durationMs, likedTrackIds, toggleLike } = usePlayerStore();

  if (!currentTrack) return null;

  const isLiked = likedTrackIds.includes(currentTrack.id);
  const percent = durationMs > 0 ? Math.min(100, Math.max(0, (progressMs / durationMs) * 100)) : 0;
  const coverUrl = currentTrack.album?.images?.[0]?.url;

  return (
    <div
      onClick={onOpenFullPlayer}
      className="fixed bottom-[74px] left-2 right-2 h-14 rounded-lg shadow-2xl z-40 flex items-center justify-between px-2.5 overflow-hidden border border-white/10 cursor-pointer select-none transition-all active:scale-[0.99] font-['SpotifyMixUI'] pointer-events-auto"
      style={{
        backgroundColor: 'rgba(34, 34, 34, 0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* 2px bottom progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-white/10">
        <div
          className="h-full bg-white transition-all duration-300 ease-linear rounded-r"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Left: Artwork + Title + Artist */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
        <div className="w-10 h-10 rounded shrink-0 overflow-hidden bg-[#181818] shadow">
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

        <div className="flex flex-col min-w-0">
          <span className="font-bold text-white text-xs truncate">
            {currentTrack.name}
          </span>
          <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
            <span className="text-[11px] text-[#b3b3b3] truncate">
              {currentTrack.artists?.map((a) => a.name).join(', ') || 'Spotify'}
            </span>
            {isPlaying && (
              <span className="text-[10px] font-bold text-[#1ed760] shrink-0 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760] animate-pulse" />
                <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11 1.5H5a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 5 14.5h6a1.5 1.5 0 0 0 1.5-1.5V3A1.5 1.5 0 0 0 11 1.5zM5 2.5h6a.5.5 0 0 1 .5.5v9H4.5V3a.5.5 0 0 1 .5-.5zm3 11a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z" />
                </svg>
                <span>Este teléfono</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right Controls: Device + Heart + Play/Pause */}
      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          className="w-8 h-8 flex items-center justify-center text-[#1ed760]"
          title="Escuchando en este teléfono"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11 1.5H5a1.5 1.5 0 0 0-1.5 1.5v10A1.5 1.5 0 0 0 5 14.5h6a1.5 1.5 0 0 0 1.5-1.5V3A1.5 1.5 0 0 0 11 1.5zM5 2.5h6a.5.5 0 0 1 .5.5v9H4.5V3a.5.5 0 0 1 .5-.5zm3 11a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5z" />
          </svg>
        </button>

        <button
          onClick={() => toggleLike(currentTrack.id)}
          className="w-8 h-8 flex items-center justify-center text-[#b3b3b3] hover:text-white transition-colors"
          title={isLiked ? 'Quitar de tus favoritos' : 'Guardar en tus favoritos'}
        >
          {isLiked ? (
            <CheckTrackNativeIcon size={20} className="text-[#1ed760]" />
          ) : (
            <AddTrackNativeIcon size={20} />
          )}
        </button>

        <button
          onClick={togglePlay}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform"
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
