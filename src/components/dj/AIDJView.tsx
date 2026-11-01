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
  QueueNativeIcon,
  CloseNativeIcon,
} from '../icons/SpotifyNativeIcons';
import { formatDuration } from '../../utils/formatters';
import { resolveVibrantColor, extractDominantColorFromImage } from '../../utils/spotifyColor';
import { handleImageError } from '../../utils/imageFallback';

interface AIDJViewProps {
  onBack: () => void;
  isMobile?: boolean;
  onOpenPlayer?: () => void;
}

const getTrackArtwork = (track: Track | null | undefined): string => {
  if (!track) return 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';
  if (track.album?.images?.[0]?.url) return track.album.images[0].url;
  if ((track as any).image) return (track as any).image;
  if ((track as any).album_cover_url) return (track as any).album_cover_url;
  return 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';
};

const QUICK_VIBE_CHIPS = [
  'Más movido',
  'Algo chill',
  'Reggaetón',
  'Clásicos',
  'Trap / Urbano',
  'Sorpréndeme',
];

export const AIDJView: React.FC<AIDJViewProps> = ({ onBack, isMobile = false, onOpenPlayer }) => {
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
    handleUserPrompt,
  } = useAIDJStore();

  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
    nextTrack,
    previousTrack,
    queue,
  } = usePlayerStore();

  const [showQueueDrawer, setShowQueueDrawer] = useState(false);
  const [ambientColor, setAmbientColor] = useState<string>('#0c52cc');
  const [promptInput, setPromptInput] = useState('');

  // Dynamically extract dominant color from current track artwork
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

  // Initialize DJ session if not active or empty
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

  const handleSendPrompt = (textToSend?: string) => {
    const q = (textToSend || promptInput).trim();
    if (!q) return;
    handleUserPrompt(q);
    setPromptInput('');
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
    <div
      className="relative w-full h-full min-h-screen text-white flex flex-col justify-between overflow-hidden select-none font-['SpotifyMixUI'] animate-in fade-in duration-300 p-4 sm:p-6"
      style={{
        backgroundColor: ambientColor || '#0c52cc',
        backgroundImage: `radial-gradient(circle at 50% 36%, ${ambientColor || '#0c52cc'}f0 0%, ${ambientColor || '#0c52cc'}c0 42%, #050b18 100%)`,
        transition: 'background-color 1.2s cubic-bezier(0.2, 0, 0, 1), background-image 1.2s cubic-bezier(0.2, 0, 0, 1)',
      }}
    >
      {/* Background Soft Aura Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[580px] h-[580px] rounded-full blur-[140px] opacity-85 transition-colors duration-1000"
          style={{ backgroundColor: ambientColor || '#0c52cc' }}
        />
      </div>

      {/* Top Header matching Photo 2 */}
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

        <div className="text-center truncate px-4">
          <span className="text-[11px] font-black uppercase tracking-widest text-white/80 font-['SpotifyMixUITitle'] block">
            DJ
          </span>
          <span className="text-xs font-bold text-white truncate max-w-[220px] block mt-0.5">
            {currentSetTitle || 'Lo que has estado escuchando'}
          </span>
        </div>

        {/* Queue / Tracks List Toggle */}
        <button
          onClick={() => setShowQueueDrawer(!showQueueDrawer)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
            showQueueDrawer ? 'bg-[#1ed760] text-black shadow-md' : 'text-white/80 hover:text-white bg-black/20 hover:bg-black/30'
          }`}
          title="Ver cola y canciones del DJ"
        >
          <QueueNativeIcon size={18} />
        </button>
      </header>

      {/* Center: The Hollow Smooth Organic Green-Cyan DJ Ring (Photo 2) */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center max-w-xl mx-auto w-full z-10 my-auto py-2">
        <div
          onClick={toggleMic}
          className="cursor-pointer transition-transform hover:scale-104 active:scale-95 my-2"
          title={isMicListening ? 'Escuchando... haz clic para detener' : 'Haz clic para hablar con el DJ'}
        >
          <SpotifyDJVisualizer
            size={isMobile ? 260 : 320}
            state={visualizerState}
            voiceLevel={voiceLevel}
            themeColor={ambientColor}
          />
        </div>

        {/* Subtitle / Transcript */}
        <div className="min-h-[58px] flex items-center justify-center px-4 mt-3">
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

        {/* Text Chat / Prompt Input Bar ("Escribirle al DJ") */}
        <div className="w-full max-w-md mt-4 space-y-2.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendPrompt();
            }}
            className="flex items-center gap-2 bg-black/40 hover:bg-black/50 border border-white/15 focus-within:border-white/40 rounded-full px-3 py-1.5 backdrop-blur-md shadow-lg transition-all"
          >
            <button
              type="button"
              onClick={toggleMic}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                isMicListening
                  ? 'bg-[#00f2fe] text-black shadow-[0_0_12px_rgba(0,242,254,0.9)] animate-pulse'
                  : 'text-white/70 hover:text-white bg-white/10 hover:bg-white/20'
              }`}
              title={isMicListening ? 'Detener micrófono' : 'Hablar por micrófono'}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
              </svg>
            </button>

            <input
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder="Escribe al DJ (ej. más reggaeton, algo chill)..."
              className="flex-1 bg-transparent text-xs sm:text-sm text-white placeholder-white/50 outline-none font-['SpotifyMixUI'] px-1"
            />

            <button
              type="submit"
              disabled={!promptInput.trim()}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                promptInput.trim()
                  ? 'bg-white text-black hover:scale-105 active:scale-95'
                  : 'text-white/30 bg-white/5 cursor-not-allowed'
              }`}
              title="Enviar petición"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </form>

          {/* Quick Vibe Chips */}
          <div className="flex items-center justify-center gap-1.5 flex-wrap overflow-x-auto py-1 scrollbar-none">
            {QUICK_VIBE_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleSendPrompt(chip)}
                className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-[11px] font-bold text-white/90 border border-white/10 transition-all cursor-pointer whitespace-nowrap"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Currently Playing Track Pill */}
        {currentTrack && (
          <div
            onClick={() => onOpenPlayer?.()}
            className="mt-4 flex items-center justify-between gap-3 bg-black/35 hover:bg-black/50 border border-white/10 rounded-full px-3 py-2 max-w-sm w-full cursor-pointer transition-all active:scale-98 shadow-md"
            title="Toca para abrir reproductor completo con letra y detalles"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={getTrackArtwork(currentTrack)}
                alt={currentTrack.name}
                onError={handleImageError}
                referrerPolicy="no-referrer"
                className="w-8 h-8 rounded-full object-cover shrink-0 bg-[#282828]"
              />
              <div className="text-left truncate">
                <p className="text-xs font-bold text-white truncate font-['SpotifyMixUITitle']">
                  {currentTrack.name}
                </p>
                <p className="text-[11px] text-[#b3b3b3] truncate">
                  {currentTrack.artists?.map((a) => a.name).join(', ') || 'DJ'}
                </p>
              </div>
            </div>

            <span className="text-[10px] font-bold uppercase tracking-wider text-[#1ed760] shrink-0 pr-1 flex items-center gap-1">
              Ver letra
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </span>
          </div>
        )}
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
            {isPlaying ? <PauseNativeIcon size={26} /> : <PlayNativeIcon size={26} className="ml-1" />}
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
