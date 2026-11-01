import React, { useState, useEffect, useRef } from 'react';
import type { Track } from '../../types/spotify';
import { SpotifyDJVisualizer } from './SpotifyDJVisualizer';
import { useAIDJStore } from '../../services/aiDJService';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { fetchLyricsUnified, parseEnhancedLyrics, type SyncedLine } from '../../utils/lyricsService';
import { getArtistPicture } from '../../utils/artistImage';
import {
  PlayNativeIcon,
  PauseNativeIcon,
  NextNativeIcon,
  PrevNativeIcon,
  ShuffleNativeIcon,
  RepeatNativeIcon,
  DeviceNativeIcon,
  ShareNativeIcon,
  PlusCircleNativeIcon,
  CheckCircleNativeIcon,
  QueueNativeIcon,
  CloseNativeIcon,
} from '../icons/SpotifyNativeIcons';
import { formatDuration } from '../../utils/formatters';
import { resolveVibrantColor, extractDominantColorFromImage } from '../../utils/spotifyColor';
import { handleImageError } from '../../utils/imageFallback';

interface AIDJViewProps {
  onBack: () => void;
  isMobile?: boolean;
}

const getTrackArtwork = (track: Track | null | undefined): string => {
  if (!track) return 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';
  if (track.album?.images?.[0]?.url) return track.album.images[0].url;
  if ((track as any).image) return (track as any).image;
  if ((track as any).album_cover_url) return (track as any).album_cover_url;
  return 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';
};

export const AIDJView: React.FC<AIDJViewProps> = ({ onBack, isMobile = false }) => {
  const {
    visualizerState,
    voiceLevel,
    displayedTranscript,
    currentMessage,
    isMicListening,
    djTracks,
    currentSetTitle,
    isDJModeActive,
    startDJSession,
    startVoiceListening,
    stopVoiceListening,
    triggerManualTransition,
  } = useAIDJStore();

  const {
    currentTrack,
    isPlaying,
    progressMs,
    durationMs,
    playTrack,
    togglePlay,
    nextTrack,
    previousTrack,
    isShuffle,
    toggleShuffle,
    repeatMode,
    likedTrackIds,
    toggleLike,
    setProgress,
    queue,
  } = usePlayerStore();

  const [showQueueDrawer, setShowQueueDrawer] = useState(false);
  const [ambientColor, setAmbientColor] = useState<string>('#0c52cc');
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [syncedLines, setSyncedLines] = useState<SyncedLine[]>([]);
  const [isLyricsExpanded, setIsLyricsExpanded] = useState(false);
  const [artistPicture, setArtistPicture] = useState<string | null>(null);
  const lyricsScrollRef = useRef<HTMLDivElement>(null);
  const artistName = currentTrack?.artists?.[0]?.name || '';
  const [isFollowingArtist, setIsFollowingArtist] = useState(() => {
    if (typeof window !== 'undefined' && artistName) {
      try {
        const raw = window.localStorage.getItem('spotifree_followed_artists');
        if (raw) return JSON.parse(raw).includes(artistName);
      } catch {}
    }
    return false;
  });

  useEffect(() => {
    if (!artistName) return;
    try {
      const raw = window.localStorage.getItem('spotifree_followed_artists');
      if (raw) setIsFollowingArtist(JSON.parse(raw).includes(artistName));
    } catch {}
  }, [artistName]);

  // Dynamically load lyrics & artist picture for current track
  useEffect(() => {
    let cancelled = false;
    async function loadLyrics() {
      if (!currentTrack) return;
      setLyrics(null);
      setSyncedLines([]);
      try {
        const res = await fetchLyricsUnified(currentTrack.name, artistName);
        if (cancelled) return;
        if (res.syncedLyrics) {
          setSyncedLines(parseEnhancedLyrics(res.syncedLyrics));
          setLyrics(res.plainLyrics || null);
        } else if (res.plainLyrics) {
          setLyrics(res.plainLyrics);
        }
      } catch {}
    }
    loadLyrics();

    async function loadArtistPhoto() {
      if (!artistName) return;
      try {
        const pic = await getArtistPicture(artistName);
        if (!cancelled && pic) setArtistPicture(pic);
      } catch {}
    }
    loadArtistPhoto();

    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.name, artistName]);

  // Dynamically extract dominant color from current track artwork (Photo 1)
  useEffect(() => {
    const art = getTrackArtwork(currentTrack);
    if (art && art !== 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg') {
      extractDominantColorFromImage(art).then((hex) => {
        if (hex) {
          setAmbientColor(hex);
        } else if (currentTrack?.id) {
          setAmbientColor(resolveVibrantColor(currentTrack.id, currentTrack.name));
        }
      });
    } else if (currentTrack?.id) {
      setAmbientColor(resolveVibrantColor(currentTrack.id, currentTrack.name));
    }
  }, [currentTrack]);

  // Initialize DJ session only if not already active or if no tracks are present
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


  const tracksToDisplay: Track[] = djTracks && djTracks.length > 0 ? djTracks : queue;
  const isSpeakingMode = visualizerState === 'speaking' || visualizerState === 'listening';
  const subtitleToShow = displayedTranscript || currentMessage;

  const currentDuration = durationMs || currentTrack?.duration_ms || 180000;
  const currentProgress = Math.min(progressMs, currentDuration);
  const progressPercent = currentDuration > 0 ? (currentProgress / currentDuration) * 100 : 0;

  const handleToggleFollowArtist = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!artistName) return;
    const next = !isFollowingArtist;
    setIsFollowingArtist(next);
    try {
      let list: string[] = [];
      const raw = window.localStorage.getItem('spotifree_followed_artists');
      if (raw) list = JSON.parse(raw);
      if (next) {
        if (!list.includes(artistName)) list.push(artistName);
        const artPl = {
          id: `art-${encodeURIComponent(artistName)}`,
          name: artistName,
          description: 'Artista oficial',
          images: artistPicture ? [{ url: artistPicture }] : [],
          type: 'artist' as const,
          owner: { display_name: 'Artista', id: 'artist' },
          tracks: { total: 10, items: [] },
          is_custom: true,
        };
        useSpotifyDataStore.getState().addCustomPlaylist(artPl as any);
      } else {
        list = list.filter((a) => a !== artistName);
      }
      window.localStorage.setItem('spotifree_followed_artists', JSON.stringify(list));
    } catch {}
  };

  const isCurrentLiked = currentTrack ? likedTrackIds.includes(currentTrack.id) : false;

  const vocalProgressMs = progressMs + 220;
  const activeLineIndex = syncedLines.length > 0
    ? syncedLines.findIndex((line, i) => {
        const nextLine = syncedLines[i + 1];
        return vocalProgressMs >= line.timeMs && (!nextLine || vocalProgressMs < nextLine.timeMs);
      })
    : -1;

  useEffect(() => {
    if (lyricsScrollRef.current && activeLineIndex >= 0) {
      const activeEl = lyricsScrollRef.current.querySelector(`[data-line-index="${activeLineIndex}"]`) as HTMLElement;
      if (activeEl) {
        if (isLyricsExpanded) {
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          const container = lyricsScrollRef.current;
          const targetTop = activeEl.offsetTop - container.offsetTop - 40;
          container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
        }
      }
    }
  }, [activeLineIndex, isLyricsExpanded]);

  const handleTrackClick = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track, tracksToDisplay, 'dj-session');
    }
  };

  // =========================================================================
  // SCREEN 1: DJ SPEAKING / TRANSITION SCREEN (Photo 2 - Royal Blue / Reactive)
  // =========================================================================
  if (isSpeakingMode) {
    return (
      <div
        className="relative w-full h-full min-h-screen text-white flex flex-col justify-between overflow-hidden select-none font-['SpotifyMixUI'] animate-in fade-in duration-300 p-4 sm:p-6"
        style={{
          backgroundColor: ambientColor || '#0c52cc',
          backgroundImage: `radial-gradient(circle at 50% 38%, ${ambientColor || '#0c52cc'}f0 0%, ${ambientColor || '#0c52cc'}bb 45%, #050b18 100%)`,
          transition: 'background-color 1.2s cubic-bezier(0.2, 0, 0, 1), background-image 1.2s cubic-bezier(0.2, 0, 0, 1)',
        }}
      >
        {/* Dynamic Background Glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[580px] h-[580px] rounded-full blur-[140px] opacity-85 transition-colors duration-1000"
            style={{ backgroundColor: ambientColor || '#0c52cc' }}
          />
        </div>

        {/* Top Header */}
        <header className="flex items-center justify-between px-3 py-2 z-20 shrink-0">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-all cursor-pointer active:scale-95"
            title="Minimizar"
          >
            <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor">
              <path d="M11.03.47a.75.75 0 0 1 0 1.06L4.56 8l6.47 6.47a.75.75 0 1 1-1.06 1.06L2.44 8 9.97.47a.75.75 0 0 1 1.06 0" />
            </svg>
          </button>

          <div className="text-center">
            <span className="text-[11px] font-black uppercase tracking-widest text-white/80 font-['SpotifyMixUITitle'] block">
              DJ
            </span>
            <span className="text-xs font-bold text-white truncate max-w-[220px] block mt-0.5">
              {currentSetTitle || 'En vivo'}
            </span>
          </div>

          <button
            onClick={toggleMic}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              isMicListening
                ? 'bg-[#00f2fe] text-black shadow-[0_0_16px_rgba(0,242,254,0.8)] animate-pulse'
                : 'text-white/80 hover:text-white bg-black/20 hover:bg-black/30'
            }`}
            title={isMicListening ? 'Detener micrófono' : 'Hablar con el DJ'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
            </svg>
          </button>
        </header>

        {/* Center: The Hollow Smooth Organic Green-Cyan DJ Ring (Photo 2) */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 text-center max-w-xl mx-auto w-full z-10 my-auto">
          <div
            onClick={toggleMic}
            className="cursor-pointer transition-transform hover:scale-104 active:scale-95 my-2"
            title={isMicListening ? 'Escuchando... haz clic para detener' : 'Haz clic para hablar'}
          >
            <SpotifyDJVisualizer
              size={isMobile ? 280 : 340}
              state={visualizerState}
              voiceLevel={voiceLevel}
              themeColor={ambientColor}
            />
          </div>

          {/* Subtitle Spoken Text */}
          <div className="min-h-[70px] flex items-center justify-center px-4 mt-5">
            <p className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-snug drop-shadow-md font-['SpotifyMixUITitle'] max-w-lg">
              {isMicListening ? (
                <span className="text-[#00f2fe] flex items-center justify-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00f2fe] animate-ping" />
                  Te escucho... habla conmigo
                </span>
              ) : (
                <span>{subtitleToShow || 'Aquí tu DJ de Spotify...'}</span>
              )}
            </p>
          </div>
        </main>

        {/* Bottom Playback Controls matching Photo 2 */}
        <footer className="relative z-20 px-4 py-4 flex items-center justify-between shrink-0">
          <div className="w-14" />

          {/* Controls: Prev, Play/Pause, Next */}
          <div className="flex items-center gap-8 mx-auto">
            <button
              onClick={() => previousTrack()}
              className="text-white/80 hover:text-white transition-colors cursor-pointer active:scale-95"
              title="Anterior"
            >
              <PrevNativeIcon size={24} className="text-white" />
            </button>

            <button
              onClick={togglePlay}
              className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-2xl"
              title={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying ? <PauseNativeIcon size={24} /> : <PlayNativeIcon size={24} className="ml-1" />}
            </button>

            <button
              onClick={() => nextTrack()}
              className="text-white/80 hover:text-white transition-colors cursor-pointer active:scale-95"
              title="Siguiente"
            >
              <NextNativeIcon size={24} className="text-white" />
            </button>
          </div>

          {/* Floating DJ Button (Bottom Right) */}
          <button
            onClick={() => triggerManualTransition()}
            className="w-14 h-14 rounded-full bg-[#0042a5] hover:bg-[#003890] border border-white/20 text-[#1ed760] shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex items-center justify-center cursor-pointer hover:scale-108 active:scale-95 transition-all"
            title="Cambiar de rollo con el DJ"
          >
            <SpotifyDJVisualizer size={38} mini state="playing" themeColor={ambientColor} />
          </button>
        </footer>
      </div>
    );
  }

  // =========================================================================
  // SCREEN 2: NOW PLAYING SCREEN (Photo 1 - Music Playing with Dynamic Color)
  // =========================================================================
  return (
    <div
      className="relative w-full h-full min-h-screen text-white flex flex-col justify-between overflow-y-auto select-none font-['SpotifyMixUI'] animate-in fade-in duration-300 p-4 sm:p-6"
      style={{
        backgroundColor: ambientColor,
        backgroundImage: `linear-gradient(180deg, ${ambientColor} 0%, rgba(18, 18, 18, 0.88) 55%, #121212 100%)`,
        transition: 'background-color 1.2s cubic-bezier(0.2, 0, 0, 1)',
      }}
    >
      {/* Background Soft Aura Glow based on track color */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[580px] h-[580px] rounded-full blur-[140px] opacity-70 transition-colors duration-1000"
          style={{ backgroundColor: ambientColor }}
        />
      </div>

      {/* Top Header matching Photo 1 */}
      <header className="flex items-center justify-between px-3 py-2 z-20 shrink-0">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer active:scale-95"
          title="Minimizar"
        >
          <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor">
            <path d="M11.03.47a.75.75 0 0 1 0 1.06L4.56 8l6.47 6.47a.75.75 0 1 1-1.06 1.06L2.44 8 9.97.47a.75.75 0 0 1 1.06 0" />
          </svg>
        </button>

        {/* Center: "DJ" + Current Set Title */}
        <div className="text-center truncate px-4">
          <span className="text-[11px] font-black uppercase tracking-widest text-[#cfcfcf] font-['SpotifyMixUITitle'] block">
            DJ
          </span>
          <span className="text-xs md:text-sm font-bold text-white truncate max-w-[240px] block mt-0.5">
            {currentSetTitle || 'Lo que has estado escuchando'}
          </span>
        </div>

        {/* Right: Queue / Playlist Toggle */}
        <button
          onClick={() => setShowQueueDrawer(!showQueueDrawer)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
            showQueueDrawer ? 'bg-[#1ed760] text-black shadow-md' : 'text-white/80 hover:text-white bg-black/40 hover:bg-black/60'
          }`}
          title="Ver cola y canciones del DJ"
        >
          <QueueNativeIcon size={18} />
        </button>
      </header>

      {/* Center: Album Artwork matching Photo 1 (Prominent, beautiful Spotify square) */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 z-10 max-w-lg mx-auto w-full my-auto">
        {/* Album Cover */}
        <div className="w-full aspect-square max-w-[min(72vw,290px)] sm:max-w-[340px] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.85)] bg-[#282828] mb-4 sm:mb-5">
          <img
            src={getTrackArtwork(currentTrack)}
            alt={currentTrack?.name || 'Música del DJ'}
            onError={handleImageError}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Track Title, Artist & Like Button */}
        <div className="w-full flex items-center justify-between gap-4">
          <div className="truncate text-left min-w-0">
            <h2 className="text-2xl md:text-3xl font-black text-white font-['SpotifyMixUITitle'] truncate">
              {currentTrack?.name || 'Música del DJ'}
            </h2>
            <p className="text-sm md:text-base text-[#b3b3b3] truncate mt-0.5">
              {currentTrack?.artists?.map((a) => a.name).join(', ') || 'Spotify DJ'}
            </p>
          </div>

          {currentTrack && (
            <button
              onClick={() => toggleLike(currentTrack.id)}
              className="shrink-0 text-white/80 hover:text-white hover:scale-110 active:scale-95 transition-transform cursor-pointer p-1"
              title={isCurrentLiked ? 'Quitar de tus Me Gusta' : 'Guardar en tus Me Gusta'}
            >
              {isCurrentLiked ? (
                <CheckCircleNativeIcon size={26} className="text-[#1ed760]" />
              ) : (
                <PlusCircleNativeIcon size={26} className="text-white/80" />
              )}
            </button>
          )}
        </div>

        {/* Scrubber Progress Slider matching Photo 1 */}
        <div className="w-full mt-4">
          <div className="relative w-full h-1 bg-white/20 rounded-full cursor-pointer group">
            <div
              className="h-full bg-white rounded-full relative group-hover:bg-[#1ed760]"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <input
              type="range"
              min={0}
              max={currentDuration}
              value={currentProgress}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#b3b3b3] font-['SpotifyMixUI'] tabular-nums mt-1.5">
            <span>{formatDuration(currentProgress)}</span>
            <span>{formatDuration(currentDuration)}</span>
          </div>
        </div>

        {/* Playback Controls matching Photo 1 */}
        <div className="w-full flex items-center justify-between mt-3 px-1">
          <button
            onClick={() => toggleShuffle()}
            className={`transition-colors cursor-pointer active:scale-95 ${
              isShuffle ? 'text-[#1ed760]' : 'text-white/60 hover:text-white'
            }`}
            title="Aleatorio"
          >
            <ShuffleNativeIcon size={20} />
          </button>

          <button
            onClick={() => previousTrack()}
            className="text-white/80 hover:text-white transition-colors cursor-pointer active:scale-95"
            title="Anterior"
          >
            <PrevNativeIcon size={24} className="text-white" />
          </button>

          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-2xl"
            title={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isPlaying ? <PauseNativeIcon size={26} /> : <PlayNativeIcon size={26} className="ml-1" />}
          </button>

          <button
            onClick={() => nextTrack()}
            className="text-white/80 hover:text-white transition-colors cursor-pointer active:scale-95"
            title="Siguiente"
          >
            <NextNativeIcon size={24} className="text-white" />
          </button>

          <button
            className={`transition-colors cursor-pointer active:scale-95 ${
              repeatMode !== 'off' ? 'text-[#1ed760]' : 'text-white/60 hover:text-white'
            }`}
            title="Repetir"
          >
            <RepeatNativeIcon size={20} />
          </button>
        </div>

        {/* SECTION: Expandable Spotify Mobile Lyrics Card ("Letras") */}
        <div
          className="w-full mt-5 rounded-[24px] p-5 transition-all duration-300 relative overflow-hidden shadow-2xl border border-white/10 flex flex-col justify-between"
          style={{
            backgroundColor: `${ambientColor}e6`,
          }}
        >
          {/* Lyrics Card Header */}
          <div
            onClick={() => setIsLyricsExpanded(!isLyricsExpanded)}
            className="flex items-center justify-between mb-4 text-white cursor-pointer select-none"
          >
            <span className="font-bold text-base tracking-tight font-['SpotifyMixUITitle'] flex items-center gap-2">
              Letras
              {syncedLines.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-[#1ed760] shadow-[0_0_8px_#1ed760]" />
              )}
            </span>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 hover:bg-black/50 text-white/90 active:scale-95 transition-all text-xs font-bold">
              <span>{isLyricsExpanded ? 'Minimizar' : 'Pantalla completa'}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            </div>
          </div>

          {/* Lyrics Content */}
          {syncedLines.length > 0 ? (
            <div
              ref={lyricsScrollRef}
              className={`space-y-4 font-bold select-none transition-all duration-300 ${
                isLyricsExpanded ? 'max-h-[500px] overflow-y-auto scroll-smooth pr-2' : 'max-h-[220px] overflow-y-auto scroll-smooth pr-1 scrollbar-none'
              }`}
            >
              {syncedLines.map((line, idx) => {
                const isCurrent = idx === activeLineIndex;
                return (
                  <p
                    key={`dj-lyric-${idx}-${line.timeMs}`}
                    data-line-index={idx}
                    onClick={() => {
                      if (typeof window !== 'undefined' && (window as any).__audioEngine) {
                        (window as any).__audioEngine.seek(line.timeMs / 1000);
                      }
                    }}
                    className={`transition-all duration-200 leading-snug cursor-pointer block origin-left text-xl font-bold ${
                      isCurrent
                        ? 'text-white scale-[1.03] drop-shadow-[0_2px_14px_rgba(255,255,255,0.65)]'
                        : Math.abs(idx - activeLineIndex) === 1
                        ? 'text-white/70 hover:text-white'
                        : 'text-black/50 hover:text-white/80'
                    }`}
                  >
                    {isCurrent && line.words.length > 0 ? (
                      line.words.map((w, wIdx) => {
                        const isWordSung = vocalProgressMs >= w.timeMs;
                        return (
                          <span
                            key={`djw-${idx}-${wIdx}`}
                            className={`transition-colors duration-150 inline ${
                              isWordSung ? 'text-white' : 'text-white/45'
                            }`}
                          >
                            {w.text}{wIdx < line.words.length - 1 ? ' ' : ''}
                          </span>
                        );
                      })
                    ) : (
                      <span>{line.text}</span>
                    )}
                  </p>
                );
              })}
            </div>
          ) : lyrics ? (
            <div className={`text-white font-bold leading-relaxed whitespace-pre-line text-base ${isLyricsExpanded ? 'max-h-[500px] overflow-y-auto' : 'h-[220px] overflow-hidden'}`}>
              {lyrics}
            </div>
          ) : (
            <div className="py-6 text-white/95 space-y-1.5">
              <p className="font-bold text-lg leading-snug">
                Disfruta de la mejor calidad de sonido en Spotifree.
              </p>
              <p className="text-xs text-white/70">
                Letras proporcionadas por la comunidad y sincronizadas en directo.
              </p>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/10 text-white/90">
            <button
              onClick={() => {
                if (navigator.share && currentTrack) {
                  navigator.share({ title: currentTrack.name, text: `Escuchando ${currentTrack.name} en Spotifree` }).catch(() => {});
                } else {
                  navigator.clipboard.writeText(window.location.href).catch(() => {});
                }
              }}
              className="px-4 py-1.5 rounded-full bg-black/25 hover:bg-black/40 text-xs font-bold uppercase tracking-wider flex items-center gap-2 active:scale-95 transition-all"
            >
              <ShareNativeIcon size={14} className="text-white" />
              <span>Compartir</span>
            </button>

            <button
              onClick={() => setIsLyricsExpanded(!isLyricsExpanded)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white text-xs font-bold active:scale-95 transition-all"
              title={isLyricsExpanded ? 'Minimizar' : 'Pantalla completa'}
            >
              <span>{isLyricsExpanded ? 'Cerrar' : 'Ampliar'}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* SECTION: Información sobre el artista Card */}
        <div className="w-full mt-4 rounded-2xl bg-[#181818]/90 p-5 space-y-3 shadow-lg border border-white/5 text-left">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-white font-['SpotifyMixUITitle']">
              Información sobre el artista
            </span>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-[#242424] shrink-0 shadow">
              {artistPicture ? (
                <img
                  src={artistPicture}
                  alt={artistName || 'Artista'}
                  onError={handleImageError}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-white bg-[#282828]">
                  {artistName?.charAt(0) || 'A'}
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-bold text-white text-base truncate">
                {artistName || 'Artista'}
              </span>
              <span className="text-xs text-[#b3b3b3]">
                Oyentes mensuales verificados
              </span>
            </div>
            <button
              onClick={handleToggleFollowArtist}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 shrink-0 ${
                isFollowingArtist
                  ? 'border border-white/40 text-white bg-transparent'
                  : 'bg-white text-black hover:scale-105'
              }`}
            >
              {isFollowingArtist ? 'Siguiendo' : 'Seguir'}
            </button>
          </div>
        </div>

        {/* SECTION: Créditos Card */}
        <div className="w-full mt-4 mb-4 rounded-2xl bg-[#181818]/80 p-5 space-y-3 shadow-md border border-white/5 text-left">
          <span className="font-bold text-sm text-white font-['SpotifyMixUITitle'] block">
            Créditos
          </span>
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-white truncate max-w-[180px]">{artistName || 'Artista'}</span>
            <span className="text-[#b3b3b3]">Artista principal</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-white truncate max-w-[180px]">{currentTrack?.name || 'Música'}</span>
            <span className="text-[#b3b3b3]">Compositor</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-white truncate max-w-[180px]">Spotifree AI Studio</span>
            <span className="text-[#b3b3b3]">Producción y mezcla</span>
          </div>
        </div>
      </main>

      {/* Bottom Toolbar & FLOATING DJ BUTTON matching Photo 1 */}
      <footer className="relative z-20 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 text-white/60">
          <button className="hover:text-white transition-colors cursor-pointer p-1" title="Conectar dispositivo">
            <DeviceNativeIcon size={18} />
          </button>
          <button
            onClick={() => {
              if (navigator.share && currentTrack) {
                navigator.share({ title: currentTrack.name, text: `Escuchando ${currentTrack.name} en el DJ de Spotifree`, url: window.location.href }).catch(() => {});
              }
            }}
            className="hover:text-white transition-colors cursor-pointer p-1"
            title="Compartir"
          >
            <ShareNativeIcon size={18} />
          </button>
        </div>

        {/* THE FLOATING DJ BUTTON (Photo 1 Bottom Right) */}
        <button
          onClick={() => triggerManualTransition()}
          className="w-14 h-14 rounded-full bg-[#0050d0] hover:bg-[#005eff] border border-white/20 text-[#1ed760] shadow-[0_6px_28px_rgba(0,80,208,0.55)] flex items-center justify-center cursor-pointer hover:scale-108 active:scale-95 transition-all"
          title="Cambiar de rollo (DJ)"
        >
          <SpotifyDJVisualizer size={38} mini state="playing" themeColor={ambientColor} />
        </button>
      </footer>

      {/* Queue Drawer (Slides up when Queue button is tapped) */}
      {showQueueDrawer && (
        <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200">
          <div className="bg-[#181818] rounded-t-2xl max-h-[75vh] flex flex-col border-t border-white/10 shadow-2xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white font-['SpotifyMixUITitle']">
                  Cola del DJ • {tracksToDisplay.length} canciones
                </h3>
                <p className="text-xs text-[#a7a7a7] mt-0.5">{currentSetTitle || 'Sesión en vivo'}</p>
              </div>
              <button
                onClick={() => setShowQueueDrawer(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                title="Cerrar"
              >
                <CloseNativeIcon size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 mt-3 pr-1">
              {tracksToDisplay.map((track, idx) => {
                const isPlayingThis = isPlaying && currentTrack?.id === track.id;
                const trackArt = getTrackArtwork(track);
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
                        onError={handleImageError}
                        referrerPolicy="no-referrer"
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
