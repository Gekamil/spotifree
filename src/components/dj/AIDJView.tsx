import React, { useState, useEffect, useRef } from 'react';
import { SpotifyDJVisualizer } from './SpotifyDJVisualizer';
import { useAIDJStore, DJ_VIBE_PRESETS } from '../../services/aiDJService';
import { aiDJVoiceService } from '../../services/aiDJVoiceService';
import { usePlayerStore } from '../../store/usePlayerStore';
import { PlayNativeIcon, PauseNativeIcon, NextNativeIcon } from '../icons/SpotifyNativeIcons';
import { AIDJSettingsModal } from './AIDJSettingsModal';

interface AIDJViewProps {
  onBack: () => void;
  isMobile?: boolean;
}

export const AIDJView: React.FC<AIDJViewProps> = ({ onBack, isMobile = false }) => {
  const {
    visualizerState,
    voiceLevel,
    displayedTranscript,
    currentMessage,
    currentSetTitle,
    isMicListening,
    startDJSession,
    handleUserPrompt,
    startVoiceListening,
    stopVoiceListening,
    triggerManualTransition,
  } = useAIDJStore();

  const { currentTrack, isPlaying, togglePlay, nextTrack, previousTrack } = usePlayerStore();
  const [inputText, setInputText] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const hasInitializedRef = useRef(false);

  const activeConfig = aiDJVoiceService.getConfig();
  const voiceLabel = activeConfig.voice.includes('Dalia')
    ? 'LIVI • EN ESPAÑOL'
    : activeConfig.voice.includes('Alvaro')
    ? 'ÁLVARO • EN ESPAÑOL'
    : activeConfig.voice.includes('Elvira')
    ? 'ELVIRA • EN ESPAÑOL'
    : activeConfig.voice.includes('Salome')
    ? 'SALOMÉ • EN ESPAÑOL'
    : 'X • IN ENGLISH';

  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      startDJSession();
    }
  }, [startDJSession]);

  const handleSendPrompt = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    handleUserPrompt(inputText.trim());
    setInputText('');
  };

  const handleVibeClick = (query: string) => {
    handleUserPrompt(query);
  };

  const toggleMic = () => {
    if (isMicListening) {
      stopVoiceListening();
    } else {
      startVoiceListening();
    }
  };

  const subtitleToShow = displayedTranscript || currentMessage;

  return (
    <div className="relative w-full h-full min-h-screen bg-[#070709] text-white flex flex-col justify-between overflow-x-hidden overflow-y-auto select-none font-['SpotifyMixUI']">
      {/* Background Soft Aura Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] bg-gradient-to-tr from-[#00f2fe]/10 via-[#0d72ea]/12 to-[#1ed760]/10 rounded-full blur-[140px] opacity-70" />
      </div>

      {/* 1. Sleek Spotify Top Bar */}
      <header className="relative z-20 flex items-center justify-between px-6 py-4 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[#b3b3b3] hover:text-white transition-colors cursor-pointer text-sm font-semibold active:scale-95"
          title="Volver"
        >
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M11.03.47a.75.75 0 0 1 0 1.06L4.56 8l6.47 6.47a.75.75 0 1 1-1.06 1.06L2.44 8 9.97.47a.75.75 0 0 1 1.06 0" />
          </svg>
          <span>Volver</span>
        </button>

        {/* Clean Spotify DJ Header Badge */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
          <span className="w-2 h-2 rounded-full bg-[#1ed760] animate-pulse" />
          <h1 className="text-xs font-black tracking-widest uppercase text-white font-['SpotifyMixUITitle']">
            DJ • {voiceLabel}
          </h1>
        </div>

        {/* Actions: Voice & Engine Settings */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 text-[#b3b3b3] hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="Configuración de voz e IA"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
      </header>

      {/* 2. Central Section: Official Spotify Liquid Visualizer & Subtitles */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-2 text-center max-w-2xl mx-auto w-full">
        {/* The Official Liquid Morphing DJ Orb */}
        <div className="my-1 flex items-center justify-center">
          <SpotifyDJVisualizer
            size={isMobile ? 240 : 310}
            state={visualizerState}
            voiceLevel={voiceLevel}
            onClick={toggleMic}
          />
        </div>

        {/* Dynamic Spoken Text & Subtitles in Pure Spotify Typography */}
        <div className="min-h-[70px] max-w-xl flex items-center justify-center px-4 mt-1">
          <p className="text-xl md:text-2xl font-bold tracking-tight text-white leading-snug drop-shadow font-['SpotifyMixUITitle'] transition-all">
            {subtitleToShow ? (
              <span>{subtitleToShow}</span>
            ) : (
              <span className="text-[#a7a7a7] text-sm md:text-base font-normal">
                Pide lo que te apetece escuchar o pulsa el micrófono...
              </span>
            )}
          </p>
        </div>

        {/* Mini Now Playing Showcase */}
        {currentTrack && (
          <div className="mt-2 flex items-center gap-3 bg-[#181818]/80 hover:bg-[#202020] border border-white/5 px-4 py-2 rounded-full transition-all shadow-md backdrop-blur-md">
            {currentTrack.album?.images?.[0]?.url ? (
              <img
                src={currentTrack.album.images[0].url}
                alt={currentTrack.name}
                className="w-8 h-8 rounded-full object-cover shrink-0 shadow-sm"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/10 shrink-0" />
            )}
            <div className="text-left leading-tight truncate max-w-[200px]">
              <p className="text-xs font-bold text-white truncate">{currentTrack.name}</p>
              <p className="text-[11px] text-[#a7a7a7] truncate">{currentTrack.artists?.[0]?.name}</p>
            </div>
            {isPlaying && (
              <div className="flex items-center gap-0.5 ml-1">
                <span className="w-0.5 h-3 bg-[#1ed760] rounded-full animate-pulse" />
                <span className="w-0.5 h-4 bg-[#1ed760] rounded-full animate-pulse delay-75" />
                <span className="w-0.5 h-2 bg-[#1ed760] rounded-full animate-pulse delay-150" />
              </div>
            )}
          </div>
        )}

        {/* 3. Sleek Spotify Input Bar */}
        <div className="w-full max-w-lg mt-5 px-2">
          <form
            onSubmit={handleSendPrompt}
            className="flex items-center bg-[#242424] hover:bg-[#2a2a2a] focus-within:bg-[#2a2a2a] focus-within:border-white/30 border border-white/10 rounded-full px-4 py-2 shadow-xl transition-all duration-200"
          >
            {/* Sparkle Icon */}
            <span className="text-[#00f2fe] shrink-0 mr-2.5">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
              </svg>
            </span>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Pide una vibra, artista o cómo te sientes..."
              className="w-full bg-transparent border-none text-white text-sm outline-none placeholder:text-[#a7a7a7] font-normal"
            />

            {/* Mic Toggle */}
            <button
              type="button"
              onClick={toggleMic}
              className={`p-1.5 rounded-full transition-all cursor-pointer active:scale-95 shrink-0 ${
                isMicListening
                  ? 'bg-[#00f2fe] text-black shadow-[0_0_12px_rgba(0,242,254,0.7)] animate-pulse'
                  : 'text-[#b3b3b3] hover:text-white hover:bg-white/10'
              }`}
              title={isMicListening ? 'Detener micrófono' : 'Hablar con el DJ'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
              </svg>
            </button>

            {/* Submit Arrow */}
            {inputText.trim() && (
              <button
                type="submit"
                className="ml-2 w-7 h-7 rounded-full bg-white text-black font-bold flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            )}
          </form>

          {/* Quick Spotify Vibe Chips (NO EMOJIS, 100% Spotify Design) */}
          <div className="flex items-center justify-center flex-wrap gap-2 mt-3.5 px-2">
            {DJ_VIBE_PRESETS.map((vibe) => (
              <button
                key={vibe.id}
                onClick={() => handleVibeClick(vibe.query)}
                className="px-3.5 py-1.5 rounded-full bg-[#242424] hover:bg-[#333333] text-white text-xs font-semibold border border-white/5 transition-all cursor-pointer active:scale-95 select-none"
              >
                {vibe.label}
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* 4. Sleek Bottom Action & Playback Dock */}
      <footer className="relative z-20 px-6 py-4 flex items-center justify-between border-t border-white/5 bg-[#070709]/90 backdrop-blur-md">
        {/* Current Set Context */}
        <div className="hidden sm:flex items-center gap-2 text-xs text-[#a7a7a7]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760]" />
          <span className="font-semibold text-white">{currentSetTitle || 'Sesión en vivo'}</span>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-4 mx-auto sm:mx-0">
          <button
            onClick={() => previousTrack()}
            className="text-[#b3b3b3] hover:text-white transition-colors cursor-pointer active:scale-95"
            title="Anterior"
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.3 1a.7.7 0 0 1 .7.7v5.1l8.5-5.3a.7.7 0 0 1 1.1.6v11.8a.7.7 0 0 1-1.1.6L4 9.2v5.1a.7.7 0 0 1-1.4 0V1.7a.7.7 0 0 1 .7-.7" />
            </svg>
          </button>

          <button
            onClick={togglePlay}
            className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-lg"
            title={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isPlaying ? <PauseNativeIcon size={20} /> : <PlayNativeIcon size={20} />}
          </button>

          <button
            onClick={() => nextTrack()}
            className="text-[#b3b3b3] hover:text-white transition-colors cursor-pointer active:scale-95"
            title="Siguiente"
          >
            <NextNativeIcon size={20} />
          </button>
        </div>

        {/* Signature Spotify DJ Action Button */}
        <div>
          <button
            onClick={() => triggerManualTransition()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-[#00f2fe] via-[#0d72ea] to-[#1ed760] text-black font-extrabold text-xs tracking-wide shadow-[0_0_18px_rgba(0,242,254,0.35)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="Cambiar de estilo musical"
          >
            <span>✦ Cambiar de rollo</span>
          </button>
        </div>
      </footer>

      {/* Voice & AI Configuration Modal */}
      <AIDJSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};
