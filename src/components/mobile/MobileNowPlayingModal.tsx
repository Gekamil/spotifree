import React from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import {
  PlayNativeIcon,
  PauseNativeIcon,
  NextNativeIcon,
  PrevNativeIcon,
  ShuffleNativeIcon,
  RepeatNativeIcon,
  AddTrackNativeIcon,
  CheckTrackNativeIcon,
} from '../icons/SpotifyNativeIcons';
import { formatDuration } from '../../utils/formatters';
import { resolveVibrantColor } from '../../utils/spotifyColor';
import { handleImageError } from '../../utils/imageFallback';

interface MobileNowPlayingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileNowPlayingModal: React.FC<MobileNowPlayingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    nextTrack,
    previousTrack,
    progressMs,
    durationMs,
    setProgress,
    isShuffle,
    toggleShuffle,
    repeatMode,
    toggleRepeat,
    likedTrackIds,
    toggleLike,
  } = usePlayerStore();

  if (!isOpen || !currentTrack) return null;

  const isLiked = likedTrackIds.includes(currentTrack.id);
  const coverUrl = currentTrack.album?.images?.[0]?.url;
  const percent = durationMs > 0 ? Math.min(100, Math.max(0, (progressMs / durationMs) * 100)) : 0;
  const themeColor = resolveVibrantColor(currentTrack.id, currentTrack.name);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    const newMs = (val / 100) * durationMs;
    setProgress(newMs);
    if (typeof window !== 'undefined' && (window as any).__audioEngine) {
      (window as any).__audioEngine.seek(newMs / 1000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-between px-6 pt-4 pb-8 select-none font-['SpotifyMixUI'] animate-in slide-in-from-bottom duration-300"
      style={{
        background: `linear-gradient(180deg, ${themeColor} 0%, rgba(18, 18, 18, 0.96) 420px, #121212 100%)`,
      }}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between text-white py-2">
        <button
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
          title="Minimizar"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 15.5l-6-6 1.41-1.41L12 12.67l4.59-4.58L18 9.5z" />
          </svg>
        </button>

        <div className="flex flex-col items-center max-w-[200px]">
          <span className="text-[10px] uppercase font-bold text-white/60 tracking-wider">
            REPRODUCIENDO DE LA LISTA
          </span>
          <span className="text-xs font-bold text-white truncate w-full text-center">
            {currentTrack.album?.name || 'Spotify'}
          </span>
        </div>

        <button
          className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white"
          title="Más opciones"
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm6.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM16 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
          </svg>
        </button>
      </div>

      {/* Large Artwork */}
      <div className="flex-1 flex items-center justify-center py-4 my-auto">
        <div className="w-full max-w-[340px] aspect-square rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.7)] bg-[#242424]">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={currentTrack.name}
              onError={handleImageError}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/40">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Title & Artist & Like */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 mr-4">
            <h1 className="text-2xl font-black text-white truncate font-['SpotifyMixUITitle']">
              {currentTrack.name}
            </h1>
            <p className="text-base text-[#b3b3b3] truncate mt-0.5">
              {currentTrack.artists?.map((a) => a.name).join(', ') || 'Spotify'}
            </p>
          </div>
          <button
            onClick={() => toggleLike(currentTrack.id)}
            className="w-10 h-10 flex items-center justify-center text-[#b3b3b3] hover:text-white transition-colors"
          >
            {isLiked ? (
              <CheckTrackNativeIcon size={26} className="text-[#1ed760]" />
            ) : (
              <AddTrackNativeIcon size={26} />
            )}
          </button>
        </div>

        {/* Scrub Bar */}
        <div className="space-y-1">
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={percent}
            onChange={handleSeek}
            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white hover:accent-[#1ed760]"
          />
          <div className="flex justify-between text-[11px] text-[#b3b3b3] font-mono">
            <span>{formatDuration(progressMs)}</span>
            <span>{formatDuration(durationMs)}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={toggleShuffle}
            className={`w-10 h-10 flex items-center justify-center transition-colors ${
              isShuffle ? 'text-[#1ed760]' : 'text-[#b3b3b3]'
            }`}
          >
            <ShuffleNativeIcon size={22} />
          </button>

          <button
            onClick={previousTrack}
            className="w-12 h-12 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform"
          >
            <PrevNativeIcon size={26} />
          </button>

          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-106 active:scale-95 shadow-2xl transition-transform"
          >
            {isPlaying ? (
              <PauseNativeIcon size={28} className="text-black" />
            ) : (
              <PlayNativeIcon size={28} className="text-black ml-1" />
            )}
          </button>

          <button
            onClick={nextTrack}
            className="w-12 h-12 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform"
          >
            <NextNativeIcon size={26} />
          </button>

          <button
            onClick={toggleRepeat}
            className={`w-10 h-10 flex items-center justify-center transition-colors ${
              repeatMode !== 'off' ? 'text-[#1ed760]' : 'text-[#b3b3b3]'
            }`}
          >
            <RepeatNativeIcon size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};
