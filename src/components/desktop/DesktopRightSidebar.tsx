import React, { useState, useEffect, useRef } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import {
  PlayNativeIcon,
  AddTrackNativeIcon,
  CheckTrackNativeIcon,
  VideoSwitchNativeIcon,
  AudioSwitchNativeIcon,
} from '../icons/SpotifyNativeIcons';
import { toHDImage } from '../../utils/formatters';
import { audioEngine } from '../../services/audioEngine';

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

interface DesktopRightSidebarProps {
  onSelectPlaylistById?: (id: string, customName?: string, customImage?: string) => void;
}

function getDynamicArtworkColor(trackId?: string, trackName?: string, artistName?: string): string {
  if (!trackName && !trackId) return '#5d1f00';
  const str = `${trackId || ''}-${trackName || ''}-${artistName || ''}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const PALETTES = [
    '#6b21a8', // Deep Purple
    '#1e3a8a', // Midnight Blue
    '#9a3412', // Warm Amber
    '#065f46', // Emerald Forest
    '#831843', // Deep Crimson / Magenta
    '#1e293b', // Slate Indigo
    '#b45309', // Golden Ochre
    '#3b0764', // Electric Violet
    '#0f766e', // Deep Teal
  ];
  return PALETTES[Math.abs(hash) % PALETTES.length];
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

    // Interpolate word-level timings when standard LRC is provided
    if (words.length === 0) {
      const tokens = item.text.split(/(\s+)/).filter(Boolean);
      const totalChars = tokens.reduce((acc, t) => acc + (t.trim().length > 0 ? t.length : 0), 0);
      const rawGap = Math.max(800, endTimeMs - item.timeMs);
      // Real vocals finish around 78% of the line interval before the pause/breath
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

// Fallback lyrics helper for offline or unindexed tracks
function getFallbackLyrics(title: string = '', artist: string = ''): string[] {
  const t = title.toLowerCase();
  const a = artist.toLowerCase();

  if (t.includes('better late') || (a.includes('romeo') && a.includes('prince'))) {
    return [
      'Yo te abro las puertas de mi corazón, sin miedo',
      'Así verás el cambio tan genuino en mi interior',
      'Le he gastado el tiempo a tu reloj',
      'Pero voy a luchar por ti aunque no quieras',
    ];
  }
  if (t.includes('rain') || a.includes('trueno')) {
    return [
      'Sigo en la mía pensando en los días de lluvia',
      'Caminando solo por la calle oscura',
      'La ciudad no duerme y yo tampoco',
      'Buscando una salida que me cure el corazón',
    ];
  }
  if (t.includes('dile que tú') || (a.includes('ozuna') && t.includes('quieres'))) {
    return [
      'Dile que tú me quieres, que no te importa lo que digan',
      'Que aunque ellos no quieran, nuestro amor sigue con vida',
      'Bebé, no le hagas caso a la gente',
      'Que lo nuestro es pa siempre',
    ];
  }
  if (t.includes('baile inolvidable') || (a.includes('bad bunny') && t.includes('baile'))) {
    return [
      'Bailando apretaíto en una esquina',
      'La noche se hace corta y la música combina',
      'Tú y yo pegados hasta el amanecer',
      'Un momento que nunca voy a olvidar',
    ];
  }
  if (t.includes('hecha pa') || a.includes('boza')) {
    return [
      'Tienes una mirada que me encanta baby',
      'Y un cuerpecito que mi mente envuelve',
      'Estás hecha pa mí, tú me resaltas',
      'Tú me dejas enrolar entre tus nalgas',
    ];
  }

  return [
    `Yo sé que sientes lo mismo al escuchar mi voz`,
    `Que el ritmo nos conecta cuando estamos los dos`,
    `No importa la distancia ni lo que diga el reloj`,
    `Esta canción la escribí solo pensando en tu amor`,
  ];
}

// Artist info helper with high-resolution 640x640 Spotify photography
function getArtistInfo(artistName: string = '', fallbackImage?: string) {
  const a = artistName.toLowerCase();
  if (a.includes('romeo santos')) {
    return {
      name: 'Romeo Santos',
      listeners: '24.819.340 oyentes mensuales',
      image: 'https://i.scdn.co/image/ab6761610000e5eb4e015d3113dd88ee0cb71658',
      bio: "Anthony Santos, conocido artísticamente como Romeo Santos, es el legendario 'Rey de la Bachata', vocalista líder de Aventura y uno de los artistas latinos más influyentes del mundo.",
    };
  }
  if (a.includes('prince royce')) {
    return {
      name: 'Prince Royce',
      listeners: '18.940.110 oyentes mensuales',
      image: 'https://i.scdn.co/image/ab6761610000e5eb9875412976be04620573e86c',
      bio: "Geoffrey Royce Rojas, apodado 'El Príncipe de la Bachata', es un aclamado cantante y compositor multiplatino estadounidense de origen dominicano.",
    };
  }
  if (a.includes('trueno')) {
    return {
      name: 'Trueno',
      listeners: '16.540.890 oyentes mensuales',
      image: 'https://i.scdn.co/image/ab6761610000e5eb919ca0a8e0f6b4c3e3871131',
      bio: "Mateo Palacios Corazzina, conocido como Trueno, es un referente indiscutible del hip hop y freestyle argentino originario del barrio de La Boca en Buenos Aires.",
    };
  }
  if (a.includes('boza')) {
    return {
      name: 'Boza',
      listeners: '11.230.400 oyentes mensuales',
      image: 'https://i.scdn.co/image/ab6761610000e5eb4d7bfa51c8a32bbd778fb8c3',
      bio: "Humberto Ceballos Boza, conocido como Boza, es un destacado cantante y compositor panameño que fusiona dancehall, reguetón y ritmos urbanos caribeños.",
    };
  }
  if (a.includes('bad bunny')) {
    return {
      name: 'Bad Bunny',
      listeners: '68.210.450 oyentes mensuales',
      image: 'https://i.scdn.co/image/ab6761610000e5eb9ad3eb759082ef7ef688b56d',
      bio: "Benito Antonio Martínez Ocasio es un icono global de la música urbana, multipremiado por los Grammy y uno de los artistas más escuchados en la historia del streaming.",
    };
  }
  if (a.includes('ozuna')) {
    return {
      name: 'Ozuna',
      listeners: '39.450.800 oyentes mensuales',
      image: 'https://i.scdn.co/image/ab6761610000e5eb21b0b57117faed68367a78e8',
      bio: "Juan Carlos Ozuna Rosado es una de las mayores superestrellas mundiales de la música latina, apodado internacionalmente como 'El Negrito de Ojos Claros'.",
    };
  }
  if (a.includes('quevedo')) {
    return {
      name: 'Quevedo',
      listeners: '22.180.900 oyentes mensuales',
      image: 'https://i.scdn.co/image/ab6761610000e5ebf8998ad6d2c49c7ab028eb67',
      bio: "Pedro Luis Domínguez Quevedo es un rapero y cantante canario consagrado como una de las figuras más influyentes del pop y reguetón en español.",
    };
  }
  if (a.includes('feid')) {
    return {
      name: 'Feid',
      listeners: '42.600.100 oyentes mensuales',
      image: 'https://i.scdn.co/image/ab6761610000e5eb604da57c9a62256c702ae07d',
      bio: "Salomón Villada Hoyos, conocido como Feid o Ferxxo, es un exitoso cantautor y productor colombiano líder del reguetón contemporáneo.",
    };
  }

  return {
    name: artistName || 'Artista',
    listeners: '12.450.800 oyentes mensuales',
    image: fallbackImage || 'https://i.scdn.co/image/ab6761610000e5eb4e015d3113dd88ee0cb71658',
    bio: `${artistName} es uno de los artistas destacados en las listas de éxitos mundiales, con millones de oyentes mensuales en Spotify.`,
  };
}

export const DesktopRightSidebar: React.FC<DesktopRightSidebarProps> = ({ onSelectPlaylistById }) => {
  const { activeRightSidebar, closeRightSidebar } = useUIStore();
  const { currentTrack, queue, playTrack, toggleLike, likedTrackIds, progressMs } = usePlayerStore();
  const playlists = useSpotifyDataStore((s) => s.playlists);
  const [isFollowing, setIsFollowing] = useState(true);
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);

  // Real synchronized lyrics state
  const [syncedLyrics, setSyncedLyrics] = useState<SyncedLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string[]>([]);
  const lyricsScrollRef = useRef<HTMLDivElement>(null);

  const primaryArtist = currentTrack?.artists?.[0]?.name || '';
  const hdCover = toHDImage(currentTrack?.album?.images?.[0]?.url);
  const artistInfo = getArtistInfo(primaryArtist, hdCover);

  // Resolve videoId for video mode
  useEffect(() => {
    let cancelled = false;
    if (currentTrack) {
      const q = `${currentTrack.name} ${currentTrack.artists?.[0]?.name || ''}`.trim();
      const cachedVid = audioEngine.getCurrentVideoId();
      if (cachedVid) {
        setVideoId(cachedVid);
      } else {
        audioEngine.resolveVideoIdForTrack(q, currentTrack.id).then((vid) => {
          if (!cancelled && vid) setVideoId(vid);
        });
      }
    }
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.name]);

  // Fetch real synced lyrics from /api/lyrics whenever current track changes
  useEffect(() => {
    if (!currentTrack) {
      setSyncedLyrics([]);
      setPlainLyrics([]);
      return;
    }

    let cancelled = false;
    const title = currentTrack.name || '';
    const artist = currentTrack.artists?.[0]?.name || '';

    const parseLyricsData = (data: any) => {
      if (data && data.syncedLyrics) {
        const lines = parseEnhancedLyrics(data.syncedLyrics);
        if (lines.length > 0) {
          setSyncedLyrics(lines);
          setPlainLyrics([]);
          return true;
        }
      }
      if (data && data.plainLyrics) {
        const plain = data.plainLyrics.split('\n').map((l: string) => l.trim()).filter(Boolean);
        if (plain.length > 0) {
          setPlainLyrics(plain);
          setSyncedLyrics([]);
          return true;
        }
      }
      return false;
    };

    fetch(`/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (parseLyricsData(data)) return;

        // Direct client fallback to LRCLib
        return fetch(`https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`)
          .then((r) => r.json())
          .then((lrclibData) => {
            if (cancelled) return;
            if (parseLyricsData(lrclibData)) return;
            setSyncedLyrics([]);
            setPlainLyrics(getFallbackLyrics(title, artist));
          });
      })
      .catch(() => {
        if (cancelled) return;
        fetch(`https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`)
          .then((r) => r.json())
          .then((lrclibData) => {
            if (cancelled) return;
            if (parseLyricsData(lrclibData)) return;
            setSyncedLyrics([]);
            setPlainLyrics(getFallbackLyrics(title, artist));
          })
          .catch(() => {
            if (!cancelled) {
              setSyncedLyrics([]);
              setPlainLyrics(getFallbackLyrics(title, artist));
            }
          });
      });

    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, currentTrack?.name, primaryArtist]);

  // Compute active synced lyric line based on current real-time playback progress
  const activeLineIndex = syncedLyrics.length > 0
    ? syncedLyrics.reduce((acc, line, idx) => (line.timeMs <= progressMs ? idx : acc), -1)
    : -1;

  // Auto-scroll lyrics view to active line
  useEffect(() => {
    if (activeRightSidebar === 'lyrics' && lyricsScrollRef.current && activeLineIndex >= 0) {
      const activeEl = lyricsScrollRef.current.querySelector(`[data-line-index="${activeLineIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [activeLineIndex, activeRightSidebar]);

  const isLiked = currentTrack ? likedTrackIds.includes(currentTrack.id) : false;
  const currentTrackIndex = currentTrack ? queue.findIndex((t) => t.id === currentTrack.id) : -1;
  const upcomingQueue = currentTrackIndex >= 0 ? queue.slice(currentTrackIndex + 1) : queue;

  // Find current context playlist name
  const currentPlaylist = playlists.find(
    (p) => (currentTrack as any)?.playlistId === p.id || p.tracks?.items?.some((t) => t.id === currentTrack?.id)
  );
  const contextTitle = currentPlaylist?.name || currentTrack?.album?.name || primaryArtist || 'Romeo & Prince';

  const handleArtistClick = (artistName: string, artistId?: string) => {
    const id = artistId || artistName.toLowerCase().replace(/[\s&]+/g, '-');
    if (onSelectPlaylistById) {
      onSelectPlaylistById(`art-${id}`, artistName, artistInfo.image);
    } else {
      useUIStore.getState().setActiveMainTab('playlist');
    }
  };

  const isVisible = activeRightSidebar !== 'none';

  return (
    <aside
      aria-label={activeRightSidebar === 'queue' ? 'Cola de reproducción' : 'Vista Sonando'}
      id="Desktop_PanelContainer_Id"
      className={`h-full bg-[#121212] rounded-lg flex flex-col shrink-0 select-none overflow-hidden transition-[width,margin,opacity,transform] duration-300 ease-[cubic-bezier(0.3,0,0,1)] ${
        isVisible
          ? 'w-[340px] xl:w-[360px] mr-2 border border-white/5 opacity-100 translate-x-0'
          : 'w-0 mr-0 border-0 opacity-0 pointer-events-none translate-x-6'
      }`}
    >
      {/* 1. NOW PLAYING VIEW (NPV) MODE */}
      {activeRightSidebar === 'now-playing' && (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header bar */}
          <div className="px-4 py-3 flex items-center justify-between border-b border-white/5 bg-[#121212] shrink-0 z-10">
            <div className="flex items-center gap-2 min-w-0">
              {/* Official Spotify Collapse Button [>|] */}
              <button
                onClick={closeRightSidebar}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#b3b3b3] hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                aria-label="Ocultar la vista Sonando"
                title="Ocultar la vista Sonando"
              >
                <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                  <path d="M5.03 10.53a.75.75 0 1 1-1.06-1.06L5.44 8 3.97 6.53a.75.75 0 0 1 1.06-1.06l2 2a.75.75 0 0 1 0 1.06z" />
                  <path d="M1 0a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1zm.5 1.5h8v13h-8zm13 13H11v-13h3.5z" />
                </svg>
              </button>

              <span
                onClick={() => currentPlaylist && onSelectPlaylistById?.(currentPlaylist.id, currentPlaylist.name)}
                className="font-bold text-sm text-white truncate hover:underline cursor-pointer font-['SpotifyMixUI']"
              >
                {contextTitle}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#b3b3b3] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Más opciones"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.5 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m15 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m-7.5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" />
                </svg>
              </button>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 font-['SpotifyMixUI']">
            {/* 1. Large High-Definition Album Artwork or Video Mode Canvas */}
            <div className="w-full aspect-square rounded-[8px] overflow-hidden shadow-2xl bg-[#1e1e1e] relative group">
              {isVideoMode && videoId ? (
                <div className="w-full h-full relative overflow-hidden pointer-events-none select-none">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&loop=1&playlist=${videoId}&playsinline=1&modestbranding=1&rel=0&start=${Math.max(0, Math.floor(progressMs / 1000))}`}
                    title={currentTrack?.name || 'Video'}
                    className="w-[160%] h-[160%] -top-[30%] -left-[30%] absolute object-cover border-0 pointer-events-none scale-125"
                    allow="autoplay; encrypted-media"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/20 pointer-events-none" />
                </div>
              ) : (
                <img
                  src={hdCover}
                  alt={currentTrack?.name || 'Portada'}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                />
              )}
            </div>

            {/* Video / Audio Switch Pill Button */}
            <div className="flex items-center justify-start pl-0.5 -mt-1 -mb-1">
              <button
                onClick={() => setIsVideoMode(!isVideoMode)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all active:scale-95 cursor-pointer border border-white/10 shadow-sm"
              >
                {isVideoMode ? (
                  <>
                    <AudioSwitchNativeIcon size={14} className="text-[#1ed760]" />
                    <span>Cambiar a audio</span>
                  </>
                ) : (
                  <>
                    <VideoSwitchNativeIcon size={14} className="text-white" />
                    <span>Cambiar a vídeo</span>
                  </>
                )}
              </button>
            </div>

            {/* 2. Track Title + Checked Icon + Artists (Clickable) */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-[22px] font-black text-white leading-tight font-['SpotifyMixUITitle'] truncate hover:underline cursor-pointer">
                  {currentTrack?.name || 'Selecciona una canción'}
                </h2>
                <div className="text-[14px] text-[#b3b3b3] mt-1 truncate">
                  {currentTrack?.artists && currentTrack.artists.length > 0 ? (
                    currentTrack.artists.map((artist, idx) => (
                      <span
                        key={artist.id || idx}
                        onClick={() => handleArtistClick(artist.name, artist.id)}
                        className="hover:underline hover:text-white cursor-pointer"
                      >
                        {artist.name}
                        {idx < currentTrack.artists.length - 1 ? ', ' : ''}
                      </span>
                    ))
                  ) : (
                    <span
                      onClick={() => handleArtistClick(primaryArtist)}
                      className="hover:underline hover:text-white cursor-pointer"
                    >
                      {primaryArtist || 'Artista'}
                    </span>
                  )}
                </div>
              </div>

              {currentTrack && (
                <button
                  onClick={() => toggleLike(currentTrack.id)}
                  className={`p-1.5 transition-transform active:scale-90 shrink-0 ${
                    isLiked ? 'text-[#1ed760]' : 'text-[#b3b3b3] hover:text-white'
                  }`}
                  title={isLiked ? 'Guardada en Tu biblioteca' : 'Añadir a Tu biblioteca'}
                >
                  {isLiked ? (
                    <CheckTrackNativeIcon size={22} className="text-[#1ed760]" />
                  ) : (
                    <AddTrackNativeIcon size={22} />
                  )}
                </button>
              )}
            </div>

            {/* 3. Real Synced Lyrics Preview (Dynamically updating with playback and matching artwork color) */}
            <div
              style={{
                backgroundColor: getDynamicArtworkColor(currentTrack?.id, currentTrack?.name, primaryArtist),
                transition: 'background-color 0.8s ease',
              }}
              className="rounded-xl p-4 text-white space-y-2 relative shadow-lg overflow-hidden transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
                  Vista previa de la letra
                  {syncedLyrics.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760] animate-pulse" title="Sincronizada" />
                  )}
                </span>
              </div>

              <div className="space-y-1.5 pt-1 min-h-[96px]">
                {syncedLyrics.length > 0 ? (
                  (() => {
                    const displayStart = Math.max(0, activeLineIndex >= 0 ? activeLineIndex : 0);
                    const previewSlice = syncedLyrics.slice(displayStart, displayStart + 4);
                    return previewSlice.map((line, idx) => {
                      const isCurrent = displayStart + idx === activeLineIndex;
                      return (
                        <p
                          key={`preview-${displayStart + idx}-${line.timeMs}`}
                          className={`leading-snug tracking-tight transition-all duration-300 ${
                            isCurrent
                              ? 'font-black text-[18px] text-white scale-101'
                              : 'font-bold text-[16px] text-white/50'
                          }`}
                        >
                          {isCurrent && line.words.length > 0 ? (
                            line.words.map((w, wIdx) => {
                              const vocalMs = progressMs + 220;
                              const isSung = vocalMs >= w.timeMs;
                              const isCurrentWord = isSung && (wIdx === line.words.length - 1 || vocalMs < (line.words[wIdx + 1]?.timeMs || Infinity));
                              return (
                                <span
                                  key={`pw-${displayStart + idx}-${wIdx}`}
                                  className={`transition-all duration-150 ${
                                    isCurrentWord
                                      ? 'text-white font-black drop-shadow-[0_2px_10px_rgba(255,255,255,0.9)] scale-105 inline-block'
                                      : isSung
                                      ? 'text-white/95 font-bold'
                                      : 'text-white/40 font-bold'
                                  }`}
                                >
                                  {w.text}
                                </span>
                              );
                            })
                          ) : (
                            line.text
                          )}
                        </p>
                      );
                    });
                  })()
                ) : plainLyrics.length > 0 ? (
                  plainLyrics.slice(0, 4).map((line, idx) => (
                    <p
                      key={`preview-plain-${idx}`}
                      className={`font-bold text-[16px] leading-snug tracking-tight ${
                        idx === 0 ? 'text-white font-black text-[18px]' : 'text-white/60'
                      }`}
                    >
                      {line}
                    </p>
                  ))
                ) : (
                  <p className="text-white/60 text-sm italic">Cargando letra sincronizada...</p>
                )}
              </div>

              <button
                onClick={() => useUIStore.getState().toggleRightSidebar('lyrics')}
                className="mt-2 text-xs font-semibold text-white/80 hover:text-white hover:underline transition-colors block cursor-pointer"
              >
                Mostrar más
              </button>
            </div>

            {/* 4. "Información sobre el artista" (Clickable to open Artist profile) */}
            <div
              onClick={() => handleArtistClick(artistInfo.name, currentTrack?.artists?.[0]?.id)}
              className="rounded-xl overflow-hidden bg-[#1f1f1f] shadow-lg relative group cursor-pointer hover:bg-[#252525] transition-colors"
            >
              <div className="relative h-44 w-full overflow-hidden bg-[#282828]">
                <img
                  src={toHDImage(artistInfo.image)}
                  alt={artistInfo.name}
                  className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1f1f1f] via-transparent to-transparent" />
                <span className="absolute top-3 left-3 text-xs font-bold text-white bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded">
                  Información sobre el artista
                </span>
              </div>

              <div className="p-4 pt-1 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-lg text-white hover:underline cursor-pointer">
                      {artistInfo.name}
                    </h4>
                    <p className="text-xs text-[#b3b3b3] mt-0.5">
                      {artistInfo.listeners}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFollowing(!isFollowing);
                    }}
                    className="border border-white/30 hover:border-white rounded-full px-4 py-1 text-xs font-bold text-white transition-all hover:scale-104 active:scale-95 cursor-pointer"
                  >
                    {isFollowing ? 'Siguiendo' : 'Seguir'}
                  </button>
                </div>

                <p className="text-xs text-[#b3b3b3] line-clamp-3 leading-relaxed">
                  {artistInfo.bio}
                </p>
              </div>
            </div>

            {/* 5. "Créditos" (Clickable Artists) */}
            <div className="rounded-xl p-4 bg-[#1f1f1f] space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-white">Créditos</h3>
                <span className="text-xs text-[#b3b3b3] hover:text-white hover:underline cursor-pointer">
                  Mostrar todo
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <p
                    onClick={() => handleArtistClick(primaryArtist, currentTrack?.artists?.[0]?.id)}
                    className="font-bold text-white hover:underline cursor-pointer"
                  >
                    {primaryArtist}
                  </p>
                  <p className="text-[#b3b3b3]">Artista principal</p>
                </div>
                {currentTrack?.artists?.[1] && (
                  <div>
                    <p
                      onClick={() => handleArtistClick(currentTrack.artists[1].name, currentTrack.artists[1].id)}
                      className="font-bold text-white hover:underline cursor-pointer"
                    >
                      {currentTrack.artists[1].name}
                    </p>
                    <p className="text-[#b3b3b3]">Artista colaborador</p>
                  </div>
                )}
                <div>
                  <p className="font-bold text-white">
                    {primaryArtist}, Sony / Universal Music
                  </p>
                  <p className="text-[#b3b3b3]">Compositores y producción</p>
                </div>
              </div>
            </div>

            {/* 6. "A continuación en la cola" */}
            {upcomingQueue.length > 0 && (
              <div className="rounded-xl p-4 bg-[#1f1f1f] space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-white">
                    A continuación en la cola
                  </h3>
                  <button
                    onClick={() => useUIStore.getState().toggleRightSidebar('queue')}
                    className="text-xs text-[#b3b3b3] hover:text-white hover:underline cursor-pointer"
                  >
                    Abrir cola
                  </button>
                </div>

                <div
                  onClick={() => playTrack(upcomingQueue[0], queue)}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 cursor-pointer transition-colors group"
                >
                  <div className="relative w-12 h-12 rounded overflow-hidden shrink-0 shadow bg-[#282828]">
                    <img
                      src={toHDImage(upcomingQueue[0].album?.images?.[0]?.url)}
                      alt={upcomingQueue[0].name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <PlayNativeIcon size={16} className="text-white ml-0.5" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white group-hover:text-[#1ed760] truncate text-sm">
                      {upcomingQueue[0].name}
                    </p>
                    <p className="text-xs text-[#b3b3b3] truncate mt-0.5">
                      {upcomingQueue[0].artists.map((a) => a.name).join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. QUEUE MODE (with smooth slide & fade animations) */}
      {activeRightSidebar === 'queue' && (
        <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300">
          {/* Header */}
          <div className="p-4 flex items-center justify-between border-b border-white/5 bg-[#121212] shrink-0">
            <h3 className="font-bold text-base text-white font-['SpotifyMixUI']">
              Cola de reproducción
            </h3>
            <button
              onClick={closeRightSidebar}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#b3b3b3] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Cerrar Cola"
            >
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                <path d="M5.03 10.53a.75.75 0 1 1-1.06-1.06L5.44 8 3.97 6.53a.75.75 0 0 1 1.06-1.06l2 2a.75.75 0 0 1 0 1.06z" />
                <path d="M1 0a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1zm.5 1.5h8v13h-8zm13 13H11v-13h3.5z" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6 font-['SpotifyMixUI']">
            {/* Section: Sonando */}
            <div>
              <h4 className="font-bold text-base text-white mb-3">Sonando</h4>
              {currentTrack ? (
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.08] group cursor-pointer shadow transition-all duration-200 hover:bg-white/[0.12]">
                  <img
                    src={hdCover}
                    alt={currentTrack.name}
                    className="w-12 h-12 rounded object-cover shadow shrink-0 bg-[#282828]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#1ed760] truncate text-sm">
                      {currentTrack.name}
                    </p>
                    <p className="text-xs text-[#b3b3b3] truncate mt-0.5">
                      {currentTrack.artists.map((a) => a.name).join(', ')}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#b3b3b3] italic p-2">
                  No hay ninguna canción reproduciéndose
                </p>
              )}
            </div>

            {/* Section: A continuación en la cola */}
            <div>
              <h4 className="font-bold text-base text-white mb-3">
                {currentPlaylist?.name ? `A continuación en: ${currentPlaylist.name}` : 'A continuación en la cola'}
              </h4>
              {upcomingQueue.length > 0 ? (
                <div className="space-y-1">
                  {upcomingQueue.map((item, idx) => (
                    <div
                      key={`${item.id}-${idx}`}
                      onClick={() => playTrack(item, queue)}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 cursor-pointer transition-all duration-200 group hover:translate-x-1"
                    >
                      <div className="relative w-12 h-12 rounded overflow-hidden shrink-0 shadow bg-[#282828]">
                        <img
                          src={toHDImage(item.album?.images?.[0]?.url)}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <PlayNativeIcon size={16} className="text-white ml-0.5" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white group-hover:text-[#1ed760] truncate text-sm">
                          {item.name}
                        </p>
                        <p className="text-xs text-[#b3b3b3] truncate mt-0.5">
                          {item.artists.map((a) => a.name).join(', ')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-[#b3b3b3] space-y-1">
                  <p className="text-sm font-semibold text-white">
                    No hay más canciones en la cola
                  </p>
                  <p className="text-xs opacity-75">
                    Selecciona una lista para seguir escuchando.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. FULL LYRICS MODE (Real-time synchronized with auto-scroll) */}
      {activeRightSidebar === 'lyrics' && (
        <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-300">
          <div className="p-4 flex items-center justify-between border-b border-white/5 bg-[#121212] shrink-0">
            <h3 className="font-bold text-base text-white">Letras</h3>
            <button
              onClick={closeRightSidebar}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#b3b3b3] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
                <path d="M5.03 10.53a.75.75 0 1 1-1.06-1.06L5.44 8 3.97 6.53a.75.75 0 0 1 1.06-1.06l2 2a.75.75 0 0 1 0 1.06z" />
                <path d="M1 0a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V1a1 1 0 0 0-1-1zm.5 1.5h8v13h-8zm13 13H11v-13h3.5z" />
              </svg>
            </button>
          </div>
          {currentTrack ? (
            <div
              ref={lyricsScrollRef}
              style={{
                background: `linear-gradient(180deg, ${getDynamicArtworkColor(currentTrack.id, currentTrack.name, primaryArtist)} 0%, rgba(18, 18, 18, 0.95) 55%, #121212 100%)`,
                transition: 'background 0.8s ease',
              }}
              className="flex-1 overflow-y-auto p-5 space-y-6 scroll-smooth select-none"
            >
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-white/60">
                  {currentTrack.name}
                </p>
                <p
                  onClick={() => handleArtistClick(primaryArtist, currentTrack.artists?.[0]?.id)}
                  className="text-sm font-semibold text-white/80 hover:text-white hover:underline cursor-pointer"
                >
                  {currentTrack.artists.map((a) => a.name).join(', ')}
                </p>
              </div>

              <div className="space-y-5 font-black text-xl leading-relaxed text-white/95 pt-2">
                {syncedLyrics.length > 0 ? (
                  syncedLyrics.map((line, idx) => {
                    const isCurrent = idx === activeLineIndex;
                    return (
                      <p
                        key={`full-lyric-${idx}-${line.timeMs}`}
                        data-line-index={idx}
                        onClick={() => {
                          if (typeof window !== 'undefined' && (window as any).__audioEngine) {
                            (window as any).__audioEngine.seek(line.timeMs / 1000);
                          }
                        }}
                        className={`transition-all duration-300 cursor-pointer flex flex-wrap items-baseline gap-x-1.5 ${
                          isCurrent
                            ? 'scale-102 text-2xl font-black py-1'
                            : 'text-white/40 text-xl font-bold hover:text-white/80 py-0.5'
                        }`}
                      >
                        {isCurrent && line.words.length > 0
                          ? line.words.map((w, wIdx) => {
                              const vocalMs = progressMs + 220;
                              const isWordSung = vocalMs >= w.timeMs;
                              const isCurrentWord = isWordSung && (wIdx === line.words.length - 1 || vocalMs < (line.words[wIdx + 1]?.timeMs || Infinity));
                              return (
                                <span
                                  key={`w-${idx}-${wIdx}`}
                                  className={`transition-all duration-150 inline-block ${
                                    isCurrentWord
                                      ? 'text-white font-black drop-shadow-[0_2px_14px_rgba(255,255,255,1)] scale-105'
                                      : isWordSung
                                      ? 'text-white/95 font-bold'
                                      : 'text-white/40 font-bold'
                                  }`}
                                >
                                  {w.text}
                                </span>
                              );
                            })
                          : (
                            <span>{line.text}</span>
                          )}
                      </p>
                    );
                  })
                ) : plainLyrics.length > 0 ? (
                  plainLyrics.map((line, idx) => (
                    <p
                      key={`full-plain-${idx}`}
                      className="text-white/80 hover:text-white text-xl font-bold transition-colors"
                    >
                      {line}
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-white/60 italic">Cargando letra sincronizada...</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-center text-[#b3b3b3]">
              <p className="text-sm">Reproduce una canción para ver la letra.</p>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
