import React, { useState, useEffect, useRef } from 'react';
import type { Track } from '../../types/spotify';
import { SpotifyDJVisualizer } from './SpotifyDJVisualizer';
import { useAIDJStore } from '../../services/aiDJService';
import { usePlayerStore } from '../../store/usePlayerStore';
import { PlayNativeIcon, PauseNativeIcon } from '../icons/SpotifyNativeIcons';
import { ClockIcon } from '../icons/SpotifyIcons';
import { formatDuration } from '../../utils/formatters';

interface AIDJViewProps {
  onBack: () => void;
  isMobile?: boolean;
}

const TrackArtwork: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div className="w-10 h-10 rounded shrink-0 bg-[#282828] flex items-center justify-center text-[#727272] shadow">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setError(true)}
      referrerPolicy="no-referrer"
      className="w-10 h-10 rounded shrink-0 object-cover shadow"
    />
  );
};

export const AIDJView: React.FC<AIDJViewProps> = ({ onBack, isMobile = false }) => {
  const {
    visualizerState,
    voiceLevel,
    displayedTranscript,
    currentMessage,
    isMicListening,
    djTracks,
    startDJSession,
    startVoiceListening,
    stopVoiceListening,
  } = useAIDJStore();

  const { currentTrack, isPlaying, playTrack, togglePlay, queue } = usePlayerStore();
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      startDJSession();
    }
  }, [startDJSession]);

  const toggleMic = () => {
    if (isMicListening) {
      stopVoiceListening();
    } else {
      startVoiceListening();
    }
  };

  const tracksToDisplay: Track[] = djTracks && djTracks.length > 0 ? djTracks : queue;
  const subtitleToShow = displayedTranscript || currentMessage;

  const handleTrackClick = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track, tracksToDisplay, 'dj-session');
    }
  };

  return (
    <div className="relative w-full min-h-full bg-[#070709] text-white flex flex-col select-none font-['SpotifyMixUI']">
      {/* Background Soft Aura Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-[#00f2fe]/10 via-[#0d72ea]/10 to-[#1ed760]/10 rounded-full blur-[140px] opacity-70" />
      </div>

      {/* 1. Spotify Top Navigation Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 bg-[#070709]/95 backdrop-blur-md shrink-0 border-b border-white/5">
        {/* Standard Clean Spotify Back Button (<) */}
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 flex items-center justify-center text-[#b3b3b3] hover:text-white transition-colors cursor-pointer active:scale-95 shadow-sm"
          title="Atrás"
        >
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M11.03.47a.75.75 0 0 1 0 1.06L4.56 8l6.47 6.47a.75.75 0 1 1-1.06 1.06L2.44 8 9.97.47a.75.75 0 0 1 1.06 0" />
          </svg>
        </button>

        {/* Animated Moving DJ Indicator Badge */}
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 shadow-sm backdrop-blur-md">
          <div className="flex items-end gap-[2px] h-3.5 pb-0.5">
            <span className="w-[2.5px] bg-[#1ed760] rounded-full animate-spotify-eq-1" />
            <span className="w-[2.5px] bg-[#00f2fe] rounded-full animate-spotify-eq-2" />
            <span className="w-[2.5px] bg-[#1ed760] rounded-full animate-spotify-eq-3" />
          </div>
          <span className="text-xs font-black tracking-widest uppercase text-white font-['SpotifyMixUITitle']">
            DJ
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760] animate-pulse" />
        </div>
      </header>

      {/* 2. Fluid Morphing Orb Visualizer & Spoken Subtitles */}
      <section className="relative z-10 flex flex-col items-center justify-center pt-1 pb-4 px-4 text-center shrink-0">
        <div
          onClick={toggleMic}
          className="cursor-pointer transition-transform hover:scale-102 active:scale-98 relative group"
          title={isMicListening ? 'Escuchando... haz clic para detener' : 'Haz clic en el DJ para hablar'}
        >
          <SpotifyDJVisualizer
            size={isMobile ? 160 : 200}
            state={visualizerState}
            voiceLevel={voiceLevel}
          />
        </div>

        {/* Dynamic Spoken Text & Subtitles */}
        <div className="min-h-[44px] max-w-xl flex items-center justify-center px-4 mt-1">
          <p className="text-base md:text-lg font-bold tracking-tight text-white leading-snug drop-shadow font-['SpotifyMixUITitle'] transition-all">
            {subtitleToShow ? (
              <span>{subtitleToShow}</span>
            ) : (
              <span className="text-[#a7a7a7] text-sm font-normal">
                Haz clic en el DJ para hablar o disfruta de tu mezcla...
              </span>
            )}
          </p>
        </div>
      </section>

      {/* 3. Playlist Tracklist (Real Spotify Playlist Layout) */}
      <section className="relative z-10 flex-1 px-4 md:px-8 pb-32 max-w-5xl mx-auto w-full">
        {/* Table Header */}
        <div className="grid grid-cols-[20px_4fr_3fr_minmax(60px,1fr)] gap-4 px-4 py-2 border-b border-white/10 text-xs font-semibold text-[#b3b3b3] uppercase tracking-wider sticky top-14 bg-[#070709]/95 backdrop-blur-md z-20">
          <div className="text-center">#</div>
          <div>Título</div>
          <div>Álbum</div>
          <div className="text-right pr-2">
            <ClockIcon size={16} className="inline-block" />
          </div>
        </div>

        {/* Tracks List */}
        <div className="mt-2 space-y-0.5">
          {tracksToDisplay.map((track, index) => {
            const isThisTrackPlaying = isPlaying && currentTrack?.id === track.id;
            const isThisTrackSelected = currentTrack?.id === track.id;
            const isHovered = hoveredTrackId === track.id;

            return (
              <div
                key={`${track.id}-${index}`}
                onMouseEnter={() => setHoveredTrackId(track.id)}
                onMouseLeave={() => setHoveredTrackId(null)}
                onClick={() => handleTrackClick(track)}
                className={`grid grid-cols-[20px_4fr_3fr_minmax(60px,1fr)] gap-4 px-4 py-2.5 rounded-md hover:bg-white/10 cursor-pointer items-center transition-colors group ${
                  isThisTrackSelected ? 'bg-white/10' : ''
                }`}
              >
                {/* Index / Play / Equalizer */}
                <div className="flex items-center justify-center text-xs text-[#b3b3b3] w-5">
                  {isHovered ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTrackClick(track);
                      }}
                      className="text-white hover:scale-110 transition-transform"
                    >
                      {isThisTrackPlaying ? (
                        <PauseNativeIcon size={14} className="text-white" />
                      ) : (
                        <PlayNativeIcon size={14} className="text-white ml-0.5" />
                      )}
                    </button>
                  ) : isThisTrackPlaying ? (
                    <div className="w-3.5 h-3.5 flex items-end justify-center gap-[2.5px] pb-0.5" title="Reproduciendo">
                      <span className="w-[2.5px] bg-[#1ed760] rounded-full animate-spotify-eq-1" />
                      <span className="w-[2.5px] bg-[#1ed760] rounded-full animate-spotify-eq-2" />
                      <span className="w-[2.5px] bg-[#1ed760] rounded-full animate-spotify-eq-3" />
                    </div>
                  ) : (
                    <span className="font-['SpotifyMixUI'] tabular-nums text-xs">
                      {index + 1}
                    </span>
                  )}
                </div>

                {/* Cover + Title + Artist */}
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <TrackArtwork
                    src={track.album?.images?.[0]?.url}
                    alt={track.name}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-semibold truncate ${
                        isThisTrackPlaying ? 'text-[#1ed760]' : 'text-white'
                      }`}
                    >
                      {track.name}
                    </p>
                    <p className="text-xs text-[#b3b3b3] truncate group-hover:text-white transition-colors">
                      {track.artists?.map((a) => a.name).join(', ') || 'Artista'}
                    </p>
                  </div>
                </div>

                {/* Album */}
                <div className="text-xs text-[#b3b3b3] truncate group-hover:text-white transition-colors">
                  {track.album?.name || 'Sencillo'}
                </div>

                {/* Duration */}
                <div className="text-xs text-[#b3b3b3] text-right pr-2 tabular-nums">
                  {formatDuration(track.duration_ms || 180000)}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
