import React, { useState, useEffect, useRef } from 'react';
import { MotionCover } from '../common/MotionCover';

/** Transparent 1×1 poster: Android's WebView draws a grey "play" icon for videos without one */
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useShallow } from 'zustand/react/shallow';
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
import { openAudioSourceSheet } from '../../utils/audioSourceSheet';
import { openSleepTimerSheet, useSleepTimer } from '../../services/sleepTimer';
import { openStoryCard } from '../../utils/storyCard';
import { resolveVibrantColor, extractDominantColorFromImage } from '../../utils/spotifyColor';
import { handleImageError, DEFAULT_FALLBACK_COVER } from '../../utils/imageFallback';
import { getArtistPicture } from '../../utils/artistImage';
import { fetchLyricsUnified, parseEnhancedLyrics, getSynchronizedLyricProgress, type SyncedLine } from '../../utils/lyricsService';
import { findExactCover, getTrackCoverUrl, persistTrackCover } from '../../utils/trackCovers';
import { fetchTrackCanvas } from '../../services/spotifyApi';
import { useLabsStore, openSpeedControlSheet, isTrackDisliked } from '../../services/labsService';
import { useDragToDismiss } from '../../hooks/useDragToDismiss';
import { useAIDJStore } from '../../services/aiDJService';
import { SpotifyDJVisualizer } from '../dj/SpotifyDJVisualizer';
import { useUIStore } from '../../store/useUIStore';
import { isNotInterested, undoNotInterested } from '../../utils/notInterested';
import { LyricsFullscreen } from './LyricsFullscreen';
import { showGlobalToast } from '../../utils/globalToast';
import { isTrackDownloaded } from '../../utils/offlineStorage';
import { downloadTrackEverywhere, removeTrackDownload } from '../../utils/downloadTrack';
import { parseTrackArtists } from '../../utils/trackArtists';
import { openDevicePickerSheet, useAudioOutputStore } from '../../services/audioOutputService';

interface MobileNowPlayingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlaylistById?: (id: string, name?: string, img?: string) => void;
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
    playTrack,
    queue,
    currentContextId,
    currentContextName,
    addToQueue,
  } = usePlayerStore(
    useShallow((s) => ({ currentTrack: s.currentTrack, isPlaying: s.isPlaying, togglePlay: s.togglePlay, nextTrack: s.nextTrack, previousTrack: s.previousTrack, progressMs: s.progressMs, durationMs: s.durationMs, setProgress: s.setProgress, shuffleMode: s.shuffleMode, toggleShuffle: s.toggleShuffle, repeatMode: s.repeatMode, toggleRepeat: s.toggleRepeat, likedTrackIds: s.likedTrackIds, toggleLike: s.toggleLike, playTrack: s.playTrack, queue: s.queue, currentContextId: s.currentContextId, currentContextName: s.currentContextName, addToQueue: s.addToQueue }))
  );

  const { activeOutputLabel, activeOutputKind } = useAudioOutputStore(
    useShallow((s) => ({ activeOutputLabel: s.activeLabel, activeOutputKind: s.activeKind }))
  );

  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const queueScrollRef = useRef<HTMLDivElement>(null);
  const {
    dragY: queueDragY,
    isDismissing: isQueueDismissing,
    handleProps: queueHandleProps,
    contentProps: queueContentProps,
    sheetStyle: queueSheetStyle,
    resetDrag: resetQueueDrag,
    triggerDismiss: dismissQueue,
  } = useDragToDismiss({
    onClose: () => setIsQueueOpen(false),
    scrollRef: queueScrollRef,
    threshold: 70,
    velocityThreshold: 0.4,
  });

  // Queue: press and hold a song, then drag it to move it (the row takes the grey it already
  // shows when pressed). Moving the finger before the hold is a normal scroll.
  const [reorder, setReorder] = useState<{ idx: number; offset: number } | null>(null);
  const reorderRef = useRef<{ idx: number; offset: number } | null>(null);
  reorderRef.current = reorder;
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdStartY = useRef(0);
  const holdStartIdx = useRef(0);
  const rowH = useRef(68);
  const suppressClick = useRef(false);

  // While dragging the page must not scroll (React's touch listeners can't stop it: passive)
  useEffect(() => {
    const el = queueScrollRef.current;
    if (!el) return;
    const block = (e: TouchEvent) => {
      if (reorderRef.current) e.preventDefault();
    };
    el.addEventListener('touchmove', block, { passive: false });
    return () => el.removeEventListener('touchmove', block);
  }, [isQueueOpen]);

  const onRowTouchStart = (e: React.TouchEvent, idx: number) => {
    holdStartY.current = e.touches[0].clientY;
    const row = e.currentTarget as HTMLElement;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      rowH.current = row.offsetHeight + 4;
      holdStartIdx.current = idx;
      setReorder({ idx, offset: 0 });
      // the swipe-down-to-close of the queue doesn't apply while moving a song
      resetQueueDrag();
      try {
        navigator.vibrate?.(12);
      } catch {}
    }, 350);
  };
  const onRowTouchMove = (e: React.TouchEvent, baseOffset: number, count: number) => {
    const dy = e.touches[0].clientY - holdStartY.current;
    const r = reorderRef.current;
    if (!r) {
      if (Math.abs(dy) > 8 && holdTimer.current) {
        clearTimeout(holdTimer.current);
        holdTimer.current = null;
      }
      return;
    }
    e.stopPropagation();
    const target = Math.max(0, Math.min(count - 1, holdStartIdx.current + Math.round(dy / rowH.current)));
    if (target !== r.idx) usePlayerStore.getState().reorderQueue(baseOffset + r.idx, baseOffset + target);
    setReorder({ idx: target, offset: dy - (target - holdStartIdx.current) * rowH.current });
  };
  const onRowTouchEnd = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (reorderRef.current) {
      suppressClick.current = true; // the lift after a drag is not a tap
      setTimeout(() => (suppressClick.current = false), 350);
      setReorder(null);
    }
  };

  const isDJActive =
    currentContextId === 'dj-session' ||
    currentContextId === 'spotify-dj' ||
    currentContextId === 'dj';
  const currentSetTitle = useAIDJStore((s) => s.currentSetTitle);
  const djThemeColor = useAIDJStore((s) => s.djThemeColor);
  const visualizerState = useAIDJStore((s) => s.visualizerState);
  const voiceLevel = useAIDJStore((s) => s.voiceLevel);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [syncedLines, setSyncedLines] = useState<SyncedLine[]>([]);
  const [isLyricsExpanded, setIsLyricsExpanded] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuScrollRef = useRef<HTMLDivElement>(null);
  const {
    dragY: menuDragY,
    isDismissing: isMenuDismissing,
    handleProps: menuHandleProps,
    contentProps: menuContentProps,
    sheetStyle: menuSheetStyle,
    triggerDismiss: dismissMenu,
  } = useDragToDismiss({
    onClose: () => setIsMenuOpen(false),
    scrollRef: menuScrollRef,
    threshold: 70,
    velocityThreshold: 0.4,
  });
  const [isTrackDownloadedState, setIsTrackDownloadedState] = useState(false);
  const [isDownloadingTrackState, setIsDownloadingTrackState] = useState(false);

  useEffect(() => {
    if (currentTrack?.id) {
      isTrackDownloaded(currentTrack.id).then(setIsTrackDownloadedState);
    }
  }, [currentTrack?.id, isMenuOpen]);
  const sleepActive = useSleepTimer((s) => s.endsAt !== null || Boolean(s.trackId));
  const { labsEnabled, speedControlEnabled, tasteRatingEnabled, playbackSpeed } = useLabsStore();
  const dislikeCurrentTrack = usePlayerStore((s) => s.dislikeCurrentTrack);
  const [artistPicture, setArtistPicture] = useState<string | null>(null);
  const [isCanvasMode, setIsCanvasMode] = useState(false);
  const [canvasUrl, setCanvasUrl] = useState<string | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
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

  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState<number>(0);
  const currentTrackIdRef = useRef<string | null>(currentTrack?.id || null);

  const [displayCover, setDisplayCover] = useState<string | null>(() => {
    if (!currentTrack) return null;
    return getTrackCoverUrl(currentTrack) || currentTrack.album?.images?.[0]?.url || (currentTrack as any).image || null;
  });

  const handleCoverError = async () => {
    if (!currentTrack) return;
    const targetId = currentTrack.id;
    const direct = getTrackCoverUrl(currentTrack);
    if (direct && !direct.includes('liked-songs')) {
      setDisplayCover(direct);
      return;
    }

    // Only this exact song's cover (same title and artist), never another song's
    const exact = await findExactCover(currentTrack);
    if (exact && currentTrackIdRef.current === targetId) {
      persistTrackCover(targetId, exact);
      setDisplayCover(exact);
      extractDominantColorFromImage(exact).then((hex) => {
        if (hex && currentTrackIdRef.current === targetId) setExtractedModalColor(hex);
      });
      return;
    }

    // Fallback to reliable default cover
    if (currentTrackIdRef.current === targetId) {
      setDisplayCover(DEFAULT_FALLBACK_COVER);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let vidPollInterval: any;
    const trackId = currentTrack?.id;
    currentTrackIdRef.current = trackId || null;

    if (currentTrack) {
      // Instantly synchronize cover, clear stale lyrics, and reset canvas to prevent leakage
      const immediateCover = getTrackCoverUrl(currentTrack) || currentTrack.album?.images?.[0]?.url || (currentTrack as any).image;
      if (immediateCover && !immediateCover.includes('liked-songs')) {
        setDisplayCover(immediateCover);
        extractDominantColorFromImage(immediateCover).then((hex) => {
          if (!cancelled && hex && currentTrackIdRef.current === trackId) {
            setExtractedModalColor(hex);
          }
        });
      } else {
        handleCoverError();
      }

      // Reset media/canvas state synchronously
      setIsCanvasMode(false);
      setCanvasUrl(null);
      setCanvasReady(false);
      setLyrics(null);
      setSyncedLines([]);
      setVideoId(null);
      setOfficialVideoId(null);

      const q = `${currentTrack.name} ${currentTrack.artists?.[0]?.name || ''}`.trim();
      const checkAndSetVid = () => {
        const cVid = audioEngine.getCurrentVideoId();
        if (cVid && !cancelled && currentTrackIdRef.current === trackId) {
          setVideoId(cVid);
          setOfficialVideoId((prev) => prev || cVid);
        }
      };
      checkAndSetVid();
      vidPollInterval = setInterval(checkAndSetVid, 800);

      audioEngine.resolveVideoIdForTrack(q, currentTrack.id).then((vid) => {
        if (!cancelled && vid && currentTrackIdRef.current === trackId) {
          setVideoId(vid);
          setOfficialVideoId((prev) => prev || vid);
        }
      });

      // Fetch Spotify Canvas video loop dynamically for any track (including searched Deezer/iTunes tracks)
      fetchTrackCanvas(currentTrack.id, currentTrack.name, currentTrack.artists?.[0]?.name).then((cUrl) => {
        if (!cancelled && currentTrackIdRef.current === trackId) {
          if (cUrl) {
            setCanvasUrl(cUrl);
            setIsCanvasMode(true);
          } else {
            setCanvasUrl(null);
            setIsCanvasMode(false);
          }
        }
      });

      // Search official music video / videoclip for Video mode
      const cleanTitle = currentTrack.name
        .replace(/\s*\(.*?\)/g, '')
        .replace(/\s*\[.*?\]/g, '')
        .trim();
      const cleanArtist = (currentTrack.artists?.[0]?.name || '').replace(/feat\..*$/i, '').trim();
      const clipQuery = `${cleanTitle} ${cleanArtist} official music video`;
      audioEngine.resolveVideoIdForTrack(clipQuery, `clip-${currentTrack.id}`).then((clipVid) => {
        if (!cancelled && clipVid && currentTrackIdRef.current === trackId) {
          setOfficialVideoId(clipVid);
        }
      });
    }
    return () => {
      cancelled = true;
      if (typeof vidPollInterval !== 'undefined') clearInterval(vidPollInterval);
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
        const durSec = currentTrack.duration_ms ? currentTrack.duration_ms / 1000 : undefined;
        const res = await fetchLyricsUnified(title, artist, durSec);
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

  const vocalProgressMs = getSynchronizedLyricProgress(progressMs, durationMs);

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
        // Only scroll the card's own box (the full-screen lyrics follow the song on their own)
        const container = lyricsScrollRef.current;
        const targetTop = activeEl.offsetTop - container.offsetTop - 40;
        container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      }
    }
  }, [activeLineIndex]);

  if (!isOpen || !currentTrack) return null;

  const isLiked = likedTrackIds.includes(currentTrack.id);
  const coverUrl = currentTrack.album?.images?.[0]?.url;
  const percent = durationMs > 0 ? Math.min(100, Math.max(0, (progressMs / durationMs) * 100)) : 0;

  const contextName = React.useMemo(() => {
    if (isDJActive) return currentSetTitle || 'DJ de Spotify';
    if (currentContextId === 'collection:tracks' || currentContextId === 'liked-songs') return 'Canciones que te gustan';
    if (currentContextName) return currentContextName;
    const playlists = useSpotifyDataStore.getState().playlists;
    const pl = playlists.find((p) => p.id === currentContextId);
    if (pl?.name) return pl.name;
    if (currentTrack?.album?.name) return currentTrack.album.name;
    return 'Lista de reproducción';
  }, [currentContextId, currentContextName, isDJActive, currentSetTitle, currentTrack?.album?.name]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    const newMs = (val / 100) * durationMs;
    setProgress(newMs);
    audioEngine.seek(newMs / 1000);
  };

  // The Canvas only takes over once its video is really playing (it loads in the background as
  // soon as the song has one): no black screen / Android's default video icon in between
  const showCanvas = Boolean(isCanvasMode && canvasUrl && canvasReady);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col select-none font-['SpotifyMixUI'] animate-slide-up-modal overflow-hidden"
      style={{
        background: showCanvas
          ? '#080808'
          : `linear-gradient(180deg, ${extractedModalColor} 0%, rgba(18, 18, 18, 1) 500px, #121212 100%)`,
      }}
    >
      {/* Canvas Full-Screen Looping Video in Background with smooth crossfade */}
      <div className={`absolute inset-0 pointer-events-none z-0 overflow-hidden transition-opacity duration-700 ease-in-out ${
        showCanvas ? 'opacity-100' : 'opacity-0'
      }`}>
        {canvasUrl && (
          <video
            key={canvasUrl}
            src={canvasUrl}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            // The song's cover until the first frame (never the WebView's grey video icon)
            poster={displayCover || TRANSPARENT_PIXEL}
            onPlaying={() => setCanvasReady(true)}
            onError={() => setCanvasReady(false)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {/* Authentic Spotify gradient overlay for pristine legibility of text and controls */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/85 pointer-events-none" />
      </div>

      {/* Top Header */}
      <div
        className="sticky top-0 z-20 flex items-center justify-between text-white px-4 py-2 bg-black/20 backdrop-blur-sm"
        style={{ paddingTop: 'calc(8px + var(--sat))' }}
      >
        <button
          onClick={onClose}
          className="w-12 h-12 flex items-center justify-center text-white hover:text-white/80 active:scale-90 transition-transform cursor-pointer"
          title="Minimizar"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 15.657l-6.364-6.364a1 1 0 0 1 1.414-1.414L12 12.828l4.95-4.95a1 1 0 1 1 1.414 1.414L12 15.657z" />
          </svg>
        </button>

        <button
          onClick={() => {
            if (isDJActive) {
              onClose();
              onSelectPlaylistById?.('spotify-dj', 'DJ de Spotify');
            } else if (currentContextId) {
              onClose();
              onSelectPlaylistById?.(currentContextId, contextName);
            }
          }}
          className="flex flex-col items-center max-w-[210px] active:scale-95 transition-transform cursor-pointer group"
          title={`Ir a ${contextName}`}
        >
          {isDJActive ? (
            <>
              <span className="text-[10px] uppercase font-black text-white/90 tracking-widest font-['SpotifyMixUITitle']">
                DJ
              </span>
              <span className="text-xs font-bold text-white truncate w-full text-center mt-0.5 group-hover:underline">
                {currentSetTitle || 'Lo que has estado escuchando'}
              </span>
            </>
          ) : (
            <>
              <span className="text-[10px] uppercase font-bold text-white/60 tracking-wider">
                REPRODUCIENDO DE LA LISTA
              </span>
              <span className="text-xs font-bold text-white truncate w-full text-center group-hover:underline">
                {contextName}
              </span>
            </>
          )}
        </button>

        <button
          onClick={() => setIsMenuOpen(true)}
          className="w-10 h-10 flex items-center justify-center text-white/80 hover:text-white active:scale-90 cursor-pointer"
          title="Más opciones"
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm6.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM16 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
          </svg>
        </button>
      </div>

      {/* Scrollable Player Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 pt-1 pb-10 space-y-3.5 relative z-10">
        {/* Large Artwork or Spotify Canvas Spacer with smooth crossfade and horizontal swipe to skip */}
        <div
          onTouchStart={(e) => {
            setTouchStartX(e.targetTouches[0].clientX);
            setTouchDeltaX(0);
          }}
          onTouchMove={(e) => {
            if (touchStartX !== null) {
              setTouchDeltaX(e.targetTouches[0].clientX - touchStartX);
            }
          }}
          onTouchEnd={() => {
            if (touchDeltaX > 45) {
              previousTrack();
            } else if (touchDeltaX < -45) {
              nextTrack();
            }
            setTouchStartX(null);
            setTouchDeltaX(0);
          }}
          className="flex items-center justify-center py-1 relative touch-pan-y cursor-grab active:cursor-grabbing"
        >
          <div
            style={{
              transform: touchDeltaX !== 0 ? `translateX(${Math.max(-75, Math.min(75, touchDeltaX * 0.45))}px)` : 'none',
              transition: touchStartX !== null ? 'none' : 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
            }}
            className={`w-full max-w-[min(74vw,300px)] sm:max-w-[320px] aspect-square rounded-2xl overflow-hidden shadow-[0_16px_45px_rgba(0,0,0,0.7)] bg-[#181818] relative transition-all duration-700 ease-in-out ${
            showCanvas
              ? 'opacity-0 scale-95 pointer-events-none'
              : 'opacity-100 scale-100'
          }`}>
            {displayCover ? (
              // Comes alive with the album's Apple Music animated cover when there is one
              <MotionCover
                track={currentTrack}
                src={displayCover}
                alt={currentTrack.name}
                onImgError={handleCoverError}
                className="w-full h-full"
                imgClassName="transition-opacity duration-500"
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
              {isCanvasMode && !canvasReady ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                  <span>Cargando Canvas…</span>
                </>
              ) : isCanvasMode ? (
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
                showCanvas && displayCover ? 'w-12 h-12 opacity-100 mr-3' : 'w-0 h-12 opacity-0 mr-0'
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
                  {(() => {
                    const parsed = parseTrackArtists(currentTrack.artists);
                    return parsed.map((a, i) => (
                      <span
                        key={a.id || i}
                        onClick={(e) => {
                          e.stopPropagation();
                          onClose();
                          onSelectPlaylistById?.(a.id, a.name);
                        }}
                        className="hover:underline hover:text-white active:text-white"
                      >
                        {a.name}{i < parsed.length - 1 ? ', ' : ''}
                      </span>
                    ));
                  })()}
                </p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!currentTrack) return;
                if (!isLiked) {
                  toggleLike(currentTrack.id, currentTrack);
                }
                useUIStore.getState().openAddToPlaylistModal(currentTrack);
              }}
              className="w-10 h-10 flex items-center justify-center text-[#b3b3b3] hover:text-white active:scale-90 transition-transform shrink-0"
              title={isLiked ? 'Añadida a tus playlists' : 'Añadir a playlist'}
            >
              {isLiked ? (
                <CheckTrackNativeIcon size={26} className="text-[#1ed760]" />
              ) : (
                <AddTrackNativeIcon size={26} className="text-white/80" />
              )}
            </button>

            {/* No me gusta (solo si está activado el modo Labs y Taste Rating) */}
            {labsEnabled && tasteRatingEnabled && currentTrack && (() => {
              const isCurrentDisliked = Boolean(
                isNotInterested(currentTrack) || isTrackDisliked(currentTrack)
              );
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isCurrentDisliked) {
                      undoNotInterested(currentTrack);
                      useLabsStore.getState().clearAllDislikes();
                      showGlobalToast('Podremos volver a ponértela');
                    } else {
                      dislikeCurrentTrack();
                    }
                  }}
                  className={`w-9 h-9 flex items-center justify-center rounded-full active:scale-90 transition-transform cursor-pointer shrink-0 ${
                    isCurrentDisliked
                      ? 'text-[#ff5c5c]'
                      : 'text-[#b3b3b3] hover:text-white'
                  }`}
                  title={isCurrentDisliked ? 'Ya no te disgusta' : 'No me gusta (saltar y no volver a poner)'}
                >
                  <svg width={20} height={20} viewBox="0 0 24 24" fill={isCurrentDisliked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
                  </svg>
                </button>
              );
            })()}
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
              {labsEnabled && speedControlEnabled && (
                <button
                  type="button"
                  onClick={openSpeedControlSheet}
                  className="px-2 py-0.5 rounded-full bg-[#242424] hover:bg-[#2e2e2e] text-[#b3b3b3] hover:text-white font-medium text-[10px] active:scale-95 transition-colors cursor-pointer"
                  title="Velocidad de reproducción"
                >
                  {playbackSpeed === 1 ? '1x' : `${playbackSpeed.toFixed(2)}x`}
                </button>
              )}
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
            </button>
          </div>

          {/* Authentic Spotify Device Bar & Bottom Controls */}
          <div className="flex items-center justify-between pt-3 pb-1 border-t border-white/5">
            <button
              onClick={() => openDevicePickerSheet()}
              className="flex items-center gap-2 text-xs font-bold text-[#1ed760] tracking-wide cursor-pointer hover:underline active:scale-95 transition-transform min-w-0 max-w-[60%]"
              title="Seleccionar salida de audio"
            >
              <SpotifyConnectNativeIcon size={16} className="shrink-0" />
              <span className="uppercase tracking-wider text-[11px] font-black truncate">
                {activeOutputKind !== 'default' && activeOutputKind !== 'speaker' && activeOutputLabel
                  ? activeOutputLabel
                  : 'Este teléfono'}
              </span>
            </button>

            <div className="flex items-center gap-2.5 sm:gap-4 text-[#b3b3b3] shrink-0">
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
              <button
                onClick={() => setIsQueueOpen(true)}
                className="hover:text-white transition-colors active:scale-90 text-[#b3b3b3] cursor-pointer"
                title="Cola de reproducción"
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M15 15H1v-1.5h14V15zm0-4.5H1V9h14v1.5zm0-4.5H1V4.5h14V6zm0-4.5H1V0h14v1.5z" />
                </svg>
              </button>

              {/* Floating DJ Button with spinning orb and dynamic track background color */}
              {isDJActive && (
                <button
                  onClick={() => {
                    onClose();
                    if (onSelectPlaylistById) {
                      onSelectPlaylistById('spotify-dj');
                    }
                  }}
                  className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center cursor-pointer hover:scale-108 active:scale-95 transition-all ml-1 shadow-lg overflow-hidden p-0"
                  style={{
                    backgroundColor: extractedModalColor || djThemeColor || '#181818',
                    boxShadow: `0 4px 18px ${extractedModalColor || djThemeColor || '#000000'}80`,
                    transition: 'background-color 0.8s ease-in-out, box-shadow 0.8s ease-in-out',
                  }}
                  title="Volver a la pantalla del DJ"
                >
                  <SpotifyDJVisualizer
                    size={36}
                    mini
                    state={visualizerState === 'speaking' ? 'speaking' : isPlaying ? 'playing' : 'idle'}
                    voiceLevel={voiceLevel}
                    themeColor={extractedModalColor || djThemeColor}
                  />
                </button>
              )}
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
            onClick={() => setIsLyricsExpanded(true)}
            className="flex items-center justify-between mb-4 text-white cursor-pointer select-none"
          >
            <span className="font-bold text-base tracking-tight font-['SpotifyMixUITitle']">
              Letras
            </span>
          </div>

          {/* Lyrics Content */}
          {syncedLines.length > 0 ? (
            <div
              ref={lyricsScrollRef}
              className={`space-y-4 font-bold select-none transition-all duration-300 ${
                'max-h-[220px] overflow-y-auto scroll-smooth pr-1 scrollbar-none'
              }`}
            >
              {syncedLines.map((line, idx) => {
                const isCurrent = idx === activeLineIndex;
                return (
                  <p
                    key={`m-lyric-${idx}-${line.timeMs}`}
                    data-line-index={idx}
                    className={`transition-all duration-200 leading-snug block origin-left text-xl font-bold ${
                      isCurrent
                        ? 'text-white scale-[1.03] drop-shadow-[0_2px_14px_rgba(255,255,255,0.65)]'
                        : Math.abs(idx - activeLineIndex) === 1
                        ? 'text-white/70 hover:text-white'
                        : 'text-black/50 hover:text-white/80'
                    }`}
                  >
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        if (typeof window !== 'undefined' && (window as any).__audioEngine) {
                          (window as any).__audioEngine.seek(line.timeMs / 1000);
                        }
                      }}
                      className="cursor-pointer inline-block active:opacity-75 transition-opacity"
                      title="Ir a este momento"
                    >
                      {isCurrent && line.words.length > 0 ? (
                        line.words.map((w, wIdx) => {
                          const vocalMs = vocalProgressMs;
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
                    </span>
                  </p>
                );
              })}
            </div>
          ) : lyrics ? (
            <div className={`text-white font-bold leading-relaxed whitespace-pre-line text-base h-[220px] overflow-hidden`}>
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
              onClick={() => setIsLyricsExpanded(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 hover:bg-black/50 text-white text-xs font-bold active:scale-95 transition-all"
              title="Ampliar letra"
            >
              <span>Ampliar</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
            </button>
          </div>
        </div>

        <LyricsFullscreen
          open={isLyricsExpanded}
          onClose={() => setIsLyricsExpanded(false)}
          track={currentTrack}
          title={currentTrack.name}
          artist={(currentTrack.artists || []).map((a) => a.name).join(', ')}
          cover={coverUrl}
          color={extractedModalColor}
          lines={syncedLines as any}
          plain={lyrics as any}
          activeIndex={activeLineIndex}
          progressMs={progressMs}
          durationMs={durationMs}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onPrevious={previousTrack}
          onNext={nextTrack}
          onSeek={(ms) => {
            setProgress(ms);
            audioEngine.seek(ms / 1000);
          }}
        />

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
                src={`https://www.youtube.com/embed/${officialVideoId || videoId}?enablejsapi=1&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : 'https://spotifreeweb.vercel.app')}&widget_referrer=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : 'https://spotifreeweb.vercel.app')}&rel=0&playsinline=1`}
                title={`${currentTrack.name} - Videoclip oficial`}
                className="w-full h-full border-0"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
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
                  ? 'border border-white/40 text-white bg-transparent hover:border-white'
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

      {/* Track More Options Menu / Bottom Sheet ("Más opciones") */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[120] flex flex-col justify-end">
          {/* Backdrop with animated fade */}
          <div
            onClick={() => dismissMenu()}
            style={{
              opacity: isMenuDismissing ? 0 : menuDragY > 0 ? Math.max(0, 1 - menuDragY / 400) : undefined,
              transition: isMenuDismissing ? 'opacity 0.22s ease' : undefined,
            }}
            className="fixed inset-0 bg-black/65 backdrop-blur-sm animate-fade-in"
          />

          {/* Bottom Sheet with Drag-to-Dismiss */}
          <div
            ref={menuScrollRef}
            {...menuContentProps}
            style={menuSheetStyle}
            className={`relative z-10 bg-[#242424] rounded-t-[22px] px-5 pb-5 pt-2 max-h-[75vh] overflow-y-auto border-t border-white/10 shadow-2xl select-none ${
              isMenuDismissing ? '' : 'animate-slide-up-modal'
            }`}
          >
            {/* Top Drag Handle (44px touch target area) */}
            <div
              {...menuHandleProps}
              className="w-full min-h-[38px] py-2 shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
              aria-label="Arrastrar para cerrar"
              role="presentation"
            >
              <div className="w-9 h-1 bg-white/30 rounded-full" />
            </div>

            {/* Header info matching Screenshot 1 */}
            <div className="flex items-center gap-3.5 pb-3 border-b border-white/10">
              <div className="w-12 h-12 min-w-[48px] max-w-[48px] min-h-[48px] max-h-[48px] aspect-square rounded-[4px] overflow-hidden bg-[#181818] shrink-0 shadow">
                {displayCover ? (
                  <img src={displayCover} alt={currentTrack.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white/40">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white text-[17px] truncate font-['SpotifyMixUITitle'] leading-tight">
                  {currentTrack.name}
                </p>
                <p className="text-[13px] text-[#b3b3b3] truncate mt-0.5 font-medium">
                  {artistName}
                </p>
              </div>
            </div>

            {/* Actions list matching Screenshot 1 (clean 24px icons and 16px text) */}
            <div className="space-y-0.5 pt-1">
              {/* 1: Compartir */}
              <button
                onClick={() => {
                  dismissMenu();
                  if (navigator.share) {
                    navigator.share({ title: currentTrack.name, text: `Escuchando ${currentTrack.name} en Spotifree`, url: window.location.href }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(window.location.href).catch(() => {});
                    showGlobalToast('Enlace copiado al portapapeles');
                  }
                }}
                className="w-full flex items-center gap-4 py-3.5 px-2 rounded-xl text-white hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white shrink-0">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium text-[16px] text-white">Compartir</p>
                </div>
              </button>

              {/* 2: Añadir a Canciones que te gustan (Iconic purple gradient square with white heart) */}
              <button
                onClick={() => {
                  toggleLike(currentTrack.id, currentTrack);
                  showGlobalToast(!isLiked ? 'Añadida a Canciones que te gustan' : 'Eliminada de Canciones que te gustan');
                  dismissMenu();
                }}
                className="w-full flex items-center gap-4 py-3.5 px-2 rounded-xl text-white hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer"
              >
                <div className="w-7 h-7 rounded-[5px] bg-gradient-to-br from-[#450af5] to-[#8e8ee5] flex items-center justify-center shrink-0 shadow-sm">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium text-[16px] text-white">
                    {isLiked ? 'En Canciones que te gustan' : 'Añadir a Canciones que te gustan'}
                  </p>
                </div>
              </button>

              {/* 3: Añadir a lista */}
              <button
                onClick={() => {
                  const t = currentTrack;
                  dismissMenu();
                  setTimeout(() => useUIStore.getState().openAddToPlaylistModal(t), 150);
                }}
                className="w-full flex items-center gap-4 py-3.5 px-2 rounded-xl text-white hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium text-[16px] text-white">Añadir a lista</p>
                </div>
              </button>

              {/* 4: Ocultar en esta lista */}
              <button
                onClick={() => {
                  const t = currentTrack;
                  dismissMenu();
                  if (isNotInterested(t)) {
                    undoNotInterested(t);
                    showGlobalToast('Podremos volver a ponértela');
                  } else {
                    dislikeCurrentTrack();
                    showGlobalToast('Oculta en esta lista');
                  }
                }}
                className="w-full flex items-center gap-4 py-3.5 px-2 rounded-xl text-white hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-white shrink-0">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium text-[16px] text-white">Ocultar en esta lista</p>
                </div>
              </button>

              {/* 5: Añadir a la cola */}
              <button
                onClick={() => {
                  addToQueue(currentTrack);
                  showGlobalToast('Añadida a la cola');
                  dismissMenu();
                }}
                className="w-full flex items-center gap-4 py-3.5 px-2 rounded-xl text-white hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white shrink-0">
                  <line x1="3" y1="6" x2="15" y2="6" />
                  <line x1="3" y1="12" x2="15" y2="12" />
                  <line x1="3" y1="18" x2="11" y2="18" />
                  <line x1="18" y1="15" x2="18" y2="21" />
                  <line x1="15" y1="18" x2="21" y2="18" />
                </svg>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium text-[16px] text-white">Añadir a la cola</p>
                </div>
              </button>

              {/* 6: Ir a la cola */}
              <button
                onClick={() => {
                  dismissMenu();
                  setTimeout(() => setIsQueueOpen(true), 150);
                }}
                className="w-full flex items-center gap-4 py-3.5 px-2 rounded-xl text-white hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white shrink-0">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium text-[16px] text-white">Ir a la cola</p>
                </div>
              </button>

              {/* 7: Ir al álbum */}
              <button
                onClick={() => {
                  dismissMenu();
                  if (currentTrack.album?.id && onSelectPlaylistById) {
                    onClose();
                    onSelectPlaylistById(currentTrack.album.id, currentTrack.album.name);
                  } else {
                    showGlobalToast(`Álbum: ${currentTrack.album?.name || currentTrack.name}`);
                  }
                }}
                className="w-full flex items-center gap-4 py-3.5 px-2 rounded-xl text-white hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium text-[16px] text-white">Ir al álbum</p>
                </div>
              </button>

              {/* 8: Ir al artista */}
              <button
                onClick={() => {
                  dismissMenu();
                  if (artistName && onSelectPlaylistById) {
                    onClose();
                    onSelectPlaylistById(
                      `art-${encodeURIComponent(artistName)}`,
                      artistName,
                      artistPicture || displayCover || undefined
                    );
                  }
                }}
                className="w-full flex items-center gap-4 py-3.5 px-2 rounded-xl text-white hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white shrink-0">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium text-[16px] text-white">Ir al artista</p>
                </div>
              </button>

              {/* 9: Temporizador de apagado */}
              <button
                onClick={() => {
                  dismissMenu();
                  openSleepTimerSheet();
                }}
                className="w-full flex items-center gap-4 py-3.5 px-2 rounded-xl text-white hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={sleepActive ? 'text-[#1ed760] shrink-0' : 'text-white shrink-0'}>
                  <circle cx="12" cy="13" r="8" />
                  <path d="M12 9v4l2.5 2" />
                  <path d="M10 2h4" />
                </svg>
                <div className="text-left flex-1 min-w-0">
                  <p className={`font-medium text-[16px] ${sleepActive ? 'text-[#1ed760]' : 'text-white'}`}>
                    Temporizador de apagado
                  </p>
                  {sleepActive && <p className="text-xs text-[#1ed760]">Activado</p>}
                </div>
              </button>

              {/* 10: Cambiar fuente de audio */}
              <button
                onClick={() => {
                  dismissMenu();
                  openAudioSourceSheet(currentTrack);
                }}
                className="w-full flex items-center gap-4 py-3.5 px-2 rounded-xl text-white hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer"
              >
                <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor" className="text-white shrink-0">
                  <path d="M3.5 2.5a.75.75 0 0 1 .75.75v9.5a.75.75 0 0 1-1.5 0v-9.5a.75.75 0 0 1 .75-.75m3 2a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5a.75.75 0 0 1 .75-.75m3-3a.75.75 0 0 1 .75.75v11.5a.75.75 0 0 1-1.5 0V2.25a.75.75 0 0 1 .75-.75m3 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5a.75.75 0 0 1 .75-.75" />
                </svg>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium text-[16px] text-white">Cambiar fuente de audio</p>
                </div>
              </button>

              {/* 11: Descargar */}
              <button
                onClick={async () => {
                  dismissMenu();
                  if (isTrackDownloadedState) {
                    await removeTrackDownload(currentTrack);
                    setIsTrackDownloadedState(false);
                  } else {
                    setIsDownloadingTrackState(true);
                    const ok = await downloadTrackEverywhere(currentTrack);
                    setIsDownloadingTrackState(false);
                    if (ok) setIsTrackDownloadedState(true);
                  }
                }}
                className="w-full flex items-center gap-4 py-3.5 px-2 rounded-xl text-white hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer"
              >
                {isTrackDownloadedState ? (
                  <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor" className="text-[#1ed760] shrink-0">
                    <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m11.748-1.97a.75.75 0 0 0-1.06-1.06l-4.47 4.47-1.405-1.406a.75.75 0 1 0-1.061 1.06l2.466 2.467 5.53-5.53z" />
                  </svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="8 12 12 16 16 12" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                  </svg>
                )}
                <div className="text-left flex-1 min-w-0">
                  <p className={`font-medium text-[16px] ${isTrackDownloadedState ? 'text-[#1ed760]' : 'text-white'}`}>
                    {isTrackDownloadedState ? 'Descargada' : isDownloadingTrackState ? 'Descargando…' : 'Descargar'}
                  </p>
                </div>
              </button>

              {/* Labs: Velocidad de reproducción (si está habilitado) */}
              {labsEnabled && speedControlEnabled && (
                <button
                  onClick={() => {
                    dismissMenu();
                    openSpeedControlSheet();
                  }}
                  className="w-full flex items-center gap-4 py-3.5 px-2 rounded-xl text-white hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <div className="text-left flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[16px] text-white">Velocidad de reproducción</p>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-[#b3b3b3]">
                        {playbackSpeed === 1 ? '1x' : `${playbackSpeed.toFixed(2)}x`}
                      </span>
                    </div>
                  </div>
                </button>
              )}

              {/* Stories Card */}
              <button
                onClick={() => {
                  dismissMenu();
                  if (currentTrack) openStoryCard(currentTrack);
                }}
                className="w-full flex items-center gap-4 py-3.5 px-2 rounded-xl text-white hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white shrink-0">
                  <rect x="6" y="2" width="12" height="20" rx="3" />
                  <path d="M9.5 15h5M9.5 18h3" />
                  <rect x="9" y="5.5" width="6" height="6" rx="1" />
                </svg>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium text-[16px] text-white">Compartir en stories</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Queue Bottom Sheet (1:1 Spotify Mobile Parity with Swipe-to-Dismiss) */}
      {isQueueOpen && (
        <div className="fixed inset-0 z-[120] flex flex-col justify-end pointer-events-auto">
          {/* Backdrop with animated fade */}
          <div
            onClick={() => dismissQueue()}
            style={{
              opacity: isQueueDismissing ? 0 : queueDragY > 0 ? Math.max(0, 1 - queueDragY / 400) : undefined,
              transition: isQueueDismissing ? 'opacity 0.22s ease' : undefined,
            }}
            className="fixed inset-0 bg-black/65 backdrop-blur-[2px] animate-fade-in"
          />

          {/* Drawer Sheet */}
          <div
            style={queueSheetStyle}
            className={`relative z-10 bg-[#1e1e1e] rounded-t-[24px] max-h-[82vh] h-[78vh] flex flex-col shadow-2xl border-t border-white/10 select-none font-['SpotifyMixUI'] ${
              isQueueDismissing ? '' : 'animate-slide-up-modal'
            }`}
          >
            {/* Top Drag Handle (pointer + touch universal capture) */}
            <div
              {...queueHandleProps}
              className="w-full min-h-[38px] py-2 shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
              aria-label="Arrastrar para cerrar"
              role="presentation"
            >
              <div className="w-10 h-1 bg-white/30 rounded-full" />
            </div>

            {/* Header: Cola + Reproduciendo <source> (1:1 with Screenshot 2) */}
            <div
              {...queueHandleProps}
              className="px-5 pt-1 pb-2 shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
            >
              <h3 className="font-bold text-white text-2xl font-['SpotifyMixUITitle']">
                Cola
              </h3>
              <p className="text-xs text-[#b3b3b3] mt-0.5 truncate">
                Reproduciendo <span className="font-medium text-white/90">{contextName}</span>
              </p>
            </div>

            {/* Now Playing Section (1:1 with Screenshot 2) */}
            {currentTrack && (
              <div className="px-5 py-2 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-[4px] overflow-hidden bg-[#282828] shrink-0 relative shadow">
                    <img
                      src={displayCover || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'}
                      alt={currentTrack.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {isPlaying && (
                        <span className="flex items-end gap-0.5 h-3 shrink-0">
                          <span className="w-0.5 h-3 bg-[#1ed760] animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-0.5 h-2 bg-[#1ed760] animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-0.5 h-3 bg-[#1ed760] animate-bounce" style={{ animationDelay: '300ms' }} />
                        </span>
                      )}
                      <p className="font-semibold text-sm text-[#1ed760] truncate font-['SpotifyMixUITitle']">
                        {currentTrack.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {(currentTrack as any).explicit && (
                        <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-[2px] bg-[#b3b3b3] text-black text-[9px] font-bold shrink-0">
                          E
                        </span>
                      )}
                      <p className="text-xs text-[#b3b3b3] truncate">
                        {parseTrackArtists(currentTrack.artists).map((a) => a.name).join(', ') || 'Artista'}
                      </p>
                    </div>
                  </div>
                  {/* Circular White Play/Pause Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlay();
                    }}
                    className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shrink-0 shadow-lg hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                    aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
                  >
                    {isPlaying ? (
                      <PauseNativeIcon size={20} className="text-black" />
                    ) : (
                      <PlayNativeIcon size={20} className="text-black ml-0.5" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Section Header: Modo aleatorio desde: / A continuación desde: */}
            <div className="px-5 pt-3 pb-1.5 shrink-0 flex items-center gap-2 text-xs font-semibold text-[#b3b3b3]">
              <ShuffleNativeIcon size={14} className={shuffleMode !== 'off' ? 'text-[#1ed760]' : 'text-[#b3b3b3]'} />
              <span>{shuffleMode !== 'off' ? 'Modo aleatorio desde:' : 'A continuación desde:'}</span>
            </div>

            {/* Upcoming Queue Section (scrollable) */}
            <div
              ref={queueScrollRef}
              {...queueContentProps}
              className="flex-1 overflow-y-auto px-5 pb-3 space-y-1.5"
            >
              {(() => {
                const curIdx = currentTrack ? queue.findIndex((t) => t.id === currentTrack.id) : -1;
                const upcoming = curIdx >= 0 ? queue.slice(curIdx + 1) : queue;

                if (upcoming.length === 0) {
                  return (
                    <div className="py-12 text-center text-[#b3b3b3] space-y-2">
                      <p className="text-sm font-semibold text-white">No hay más canciones en la cola</p>
                      <p className="text-xs text-white/50 max-w-xs mx-auto">
                        La reproducción continuará automáticamente con recomendaciones similares de Spotify.
                      </p>
                    </div>
                  );
                }

                const baseOffset = curIdx >= 0 ? curIdx + 1 : 0;
                return (
                  <div className="space-y-1">
                    {upcoming.map((t, idx) => {
                      const cover = getTrackCoverUrl(t) || t.album?.images?.[0]?.url || (t as any).image;
                      const dragging = reorder?.idx === idx;
                      return (
                        <div
                          key={t.id}
                          onTouchStart={(e) => onRowTouchStart(e, idx)}
                          onTouchMove={(e) => onRowTouchMove(e, baseOffset, upcoming.length)}
                          onTouchEnd={onRowTouchEnd}
                          onTouchCancel={onRowTouchEnd}
                          onContextMenu={(e) => e.preventDefault()}
                          onClick={() => {
                            if (suppressClick.current) return;
                            playTrack(t, queue);
                            dismissQueue();
                          }}
                          style={
                            dragging
                              ? { transform: `translateY(${reorder!.offset}px)`, transition: 'none', position: 'relative', zIndex: 10 }
                              : undefined
                          }
                          className={`flex items-center gap-3 p-1.5 rounded-xl transition-colors cursor-pointer ${
                            dragging ? 'bg-white/15 shadow-[0_8px_24px_rgba(0,0,0,0.5)]' : 'hover:bg-white/10 active:bg-white/15'
                          }`}
                        >
                          <div className="w-12 h-12 rounded-[4px] overflow-hidden bg-[#282828] shrink-0 shadow">
                            <img
                              src={cover || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'}
                              alt={t.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-sm text-white truncate font-['SpotifyMixUITitle']">{t.name}</p>
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {(t as any).explicit && (
                                <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-[2px] bg-[#b3b3b3] text-black text-[9px] font-bold shrink-0">
                                  E
                                </span>
                              )}
                              <p className="text-xs text-[#b3b3b3] truncate">
                                {parseTrackArtists(t.artists).map((a) => a.name).join(', ') || 'Artista'}
                              </p>
                            </div>
                          </div>
                          {/* 3 horizontal drag reorder lines (1:1 with Screenshot 2) */}
                          <div
                            className="w-8 h-8 flex flex-col justify-center items-center gap-1 text-white/30 hover:text-white/70 cursor-grab active:cursor-grabbing shrink-0"
                            aria-label="Reordenar"
                          >
                            <span className="w-5 h-[2px] bg-current rounded-full" />
                            <span className="w-5 h-[2px] bg-current rounded-full" />
                            <span className="w-5 h-[2px] bg-current rounded-full" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Sticky Bottom Action Bar with [Aleatorio] and [Temporizador] (1:1 with Screenshot 2) */}
            <div className="p-3 bg-[#1e1e1e] border-t border-white/5 flex items-center gap-3 shrink-0">
              <button
                onClick={() => toggleShuffle()}
                className={`flex-1 py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  shuffleMode !== 'off' ? 'bg-[#282828] text-[#1ed760]' : 'bg-[#282828] text-white hover:bg-[#323232]'
                }`}
              >
                <ShuffleNativeIcon size={18} className={shuffleMode !== 'off' ? 'text-[#1ed760]' : 'text-white'} />
                <span className="text-sm font-semibold">Aleatorio</span>
              </button>
              <button
                onClick={() => openSleepTimerSheet()}
                className={`flex-1 py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  sleepActive ? 'bg-[#282828] text-[#1ed760]' : 'bg-[#282828] text-white hover:bg-[#323232]'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={sleepActive ? 'text-[#1ed760]' : 'text-white'}>
                  <circle cx="12" cy="13" r="8" />
                  <path d="M12 9v4l2.5 2" />
                  <path d="M10 2h4" />
                </svg>
                <span className="text-sm font-semibold">Temporizador</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
