import React, { useRef, useState, useEffect } from 'react';
import {
  AddTrackNativeIcon,
  CheckTrackNativeIcon,
  ShuffleNativeIcon,
  SmartShuffleNativeIcon,
  PrevNativeIcon,
  PlayNativeIcon,
  PauseNativeIcon,
  NextNativeIcon,
  RepeatNativeIcon,
  RepeatOneNativeIcon,
  MiniplayerNativeIcon,
  LyricsNativeIcon,
  QueueNativeIcon,
  DeviceNativeIcon,
  VolumeNativeIcon,
  FullscreenNativeIcon,
} from '../icons/SpotifyNativeIcons';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '../../store/useUIStore';
import { formatDuration, toHDImage } from '../../utils/formatters';
import { audioEngine } from '../../services/audioEngine';
import { getTrackCoverUrl, resolveTrackCoversBatch, isPlaylistOrGenericCover } from '../../utils/trackCovers';
import { handleImageError } from '../../utils/imageFallback';
import { parseTrackArtists } from '../../utils/trackArtists';
import { openSleepTimerSheet, useSleepTimer } from '../../services/sleepTimer';

interface DesktopPlayerProps {
  onSelectPlaylistById?: (id: string, customName?: string, customImage?: string) => void;
}

export const DesktopPlayer: React.FC<DesktopPlayerProps> = ({ onSelectPlaylistById }) => {
  const sleepActive = useSleepTimer((s) => s.endsAt !== null || Boolean(s.trackId));
  const {
    currentTrack,
    isPlaying,
    progressMs,
    durationMs,
    volume,
    isMuted,
    shuffleMode,
    repeatMode,
    likedTrackIds,
    nextTrack,
    previousTrack,
    setProgress,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    toggleLike,
    queue,
  } = usePlayerStore(
    useShallow((s) => ({ currentTrack: s.currentTrack, isPlaying: s.isPlaying, progressMs: s.progressMs, durationMs: s.durationMs, volume: s.volume, isMuted: s.isMuted, shuffleMode: s.shuffleMode, repeatMode: s.repeatMode, likedTrackIds: s.likedTrackIds, nextTrack: s.nextTrack, previousTrack: s.previousTrack, setProgress: s.setProgress, setVolume: s.setVolume, toggleMute: s.toggleMute, toggleShuffle: s.toggleShuffle, toggleRepeat: s.toggleRepeat, toggleLike: s.toggleLike, queue: s.queue }))
  );

  const [resolvedDesktopCover, setResolvedDesktopCover] = useState<string | undefined>(() => {
    return currentTrack ? getTrackCoverUrl(currentTrack) : undefined;
  });

  useEffect(() => {
    if (!currentTrack) return;
    const direct = getTrackCoverUrl(currentTrack);
    if (direct && !isPlaylistOrGenericCover(direct)) {
      setResolvedDesktopCover(direct);
      return;
    }
    resolveTrackCoversBatch([currentTrack]).then((updates) => {
      const fresh = updates.get(currentTrack.id) || getTrackCoverUrl(currentTrack);
      if (fresh && !isPlaylistOrGenericCover(fresh)) setResolvedDesktopCover(fresh);
    }).catch(() => {});
  }, [currentTrack?.id, currentTrack?.name]);

  const activeArtworkUrl =
    (resolvedDesktopCover && !isPlaylistOrGenericCover(resolvedDesktopCover) ? resolvedDesktopCover : undefined) ||
    (currentTrack ? getTrackCoverUrl(currentTrack) : undefined) ||
    (!isPlaylistOrGenericCover(currentTrack?.album?.images?.[0]?.url) ? currentTrack?.album?.images?.[0]?.url : undefined) ||
    'https://i.scdn.co/image/ab67616d0000b273809e5975e533b8fb328325dd';

  const { toggleRightSidebar, activeRightSidebar } = useUIStore();

  const [isHoveringProgress, setIsHoveringProgress] = useState(false);
  const [isHoveringVolume, setIsHoveringVolume] = useState(false);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [dragProgressPercent, setDragProgressPercent] = useState<number | null>(null);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const volumeBarRef = useRef<HTMLDivElement>(null);
  const isSeekingRef = useRef(false);
  const progressMsRef = useRef(progressMs);
  const lastPlayedTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    progressMsRef.current = progressMs;
  }, [progressMs]);

  // 1. Play track from 0:00 on Native Audio Engine (0% Ads, Never Stalls, Desktop + Mobile)
  useEffect(() => {
    if (!currentTrack) return;
    if (lastPlayedTrackIdRef.current === currentTrack.id) return;
    lastPlayedTrackIdRef.current = currentTrack.id;

    setProgress(0);
    const artistName = currentTrack.artists?.[0]?.name || '';
    const query = `${currentTrack.name} ${artistName}`;

    if (audioEngine.getCurrentTrackId() !== currentTrack.id) {
      audioEngine.playTrack(currentTrack.id, query, 0);
    }

    // Preload next tracks in background for instantaneous zero-delay switching
    if (queue && queue.length > 0) {
      const currIdx = queue.findIndex((t) => t.id === currentTrack.id);
      setTimeout(() => {
        for (let offset = 1; offset <= 2; offset++) {
          const nextIdx = (currIdx + offset) % queue.length;
          const upcoming = queue[nextIdx];
          if (upcoming && upcoming.id !== currentTrack.id) {
            const nextQuery = `${upcoming.name} ${upcoming.artists?.[0]?.name || ''}`;
            audioEngine.preloadTrack(upcoming.id, nextQuery);
          }
        }
      }, 150);
    }
  }, [currentTrack?.id]);

  // 2. Play / Pause Control
  const handleTogglePlay = () => {
    audioEngine.togglePlay();
  };

  const handlePreviousTrack = () => {
    if (progressMs > 3000) {
      setProgress(0);
      audioEngine.seek(0);
      return;
    }
    previousTrack();
  };

  // 3. Volume & Mute Sync
  useEffect(() => {
    audioEngine.setVolume(volume);
    audioEngine.setMuted(isMuted);
  }, [volume, isMuted]);

  const isLiked = currentTrack ? likedTrackIds.includes(currentTrack.id) : false;
  const progressPercent = durationMs > 0 ? (progressMs / durationMs) * 100 : 0;
  const effectiveProgressPercent = dragProgressPercent !== null ? dragProgressPercent : progressPercent;
  const volumePercent = isMuted ? 0 : volume * 100;

  // Real-time Scrubbing & Dragging Handlers
  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || durationMs <= 0) return;
    setIsDraggingProgress(true);
    isSeekingRef.current = true;
    const rect = progressBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setDragProgressPercent(ratio * 100);
    const targetMs = ratio * durationMs;
    setProgress(targetMs);
    audioEngine.seek(targetMs / 1000);
  };

  useEffect(() => {
    if (!isDraggingProgress) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!progressBarRef.current || durationMs <= 0) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setDragProgressPercent(ratio * 100);
      setProgress(ratio * durationMs);
    };

    const handleMouseUp = (e: MouseEvent) => {
      setIsDraggingProgress(false);
      if (!progressBarRef.current || durationMs <= 0) {
        setDragProgressPercent(null);
        isSeekingRef.current = false;
        return;
      }
      const rect = progressBarRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const targetMs = ratio * durationMs;
      const targetSec = targetMs / 1000;
      setDragProgressPercent(null);
      setProgress(targetMs);
      audioEngine.seek(targetSec);

      setTimeout(() => {
        isSeekingRef.current = false;
      }, 300);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingProgress, durationMs, setProgress]);

  // Real-time Volume Dragging Handlers
  const handleVolumeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!volumeBarRef.current) return;
    setIsDraggingVolume(true);
    const rect = volumeBarRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(ratio);
  };

  useEffect(() => {
    if (!isDraggingVolume) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!volumeBarRef.current) return;
      const rect = volumeBarRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setVolume(ratio);
    };

    const handleMouseUp = (e: MouseEvent) => {
      setIsDraggingVolume(false);
      if (!volumeBarRef.current) return;
      const rect = volumeBarRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setVolume(ratio);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingVolume, setVolume]);

  return (
    <footer className="h-[72px] w-full bg-black px-4 flex items-center justify-between select-none z-50 shrink-0">
      {/* Left: Track Details + Add Button (+) */}
      <div className="flex items-center gap-3.5 w-[30%] min-w-[180px] overflow-hidden">
        {currentTrack ? (
          <>
            <div
              onClick={() => {
                const albId = currentTrack.album?.id || (currentTrack as any).playlistId;
                if (albId) onSelectPlaylistById?.(albId, currentTrack.album?.name);
              }}
              className="w-14 h-14 rounded overflow-hidden shrink-0 shadow cursor-pointer group"
            >
              <img
                src={toHDImage(activeArtworkUrl)}
                alt={currentTrack.name}
                onError={handleImageError}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            </div>
            <div className="flex flex-col min-w-0 mr-1">
              <span
                onClick={() => {
                  const albId = currentTrack.album?.id || (currentTrack as any).playlistId;
                  if (albId) onSelectPlaylistById?.(albId, currentTrack.album?.name);
                }}
                className="text-white text-[13px] font-medium hover:underline cursor-pointer truncate leading-tight"
              >
                {currentTrack.name}
              </span>
              <span className="text-[#b3b3b3] text-[11px] truncate mt-0.5">
                {(() => {
                  const parsed = parseTrackArtists(currentTrack.artists);
                  return parsed.map((a, i) => (
                    <span
                      key={a.id || i}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPlaylistById?.(a.id, a.name);
                      }}
                      className="hover:underline hover:text-white cursor-pointer"
                    >
                      {a.name}{i < parsed.length - 1 ? ', ' : ''}
                    </span>
                  ));
                })()}
              </span>
            </div>

            {/* Official Modern Spotify Add Track button (+) or Checked circle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!currentTrack) return;
                if (!isLiked) {
                  toggleLike(currentTrack.id, currentTrack);
                }
                useUIStore.getState().openAddToPlaylistModal(currentTrack);
              }}
              className={`transition-transform active:scale-90 p-1 shrink-0 ${
                isLiked ? 'text-[#1ed760]' : 'text-[#b3b3b3] hover:text-white'
              }`}
              title={isLiked ? "Añadida a tus playlists" : "Añadir a playlist"}
            >
              {isLiked ? (
                <CheckTrackNativeIcon size={16} className="text-[#1ed760]" />
              ) : (
                <AddTrackNativeIcon size={16} className="text-[#b3b3b3] hover:text-white" />
              )}
            </button>
          </>
        ) : (
          <div className="w-14 h-14 rounded bg-[#181818] shrink-0 opacity-40 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#535353">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}
      </div>

      {/* Center: Playback Controls & Scrubber */}
      <div className="flex flex-col items-center max-w-[720px] w-[40%]">
        {/* Buttons Row (Exactly 5 buttons with Play perfectly centered) */}
        <div className="flex items-center gap-4 mb-1.5">
          <button
            onClick={toggleShuffle}
            title={
              shuffleMode === 'smart'
                ? 'Aleatorio inteligente activado'
                : shuffleMode === 'all'
                ? 'Aleatorio activado'
                : 'Habilitar reproducción aleatoria'
            }
            className={`transition-colors p-1 relative flex flex-col items-center ${
              shuffleMode !== 'off' ? 'text-spotify-green' : 'text-[#b3b3b3] hover:text-white'
            }`}
          >
            {shuffleMode === 'smart' ? (
              <SmartShuffleNativeIcon size={16} className="text-spotify-green" />
            ) : (
              <ShuffleNativeIcon size={16} className={shuffleMode === 'all' ? 'text-spotify-green' : 'text-[#b3b3b3] hover:text-white'} />
            )}
          </button>

          <button
            onClick={handlePreviousTrack}
            title="Anterior"
            className="text-[#b3b3b3] hover:text-white transition-colors p-1"
          >
            <PrevNativeIcon size={16} className="text-[#b3b3b3] hover:text-white" />
          </button>

          <button
            onClick={handleTogglePlay}
            title={isPlaying ? "Pausa" : "Reproducir"}
            className="w-8 h-8 rounded-full bg-white flex items-center justify-center hover:scale-106 active:scale-95 transition-transform shadow-md"
          >
            {isPlaying ? (
              <PauseNativeIcon size={14} className="text-black" />
            ) : (
              <PlayNativeIcon size={14} className="text-black ml-0.5" />
            )}
          </button>

          <button
            onClick={nextTrack}
            title="Siguiente"
            className="text-[#b3b3b3] hover:text-white transition-colors p-1"
          >
            <NextNativeIcon size={16} className="text-[#b3b3b3] hover:text-white" />
          </button>

          <button
            onClick={toggleRepeat}
            title={
              repeatMode === 'one'
                ? 'Repetir una canción'
                : repeatMode === 'all'
                ? 'Repetir todo activado'
                : 'Activar repetir'
            }
            className={`transition-colors p-1 relative flex flex-col items-center ${
              repeatMode !== 'off' ? 'text-spotify-green' : 'text-[#b3b3b3] hover:text-white'
            }`}
          >
            {repeatMode === 'one' ? (
              <RepeatOneNativeIcon size={16} className="text-spotify-green" />
            ) : (
              <RepeatNativeIcon size={16} className={repeatMode === 'all' ? 'text-spotify-green' : 'text-[#b3b3b3] hover:text-white'} />
            )}
          </button>
        </div>

        {/* Scrubber Time Bar with exact Spotify tabular font and styling */}
        <div className="w-full flex items-center gap-2 font-['SpotifyMixUI'] tabular-nums text-[11px] font-normal text-[#a7a7a7]">
          <span className="w-8 text-right select-none">{formatDuration(progressMs)}</span>

          <div
            ref={progressBarRef}
            onMouseDown={handleProgressMouseDown}
            onMouseEnter={() => setIsHoveringProgress(true)}
            onMouseLeave={() => setIsHoveringProgress(false)}
            className="group relative flex-1 h-3 flex items-center cursor-pointer"
          >
            <div className="w-full h-[4px] bg-[#4d4d4d] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-colors ${
                  isHoveringProgress || isDraggingProgress ? 'bg-spotify-green' : 'bg-white'
                }`}
                style={{ width: `${effectiveProgressPercent}%` }}
              />
            </div>

            <div
              className={`absolute w-3 h-3 bg-white rounded-full shadow-md -ml-1.5 transition-opacity ${
                isHoveringProgress || isDraggingProgress ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ left: `${effectiveProgressPercent}%` }}
            />
          </div>

          <span className="w-8 select-none">{formatDuration(durationMs)}</span>
        </div>
      </div>

      {/* Right: Extras & Volume */}
      <div className="flex items-center justify-end gap-2.5 w-[30%] min-w-[180px]">
        {/* Vista En reproducción (Spotify Canvas & Now Playing View) */}
        <button
          onClick={() => toggleRightSidebar('now-playing')}
          className={`p-1 relative flex flex-col items-center transition-colors cursor-pointer ${
            activeRightSidebar === 'now-playing' ? 'text-[#1ed760]' : 'text-[#b3b3b3] hover:text-white'
          }`}
          title="Vista En reproducción (Canvas y detalles)"
        >
          <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.196 8 6 5.03v5.94z" />
            <path d="M15 1H1v14h14zM2 14V2h12v12z" />
          </svg>
        </button>

        <button
          onClick={() => toggleRightSidebar('lyrics')}
          className={`p-1 relative flex flex-col items-center transition-colors ${
            activeRightSidebar === 'lyrics' ? 'text-[#1ed760]' : 'text-[#b3b3b3] hover:text-white'
          }`}
          title="Letra"
        >
          <LyricsNativeIcon size={16} className={activeRightSidebar === 'lyrics' ? 'text-[#1ed760]' : 'text-[#b3b3b3] hover:text-white'} />
        </button>

        <button
          onClick={() => toggleRightSidebar('queue')}
          className={`p-1 relative flex flex-col items-center transition-colors ${
            activeRightSidebar === 'queue' ? 'text-[#1ed760]' : 'text-[#b3b3b3] hover:text-white'
          }`}
          title="Cola"
        >
          <QueueNativeIcon size={16} className={activeRightSidebar === 'queue' ? 'text-[#1ed760]' : 'text-[#b3b3b3] hover:text-white'} />
        </button>

        {/* Temporizador de apagado */}
        <button
          onClick={openSleepTimerSheet}
          className={`p-1 relative flex flex-col items-center transition-colors ${sleepActive ? 'text-[#1ed760]' : 'text-[#b3b3b3] hover:text-white'}`}
          title={sleepActive ? 'Temporizador de apagado (activado)' : 'Temporizador de apagado'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12.34 2.02A10 10 0 1 0 21.98 11.7a.75.75 0 0 0-1.2-.65 6.5 6.5 0 0 1-9.06-9.06.75.75 0 0 0-.66-1.2zM9.2 4.1a8 8 0 0 0 10.7 10.7A8.5 8.5 0 1 1 9.2 4.1z" />
          </svg>
          {sleepActive && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#1ed760]" />}
        </button>

        <button
          onClick={() => {}}
          className="text-[#b3b3b3] hover:text-[#1ed760] transition-colors p-1"
          title="Conectado a: Este ordenador (Altavoces estéreo)"
        >
          <DeviceNativeIcon size={16} className="currentColor" />
        </button>

        {/* Volume */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleMute}
            className="text-[#b3b3b3] hover:text-white transition-colors p-1"
            title={isMuted ? "Reactivar audio" : "Silenciar"}
          >
            <VolumeNativeIcon size={16} className="text-[#b3b3b3] hover:text-white" />
          </button>

          <div
            ref={volumeBarRef}
            onMouseDown={handleVolumeMouseDown}
            onMouseEnter={() => setIsHoveringVolume(true)}
            onMouseLeave={() => setIsHoveringVolume(false)}
            className="group relative w-20 h-3 flex items-center cursor-pointer"
          >
            <div className="w-full h-[3px] bg-[#4d4d4d] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-colors ${
                  isHoveringVolume || isDraggingVolume ? 'bg-spotify-green' : 'bg-white'
                }`}
                style={{ width: `${volumePercent}%` }}
              />
            </div>
            <div
              className={`absolute w-2.5 h-2.5 bg-white rounded-full shadow -ml-1 transition-opacity ${
                isHoveringVolume || isDraggingVolume ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ left: `${volumePercent}%` }}
            />
          </div>
        </div>

        {/* Miniplayer button */}
        <button
          onClick={() => {}}
          className="text-[#b3b3b3] hover:text-white transition-colors p-1"
          title="Abrir el Minirreproductor"
        >
          <MiniplayerNativeIcon size={16} className="text-[#b3b3b3] hover:text-white" />
        </button>

        <button
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen?.().catch(() => {});
            } else {
              document.exitFullscreen?.().catch(() => {});
            }
          }}
          className="text-[#b3b3b3] hover:text-white transition-colors p-1"
          title="Pantalla completa"
        >
          <FullscreenNativeIcon size={16} className="text-[#b3b3b3] hover:text-white" />
        </button>
      </div>
    </footer>
  );
};
