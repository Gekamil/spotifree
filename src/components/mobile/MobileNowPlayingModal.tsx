import React, { useState, useEffect, useRef } from 'react';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
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
  VideoSwitchNativeIcon,
  AudioSwitchNativeIcon,
  ShareNativeIcon,
} from '../icons/SpotifyNativeIcons';
import { formatDuration } from '../../utils/formatters';
import { resolveVibrantColor, extractDominantColorFromImage } from '../../utils/spotifyColor';
import { handleImageError } from '../../utils/imageFallback';
import { getArtistPicture } from '../../utils/artistImage';
import { fetchLyricsUnified } from '../../utils/lyricsService';
import { getTrackCoverUrl, persistTrackCover } from '../../utils/trackCovers';
import { fetchTrackCanvas } from '../../services/spotifyApi';

interface MobileNowPlayingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlaylistById?: (id: string, name?: string, img?: string) => void;
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
  onSelectPlaylistById,
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
  const [isCanvasMode, setIsCanvasMode] = useState(true);
  const [canvasUrl, setCanvasUrl] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [officialVideoId, setOfficialVideoId] = useState<string | null>(null);
  const [extractedModalColor, setExtractedModalColor] = useState<string>(() =>
    resolveVibrantColor(currentTrack?.id, currentTrack?.name)
  );
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
          images: artistPicture ? [{ url: artistPicture }] : displayCover ? [{ url: displayCover }] : [],
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

  const [displayCover, setDisplayCover] = useState<string | null>(() => {
    if (!currentTrack) return null;
    return getTrackCoverUrl(currentTrack) || currentTrack.album?.images?.[0]?.url || (currentTrack as any).image || null;
  });

  const handleCoverError = async () => {
    if (!currentTrack) return;
    const q = `${currentTrack.name} ${currentTrack.artists?.[0]?.name || ''}`.trim();
    try {
      const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=1`);
      if (res.ok) {
        const data = await res.json();
        if (data.results?.[0]?.artworkUrl100) {
          const hd = data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
          persistTrackCover(currentTrack.id, hd);
          setDisplayCover(hd);
          extractDominantColorFromImage(hd).then((hex) => {
            if (hex) setExtractedModalColor(hex);
          });
          return;
        }
      }
    } catch {}
    // If cover artwork cannot be resolved and canvas exists, switch to canvas mode
    setDisplayCover(null);
    setIsCanvasMode(true);
  };

  useEffect(() => {
    let cancelled = false;
    if (currentTrack) {
      const initial = getTrackCoverUrl(currentTrack) || currentTrack.album?.images?.[0]?.url || (currentTrack as any).image;
      if (initial && !initial.includes('liked-songs')) {
        setDisplayCover(initial);
        extractDominantColorFromImage(initial).then((hex) => {
          if (!cancelled && hex) setExtractedModalColor(hex);
        });
      } else {
        handleCoverError();
      }

      const q = `${currentTrack.name} ${currentTrack.artists?.[0]?.name || ''}`.trim();
      const cachedVid = audioEngine.getCurrentVideoId();
      if (cachedVid) {
        setVideoId(cachedVid);
      } else {
        audioEngine.resolveVideoIdForTrack(q, currentTrack.id).then((vid) => {
          if (!cancelled && vid) setVideoId(vid);
        });
      }

      // Fetch Spotify Canvas video loop
      setCanvasUrl(currentTrack.canvasUrl || null);
      fetchTrackCanvas(currentTrack.id).then((cUrl) => {
        if (!cancelled && cUrl) {
          setCanvasUrl(cUrl);
          if (!initial || initial.includes('liked-songs')) {
            setIsCanvasMode(true);
          }
        }
      });

      // Search official music video / videoclip for Video mode
      const clipQuery = `${currentTrack.name} ${currentTrack.artists?.[0]?.name || ''} video oficial videoclip`;
      audioEngine.resolveVideoIdForTrack(clipQuery, `clip-${currentTrack.id}`).then((clipVid) => {
        if (!cancelled && clipVid) setOfficialVideoId(clipVid);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.name]);

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
          // Full-screen mode: center the active lyric line in the screen
          activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          // Compact mode: ONLY scroll the internal card container without moving the parent modal / screen
          const container = lyricsScrollRef.current;
          const targetTop = activeEl.offsetTop - container.offsetTop - 40;
          container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
        }
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
      className="fixed inset-0 z-[100] flex flex-col select-none font-['SpotifyMixUI'] animate-slide-up-modal overflow-hidden"
      style={{
        background: isCanvasMode && canvasUrl
          ? '#080808'
          : `linear-gradient(180deg, ${extractedModalColor} 0%, rgba(18, 18, 18, 1) 500px, #121212 100%)`,
      }}
    >
      {/* Canvas Full-Screen Looping Video in Background with smooth crossfade */}
      <div className={`absolute inset-0 pointer-events-none z-0 overflow-hidden transition-opacity duration-700 ease-in-out ${
        isCanvasMode && canvasUrl ? 'opacity-100' : 'opacity-0'
      }`}>
        {canvasUrl && (
          <video
            key={canvasUrl}
            src={canvasUrl}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {/* Authentic Spotify gradient overlay for pristine legibility of text and controls */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/85 pointer-events-none" />
      </div>

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
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pt-2 pb-12 space-y-4 relative z-10">
        {/* Large Artwork or Spotify Canvas Spacer with smooth crossfade */}
        <div className="flex items-center justify-center pt-2 pb-1 relative min-h-[340px]">
          <div className={`w-full max-w-[340px] aspect-square rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.75)] bg-[#181818] relative transition-all duration-700 ease-in-out ${
            isCanvasMode && canvasUrl
              ? 'opacity-0 scale-95 pointer-events-none'
              : 'opacity-100 scale-100'
          }`}>
            {displayCover ? (
              <img
                src={displayCover}
                alt={currentTrack.name}
                onError={handleCoverError}
                className="w-full h-full object-cover transition-opacity duration-500"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-white/40 gap-3">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
                {canvasUrl && <span className="text-xs text-white/50">Cambiando a Canvas...</span>}
              </div>
            )}
          </div>
        </div>

        {/* Cambiar a Canvas / Cambiar a carátula pill - VISIBLE WHEN SONG HAS CANVAS */}
        {canvasUrl && (
          <div className="flex items-center justify-start pl-1 -my-0.5">
            <button
              onClick={() => setIsCanvasMode(!isCanvasMode)}
              className="flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all active:scale-95 cursor-pointer border border-white/10 shadow-sm backdrop-blur-md"
            >
              {isCanvasMode ? (
                <>
                  <AudioSwitchNativeIcon size={14} className="text-[#1ed760]" />
                  <span>Cambiar a carátula</span>
                </>
              ) : (
                <>
                  <VideoSwitchNativeIcon size={14} className="text-white" />
                  <span>Cambiar a Canvas</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Title & Artist & Like */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1 mr-4 flex items-center">
              {/* Mini cover thumbnail with smooth width & opacity transition */}
              <div className={`overflow-hidden transition-all duration-500 ease-in-out shrink-0 ${
                isCanvasMode && canvasUrl && displayCover ? 'w-12 h-12 opacity-100 mr-3' : 'w-0 h-12 opacity-0 mr-0'
              }`}>
                {displayCover && (
                  <img
                    src={displayCover}
                    alt={currentTrack.name}
                    className="w-12 h-12 rounded-lg object-cover shadow-lg border border-white/10"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-black text-white truncate font-['SpotifyMixUITitle']">
                  {currentTrack.name}
                </h1>
                <p className="text-base text-[#b3b3b3] truncate mt-0.5">
                  {currentTrack.artists?.map((a) => a.name).join(', ') || 'Spotify'}
                </p>
              </div>
            </div>
            <button
              onClick={() => toggleLike(currentTrack.id)}
              className="w-10 h-10 flex items-center justify-center text-[#b3b3b3] hover:text-white active:scale-90 transition-transform shrink-0"
            >
              {isLiked ? (
                <CheckTrackNativeIcon size={26} className="text-[#1ed760]" />
              ) : (
                <AddTrackNativeIcon size={26} className="text-white/80" />
              )}
            </button>
          </div>

          {/* Scrub Bar */}
          <div className="space-y-1.5 touch-none">
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={percent}
              onChange={handleSeek}
              style={{
                background: `linear-gradient(to right, #ffffff ${percent}%, rgba(255, 255, 255, 0.2) ${percent}%)`,
              }}
              className="w-full h-1 rounded-lg appearance-none cursor-pointer accent-white hover:accent-[#1ed760] transition-all"
            />
            <div className="flex justify-between font-['SpotifyMixUI'] tabular-nums text-[11px] font-normal text-[#b3b3b3]">
              <span className="select-none tracking-normal">{formatDuration(progressMs)}</span>
              <span className="select-none tracking-normal">{formatDuration(durationMs)}</span>
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
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: currentTrack.name, text: `Escuchando ${currentTrack.name} en Spotifree`, url: window.location.href }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(window.location.href).catch(() => {});
                  }
                }}
                className="hover:text-white transition-colors active:scale-90"
                title="Compartir"
              >
                <ShareNativeIcon size={18} className="text-[#b3b3b3] hover:text-white" />
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
            backgroundColor: `${extractedModalColor}f0`,
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
                    key={`m-lyric-${idx}-${line.timeMs}`}
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
                        const vocalMs = progressMs + 220;
                        const isWordSung = vocalMs >= w.timeMs;
                        return (
                          <span
                            key={`mw-${idx}-${wIdx}`}
                            className={`transition-colors duration-150 inline ${
                              isWordSung
                                ? 'text-white'
                                : 'text-white/45'
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
                if (navigator.share) {
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

        {/* SECTION: Official Music Video / Videoclip */}
        <div className="rounded-2xl bg-[#181818] p-4 space-y-3 shadow-xl border border-white/5 overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <VideoSwitchNativeIcon size={18} className="text-[#1ed760]" />
              <span className="font-bold text-sm text-white font-['SpotifyMixUITitle']">
                Videoclip oficial
              </span>
            </div>
            <span className="text-[10px] font-bold text-white/60 bg-white/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Video HD
            </span>
          </div>

          <div className="w-full aspect-video rounded-xl overflow-hidden bg-black relative shadow-inner">
            {officialVideoId || videoId ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${officialVideoId || videoId}?rel=0&modestbranding=1&playsinline=1`}
                title={`${currentTrack.name} - Videoclip oficial`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-white/40 gap-2">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
                </svg>
                <span className="text-xs">Buscando videoclip...</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-[#b3b3b3] pt-0.5">
            <span className="truncate max-w-[240px]">
              {currentTrack.name} — {artistName}
            </span>
            <span className="text-[11px] text-white/40 font-medium">YouTube</span>
          </div>
        </div>

        {/* SECTION: About the Artist Card */}
        <div className="rounded-2xl bg-[#181818] p-5 space-y-3 shadow-lg border border-white/5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-white font-['SpotifyMixUITitle']">
              Información sobre el artista
            </span>
          </div>

          <div
            onClick={() => {
              if (artistName && onSelectPlaylistById) {
                onClose();
                onSelectPlaylistById(
                  `art-${encodeURIComponent(artistName)}`,
                  artistName,
                  artistPicture || coverUrl
                );
              }
            }}
            className="flex items-center gap-3.5 cursor-pointer active:scale-[0.98] transition-transform"
          >
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
            <button
              onClick={handleToggleFollowArtist}
              className={`px-4 py-1.5 rounded-full font-bold text-xs active:scale-95 transition-all cursor-pointer ${
                isFollowingArtist
                  ? 'border border-[#1ed760] text-[#1ed760] bg-[#1ed760]/10'
                  : 'border border-white/30 text-white hover:border-white'
              }`}
            >
              {isFollowingArtist ? 'Siguiendo' : 'Seguir'}
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
