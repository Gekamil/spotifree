import React, { useState, useEffect, useRef } from 'react';
import type { Track } from '../../types/spotify';
import { SpotifyDJVisualizer } from './SpotifyDJVisualizer';
import { InteractiveMusicWaves } from './InteractiveMusicWaves';
import { useAIDJStore } from '../../services/aiDJService';
import { usePlayerStore } from '../../store/usePlayerStore';
import {
  PlayNativeIcon,
  PauseNativeIcon,
  NextNativeIcon,
  PrevNativeIcon,
  QueueNativeIcon,
  CloseNativeIcon,
  AddTrackNativeIcon,
  CheckTrackNativeIcon,
} from '../icons/SpotifyNativeIcons';
import { formatDuration } from '../../utils/formatters';
import { resolveVibrantColor, extractDominantColorFromImage } from '../../utils/spotifyColor';
import { handleImageError } from '../../utils/imageFallback';
import { getTrackCoverUrl, resolveTrackCoversBatch } from '../../utils/trackCovers';

interface AIDJViewProps {
  onBack: () => void;
  isMobile?: boolean;
  onOpenPlayer?: () => void;
}

const getBestTrackArtwork = (track: Track | null | undefined): string => {
  if (!track) return 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';
  const cached = getTrackCoverUrl(track);
  if (cached && !cached.includes('liked-songs')) return cached;
  if (track.album?.images?.[0]?.url && !track.album.images[0].url.includes('liked-songs')) {
    return track.album.images[0].url;
  }
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
    djThemeColor,
    setDJThemeColor,
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
    progressMs,
    durationMs,
    playTrack,
    togglePlay,
    nextTrack,
    previousTrack,
    likedTrackIds,
    toggleLike,
    queue,
  } = usePlayerStore();

  const [showQueueDrawer, setShowQueueDrawer] = useState(false);
  const [ambientColor, setAmbientColor] = useState<string>('#0c52cc');
  const [promptInput, setPromptInput] = useState('');
  const [textGlowKey, setTextGlowKey] = useState(0);
  const [, setCoversVersion] = useState(0);
  const prevTextRef = useRef('');

  // Resolve album covers for all DJ tracks in background
  useEffect(() => {
    const list = djTracks && djTracks.length > 0 ? djTracks : queue;
    if (list && list.length > 0) {
      resolveTrackCoversBatch(list).then(() => {
        setCoversVersion((v) => v + 1);
      }).catch(() => {});
    }
  }, [djTracks, queue]);

  // Dynamically extract dominant color from current track artwork
  useEffect(() => {
    const art = getBestTrackArtwork(currentTrack);
    if (art && !art.includes('liked-songs')) {
      extractDominantColorFromImage(art).then((hex) => {
        if (hex) {
          setAmbientColor(hex);
          setDJThemeColor(hex);
        } else if (currentTrack?.id) {
          const col = resolveVibrantColor(currentTrack.id, currentTrack.name);
          setAmbientColor(col);
          setDJThemeColor(col);
        }
      });
    } else if (currentTrack?.id) {
      const col = resolveVibrantColor(currentTrack.id, currentTrack.name);
      setAmbientColor(col);
      setDJThemeColor(col);
    }
  }, [currentTrack, setDJThemeColor]);

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

  // Trigger smooth glow & fade whenever the displayed text changes
  useEffect(() => {
    if (subtitleToShow && subtitleToShow !== prevTextRef.current) {
      prevTextRef.current = subtitleToShow;
      setTextGlowKey((k) => k + 1);
    }
  }, [subtitleToShow]);

  const handleTrackClick = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track, tracksToDisplay, 'dj-session');
    }
  };

  const isCurrentLiked = currentTrack ? likedTrackIds.includes(currentTrack.id) : false;
  const currentDuration = durationMs || currentTrack?.duration_ms || 180000;
  const currentProgress = Math.min(progressMs, currentDuration);
  const progressPercent = currentDuration > 0 ? (currentProgress / currentDuration) * 100 : 0;
  const activeArtwork = getBestTrackArtwork(currentTrack);

  const isSpeaking = visualizerState === 'speaking' || visualizerState === 'listening';

  return (
    <div
      className="relative w-full h-full min-h-screen text-white flex flex-col justify-between overflow-hidden select-none font-['SpotifyMixUI'] animate-in fade-in duration-300 p-3 sm:p-5"
      style={{
        backgroundColor: '#050b18',
      }}
    >
      {/* =========================================================================
          BACKGROUND LAYER 1: DEEP BLURRED CANVAS / ALBUM ART OF CURRENT TRACK
          ========================================================================= */}
      {activeArtwork && (
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden transition-all duration-1000 ease-out"
          style={{
            backgroundImage: `url(${activeArtwork})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(55px) brightness(0.24) saturate(1.4)',
            transform: 'scale(1.15)',
          }}
        />
      )}

      {/* =========================================================================
          BACKGROUND LAYER 2: INTERACTIVE MUSIC WAVES (Audio frequency glow)
          ========================================================================= */}
      <InteractiveMusicWaves
        isPlaying={isPlaying}
        isSpeaking={isSpeaking}
        voiceLevel={voiceLevel}
        themeColor={ambientColor || '#1ed760'}
        className="opacity-70"
      />

      {/* =========================================================================
          BACKGROUND LAYER 3: RADIAL VIGNETTE & AMBIENT AURA GLOW
          ========================================================================= */}
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-1000"
        style={{
          background: `radial-gradient(circle at 50% 36%, ${ambientColor || '#0c52cc'}99 0%, ${ambientColor || '#0c52cc'}44 48%, #050b18fa 92%)`,
        }}
      />

      {/* Top Header matching Photo 2 */}
      <header className="flex items-center justify-between px-2 py-1.5 z-20 shrink-0">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-black/25 hover:bg-black/45 backdrop-blur-md flex items-center justify-center text-white transition-all cursor-pointer active:scale-95"
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
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 backdrop-blur-md ${
            showQueueDrawer ? 'bg-[#1ed760] text-black shadow-md' : 'text-white/80 hover:text-white bg-black/25 hover:bg-black/45'
          }`}
          title="Ver cola y canciones del DJ"
        >
          <QueueNativeIcon size={18} />
        </button>
      </header>

      {/* Center: The Hollow Smooth Organic Green-Cyan DJ Ring (Photo 2) */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center max-w-xl mx-auto w-full z-10 my-auto py-1">
        <div
          onClick={toggleMic}
          className="cursor-pointer transition-transform hover:scale-104 active:scale-95 my-1"
          title={isMicListening ? 'Escuchando... haz clic para detener' : 'Haz clic para hablar con el DJ'}
        >
          <SpotifyDJVisualizer
            size={isMobile ? 250 : 310}
            state={visualizerState}
            voiceLevel={voiceLevel}
            themeColor={ambientColor}
          />
        </div>

        {/* Subtitle / Transcript with Smooth Glow & Fade Transition */}
        <div className="min-h-[62px] flex items-center justify-center px-4 mt-2">
          <p
            key={`glow-txt-${textGlowKey}`}
            className="text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-snug drop-shadow-[0_2px_14px_rgba(255,255,255,0.45)] font-['SpotifyMixUITitle'] max-w-lg transition-all duration-400 ease-out animate-in fade-in"
          >
            {isMicListening ? (
              <span className="text-[#00f2fe] flex items-center justify-center gap-2 drop-shadow-[0_0_16px_rgba(0,242,254,0.7)]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00f2fe] animate-ping" />
                Te escucho... habla conmigo
              </span>
            ) : (
              <span>{subtitleToShow || 'Aquí tu DJ de Spotify...'}</span>
            )}
          </p>
        </div>

        {/* Text Chat / Prompt Input Bar in Frosted Glass ("Cristal") */}
        <div className="w-full max-w-md mt-3 space-y-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendPrompt();
            }}
            className="flex items-center gap-2 bg-white/[0.08] hover:bg-white/[0.12] border border-white/20 focus-within:border-white/45 rounded-full px-3 py-1.5 backdrop-blur-xl shadow-[0_8px_28px_rgba(0,0,0,0.35)] transition-all"
          >
            <button
              type="button"
              onClick={toggleMic}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                isMicListening
                  ? 'bg-[#00f2fe] text-black shadow-[0_0_14px_rgba(0,242,254,0.9)] animate-pulse'
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

          {/* Quick Vibe Chips in Frosted Glass ("Cristal") */}
          <div className="flex items-center justify-center gap-1.5 flex-wrap overflow-x-auto py-0.5 scrollbar-none">
            {QUICK_VIBE_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleSendPrompt(chip)}
                className="px-3 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.18] active:scale-95 text-[11px] font-bold text-white/90 border border-white/15 backdrop-blur-md shadow-sm transition-all cursor-pointer whitespace-nowrap"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* =========================================================================
            CLASSIC SPOTIFY MINI-PLAYER ("El minireproductor de toda la vida")
            ========================================================================= */}
        {currentTrack && (
          <div
            onClick={() => onOpenPlayer?.()}
            className="w-full max-w-md mt-3.5 h-14 rounded-[8px] flex items-center justify-between px-2.5 overflow-hidden cursor-pointer select-none transition-all active:scale-[0.99] font-['SpotifyMixUI'] shadow-[0_8px_24px_rgba(0,0,0,0.6)] border border-white/15 backdrop-blur-2xl relative"
            style={{
              backgroundColor: `${ambientColor || '#181818'}55`,
            }}
            title="Toca para abrir reproductor completo con letra y detalles"
          >
            {/* 2px Bottom Progress Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/20 rounded-b-[8px] overflow-hidden pointer-events-none">
              <div
                className="h-full bg-white transition-all duration-200 ease-linear"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Left: Artwork + Track details */}
            <div className="flex items-center min-w-0 flex-1 mr-2">
              <div className="w-10 h-10 rounded-[4px] shrink-0 overflow-hidden bg-[#181818] shadow-md ml-0.5">
                <img
                  src={activeArtwork}
                  alt={currentTrack.name}
                  onError={handleImageError}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex flex-col justify-center min-w-0 ml-2.5 flex-1 pr-1 text-left">
                <span className="font-bold text-white text-[13px] leading-tight truncate block font-['SpotifyMixUITitle']">
                  {currentTrack.name}
                </span>
                <span className="text-[11px] text-white/70 truncate leading-tight mt-0.5">
                  {currentTrack.artists?.map((a) => a.name).join(', ') || 'Artista'}
                </span>
              </div>
            </div>

            {/* Right: Like Button + Play/Pause */}
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => toggleLike(currentTrack.id)}
                className="w-8 h-8 flex items-center justify-center text-[#b3b3b3] hover:text-white active:scale-95 transition-transform cursor-pointer"
                title={isCurrentLiked ? 'Quitar de tus Me Gusta' : 'Añadir a tus Me Gusta'}
              >
                {isCurrentLiked ? (
                  <CheckTrackNativeIcon size={20} className="text-[#1ed760]" />
                ) : (
                  <AddTrackNativeIcon size={20} className="text-white/80" />
                )}
              </button>

              <button
                onClick={togglePlay}
                className="w-9 h-9 flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer"
                title={isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPlaying ? (
                  <PauseNativeIcon size={20} className="text-white" />
                ) : (
                  <PlayNativeIcon size={20} className="text-white ml-0.5" />
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Playback Controls matching Photo 2 */}
      <footer className="relative z-20 px-4 py-3 flex items-center justify-between shrink-0">
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
          className="w-14 h-14 rounded-full border border-white/20 text-[#1ed760] flex items-center justify-center cursor-pointer hover:scale-108 active:scale-95 transition-all shadow-xl"
          style={{
            backgroundColor: djThemeColor || ambientColor || '#0042a5',
            boxShadow: `0 4px 24px ${djThemeColor || ambientColor || '#0042a5'}80`,
            transition: 'background-color 0.8s ease, box-shadow 0.8s ease',
          }}
          title="Cambiar de rollo con el DJ"
        >
          <SpotifyDJVisualizer size={38} mini state="playing" themeColor={djThemeColor || ambientColor} />
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
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
                title="Cerrar"
              >
                <CloseNativeIcon size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 mt-3 pr-1">
              {tracksToDisplay.map((track, idx) => {
                const isPlayingThis = isPlaying && currentTrack?.id === track.id;
                const trackArt = getBestTrackArtwork(track);
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
