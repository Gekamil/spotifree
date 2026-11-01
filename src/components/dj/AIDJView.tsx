import React, { useState, useEffect, useRef } from 'react';
import { SpotifyDJVisualizer } from './SpotifyDJVisualizer';
import { useAIDJStore, DJ_VIBE_PRESETS } from '../../services/aiDJService';
import { usePlayerStore } from '../../store/usePlayerStore';
import { PlayNativeIcon, PauseNativeIcon, NextNativeIcon } from '../icons/SpotifyNativeIcons';

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

  const { currentTrack, isPlaying, togglePlay, nextTrack } = usePlayerStore();
  const [inputText, setInputText] = useState('');
  const hasInitializedRef = useRef(false);

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
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-gradient-to-tr from-[#1ed760]/12 via-[#00f2fe]/15 to-[#2e77d0]/12 rounded-full blur-[130px] opacity-70" />
      </div>

      {/* 1. Minimal Spotify Top Bar */}
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

        {/* Clean Spotify DJ Header Title */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#1ed760] animate-pulse" />
          <h1 className="text-sm font-bold tracking-wider uppercase text-white font-['SpotifyMixUITitle']">
            DJ
          </h1>
        </div>

        {/* Microphone Toggle */}
        <button
          onClick={toggleMic}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
            isMicListening
              ? 'bg-[#00f2fe] text-black shadow-[0_0_15px_rgba(0,242,254,0.7)] animate-pulse'
              : 'text-[#b3b3b3] hover:text-white hover:bg-white/10'
          }`}
          title={isMicListening ? 'Detener micrófono' : 'Hablar con el DJ'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
            <line x1="8" y1="23" x2="16" y2="23"></line>
          </svg>
        </button>
      </header>

      {/* 2. Central Section: Visualizer & Subtitles */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-3 text-center max-w-2xl mx-auto w-full">
        {/* Visualizer Orb */}
        <div className="my-2 flex items-center justify-center">
          <SpotifyDJVisualizer
            size={isMobile ? 260 : 340}
            state={visualizerState}
            voiceLevel={voiceLevel}
            onClick={toggleMic}
          />
        </div>

        {/* DJ Speech Subtitle */}
        <div className="min-h-[75px] max-w-xl flex items-center justify-center px-4 mt-2">
          <p className="text-lg md:text-2xl font-bold tracking-tight text-white leading-snug drop-shadow-md font-['SpotifyMixUITitle'] transition-all">
            {subtitleToShow ? (
              <span>"{subtitleToShow}"</span>
            ) : (
              <span className="text-[#a7a7a7] text-sm md:text-base font-normal">
                Toca el círculo o escribe abajo para hablar con tu DJ...
              </span>
            )}
          </p>
        </div>

        {/* Current Set / Vibe Tag */}
        {currentSetTitle && (
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.07] border border-white/10 text-[11px] font-semibold text-[#b3b3b3] uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00f2fe]" />
            <span>{currentSetTitle}</span>
          </div>
        )}

        {/* 3. Simple Conversational Input Bar */}
        <div className="w-full max-w-lg mt-6 px-2">
          <form
            onSubmit={handleSendPrompt}
            className="flex items-center gap-2 bg-[#181818] border border-white/15 focus-within:border-white/40 rounded-full px-4 py-1.5 shadow-xl transition-all"
          >
            <button
              type="button"
              onClick={toggleMic}
              className={`p-1.5 rounded-full transition-colors cursor-pointer shrink-0 ${
                isMicListening ? 'text-[#00f2fe]' : 'text-[#b3b3b3] hover:text-white'
              }`}
              title="Hablar por micrófono"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              </svg>
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Dile a tu DJ qué te apetece o cómo te sientes..."
              className="flex-1 bg-transparent text-sm text-white placeholder-[#727272] focus:outline-none py-1"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="px-3.5 py-1.5 rounded-full bg-white text-black font-bold text-xs uppercase tracking-wider hover:scale-104 active:scale-96 transition-all disabled:opacity-20 disabled:hover:scale-100 cursor-pointer shrink-0"
            >
              Pedir
            </button>
          </form>

          {/* Quick Clean Vibe Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
            {DJ_VIBE_PRESETS.map((vibe) => (
              <button
                key={vibe.id}
                onClick={() => handleVibeClick(vibe.query)}
                className="px-3 py-1 rounded-full bg-white/[0.06] hover:bg-white/[0.15] text-xs font-medium text-[#b3b3b3] hover:text-white border border-white/5 transition-all cursor-pointer active:scale-95"
              >
                {vibe.label}
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* 4. Sleek Spotify Playback Dock */}
      {currentTrack && (
        <footer className="relative z-20 w-full max-w-xl mx-auto px-4 pb-6 pt-2 shrink-0">
          <div className="bg-[#181818]/95 border border-white/10 rounded-2xl p-3 flex items-center justify-between shadow-2xl backdrop-blur-lg">
            {/* Track Info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <img
                src={currentTrack.album?.images?.[0]?.url || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'}
                alt={currentTrack.name}
                className="w-12 h-12 rounded-[6px] object-cover shadow-md shrink-0"
              />
              <div className="min-w-0 flex-1 pr-2">
                <p className="text-sm font-bold text-white truncate">{currentTrack.name}</p>
                <p className="text-xs text-[#b3b3b3] truncate">
                  {currentTrack.artists?.map((a) => a.name).join(', ')}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer shadow-md"
                title={isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPlaying ? <PauseNativeIcon size={20} /> : <PlayNativeIcon size={20} />}
              </button>

              <button
                onClick={nextTrack}
                className="w-9 h-9 rounded-full text-[#b3b3b3] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Siguiente canción"
              >
                <NextNativeIcon size={18} />
              </button>

              {/* Iconic Spotify DJ Action Button */}
              <button
                onClick={triggerManualTransition}
                className="px-3.5 py-2 rounded-full bg-gradient-to-r from-[#1ed760] via-[#00f2fe] to-[#2e77d0] text-black font-bold text-xs flex items-center gap-1.5 hover:scale-104 active:scale-95 transition-all shadow-lg cursor-pointer"
                title="Pedir al DJ que cambie de vibra"
              >
                <span>✦ Cambiar de rollo</span>
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};
