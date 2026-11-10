import React, { useState, useEffect, useRef } from 'react';
import { getArtistPicture } from '../../utils/artistImage';
import { MotionCover } from '../common/MotionCover';
import { useUIStore } from '../../store/useUIStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useShallow } from 'zustand/react/shallow';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import {
  PlayNativeIcon,
  AddTrackNativeIcon,
  CheckTrackNativeIcon,
  VideoSwitchNativeIcon,
  AudioSwitchNativeIcon,
  CloseNativeIcon,
} from '../icons/SpotifyNativeIcons';
import { SharedSessionPanel } from '../common/SharedSessionPanel';
import { toHDImage } from '../../utils/formatters';
import { audioEngine } from '../../services/audioEngine';
import { fetchTrackCanvas } from '../../services/spotifyApi';
import { resolveVibrantColor, extractDominantColorFromImage } from '../../utils/spotifyColor';
import { parseTrackArtists } from '../../utils/trackArtists';
import { artistLibraryId, toggleFollowArtist } from '../../utils/artistFollow';
import { parseEnhancedLyrics, type SyncedLine } from '../../utils/lyricsService';

interface DesktopRightSidebarProps {
  onSelectPlaylistById?: (id: string, customName?: string, customImage?: string) => void;
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

// Artist card of "Sonando ahora": the same for every artist. No invented listener numbers and
// no fixed photos: the song's cover until the artist's real photo arrives (getArtistPicture).
function getArtistInfo(artistName: string = '', fallbackImage?: string) {
  return {
    name: artistName || 'Artista',
    listeners: '',
    image: fallbackImage || '',
    bio: 'Toca para ver su perfil: canciones populares, álbumes y más.',
  };
}

/** Computer: "Escuchar juntos" in the right panel (same content as the phone's sheet) */
const SharedSessionSidebarView: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="flex flex-col h-full overflow-hidden font-['SpotifyMixUI']">
    <div className="px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
      <span className="font-bold text-[16px] text-white">Escuchar juntos</span>
      <button
        onClick={onClose}
        className="w-8 h-8 rounded-full flex items-center justify-center text-[#b3b3b3] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        title="Cerrar"
        aria-label="Cerrar"
      >
        <CloseNativeIcon size={16} />
      </button>
    </div>
    <div className="flex-1 overflow-y-auto px-4 pt-3 pb-6">
      <SharedSessionPanel surface="#121212" compact />
    </div>
  </div>
);

export const DesktopRightSidebar: React.FC<DesktopRightSidebarProps> = ({ onSelectPlaylistById }) => {
  const { activeRightSidebar, closeRightSidebar } = useUIStore();
  const { currentTrack, queue, playTrack, toggleLike, likedTrackIds, progressMs } = usePlayerStore(
    useShallow((s) => ({ currentTrack: s.currentTrack, queue: s.queue, playTrack: s.playTrack, toggleLike: s.toggleLike, likedTrackIds: s.likedTrackIds, progressMs: s.progressMs }))
  );
  const playlists = useSpotifyDataStore((s) => s.playlists);
  // "Seguir" puts the artist in Tu biblioteca (same as the artist page's button)
  const followArtistId = currentTrack?.artists?.[0]?.id;
  const followArtistName = currentTrack?.artists?.[0]?.name;
  const isFollowing = useSpotifyDataStore((s) => {
    const id = artistLibraryId(followArtistId, followArtistName);
    return !!id && s.playlists.some((p) => p.id === id);
  });
  const [isCanvasMode, setIsCanvasMode] = useState(false);
  const [canvasUrl, setCanvasUrl] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [officialVideoId, setOfficialVideoId] = useState<string | null>(null);
  const [draggedQueueIndex, setDraggedQueueIndex] = useState<number | null>(null);
  const [dragOverQueueIndex, setDragOverQueueIndex] = useState<number | null>(null);

  // Real synchronized lyrics state
  const [syncedLyrics, setSyncedLyrics] = useState<SyncedLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string[]>([]);
  const [dominantColor, setDominantColor] = useState<string>('#5d1f00');
  const lyricsScrollRef = useRef<HTMLDivElement>(null);

  // Resizable Right Sidebar State (Spotify Desktop Fidelity)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem('spotifree_right_sidebar_width');
        if (saved) {
          const parsed = parseInt(saved, 10);
          if (parsed >= 280 && parsed <= 520) return parsed;
        }
      } catch {}
    }
    return 360;
  });
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef<number>(0);
  const startWidthRef = useRef<number>(360);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startXRef.current - e.clientX;
      const nextWidth = Math.min(520, Math.max(280, startWidthRef.current + deltaX));
      setSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      try {
        window.localStorage.setItem('spotifree_right_sidebar_width', String(sidebarWidth));
      } catch {}
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, sidebarWidth]);

  const primaryArtist = currentTrack?.artists?.[0]?.name || '';
  const hdCover = toHDImage(currentTrack?.album?.images?.[0]?.url);
  const artistInfoBase = getArtistInfo(primaryArtist, hdCover);
  // The artist's real photo (looked up, cached); some hard-coded links had stopped working
  const [artistPhoto, setArtistPhoto] = useState<string | null>(null);
  const [artistPhotoFailed, setArtistPhotoFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setArtistPhoto(null);
    setArtistPhotoFailed(false);
    if (!primaryArtist) return;
    getArtistPicture(primaryArtist)
      .then((url) => {
        if (alive && url) setArtistPhoto(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [primaryArtist]);
  const artistInfo = {
    ...artistInfoBase,
    image: (!artistPhotoFailed && artistPhoto) || artistInfoBase.image || hdCover || '',
  };

  // Extract real dynamic dominant artwork color with seamless gradient
  useEffect(() => {
    let cancelled = false;
    if (!currentTrack) {
      setDominantColor('#5d1f00');
      return;
    }
    const coverUrl = hdCover || currentTrack.album?.images?.[0]?.url;
    if (coverUrl && !coverUrl.includes('liked-songs')) {
      extractDominantColorFromImage(coverUrl).then((hex) => {
        if (!cancelled && hex) {
          setDominantColor(hex);
        } else if (!cancelled) {
          setDominantColor(resolveVibrantColor(currentTrack.id, currentTrack.name));
        }
      });
    } else {
      setDominantColor(resolveVibrantColor(currentTrack.id, currentTrack.name));
    }
    return () => {
      cancelled = true;
    };
  }, [currentTrack?.id, hdCover]);

  // Resolve videoId & canvas
  useEffect(() => {
    let cancelled = false;
    let vidPollInterval: any;
    if (currentTrack) {
      // Reset canvas state immediately on track change to prevent state leakage
      setIsCanvasMode(false);
      setCanvasUrl(null);

      // Fetch Spotify Canvas video loop dynamically for any track (including searched Deezer/iTunes tracks)
      fetchTrackCanvas(currentTrack.id, currentTrack.name, currentTrack.artists?.[0]?.name).then((cUrl) => {
        if (!cancelled) {
          if (cUrl) {
            setCanvasUrl(cUrl);
            setIsCanvasMode(true);
          } else {
            setCanvasUrl(null);
            setIsCanvasMode(false);
          }
        }
      });

      const q = `${currentTrack.name} ${currentTrack.artists?.[0]?.name || ''}`.trim();
      const checkAndSetVid = () => {
        const cVid = audioEngine.getCurrentVideoId();
        if (cVid && !cancelled) {
          setVideoId(cVid);
          setOfficialVideoId((prev) => prev || cVid);
        }
      };
      checkAndSetVid();
      vidPollInterval = setInterval(checkAndSetVid, 800);

      audioEngine.resolveVideoIdForTrack(q, currentTrack.id).then((vid) => {
        if (!cancelled && vid) {
          setVideoId(vid);
          setOfficialVideoId((prev) => prev || vid);
        }
      });

      // Search official music video / videoclip
      const cleanTitle = currentTrack.name
        .replace(/\s*\(.*?\)/g, '')
        .replace(/\s*\[.*?\]/g, '')
        .trim();
      const cleanArtist = (currentTrack.artists?.[0]?.name || '').replace(/feat\..*$/i, '').trim();
      const clipQuery = `${cleanTitle} ${cleanArtist} official music video`;
      audioEngine.resolveVideoIdForTrack(clipQuery, `clip-${currentTrack.id}`).then((clipVid) => {
        if (!cancelled && clipVid) setOfficialVideoId(clipVid);
      });
    }
    return () => {
      cancelled = true;
      if (typeof vidPollInterval !== 'undefined') clearInterval(vidPollInterval);
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

    const durSec = currentTrack.duration_ms ? Math.round(currentTrack.duration_ms / 1000) : 0;
    fetch(`/api/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}${durSec ? `&duration=${durSec}` : ''}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (parseLyricsData(data)) return;

        // Direct client fallback to LRCLib with duration
        let lrcUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
        if (durSec > 0) lrcUrl += `&duration=${durSec}`;
        return fetch(lrcUrl)
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

  // Compute active synced lyric line with 150ms vocal lead for human timing sync
  const activeLineIndex = syncedLyrics.length > 0
    ? syncedLyrics.reduce((acc, line, idx) => (line.timeMs <= progressMs + 150 ? idx : acc), -1)
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
      style={{ width: isVisible ? `${sidebarWidth}px` : 0 }}
      className={`h-full bg-[#121212] rounded-lg flex flex-col shrink-0 select-none overflow-hidden relative ${
        isResizing ? '' : 'transition-[width,margin,opacity,transform] duration-200 ease-[cubic-bezier(0.3,0,0,1)]'
      } ${
        isVisible
          ? 'mr-2 border border-white/5 opacity-100 translate-x-0'
          : 'w-0 mr-0 border-0 opacity-0 pointer-events-none translate-x-6'
      }`}
    >
      {/* Resizable Left Edge Drag Handle */}
      {isVisible && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute top-0 bottom-0 left-0 w-2.5 -ml-1 cursor-col-resize z-50 hover:bg-[#1ed760]/40 transition-colors group select-none"
          title="Arrastra para cambiar el tamaño"
        >
          <div className="w-[2px] h-full mx-auto bg-transparent group-hover:bg-[#1ed760] transition-colors" />
        </div>
      )}
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
                onClick={(e) => {
                  if (!currentTrack) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  useUIStore.getState().openContextMenu(Math.max(8, r.right - 260), r.bottom + 6, currentTrack.id, (currentTrack as any).playlistId);
                }}
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
            {/* 1. Expanded High-Definition Album Artwork or Spotify Canvas with smooth gradient bleed */}
            <div className="w-full aspect-[4/5] min-h-[340px] max-h-[48vh] rounded-[10px] overflow-hidden shadow-2xl bg-[#181818] relative group">
              {/* Canvas video with smooth fade */}
              <div className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                isCanvasMode && canvasUrl ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none z-0'
              }`}>
                {canvasUrl && (
                  <video
                    key={canvasUrl}
                    src={canvasUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* Cover Image with smooth fade and subtle hover zoom */}
              <MotionCover
                track={currentTrack}
                src={hdCover}
                alt={currentTrack?.name || 'Portada'}
                className={`w-full h-full transition-all duration-700 ease-in-out group-hover:scale-103 ${
                  isCanvasMode && canvasUrl ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                }`}
              />

              {/* Bottom Gradient Fade: Bleeds artwork smoothly downwards into the sidebar background */}
              <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#121212] via-[#121212]/60 to-transparent pointer-events-none z-20" />

              {/* Floating Canvas / Cover Switch Pill Button over gradient bleed */}
              {canvasUrl && (
                <div className="absolute bottom-3 left-3 z-30">
                  <button
                    onClick={() => setIsCanvasMode(!isCanvasMode)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-xs font-bold text-white transition-all active:scale-95 cursor-pointer border border-white/15 shadow-lg"
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
            </div>

            {/* 2. Track Title + Checked Icon + Artists (Clickable) */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-[22px] font-black text-white leading-tight font-['SpotifyMixUITitle'] truncate hover:underline cursor-pointer">
                  {currentTrack?.name || 'Selecciona una canción'}
                </h2>
                <div className="text-[14px] text-[#b3b3b3] mt-1 truncate">
                  {(() => {
                    const parsed = parseTrackArtists(currentTrack?.artists);
                    return parsed.map((artist, idx) => (
                      <span
                        key={artist.id || idx}
                        onClick={() => handleArtistClick(artist.name, artist.id)}
                        className="hover:underline hover:text-white cursor-pointer"
                      >
                        {artist.name}
                        {idx < parsed.length - 1 ? ', ' : ''}
                      </span>
                    ));
                  })()}
                </div>
              </div>

              {currentTrack && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isLiked) {
                      toggleLike(currentTrack.id, currentTrack);
                    }
                    useUIStore.getState().openAddToPlaylistModal(currentTrack);
                  }}
                  className={`p-1.5 transition-transform active:scale-90 shrink-0 ${
                    isLiked ? 'text-[#1ed760]' : 'text-[#b3b3b3] hover:text-white'
                  }`}
                  title={isLiked ? 'Añadida a tus playlists' : 'Añadir a playlist'}
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
                background: `linear-gradient(135deg, ${dominantColor}f0 0%, ${dominantColor}99 65%, rgba(18, 18, 18, 0.9) 100%)`,
                transition: 'background 0.8s ease-in-out, background-color 0.8s ease-in-out',
              }}
              className="rounded-xl p-4 text-white space-y-2 relative shadow-lg overflow-hidden transition-all duration-300 border border-white/10"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm tracking-tight text-white">
                  Vista previa de la letra
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
                {artistInfo.image ? (
                  <img
                    key={artistInfo.image}
                    src={toHDImage(artistInfo.image)}
                    alt={artistInfo.name}
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      // Broken photo: fall back to the song's cover (never a broken-image icon)
                      if (artistPhoto && !artistPhotoFailed) setArtistPhotoFailed(true);
                      else if (hdCover && (e.currentTarget as HTMLImageElement).src !== hdCover) (e.currentTarget as HTMLImageElement).src = hdCover;
                    }}
                    className="w-full h-full object-cover object-top group-hover:scale-104 transition-transform duration-500"
                  />
                ) : null}
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
                    {artistInfo.listeners && (
                      <p className="text-xs text-[#b3b3b3] mt-0.5">
                        {artistInfo.listeners}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (followArtistName) toggleFollowArtist({ id: followArtistId, name: followArtistName, image: artistInfo.image || undefined });
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

            {/* Videoclip Oficial */}
            <div className="rounded-xl p-4 bg-[#1f1f1f] space-y-3 shadow-lg border border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <VideoSwitchNativeIcon size={16} className="text-[#1ed760]" />
                  <h3 className="font-bold text-sm text-white">Videoclip oficial</h3>
                </div>
                <span className="text-[10px] font-bold text-white/50 bg-white/10 px-2 py-0.5 rounded uppercase">
                  Video HD
                </span>
              </div>

              <div className="w-full aspect-video rounded-lg overflow-hidden bg-black relative shadow-inner">
                {officialVideoId || videoId ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${officialVideoId || videoId}?enablejsapi=1&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : 'https://spotifreeweb.vercel.app')}&widget_referrer=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : 'https://spotifreeweb.vercel.app')}&rel=0&playsinline=1`}
                    title={`${currentTrack?.name} - Videoclip`}
                    className="w-full h-full border-0"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-white/40">
                    Buscando videoclip...
                  </div>
                )}
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
                      {parseTrackArtists(upcomingQueue[0].artists).map((a) => a.name).join(', ')}
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
                      {parseTrackArtists(currentTrack.artists).map((a) => a.name).join(', ')}
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
                  {upcomingQueue.map((item, idx) => {
                    const isDragging = draggedQueueIndex === idx;
                    const isOver = dragOverQueueIndex === idx;
                    return (
                      <div
                        key={`${item.id}-${idx}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', String(idx));
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggedQueueIndex(idx);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverQueueIndex !== idx) {
                            setDragOverQueueIndex(idx);
                          }
                        }}
                        onDragLeave={() => {
                          if (dragOverQueueIndex === idx) setDragOverQueueIndex(null);
                        }}
                        onDragEnd={() => {
                          setDraggedQueueIndex(null);
                          setDragOverQueueIndex(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const fromIdx =
                            draggedQueueIndex !== null
                              ? draggedQueueIndex
                              : parseInt(e.dataTransfer.getData('text/plain'), 10);
                          setDraggedQueueIndex(null);
                          setDragOverQueueIndex(null);
                          if (!isNaN(fromIdx) && fromIdx !== idx) {
                            const baseOffset = currentTrackIndex >= 0 ? currentTrackIndex + 1 : 0;
                            usePlayerStore.getState().reorderQueue(baseOffset + fromIdx, baseOffset + idx);
                          }
                        }}
                        onClick={() => playTrack(item, queue)}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-grab active:cursor-grabbing transition-all duration-150 group relative select-none ${
                          isDragging
                            ? 'opacity-30 scale-95 bg-white/5'
                            : isOver
                            ? 'bg-[#1ed760]/20 border-t-2 border-[#1ed760]'
                            : 'hover:bg-white/10'
                        }`}
                        title="Arrastra para reordenar la cola · Clic para reproducir"
                      >
                        <div className="relative w-12 h-12 rounded overflow-hidden shrink-0 shadow bg-[#282828]">
                          <img
                            src={toHDImage(item.album?.images?.[0]?.url)}
                            alt={item.name}
                            className="w-full h-full object-cover pointer-events-none"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                            <PlayNativeIcon size={16} className="text-white ml-0.5" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 pointer-events-none">
                          <p className="font-bold text-white group-hover:text-[#1ed760] truncate text-sm">
                            {item.name}
                          </p>
                          <p className="text-xs text-[#b3b3b3] truncate mt-0.5">
                            {parseTrackArtists(item.artists).map((a) => a.name).join(', ')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
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
                background: `linear-gradient(180deg, ${dominantColor}f0 0%, ${dominantColor}77 30%, rgba(18, 18, 18, 0.95) 65%, #121212 100%)`,
                transition: 'background 0.8s ease-in-out',
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
                  {parseTrackArtists(currentTrack.artists).map((a) => a.name).join(', ')}
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
                        className={`transition-all duration-300 flex flex-wrap items-baseline gap-x-1.5 ${
                          isCurrent
                            ? 'scale-102 text-2xl font-black py-1'
                            : 'text-white/40 text-xl font-bold hover:text-white/80 py-0.5'
                        }`}
                      >
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            if (typeof window !== 'undefined' && (window as any).__audioEngine) {
                              (window as any).__audioEngine.seek(line.timeMs / 1000);
                            }
                          }}
                          className="cursor-pointer inline-flex flex-wrap items-baseline gap-x-1.5"
                          title="Ir a este momento"
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
                        </span>
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

      {/* 4. SHARED SESSION / FRIENDS MODE */}
      {activeRightSidebar === 'friends' && (
        <SharedSessionSidebarView onClose={closeRightSidebar} />
      )}
    </aside>
  );
};
