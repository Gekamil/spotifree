import React, { useState, useEffect } from 'react';
import type { Track } from '../../types/spotify';
import { SpotifyDJVisualizer } from './SpotifyDJVisualizer';
import { useAIDJStore } from '../../services/aiDJService';
import { usePlayerStore } from '../../store/usePlayerStore';
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
    handleUserPrompt,
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
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [ambientColor, setAmbientColor] = useState<string>('#5018F0');

  // Dynamically extract dominant color from current track artwork (Photo 1)
  useEffect(() => {
    const art = getTrackArtwork(currentTrack);
    if (art && art !== 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg') {
      extractDominantColorFromImage(art).then((hex) => {
        if (hex) setAmbientColor(hex);
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

  const handleSendPrompt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!promptText.trim()) return;
    const txt = promptText.trim();
    setPromptText('');
    setShowPromptInput(false);
    handleUserPrompt(txt);
  };

  const tracksToDisplay: Track[] = djTracks && djTracks.length > 0 ? djTracks : queue;
  const isSpeakingMode = visualizerState === 'speaking' || visualizerState === 'listening';
  const subtitleToShow = displayedTranscript || currentMessage;

  const currentDuration = durationMs || currentTrack?.duration_ms || 180000;
  const currentProgress = Math.min(progressMs, currentDuration);
  const progressPercent = currentDuration > 0 ? (currentProgress / currentDuration) * 100 : 0;

  const isCurrentLiked = currentTrack ? likedTrackIds.includes(currentTrack.id) : false;

  const handleTrackClick = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track, tracksToDisplay, 'dj-session');
    }
  };

  // =========================================================================
  // SCREEN 1: DJ SPEAKING / TRANSITION SCREEN (Photo 2 - Royal Blue Background)
  // =========================================================================
  if (isSpeakingMode) {
    return (
      <div className="relative w-full h-full max-h-screen bg-[#0c52cc] text-white flex flex-col justify-between overflow-hidden select-none font-['SpotifyMixUI'] animate-in fade-in duration-300 p-3 sm:p-5">
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

        {/* Center: The Hollow Morphing Green-Cyan DJ Ring (Photo 2) */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 text-center max-w-xl mx-auto w-full z-10 min-h-0 my-auto">
          <div
            onClick={toggleMic}
            className="cursor-pointer transition-transform hover:scale-104 active:scale-95 shrink"
            title={isMicListening ? 'Escuchando... haz clic para detener' : 'Haz clic para hablar'}
          >
            <SpotifyDJVisualizer
              size={isMobile ? 190 : 250}
              state={visualizerState}
              voiceLevel={voiceLevel}
            />
          </div>

          {/* Subtitle Spoken Text */}
          <div className="min-h-[50px] flex items-center justify-center px-4 mt-3">
            <p className="text-base sm:text-xl md:text-2xl font-bold tracking-tight text-white leading-snug drop-shadow-md font-['SpotifyMixUITitle'] max-w-md">
              {isMicListening ? (
                <span className="text-[#00f2fe] flex items-center gap-2">
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
        <footer className="relative z-20 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="w-12" />

          {/* Controls: Prev, Play/Pause, Next */}
          <div className="flex items-center gap-7 mx-auto">
            <button
              onClick={() => previousTrack()}
              className="text-white/80 hover:text-white transition-colors cursor-pointer active:scale-95"
              title="Anterior"
            >
              <PrevNativeIcon size={24} className="text-white" />
            </button>

            <button
              onClick={togglePlay}
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-2xl"
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
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#0042a5] hover:bg-[#003890] border border-white/20 text-[#1ed760] shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex items-center justify-center cursor-pointer hover:scale-108 active:scale-95 transition-all"
            title="Cambiar de rollo con el DJ"
          >
            <SpotifyDJVisualizer size={34} mini state="playing" />
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
      className="relative w-full h-full max-h-screen text-white flex flex-col justify-between overflow-hidden select-none font-['SpotifyMixUI'] animate-in fade-in duration-300 p-3 sm:p-5"
      style={{
        backgroundColor: ambientColor,
        backgroundImage: 'linear-gradient(180deg, rgba(0, 0, 0, 0.18) 0%, rgba(18, 18, 18, 0.88) 55%, #121212 100%)',
        transition: 'background-color 1.2s cubic-bezier(0.2, 0, 0, 1)',
      }}
    >
      {/* Background Soft Aura Glow based on track color */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] rounded-full blur-[140px] opacity-60 transition-colors duration-1000"
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
        <div className="text-center truncate px-3">
          <span className="text-[11px] font-black uppercase tracking-widest text-[#cfcfcf] font-['SpotifyMixUITitle'] block">
            DJ
          </span>
          <span className="text-xs md:text-sm font-bold text-white truncate max-w-[220px] block mt-0.5">
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

      {/* Center: Album Artwork matching Photo 1 (Responsive scaling to prevent overflow) */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 z-10 max-w-sm mx-auto w-full min-h-0 my-auto">
        {/* Album Cover */}
        <div className="w-full aspect-square max-h-[35vh] max-w-[min(65vw,35vh,270px)] rounded-lg overflow-hidden shadow-[0_16px_36px_rgba(0,0,0,0.7)] bg-[#282828] mb-3 sm:mb-4 shrink">
          <img
            src={getTrackArtwork(currentTrack)}
            alt={currentTrack?.name || 'Música del DJ'}
            onError={handleImageError}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Track Title, Artist & Like Button */}
        <div className="w-full flex items-center justify-between gap-3">
          <div className="truncate text-left min-w-0">
            <h2 className="text-lg md:text-xl font-bold text-white font-['SpotifyMixUITitle'] truncate">
              {currentTrack?.name || 'Música del DJ'}
            </h2>
            <p className="text-xs md:text-sm text-[#b3b3b3] truncate mt-0.5">
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
                <CheckCircleNativeIcon size={24} className="text-[#1ed760]" />
              ) : (
                <PlusCircleNativeIcon size={24} className="text-white/80" />
              )}
            </button>
          )}
        </div>

        {/* Scrubber Progress Slider matching Photo 1 */}
        <div className="w-full mt-3">
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

          <div className="flex items-center justify-between text-[11px] text-[#b3b3b3] font-['SpotifyMixUI'] tabular-nums mt-1">
            <span>{formatDuration(currentProgress)}</span>
            <span>{formatDuration(currentDuration)}</span>
          </div>
        </div>

        {/* Playback Controls matching Photo 1 */}
        <div className="w-full flex items-center justify-between mt-2 sm:mt-3 px-1">
          <button
            onClick={() => toggleShuffle()}
            className={`transition-colors cursor-pointer active:scale-95 ${
              isShuffle ? 'text-[#1ed760]' : 'text-white/60 hover:text-white'
            }`}
            title="Aleatorio"
          >
            <ShuffleNativeIcon size={19} />
          </button>

          <button
            onClick={() => previousTrack()}
            className="text-white/80 hover:text-white transition-colors cursor-pointer active:scale-95"
            title="Anterior"
          >
            <PrevNativeIcon size={22} className="text-white" />
          </button>

          <button
            onClick={togglePlay}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-2xl"
            title={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isPlaying ? <PauseNativeIcon size={24} /> : <PlayNativeIcon size={24} className="ml-0.5" />}
          </button>

          <button
            onClick={() => nextTrack()}
            className="text-white/80 hover:text-white transition-colors cursor-pointer active:scale-95"
            title="Siguiente"
          >
            <NextNativeIcon size={22} className="text-white" />
          </button>

          <button
            className={`transition-colors cursor-pointer active:scale-95 ${
              repeatMode !== 'off' ? 'text-[#1ed760]' : 'text-white/60 hover:text-white'
            }`}
            title="Repetir"
          >
            <RepeatNativeIcon size={19} />
          </button>
        </div>
      </main>

      {/* Bottom Toolbar & FLOATING DJ BUTTON matching Photo 1 */}
      <footer className="relative z-20 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 text-white/60">
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

        {/* Prompt Input Toggle (Allows talking/typing to DJ on demand) */}
        {showPromptInput ? (
          <form
            onSubmit={handleSendPrompt}
            className="flex-1 max-w-xs mx-2 flex items-center bg-[#242424] border border-white/20 rounded-full px-3 py-1 shadow-xl animate-in fade-in"
          >
            <input
              type="text"
              autoFocus
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Pide un cambio (ej. más reggaeton)..."
              className="w-full bg-transparent border-none text-white text-xs outline-none placeholder:text-[#a7a7a7]"
            />
            <button
              type="submit"
              className="ml-1 w-5 h-5 rounded-full bg-white text-black flex items-center justify-center text-xs font-bold hover:scale-105 shrink-0"
            >
              ✓
            </button>
            <button
              type="button"
              onClick={() => setShowPromptInput(false)}
              className="ml-1 text-white/60 hover:text-white shrink-0 p-1"
            >
              ✕
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowPromptInput(true)}
            className="text-xs text-[#a7a7a7] hover:text-white transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10"
            title="Pedir algo al DJ"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            </svg>
            <span>Pedir cambio</span>
          </button>
        )}

        {/* THE FLOATING DJ BUTTON (Photo 1 Bottom Right) */}
        <button
          onClick={() => triggerManualTransition()}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#0050d0] hover:bg-[#005eff] border border-white/20 text-[#1ed760] shadow-[0_6px_28px_rgba(0,80,208,0.55)] flex items-center justify-center cursor-pointer hover:scale-108 active:scale-95 transition-all"
          title="Cambiar de rollo (DJ)"
        >
          <SpotifyDJVisualizer size={34} mini state="playing" />
        </button>
      </footer>

      {/* Queue Drawer (Slides up when Queue button is tapped) */}
      {showQueueDrawer && (
        <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-md flex flex-col justify-end animate-in fade-in duration-200">
          <div className="bg-[#181818] rounded-t-2xl max-h-[70vh] flex flex-col border-t border-white/10 shadow-2xl p-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
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
                    className={`flex items-center justify-between p-2 rounded-lg hover:bg-white/10 cursor-pointer transition-colors ${
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
                        className="w-9 h-9 rounded object-cover shrink-0 bg-[#282828]"
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
