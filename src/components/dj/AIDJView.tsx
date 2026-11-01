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

// Spotify Quick Suggestions (NO emojis, authentic Spotify text style)
const QUICK_PROMPTS = [
  'Más reggaeton',
  'Algo tranquilo para relajar',
  'Canciones de Romeo Santos',
  'Modo entreno con fuerza',
  'Clásicos de siempre',
];

export const AIDJView: React.FC<AIDJViewProps> = ({ onBack, isMobile = false }) => {
  const {
    visualizerState,
    voiceLevel,
    displayedTranscript,
    currentMessage,
    isMicListening,
    djTracks,
    chatHistory,
    viewMode,
    currentSetTitle,
    setViewMode,
    startDJSession,
    handleUserPrompt,
    startVoiceListening,
    stopVoiceListening,
  } = useAIDJStore();

  const { currentTrack, isPlaying, playTrack, togglePlay, queue } = usePlayerStore();
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      startDJSession();
    }
  }, [startDJSession]);

  useEffect(() => {
    if (viewMode === 'chat') {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, viewMode]);

  const toggleMic = () => {
    if (isMicListening) {
      stopVoiceListening();
    } else {
      startVoiceListening();
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');
    handleUserPrompt(text);
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
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-gradient-to-tr from-[#00f2fe]/10 via-[#0d72ea]/10 to-[#1ed760]/10 rounded-full blur-[140px] opacity-70" />
      </div>

      {/* 1. Spotify Top Navigation Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 bg-[#070709]/95 backdrop-blur-md shrink-0 border-b border-white/5">
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

        {/* Real Spotify Segmented Pill Toggle: Chat vs Lista */}
        <div className="flex items-center bg-[#181818] p-1 rounded-full border border-white/10 shadow-sm">
          <button
            onClick={() => setViewMode('chat')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'chat'
                ? 'bg-white text-black shadow-sm'
                : 'text-[#b3b3b3] hover:text-white'
            }`}
            title="Vista de conversación y peticiones con el DJ"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M12.5 1h-9A2.5 2.5 0 0 0 1 3.5v7A2.5 2.5 0 0 0 3.5 13H5v2.5a.5.5 0 0 0 .8.4L9.5 13h3a2.5 2.5 0 0 0 2.5-2.5v-7A2.5 2.5 0 0 0 12.5 1zm1 9.5a1 1 0 0 1-1 1h-3.2a.5.5 0 0 0-.32.12L6.5 13.68V12a.5.5 0 0 0-.5-.5h-2.5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1z" />
            </svg>
            <span>Chat</span>
          </button>
          <button
            onClick={() => setViewMode('playlist')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'playlist'
                ? 'bg-white text-black shadow-sm'
                : 'text-[#b3b3b3] hover:text-white'
            }`}
            title="Vista de lista de canciones"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M15 15H1v-1.5h14V15zm0-4.5H1V9h14v1.5zm-14-7A1.5 1.5 0 0 1 2.5 2h11A1.5 1.5 0 0 1 15 3.5V6H1V3.5z" />
            </svg>
            <span>Lista</span>
          </button>
        </div>
      </header>

      {/* VIEW MODE A: CONVERSATIONAL CHAT WITH DJ */}
      {viewMode === 'chat' && (
        <div className="relative z-10 flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 md:px-6 pt-1 pb-4 h-[calc(100vh-150px)]">
          {/* Top: Fluid Morphing Canvas Orb Visualizer */}
          <div className="flex flex-col items-center justify-center pt-1 pb-2 text-center shrink-0">
            <div
              onClick={toggleMic}
              className="cursor-pointer transition-transform hover:scale-102 active:scale-98 relative group"
              title={isMicListening ? 'Escuchando... haz clic para detener' : 'Haz clic para hablar'}
            >
              <SpotifyDJVisualizer
                size={isMobile ? 120 : 145}
                state={visualizerState}
                voiceLevel={voiceLevel}
              />
            </div>

            <div className="min-h-[26px] max-w-md flex items-center justify-center px-2 mt-0.5">
              <p className="text-xs font-semibold tracking-wide text-[#b3b3b3] text-center font-['SpotifyMixUI']">
                {isMicListening ? (
                  <span className="text-[#00f2fe] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#00f2fe] animate-ping" />
                    Te estoy escuchando... habla conmigo
                  </span>
                ) : visualizerState === 'speaking' ? (
                  <span className="text-white drop-shadow truncate max-w-[420px]">
                    {subtitleToShow}
                  </span>
                ) : (
                  <span>Pulsa el micrófono o escribe abajo para pedirle lo que quieras al DJ</span>
                )}
              </p>
            </div>
          </div>

          {/* Middle: Conversation Timeline */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 py-2 px-1 pr-2">
            {chatHistory.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start items-start gap-2.5'}`}
                >
                  {/* DJ Avatar */}
                  {!isUser && (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#00f2fe] to-[#1ed760] text-black font-black text-[10px] flex items-center justify-center shrink-0 shadow-sm mt-1">
                      DJ
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`${
                      isUser
                        ? 'bg-[#282828] text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]'
                        : 'bg-[#181818] border border-white/10 text-white rounded-2xl rounded-tl-sm p-3.5 max-w-[85%]'
                    } text-sm leading-relaxed shadow-sm`}
                  >
                    <p className="font-normal font-['SpotifyMixUI']">{msg.text}</p>

                    {/* Curated Set Preview Card inside DJ response */}
                    {msg.curatedSetTitle && (
                      <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between gap-3 bg-white/5 hover:bg-white/10 p-2.5 rounded-xl transition-all">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-[#1ed760] text-black flex items-center justify-center shrink-0">
                            <PlayNativeIcon size={14} />
                          </div>
                          <div className="truncate text-left">
                            <p className="text-xs font-bold text-white truncate">{msg.curatedSetTitle}</p>
                            <p className="text-[11px] text-[#a7a7a7]">{msg.trackCount || 15} canciones en cola</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setViewMode('playlist')}
                          className="text-xs font-bold text-[#1ed760] hover:underline shrink-0 px-2.5 py-1 cursor-pointer bg-[#1ed760]/10 rounded-full hover:bg-[#1ed760]/20 transition-colors"
                        >
                          Ver lista
                        </button>
                      </div>
                    )}

                    <div className={`text-[10px] text-[#727272] mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatMessagesEndRef} />
          </div>

          {/* Bottom: Sleek Spotify Capsule Input Bar */}
          <div className="mt-2 pt-2 shrink-0 border-t border-white/5">
            {/* Quick Natural Suggestions */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 px-1">
              {QUICK_PROMPTS.map((promptText, idx) => (
                <button
                  key={idx}
                  onClick={() => handleUserPrompt(promptText)}
                  className="px-3 py-1 rounded-full bg-[#181818] hover:bg-[#282828] text-[#b3b3b3] hover:text-white text-xs font-semibold border border-white/10 transition-colors shrink-0 cursor-pointer active:scale-95"
                >
                  {promptText}
                </button>
              ))}
            </div>

            {/* Input Form */}
            <form
              onSubmit={handleSendMessage}
              className="flex items-center bg-[#242424] hover:bg-[#2a2a2a] focus-within:bg-[#242424] border border-white/10 focus-within:border-white/30 rounded-full px-4 py-2 transition-all shadow-xl"
            >
              {/* Mic Toggle Button */}
              <button
                type="button"
                onClick={toggleMic}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0 mr-1.5 ${
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

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Pídele al DJ que cambie el estilo, artista o ambiente..."
                className="w-full bg-transparent border-none text-white text-sm outline-none placeholder:text-[#a7a7a7] font-normal"
              />

              {inputText.trim() && (
                <button
                  type="submit"
                  className="w-7 h-7 rounded-full bg-white text-black font-bold flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 ml-1.5"
                  title="Enviar"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* VIEW MODE B: PLAYLIST VIEW WITH TRACKLIST TABLE */}
      {viewMode === 'playlist' && (
        <div className="relative z-10 flex-1 px-4 md:px-8 pb-32 max-w-5xl mx-auto w-full">
          {/* Header Banner for DJ Playlist */}
          <section className="flex items-center gap-5 pt-4 pb-6 border-b border-white/10">
            <div
              onClick={() => setViewMode('chat')}
              className="cursor-pointer transition-transform hover:scale-102 shrink-0 relative group"
              title="Haz clic para volver al chat con el DJ"
            >
              <SpotifyDJVisualizer
                size={isMobile ? 90 : 120}
                state={visualizerState}
                voiceLevel={voiceLevel}
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-[#1ed760] font-['SpotifyMixUITitle']">
                DJ • SESIÓN PERSONALIZADA
              </p>
              <h1 className="text-2xl md:text-4xl font-black text-white font-['SpotifyMixUITitle'] tracking-tight truncate mt-1">
                {currentSetTitle || 'Tu Mezcla Personalizada'}
              </h1>
              <p className="text-xs md:text-sm text-[#b3b3b3] mt-1">
                {tracksToDisplay.length} canciones • Mezcladas en vivo por tu DJ con IA
              </p>

              {/* Quick Action: Ask DJ to change vibe */}
              <div className="mt-3 flex items-center gap-3">
                <button
                  onClick={() => setViewMode('chat')}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer active:scale-95 border border-white/10"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M12.5 1h-9A2.5 2.5 0 0 0 1 3.5v7A2.5 2.5 0 0 0 3.5 13H5v2.5a.5.5 0 0 0 .8.4L9.5 13h3a2.5 2.5 0 0 0 2.5-2.5v-7A2.5 2.5 0 0 0 12.5 1zm1 9.5a1 1 0 0 1-1 1h-3.2a.5.5 0 0 0-.32.12L6.5 13.68V12a.5.5 0 0 0-.5-.5h-2.5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1z" />
                  </svg>
                  <span>Hablar con el DJ para cambiar</span>
                </button>
              </div>
            </div>
          </section>

          {/* Playlist Tracklist Table */}
          <div className="mt-4">
            {/* Table Column Headers */}
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
          </div>
        </div>
      )}
    </div>
  );
};
