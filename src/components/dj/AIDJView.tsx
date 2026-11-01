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

  const { currentTrack, isPlaying, togglePlay } = usePlayerStore();
  const [inputText, setInputText] = useState('');
  const hasInitializedRef = useRef(false);

  // Initialize DJ session speech on first mount
  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      startDJSession();
    }

    return () => {
      // Don't kill audio when unmounting, but stop DJ speech
      useAIDJStore.getState().stopDJSession();
    };
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
    <div className="relative w-full h-full min-h-screen bg-[#08080c] text-white flex flex-col justify-between overflow-x-hidden overflow-y-auto select-none font-['SpotifyMixUI']">
      {/* Dynamic Background Mesh Gradients */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-[#1ed760]/15 via-[#00f2fe]/15 to-[#2e77d0]/20 rounded-full blur-[120px] opacity-75" />
        <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-[#8b5cf6]/10 rounded-full blur-[100px]" />
      </div>

      {/* 1. Header Bar */}
      <header className="relative z-20 flex items-center justify-between px-6 py-5 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[#b3b3b3] hover:text-white transition-colors bg-[#181818]/60 hover:bg-[#282828] px-3.5 py-1.5 rounded-full border border-white/10 text-xs font-semibold backdrop-blur-md cursor-pointer active:scale-95"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Salir del DJ
        </button>

        {/* DJ Badge */}
        <div className="flex items-center gap-2 bg-gradient-to-r from-[#1ed760]/20 via-[#00f2fe]/20 to-[#2e77d0]/20 px-3 py-1 rounded-full border border-[#00f2fe]/30 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-[#1ed760] animate-ping" />
          <span className="text-[11px] font-black tracking-widest text-[#00f2fe] uppercase">
            ✦ Spotify AI DJ
          </span>
        </div>

        {/* Microphone Quick Toggle */}
        <button
          onClick={toggleMic}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
            isMicListening
              ? 'bg-[#00f2fe] text-black shadow-[0_0_15px_rgba(0,242,254,0.6)] animate-pulse'
              : 'bg-[#181818]/80 text-[#b3b3b3] hover:text-white hover:bg-[#282828] border border-white/10'
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

      {/* 2. Central Area: Orb & Dynamic Subtitles */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-2 text-center max-w-3xl mx-auto w-full">
        {/* Set Title Pill */}
        <div className="mb-4 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-[#b3b3b3] uppercase tracking-wider backdrop-blur-sm">
          <span>{currentSetTitle}</span>
        </div>

        {/* The Fluid Spotify AI DJ Orb */}
        <div className="my-2 flex items-center justify-center">
          <SpotifyDJVisualizer
            size={isMobile ? 270 : 360}
            state={visualizerState}
            voiceLevel={voiceLevel}
            onClick={toggleMic}
          />
        </div>

        {/* Subtitle / DJ Transcription Box */}
        <div className="min-h-[70px] max-w-xl flex items-center justify-center px-4 mt-2">
          <p className="text-base md:text-xl font-bold tracking-tight text-white leading-relaxed drop-shadow-md transition-all">
            {subtitleToShow ? (
              <span>"{subtitleToShow}"</span>
            ) : (
              <span className="text-[#b3b3b3] italic font-normal text-sm">
                Pulsa el círculo o el micrófono para hablar con tu DJ...
              </span>
            )}
          </p>
        </div>

        {/* 3. Vibe Suggestion Pills */}
        <div className="w-full max-w-2xl mt-5 px-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {DJ_VIBE_PRESETS.map((vibe) => (
              <button
                key={vibe.id}
                onClick={() => handleVibeClick(vibe.query)}
                className="px-3.5 py-1.5 rounded-full bg-[#181818]/90 hover:bg-[#282828] text-xs font-semibold text-[#e0e0e0] hover:text-white border border-white/10 hover:border-[#1ed760]/40 transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                {vibe.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Text input for custom prompts */}
        <form
          onSubmit={handleSendPrompt}
          className="w-full max-w-md mt-4 flex items-center gap-2 bg-[#181818]/90 border border-white/15 focus-within:border-[#1ed760] rounded-full px-4 py-1.5 shadow-lg backdrop-blur-md transition-all"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Pide una vibra, artista o género..."
            className="flex-1 bg-transparent text-sm text-white placeholder-[#727272] focus:outline-none"
          />
          <button
            type="button"
            onClick={toggleMic}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isMicListening ? 'text-[#00f2fe]' : 'text-[#b3b3b3] hover:text-white'
            }`}
            title="Hablar por micrófono"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            </svg>
          </button>
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="px-3 py-1 rounded-full bg-[#1ed760] text-black font-bold text-xs uppercase tracking-wider hover:scale-104 active:scale-96 transition-all disabled:opacity-30 disabled:hover:scale-100 cursor-pointer"
          >
            Pedir
          </button>
        </form>
      </main>

      {/* 5. Bottom Playback Dock */}
      {currentTrack && (
        <footer className="relative z-20 w-full max-w-xl mx-auto px-4 pb-6 pt-2 shrink-0">
          <div className="bg-[#181818]/90 border border-white/10 rounded-2xl p-3 flex items-center justify-between shadow-2xl backdrop-blur-lg">
            {/* Track Info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <img
                src={currentTrack.album?.images?.[0]?.url || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'}
                alt={currentTrack.name}
                className="w-11 h-11 rounded-lg object-cover shadow-md shrink-0"
              />
              <div className="min-w-0 flex-1 pr-2">
                <p className="text-sm font-bold text-white truncate">{currentTrack.name}</p>
                <p className="text-xs text-[#b3b3b3] truncate">
                  {currentTrack.artists?.map((a) => a.name).join(', ')}
                </p>
              </div>
            </div>

            {/* Playback Controls & DJ Next Vibe */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={togglePlay}
                className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform cursor-pointer shadow-md"
                title={isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isPlaying ? <PauseNativeIcon size={20} /> : <PlayNativeIcon size={20} />}
              </button>

              <button
                onClick={triggerManualTransition}
                className="px-3 py-2 rounded-full bg-gradient-to-r from-[#1ed760] to-[#00f2fe] text-black font-bold text-xs flex items-center gap-1.5 hover:scale-104 active:scale-95 transition-all shadow-md cursor-pointer"
                title="Pedir al DJ que cambie de vibra"
              >
                <span>✦ Cambiar vibra</span>
                <NextNativeIcon size={14} />
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};
