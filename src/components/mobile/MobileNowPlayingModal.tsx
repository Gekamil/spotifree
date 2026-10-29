import React, { useState, useEffect, useRef } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { audioEngine } from '../../services/audioEngine';
import {
  PlayNativeIcon,
  PauseNativeIcon,
  NextNativeIcon,
  PrevNativeIcon,
  ShuffleNativeIcon,
  SmartShuffleNativeIcon,
  RepeatNativeIcon,
  RepeatOneNativeIcon,
  AddTrackNativeIcon,
  CheckTrackNativeIcon,
  SpotifyConnectNativeIcon,
} from '../icons/SpotifyNativeIcons';
import { formatDuration } from '../../utils/formatters';
import { resolveVibrantColor } from '../../utils/spotifyColor';
import { handleImageError } from '../../utils/imageFallback';
import { getArtistPicture } from '../../utils/artistImage';
import { fetchLyricsUnified } from '../../utils/lyricsService';

interface MobileNowPlayingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LyricWord {
  timeMs: number;
  text: string;
}

interface SyncedLine {
  timeMs: number;
  endTimeMs: number;
  text: string;
  words: LyricWord[];
}

function parseEnhancedLyrics(lrcText: string): SyncedLine[] {
  const rawLines = lrcText.split('\n');
  const tempLines: Array<{ timeMs: number; text: string; rawContent: string }> = [];

  for (const raw of rawLines) {
    const lineMatch = raw.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/);
    if (lineMatch) {
      const min = parseInt(lineMatch[1], 10);
      const sec = parseFloat(`${lineMatch[2]}.${lineMatch[3]}`);
      const timeMs = Math.round((min * 60 + sec) * 1000);
      const content = lineMatch[4].trim();
      if (content) {
        tempLines.push({
          timeMs,
          text: content.replace(/<\d{2}:\d{2}\.\d{2,3}>/g, '').trim(),
          rawContent: content,
        });
      }
    }
  }

  tempLines.sort((a, b) => a.timeMs - b.timeMs);

  const parsedLines: SyncedLine[] = [];
  const wordTokenRegex = /<(\d{2}):(\d{2})\.(\d{2,3})>([^<]*)/g;

  for (let i = 0; i < tempLines.length; i++) {
    const item = tempLines[i];
    const nextItem = tempLines[i + 1];
    const endTimeMs = nextItem ? nextItem.timeMs : item.timeMs + 4500;
    const words: LyricWord[] = [];

    wordTokenRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = wordTokenRegex.exec(item.rawContent)) !== null) {
      const wMin = parseInt(match[1], 10);
      const wSec = parseFloat(`${match[2]}.${match[3]}`);
      const wTimeMs = Math.round((wMin * 60 + wSec) * 1000);
      const wText = match[4];
      if (wText) {
        words.push({ timeMs: wTimeMs, text: wText });
      }
    }

    if (words.length === 0) {
      const tokens = item.text.split(/(\s+)/).filter(Boolean);
      const totalChars = tokens.reduce((acc, t) => acc + (t.trim().length > 0 ? t.length : 0), 0);
      const rawGap = Math.max(800, endTimeMs - item.timeMs);
      const lineDuration = Math.max(600, Math.min(rawGap * 0.78, 4800));
      let elapsedMs = 0;

      for (let j = 0; j < tokens.length; j++) {
        const token = tokens[j];
        const isSpace = token.trim().length === 0;
        const charWeight = isSpace ? 0.2 : token.length;
        const fraction = totalChars > 0 ? charWeight / (totalChars + 0.2 * tokens.length) : 1 / tokens.length;
        const wTimeMs = item.timeMs + Math.round(elapsedMs);
        words.push({ timeMs: wTimeMs, text: token });
        elapsedMs += fraction * lineDuration;
      }
    }

    parsedLines.push({
      timeMs: item.timeMs,
      endTimeMs,
      text: item.text,
      words,
    });
  }

  return parsedLines;
}

export const MobileNowPlayingModal: React.FC<MobileNowPlayingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    nextTrack,
    previousTrack,
    progressMs,
    durationMs,
    setProgress,
    shuffleMode,
    toggleShuffle,
    repeatMode,
    toggleRepeat,
    likedTrackIds,
    toggleLike,
  } = usePlayerStore();

  const [lyrics, setLyrics] = useState<string | null>(null);
  const [syncedLines, setSyncedLines] = useState<SyncedLine[]>([]);
  const [isLyricsExpanded, setIsLyricsExpanded] = useState(false);
  const [artistPicture, setArtistPicture] = useState<string | null>(null);
  const lyricsScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadArtistPhoto() {
      if (!currentTrack?.artists?.[0]?.name) {
        setArtistPicture(null);
        return;
      }
      try {
        const pic = await getArtistPicture(currentTrack.artists[0].name);
        if (!cancelled && pic) {
          setArtistPicture(pic);
        }
      } catch {
        // Fallback
      }
    }
    loadArtistPhoto();
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.artists?.[0]?.name]);

  useEffect(() => {
    let cancelled = false;
    async function fetchLyrics() {
      if (!currentTrack) return;
      setLyrics(null);
      setSyncedLines([]);
      try {
        const artist = currentTrack.artists?.[0]?.name || '';
        const title = currentTrack.name;
        const res = await fetchLyricsUnified(title, artist);
        if (cancelled) return;
        if (res.syncedLyrics) {
          const parsed = parseEnhancedLyrics(res.syncedLyrics);
          setSyncedLines(parsed);
          setLyrics(res.plainLyrics || null);
        } else if (res.plainLyrics) {
          setLyrics(res.plainLyrics);
          setSyncedLines([]);
        }
      } catch {
        // Fallback gracefully
      }
    }
    fetchLyrics();
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.name]);

  if (!isOpen || !currentTrack) return null;

  const isLiked = likedTrackIds.includes(currentTrack.id);
  const coverUrl = currentTrack.album?.images?.[0]?.url;
  const percent = durationMs > 0 ? Math.min(100, Math.max(0, (progressMs / durationMs) * 100)) : 0;
  const themeColor = resolveVibrantColor(currentTrack.id, currentTrack.name);
  const vocalProgressMs = progressMs + 220;

  const activeLineIndex = syncedLines.length > 0
    ? syncedLines.findIndex((line, i) => {
        const nextLine = syncedLines[i + 1];
        return vocalProgressMs >= line.timeMs && (!nextLine || vocalProgressMs < nextLine.timeMs);
      })
    : -1;

  useEffect(() => {
    if (isLyricsExpanded && lyricsScrollRef.current && activeLineIndex >= 0) {
      const activeEl = lyricsScrollRef.current.querySelector(`[data-line-index="${activeLineIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLineIndex, isLyricsExpanded]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    const newMs = (val / 100) * durationMs;
    setProgress(newMs);
    audioEngine.seek(newMs / 1000);
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-[#121212] flex flex-col select-none font-['SpotifyMixUI'] animate-in slide-in-from-bottom duration-300"
      style={{
        background: `linear-gradient(180deg, ${themeColor} 0%, rgba(18, 18, 18, 1) 500px, #121212 100%)`,
      }}
    >
      {/* Top Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between text-white px-4 py-2 bg-black/20 backdrop-blur-sm">
        <button
          onClick={onClose}
          className="w-12 h-12 flex items-center justify-center text-white hover:text-white/80 active:scale-90 transition-transform cursor-pointer"
          title="Minimizar"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 15.657l-6.364-6.364a1 1 0 0 1 1.414-1.414L12 12.828l4.95-4.95a1 1 0 1 1 1.414 1.414L12 15.657z" />
          </svg>
        </button>

        <div className="flex flex-col items-center max-w-[210px]">
          <span className="text-[10px] uppercase font-bold text-white/60 tracking-wider">
            REPRODUCIENDO DE LA LISTA
          </span>
          <span className="text-xs font-bold text-white truncate w-full text-center">
            {currentTrack.album?.name || 'Spotify'}
          </span>
        </div>

        <button
          className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white active:scale-90"
          title="Más opciones"
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm6.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM16 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
          </svg>
        </button>
      </div>

      {/* Scrollable Player Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pt-2 pb-12 space-y-6">
        {/* Large Artwork */}
        <div className="flex items-center justify-center pt-2 pb-2">
          <div className="w-full max-w-[340px] aspect-square rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.75)] bg-[#242424]">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={currentTrack.name}
                onError={handleImageError}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/40">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Title & Artist & Like */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1 mr-4">
              <h1 className="text-2xl font-black text-white truncate font-['SpotifyMixUITitle']">
                {currentTrack.name}
              </h1>
              <p className="text-base text-[#b3b3b3] truncate mt-0.5">
                {currentTrack.artists?.map((a) => a.name).join(', ') || 'Spotify'}
              </p>
            </div>
            <button
              onClick={() => toggleLike(currentTrack.id)}
              className="w-10 h-10 flex items-center justify-center text-[#b3b3b3] hover:text-white active:scale-90 transition-transform"
            >
              {isLiked ? (
                <CheckTrackNativeIcon size={26} className="text-[#1ed760]" />
              ) : (
                <AddTrackNativeIcon size={26} className="text-white/80" />
              )}
            </button>
          </div>

          {/* Scrub Bar */}
          <div className="space-y-1">
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={percent}
              onChange={handleSeek}
              className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white hover:accent-[#1ed760]"
            />
            <div className="flex justify-between text-[11px] text-[#b3b3b3] font-mono">
              <span>{formatDuration(progressMs)}</span>
              <span>{formatDuration(durationMs)}</span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={toggleShuffle}
              className={`w-10 h-10 flex flex-col items-center justify-center transition-colors active:scale-90 relative ${
                shuffleMode !== 'off' ? 'text-[#1ed760]' : 'text-[#b3b3b3]'
              }`}
            >
              {shuffleMode === 'smart' ? (
                <SmartShuffleNativeIcon size={22} className="text-[#1ed760]" />
              ) : (
                <ShuffleNativeIcon size={22} className={shuffleMode === 'all' ? 'text-[#1ed760]' : 'text-[#b3b3b3]'} />
              )}
              {shuffleMode !== 'off' && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#1ed760]" />
              )}
            </button>

            <button
              onClick={previousTrack}
              className="w-12 h-12 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform"
            >
              <PrevNativeIcon size={26} />
            </button>

            <button
              onClick={togglePlay}
              className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-106 active:scale-95 shadow-2xl transition-transform"
            >
              {isPlaying ? (
                <PauseNativeIcon size={28} className="text-black" />
              ) : (
                <PlayNativeIcon size={28} className="text-black ml-1" />
              )}
            </button>

            <button
              onClick={nextTrack}
              className="w-12 h-12 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform"
            >
              <NextNativeIcon size={26} />
            </button>

            <button
              onClick={toggleRepeat}
              className={`w-10 h-10 flex flex-col items-center justify-center transition-colors active:scale-90 relative ${
                repeatMode !== 'off' ? 'text-[#1ed760]' : 'text-[#b3b3b3]'
              }`}
            >
              {repeatMode === 'one' ? (
                <RepeatOneNativeIcon size={22} className="text-[#1ed760]" />
              ) : (
                <RepeatNativeIcon size={22} className={repeatMode === 'all' ? 'text-[#1ed760]' : 'text-[#b3b3b3]'} />
              )}
              {repeatMode !== 'off' && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#1ed760]" />
              )}
            </button>
          </div>

          {/* Authentic Spotify Device Bar & Bottom Controls */}
          <div className="flex items-center justify-between pt-3 pb-1 border-t border-white/5">
            <button className="flex items-center gap-2 text-xs font-bold text-[#1ed760] tracking-wide cursor-pointer hover:underline">
              <SpotifyConnectNativeIcon size={16} />
              <span className="uppercase tracking-wider text-[11px] font-black">Este teléfono</span>
            </button>

            <div className="flex items-center gap-4 text-[#b3b3b3]">
              <button className="hover:text-white transition-colors active:scale-90" title="Compartir">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11 2.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zm-2.5 4a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 13.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm-1.5 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm13-2.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm-1.5 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM5.5 4.5l-3 7 1 .5 3-7-1-.5zm5 0l3 7-1 .5-3-7 1-.5z" />
                </svg>
              </button>
              <button className="hover:text-white transition-colors active:scale-90" title="Cola de reproducción">
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M15 15H1v-1.5h14V15zm0-4.5H1V9h14v1.5zm0-4.5H1V4.5h14V6zm0-4.5H1V0h14v1.5z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* SECTION: Expandable Spotify Mobile Lyrics Card ("Letras") with Word-by-Word illumination */}
        <div
          className="rounded-[28px] p-6 transition-all duration-300 relative overflow-hidden shadow-2xl border border-white/10 flex flex-col justify-between"
          style={{
            backgroundColor: `${themeColor}f0`,
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
                isLyricsExpanded ? 'max-h-[500px] overflow-y-auto scroll-smooth pr-2' : 'h-[230px] overflow-hidden'
              }`}
            >
              {syncedLines.map((line, idx) => {
                const isCurrent = idx === activeLineIndex;
                return (
                  <p
                    key={`m-lyric-${idx}-${line.timeMs}`}
                    data-line-index={idx}
                    onClick={() => {
                      if (typeof window !== 'undefined' && (window as any).__audioEngine) {
                        (window as any).__audioEngine.seek(line.timeMs / 1000);
                      }
                    }}
                    className={`transition-all duration-200 leading-snug cursor-pointer flex flex-wrap items-baseline gap-x-1.5 ${
                      isCurrent
                        ? 'text-white text-xl scale-[1.02] font-black'
                        : 'text-black/55 hover:text-white/80 text-lg'
                    }`}
                  >
                    {isCurrent && line.words.length > 0 ? (
                      line.words.map((w, wIdx) => {
                        const vocalMs = progressMs + 220;
                        const isWordSung = vocalMs >= w.timeMs;
                        const isCurrentWord =
                          isWordSung &&
                          (wIdx === line.words.length - 1 || vocalMs < (line.words[wIdx + 1]?.timeMs || Infinity));
                        return (
                          <span
                            key={`mw-${idx}-${wIdx}`}
                            className={`transition-all duration-150 inline-block ${
                              isCurrentWord
                                ? 'text-white font-black drop-shadow-[0_2px_14px_rgba(255,255,255,1)] scale-105'
                                : isWordSung
                                ? 'text-white/95 font-bold'
                                : 'text-black/45 font-bold'
                            }`}
                          >
                            {w.text}
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
                if (navigator.share) {
                  navigator.share({ title: currentTrack.name, text: `Escuchando ${currentTrack.name} en Spotifree` }).catch(() => {});
                }
              }}
              className="px-4 py-1.5 rounded-full bg-black/25 hover:bg-black/40 text-xs font-bold uppercase tracking-wider flex items-center gap-2 active:scale-95 transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11 2.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zm-2.5 4a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 13.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm-1.5 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm13-2.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm-1.5 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM5.5 4.5l-3 7 1 .5 3-7-1-.5zm5 0l3 7-1 .5-3-7 1-.5z" />
              </svg>
              <span>Compartir</span>
            </button>

            <button
              onClick={() => setIsLyricsExpanded(!isLyricsExpanded)}
              className="w-8 h-8 rounded-full bg-black/25 hover:bg-black/40 flex items-center justify-center text-white active:scale-95 transition-transform"
              title={isLyricsExpanded ? 'Minimizar' : 'Expandir letras'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            </button>
          </div>
        </div>

        {/* SECTION: About the Artist Card */}
        <div className="rounded-2xl bg-[#181818] p-5 space-y-3 shadow-lg border border-white/5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-white font-['SpotifyMixUITitle']">
              Información sobre el artista
            </span>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-[#242424] shrink-0 shadow">
              {(artistPicture || coverUrl) ? (
                <img
                  src={artistPicture || coverUrl}
                  alt={currentTrack.artists?.[0]?.name || 'Artista'}
                  onError={handleImageError}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-white bg-[#282828]">
                  {currentTrack.artists?.[0]?.name?.charAt(0) || 'A'}
                </div>
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-bold text-white text-base truncate">
                {currentTrack.artists?.[0]?.name || 'Artista'}
              </span>
              <span className="text-xs text-[#b3b3b3]">
                Oyentes mensuales verificados
              </span>
            </div>
            <button className="px-4 py-1.5 rounded-full border border-white/30 text-white font-bold text-xs hover:border-white active:scale-95 transition-all">
              Seguir
            </button>
          </div>
        </div>

        {/* SECTION: Credits Card */}
        <div className="rounded-2xl bg-[#181818] p-5 space-y-3 shadow-lg border border-white/5">
          <span className="font-bold text-sm text-white font-['SpotifyMixUITitle']">
            Créditos
          </span>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-white font-medium">{currentTrack.artists?.[0]?.name}</span>
              <span className="text-[#b3b3b3]">Artista principal</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white font-medium">{currentTrack.name}</span>
              <span className="text-[#b3b3b3]">Compositor</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white font-medium">Spotifree Global Audio</span>
              <span className="text-[#b3b3b3]">Distribución y máster</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
