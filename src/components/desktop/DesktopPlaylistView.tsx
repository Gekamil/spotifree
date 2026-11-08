import React, { useState, useEffect, useRef } from 'react';
import type { Playlist, Track } from '../../types/spotify';
import {
  PlayNativeIcon,
  PauseNativeIcon,
  ShuffleNativeIcon,
  SmartShuffleNativeIcon,
  VerifiedArtistNativeIcon,
  CheckCircleNativeIcon,
  PlusCircleNativeIcon,
  DownloadActiveCircleNativeIcon,
  DownloadCircleNativeIcon,
  AutomixNativeIcon,
  SpotifyBadgeIcon,
} from '../icons/SpotifyNativeIcons';
import { ClockIcon } from '../icons/SpotifyIcons';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { formatDuration, stripHtml } from '../../utils/formatters';
import { resolveVibrantColor, extractDominantColorFromImage } from '../../utils/spotifyColor';
import { getSavedCustomTracks, saveCustomTrackToStorage, saveCustomLikedSong, removeCustomLikedSong, getCustomLikedSongs, getRemovedTrackIdsForPlaylist } from '../../utils/userStorage';
import { audioEngine } from '../../services/audioEngine';
import {
  isPlaylistDownloaded,
  downloadPlaylist,
  deleteDownloadedPlaylist,
  downloadTrackAudio,
  deleteDownloadedTrack,
  getAllDownloadedTrackIds,
  onDownloadsChanged,
} from '../../utils/offlineStorage';
import { cleanTrackId, fetchAudioFeaturesBatch, resolveClientSideRealFeature, TRACK_ANALYSIS_EVENT, type AudioFeature } from '../../utils/audioFeatures';
import { djTransitionService } from '../../services/djTransitionService';
import { buildDJSetOrder, getSessionFlavour, mixStyleName, mixStyleOf, SET_STRATEGY_LABELS, startNewDJSession } from '../../services/djMixPlanner';
import { prepareDJAnalyses } from '../../services/trackAnalysisService';
import { TransitionEditorModal } from '../modals/TransitionEditorModal';
import { AIDJView } from '../dj/AIDJView';
import { PlaylistClipsMiniPlayer } from '../playlist/PlaylistClipsMiniPlayer';
import { filterMusicTracksOnly } from '../../utils/trackFilter';

function getArtistMonthlyListeners(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('romeo santos')) return '24.819.340 oyentes mensuales';
  if (n.includes('prince royce')) return '18.940.110 oyentes mensuales';
  if (n.includes('trueno')) return '16.540.890 oyentes mensuales';
  if (n.includes('bad bunny')) return '68.420.912 oyentes mensuales';
  if (n.includes('ozuna')) return '32.140.780 oyentes mensuales';
  if (n.includes('feid')) return '41.290.450 oyentes mensuales';
  if (n.includes('quevedo')) return '22.380.120 oyentes mensuales';
  if (n.includes('rosalía') || n.includes('rosalia')) return '28.450.600 oyentes mensuales';
  if (n.includes('myke towers')) return '35.620.300 oyentes mensuales';
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 80000000;
  const count = Math.max(1200000, hash + 3500000);
  return `${count.toLocaleString('es-ES')} oyentes mensuales`;
}


import { handleImageError } from '../../utils/imageFallback';
import { parseTrackArtists } from '../../utils/trackArtists';
import { getTrackCoverUrl, resolveTrackCoversBatch, TRACK_COVER_CACHE, TrackArtwork } from '../../utils/trackCovers';
import { toHDImage } from '../../utils/formatters';
import { EMPTY_PLAYLIST_COVER, getAutoPlaylistCover, useAutoCovers } from '../../utils/playlistCover';
import { deduplicateTracks } from '../../utils/trackDeduplication';
import { fetchPlaylistRecommendations } from '../../services/spotifyApi';

import { resolvePlaylistBanner } from '../../utils/playlistBanner';

interface DesktopPlaylistViewProps {
  playlist: Playlist;
  onSelectPlaylistById?: (id: string, customName?: string, customImage?: string) => void;
}

export const DesktopPlaylistView: React.FC<DesktopPlaylistViewProps> = ({ playlist, onSelectPlaylistById }) => {
  const {
    currentTrack,
    isPlaying,
    likedTrackIds,
    playTrack,
    togglePlay,
    toggleLike,
    shuffleMode,
    toggleShuffle,
  } = usePlayerStore(
    useShallow((s) => ({ currentTrack: s.currentTrack, isPlaying: s.isPlaying, likedTrackIds: s.likedTrackIds, playTrack: s.playTrack, togglePlay: s.togglePlay, toggleLike: s.toggleLike, shuffleMode: s.shuffleMode, toggleShuffle: s.toggleShuffle }))
  );

  const { openContextMenu, openEditPlaylistModal, openAddToPlaylistModal } = useUIStore();
  const { user, playlists: allUserPlaylists } = useSpotifyDataStore();
  useAutoCovers((s) => s.version); // repaint when the songs' collage is ready
  const [isDownloaded, setIsDownloaded] = useState<boolean>(() => isPlaylistDownloaded(playlist.id));
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
  const [downloadedTrackIds, setDownloadedTrackIds] = useState<Set<string>>(new Set());
  const [downloadingTrackIds, setDownloadingTrackIds] = useState<Set<string>>(new Set());


  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const isLikedInitially =
    playlist.id === 'liked-songs' ||
    playlist.id === 'tracks' ||
    playlist.id.includes('collection:tracks') ||
    playlist.id.includes('collection-tracks') ||
    /^(canciones que te gustan|canciones que me gustan|tus me gusta|liked songs|liked tracks|saved songs|saved tracks|favoritas|favorites|my favorites|favorite songs)$/i.test(
      (playlist.name || '').trim()
    );

  const customSaved = getSavedCustomTracks(playlist.id, isLikedInitially, user?.id);
  const storePl = useSpotifyDataStore.getState().playlists.find((p) => p.id === playlist.id);
  const rawBaseTracks = isLikedInitially
    ? deduplicateTracks([...customSaved, ...(playlist.tracks?.items || []), ...(storePl?.tracks?.items || [])])
    : ((playlist.tracks?.items && playlist.tracks.items.length > 0)
    ? playlist.tracks.items
    : (storePl?.tracks?.items && storePl.tracks.items.length > 0)
    ? storePl.tracks.items
    : customSaved);

  const removedTrackIds = getRemovedTrackIdsForPlaylist(playlist.id);
  const baseTracks = rawBaseTracks.filter((t) => {
    const cleanT = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
    return !removedTrackIds.has(t.id) && !removedTrackIds.has(cleanT);
  });

  const initialTracks = deduplicateTracks(baseTracks).map((t) => {
    if (TRACK_COVER_CACHE.has(t.id)) {
      return {
        ...t,
        album: {
          ...t.album,
          id: t.album?.id || `alb-${t.id}`,
          name: t.album?.name || t.name,
          images: [{ url: TRACK_COVER_CACHE.get(t.id)! }],
        },
      };
    }
    return t;
  });

  const [dynamicTracks, setDynamicTracks] = useState<Track[]>(deduplicateTracks(initialTracks));
  const [dynamicPlaylist, setDynamicPlaylist] = useState<Playlist>(playlist);
  const [trackCovers, setTrackCovers] = useState<Record<string, string>>({});

  // Reactive listener for real-time liked songs synchronization
  useEffect(() => {
    if (!isLikedInitially) return;
    const handleLikedUpdate = (e: any) => {
      const rawUpdated = e.detail?.tracks;
      const remSet = getRemovedTrackIdsForPlaylist('liked-songs');
      const isNotRemoved = (t: Track) => {
        const c = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
        const sig = t.name && t.artists?.[0]?.name ? `sig:${t.name.toLowerCase().trim()}::${t.artists[0].name.toLowerCase().trim()}` : '';
        return !remSet.has(t.id) && !remSet.has(c) && (!sig || !remSet.has(sig));
      };

      if (rawUpdated && Array.isArray(rawUpdated)) {
        const cleanUpdated = rawUpdated.filter(isNotRemoved);
        setDynamicTracks((prev) => {
          if (cleanUpdated.length >= prev.length) {
            return cleanUpdated;
          }
          return deduplicateTracks([...cleanUpdated, ...prev]).filter(isNotRemoved);
        });
        setDynamicPlaylist((prev) => ({
          ...prev,
          tracks: { total: cleanUpdated.length, items: cleanUpdated },
        }));
      } else {
        const custom = getSavedCustomTracks(playlist.id, true, user?.id).filter(isNotRemoved);
        setDynamicTracks((prev) => deduplicateTracks([...custom, ...prev]).filter(isNotRemoved));
      }
    };
    window.addEventListener('spotifree_liked_songs_updated', handleLikedUpdate);
    return () => window.removeEventListener('spotifree_liked_songs_updated', handleLikedUpdate);
  }, [isLikedInitially, playlist.id, user?.id]);

  // Reactive listener for removed tracks from this playlist
  useEffect(() => {
    const handleTrackRemoved = (e: any) => {
      const { playlistId: targetPlId, trackId: targetTrackId, trackObj } = e.detail || {};
      const cleanCurrent = (dynamicPlaylist.id || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
      const cleanTarget = (targetPlId || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
      const isLikedTarget =
        cleanTarget === 'liked-songs' ||
        cleanTarget === 'tracks' ||
        cleanTarget.includes('collection:tracks') ||
        cleanTarget === 'user-liked-songs';

      const matchesThisPlaylist =
        cleanCurrent === cleanTarget ||
        dynamicPlaylist.id === targetPlId ||
        (isLikedInitially && isLikedTarget);

      if (matchesThisPlaylist) {
        const cleanTrack = (targetTrackId || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
        const filterFn = (t: Track) => {
          const c = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
          const matchId = t.id === targetTrackId || t.id === cleanTrack || c === cleanTrack || t.id === `spotify:track:${cleanTrack}`;
          const matchName = trackObj && t.name?.toLowerCase().trim() === trackObj.name?.toLowerCase().trim() &&
            t.artists?.[0]?.name?.toLowerCase().trim() === trackObj.artists?.[0]?.name?.toLowerCase().trim();
          return !matchId && !matchName;
        };

        setDynamicTracks((prev) => prev.filter(filterFn));
        setDynamicPlaylist((prev) => {
          const nextItems = (prev.tracks?.items || []).filter(filterFn);
          return {
            ...prev,
            tracks: { total: nextItems.length, items: nextItems },
          };
        });
      }
    };
    window.addEventListener('spotifree_track_removed', handleTrackRemoved);
    return () => window.removeEventListener('spotifree_track_removed', handleTrackRemoved);
  }, [dynamicPlaylist.id, isLikedInitially]);

  // Reactive listener for deleted playlists: return to home immediately if this playlist is deleted
  useEffect(() => {
    const handlePlaylistDeleted = (e: any) => {
      const { id: deletedId } = e.detail || {};
      const cleanCurrent = (dynamicPlaylist.id || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
      const cleanDeleted = (deletedId || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
      if (cleanCurrent === cleanDeleted || dynamicPlaylist.id === deletedId) {
        useUIStore.getState().setActiveMainTab('home');
      }
    };
    window.addEventListener('spotifree_playlist_deleted', handlePlaylistDeleted);
    return () => window.removeEventListener('spotifree_playlist_deleted', handlePlaylistDeleted);
  }, [dynamicPlaylist.id]);

  // Reactive listener for cloud-synced & updated playlists (cross-device & cross-browser real-time updates)
  useEffect(() => {
    const handlePlaylistsSynced = (e: any) => {
      const syncedPlaylists: Playlist[] = e.detail?.playlists || [];
      const cleanCurrent = (dynamicPlaylist.id || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
      const updated = syncedPlaylists.find((p) => {
        if (!p) return false;
        const pClean = (p.id || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
        return p.id === dynamicPlaylist.id || pClean === cleanCurrent;
      });
      if (updated?.tracks?.items) {
        const removedSet = getRemovedTrackIdsForPlaylist(cleanCurrent);
        const isNotRemoved = (t: Track) => {
          const c = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
          const sig = t.name && t.artists?.[0]?.name ? `sig:${t.name.toLowerCase().trim()}::${t.artists[0].name.toLowerCase().trim()}` : '';
          return !removedSet.has(t.id) && !removedSet.has(c) && (!sig || !removedSet.has(sig));
        };
        const filtered = updated.tracks.items.filter(isNotRemoved);
        setDynamicTracks(filtered);
        setDynamicPlaylist((prev) => ({
          ...prev,
          ...updated,
          tracks: { total: filtered.length, items: filtered },
        }));
      }
    };

    const handlePlaylistUpdated = (e: any) => {
      const { id: updatedId, cleanId: updatedCleanId, updatedPlaylist } = e.detail || {};
      const cleanCurrent = (dynamicPlaylist.id || '').replace(/^spotify:playlist:/i, '').split('?')[0].trim();
      if (
        (dynamicPlaylist.id === updatedId || cleanCurrent === updatedCleanId) &&
        updatedPlaylist?.tracks?.items
      ) {
        const removedSet = getRemovedTrackIdsForPlaylist(cleanCurrent);
        const isNotRemoved = (t: Track) => {
          const c = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
          const sig = t.name && t.artists?.[0]?.name ? `sig:${t.name.toLowerCase().trim()}::${t.artists[0].name.toLowerCase().trim()}` : '';
          return !removedSet.has(t.id) && !removedSet.has(c) && (!sig || !removedSet.has(sig));
        };
        const filtered = updatedPlaylist.tracks.items.filter(isNotRemoved);
        setDynamicTracks(filtered);
        setDynamicPlaylist((prev) => ({
          ...prev,
          ...updatedPlaylist,
          tracks: { total: filtered.length, items: filtered },
        }));
      }
    };

    window.addEventListener('spotifree_playlists_synced', handlePlaylistsSynced);
    window.addEventListener('spotifree_playlist_updated', handlePlaylistUpdated);
    return () => {
      window.removeEventListener('spotifree_playlists_synced', handlePlaylistsSynced);
      window.removeEventListener('spotifree_playlist_updated', handlePlaylistUpdated);
    };
  }, [dynamicPlaylist.id]);

  // DJ Mode and Transitions State (Desktop)
  const [isAutomixActive, setIsAutomixActive] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.localStorage.getItem('spotifree_dj_mode_desktop') === 'true' ||
      window.localStorage.getItem('spotifree_dj_mode') === 'true'
    );
  });
  const [audioFeatures, setAudioFeatures] = useState<Record<string, AudioFeature>>({});
  const [transitionModalPair, setTransitionModalPair] = useState<{ trackA: Track; trackB: Track } | null>(null);
  const originalTracksRef = useRef<Track[] | null>(null);

  // Load real Spotify Audio Features in batch for DJ mode
  useEffect(() => {
    if (!isAutomixActive || dynamicTracks.length === 0) return;
    let cancelled = false;
    fetchAudioFeaturesBatch(dynamicTracks).then((feats) => {
      if (!cancelled) {
        setAudioFeatures((prev) => ({ ...prev, ...feats }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isAutomixActive, dynamicTracks]);

  // Refresh BPM / key badges as soon as a song's real audio analysis arrives
  useEffect(() => {
    const onAnalysis = (e: Event) => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id;
      if (!id) return;
      const t = dynamicTracks.find((x) => cleanTrackId(x.id) === id);
      if (!t) return;
      setAudioFeatures((prev) => ({ ...prev, [id]: resolveClientSideRealFeature(id, t.name, t.artists?.[0]?.name) }));
    };
    window.addEventListener(TRACK_ANALYSIS_EVENT, onAnalysis);
    return () => window.removeEventListener(TRACK_ANALYSIS_EVENT, onAnalysis);
  }, [dynamicTracks]);

  // Preload and pre-warm audio & video IDs for top tracks in this playlist for instant 0ms playback
  useEffect(() => {
    if (dynamicTracks && dynamicTracks.length > 0) {
      audioEngine.warmupInitialTracks(dynamicTracks.slice(0, 8));
    }
  }, [dynamicTracks.length, dynamicPlaylist.id]);

  // Synchronize DJ / Automix state when toggled externally (e.g. mutual exclusivity from shuffle)
  useEffect(() => {
    const handleDjChange = (e: any) => {
      const enabled = Boolean(e?.detail?.enabled);
      setIsAutomixActive(enabled);
      if (!enabled && originalTracksRef.current && originalTracksRef.current.length > 0) {
        setDynamicTracks(deduplicateTracks(originalTracksRef.current));
        originalTracksRef.current = null;
      }
    };
    window.addEventListener('spotifree_dj_mode_changed', handleDjChange);
    return () => window.removeEventListener('spotifree_dj_mode_changed', handleDjChange);
  }, []);

  const handleToggleAutomix = () => {
    const next = !isAutomixActive;
    setIsAutomixActive(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('spotifree_dj_mode_desktop', String(next));
      window.localStorage.setItem('spotifree_dj_mode', String(next));
      window.dispatchEvent(new CustomEvent('spotifree_dj_mode_changed', { detail: { enabled: next } }));
      try {
        (audioEngine as any).resetTransitionState?.();
      } catch {}
    }

    if (next) {
      // Mutual Exclusivity: Turning DJ ON automatically disables Shuffle
      const pState = usePlayerStore.getState();
      if (pState.isShuffle || pState.shuffleMode !== 'off') {
        const source = pState.originalQueue.length > 0 ? pState.originalQueue : pState.queue;
        const cleanQueue = deduplicateTracks(source.filter((t: any) => !t.isSmartRecommendation));
        usePlayerStore.setState({
          shuffleMode: 'off',
          isShuffle: false,
          shuffleVersion: pState.shuffleVersion + 1,
          playedInShuffle: [],
          preselectedNextTrackId: null,
          queue: cleanQueue,
        });
      }

      // 1. Save original playlist order before harmonic DJ set sorting (deduplicated)
      if (!originalTracksRef.current || originalTracksRef.current.length === 0) {
        originalTracksRef.current = deduplicateTracks([...dynamicTracks]);
      }
      // 2. New DJ session: a different set order and different transitions every time.
      //    The order follows real BPM / key / energy (when measured) with a random strategy.
      const seed = startNewDJSession();
      const { order, strategy } = buildDJSetOrder(dynamicTracks, seed);
      console.info(`[DJ] Nueva sesión: orden "${SET_STRATEGY_LABELS[strategy]}" (${getSessionFlavour(seed)})`);
      setDynamicTracks(deduplicateTracks(order));
      // Real BPM for every song (Deezer) + full audio analysis of the first ones, in background
      void prepareDJAnalyses(order, 3);
    } else {
      // 3. Restore exact original order when leaving DJ mode
      if (originalTracksRef.current && originalTracksRef.current.length > 0) {
        setDynamicTracks(deduplicateTracks(originalTracksRef.current));
        originalTracksRef.current = null;
      }
    }
  };
  useEffect(() => {
    setIsDownloaded(isPlaylistDownloaded(dynamicPlaylist.id));
    getAllDownloadedTrackIds().then(setDownloadedTrackIds);
    const unsubscribe = onDownloadsChanged(() => {
      getAllDownloadedTrackIds().then(setDownloadedTrackIds);
      setIsDownloaded(isPlaylistDownloaded(dynamicPlaylist.id));
    });
    return unsubscribe;
  }, [dynamicPlaylist.id]);

  const handleToggleTrackDownload = async (track: Track) => {
    const clean = cleanTrackId(track.id);
    if (downloadedTrackIds.has(clean)) {
      await deleteDownloadedTrack(track.id);
      try {
        window.dispatchEvent(
          new CustomEvent('spotifree:toast', {
            detail: { message: `Descarga eliminada: ${track.name}` },
          })
        );
      } catch {}
    } else {
      setDownloadingTrackIds((prev) => new Set(prev).add(clean));
      try {
        window.dispatchEvent(
          new CustomEvent('spotifree:toast', {
            detail: { message: `Descargando «${track.name}» para escuchar sin conexión...` },
          })
        );
      } catch {}
      const ok = await downloadTrackAudio(track);
      setDownloadingTrackIds((prev) => {
        const next = new Set(prev);
        next.delete(clean);
        return next;
      });
      if (ok) {
        try {
          window.dispatchEvent(
            new CustomEvent('spotifree:toast', {
              detail: { message: `¡«${track.name}» descargada para modo avión!` },
            })
          );
        } catch {}
      } else {
        try {
          window.dispatchEvent(
            new CustomEvent('spotifree:toast', {
              detail: { message: `No se pudo descargar «${track.name}».` },
            })
          );
        } catch {}
      }
    }
  };

  const handleToggleDownload = async () => {
    if (isDownloaded) {
      await deleteDownloadedPlaylist(dynamicPlaylist.id);
      setIsDownloaded(false);
    } else {
      setIsDownloading(true);
      await downloadPlaylist(dynamicPlaylist, dynamicTracks, (cur, tot) => {
        setDownloadProgress({ current: cur, total: tot });
      });
      setIsDownloading(false);
      setIsDownloaded(true);
    }
  };

  // Library Saved status (+ / ✓)
  const checkIsInLibrary = (id: string): boolean => {
    if (!id) return false;
    const clean = id.replace(/^spotify:(playlist|album):/, '').split('?')[0];
    if (id === 'liked-songs' || id === 'collection:tracks' || clean === 'liked-songs') return true;
    if (allUserPlaylists && allUserPlaylists.some((p) => p.id === id || p.id === clean)) return true;
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem('spotifree_saved_library_playlists');
        if (saved) {
          const list: string[] = JSON.parse(saved);
          if (list.includes(id) || list.includes(clean)) return true;
        }
        const userPlaylistsRaw = window.localStorage.getItem('spotifree_user_playlists');
        if (userPlaylistsRaw) {
          const list = JSON.parse(userPlaylistsRaw);
          if (Array.isArray(list) && list.some((p: any) => p.id === id || p.id === clean)) return true;
        }
      } catch {}
    }
    return false;
  };

  const [isSavedInLibrary, setIsSavedInLibrary] = useState<boolean>(() => checkIsInLibrary(playlist.id));

  useEffect(() => {
    setIsSavedInLibrary(checkIsInLibrary(playlist.id));
  }, [playlist.id, allUserPlaylists]);

  const handleToggleLibrary = () => {
    const next = !isSavedInLibrary;
    setIsSavedInLibrary(next);
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('spotifree_saved_library_playlists');
        let list: string[] = raw ? JSON.parse(raw) : [];
        if (next) {
          if (!list.includes(dynamicPlaylist.id)) list.push(dynamicPlaylist.id);
          useSpotifyDataStore.getState().addCustomPlaylist(dynamicPlaylist);
        } else {
          list = list.filter((id) => id !== dynamicPlaylist.id);
          useSpotifyDataStore.getState().deletePlaylist(dynamicPlaylist.id);
        }
        window.localStorage.setItem('spotifree_saved_library_playlists', JSON.stringify(list));
      } catch {}
    }
  };

  // States for Spotify "Busquemos algo para tu lista" inline track searcher
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [addSearchResults, setAddSearchResults] = useState<Track[]>([]);
  const [isSearchingAdd, setIsSearchingAdd] = useState(false);
  const [popularSuggestions, setPopularSuggestions] = useState<Track[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Load real Spotify recommendations tailored to this playlist on enter or refresh
  const loadRecommendations = async () => {
    setIsLoadingSuggestions(true);
    try {
      const recs = await fetchPlaylistRecommendations(
        playlist.id,
        playlist.name,
        dynamicTracks,
        8
      );
      if (recs && recs.length > 0) {
        setPopularSuggestions(filterMusicTracksOnly(recs));
      }
    } catch (err) {
      console.warn('[DesktopPlaylistView] loadRecommendations error:', err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    loadRecommendations();
  }, [playlist.id, playlist.name]);

  // Debounced search for adding tracks to playlist
  useEffect(() => {
    const q = addSearchQuery.trim();
    if (!q) {
      setAddSearchResults([]);
      setIsSearchingAdd(false);
      return;
    }

    let cancelled = false;
    setIsSearchingAdd(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=8`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.results) {
            const mapped: Track[] = data.results.map((t: any, idx: number) => ({
              id: `search-add-${t.trackId || idx}`,
              name: t.trackName || 'Canción',
              duration_ms: t.trackTimeMillis || 210000,
              artists: [{ id: `art-${t.artistId || idx}`, name: t.artistName || 'Artista' }],
              album: {
                id: `alb-${t.collectionId || idx}`,
                name: t.collectionName || t.trackName,
                images: [{ url: (t.artworkUrl100 || '').replace('100x100bb', '600x600bb') }],
              },
            }));
            setAddSearchResults(filterMusicTracksOnly(mapped));
          }
        }
      } catch {} finally {
        if (!cancelled) setIsSearchingAdd(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [addSearchQuery]);

  const handleAddTrack = (track: Track) => {
    if (dynamicTracks.some((t) => t.id === track.id || (t.name === track.name && t.artists[0]?.name === track.artists[0]?.name))) {
      return;
    }

    const newTrack: Track = {
      ...track,
      added_at: 'Hoy',
    };

    const updated = [...dynamicTracks, newTrack];
    setDynamicTracks(updated);
    setDynamicPlaylist((prev) => ({
      ...prev,
      tracks: {
        total: updated.length,
        items: updated,
      },
    }));

    if (isLikedInitially) {
      saveCustomLikedSong(newTrack, user?.id, updated);
      usePlayerStore.setState((s) => ({
        likedTrackIds: Array.from(new Set([...s.likedTrackIds, newTrack.id, (newTrack.id || '').replace(/^spotify:track:/i, '')])),
      }));
    } else {
      saveCustomTrackToStorage(dynamicPlaylist.id, false, newTrack, user?.id, updated);
    }

    // Persist to store, cache, localStorage, and cloud Firestore
    useSpotifyDataStore.getState().updatePlaylist(dynamicPlaylist.id, {
      tracks: { total: updated.length, items: updated },
    });
  };

  useEffect(() => {
    let cancelled = false;
    const currentCustom = getSavedCustomTracks(playlist.id, isLikedInitially, user?.id);
    const customIds = new Set(currentCustom.map((t) => t.id));
    const baseItems = playlist.tracks?.items || [];
    const removedSet = getRemovedTrackIdsForPlaylist(playlist.id);
    const isNotRemoved = (t: Track) => {
      const c = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
      const sig = t.name && t.artists?.[0]?.name ? `sig:${t.name.toLowerCase().trim()}::${t.artists[0].name.toLowerCase().trim()}` : '';
      return !removedSet.has(t.id) && !removedSet.has(c) && (!sig || !removedSet.has(sig));
    };
    const sourceTracks = isLikedInitially
      ? deduplicateTracks([...currentCustom.filter(isNotRemoved), ...baseItems.filter(isNotRemoved)])
      : [
          ...currentCustom.filter(isNotRemoved),
          ...baseItems.filter((t) => !customIds.has(t.id) && isNotRemoved(t)),
        ];

    let mapped = sourceTracks.map((t) => {
      if (TRACK_COVER_CACHE.has(t.id)) {
        return {
          ...t,
          album: {
            ...t.album,
            id: t.album?.id || `alb-${t.id}`,
            name: t.album?.name || t.name,
            images: [{ url: TRACK_COVER_CACHE.get(t.id)! }],
          },
        };
      }
      return t;
    });

    // Do NOT wipe out existing dynamicTracks if we already have them for this playlist
    setDynamicTracks((prev) => {
      if (mapped.length === 0 && prev.length > 0) {
        return prev.filter(isNotRemoved);
      }
      if (prev.length > mapped.length) {
        return deduplicateTracks([...mapped, ...prev]).filter(isNotRemoved);
      }
      return mapped;
    });
    setDynamicPlaylist(playlist);

    async function loadTracks() {
      const isArtist =
        playlist.type === 'artist' ||
        playlist.description === 'Artista' ||
        playlist.id.startsWith('art-') ||
        playlist.id.startsWith('artist-');

      if (isArtist) {
        setLoading(true);
        try {
          const cleanArtistName = playlist.name.replace(/^(art-|artist-)/i, '').trim();
          const searchRes = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(cleanArtistName)}&media=music&entity=song&limit=25`
          );
          if (searchRes.ok) {
            const data = await searchRes.json();
            const artistTracks: Track[] = (data.results || []).map((t: any, idx: number) => ({
              id: `artist-song-${t.trackId || idx}`,
              name: t.trackName || 'Canción',
              duration_ms: t.trackTimeMillis || 210000,
              artists: [{ id: `art-${t.artistId || idx}`, name: t.artistName || cleanArtistName }],
              album: {
                id: `alb-${t.collectionId || idx}`,
                name: t.collectionName || t.trackName,
                images: [{ url: (t.artworkUrl100 || '').replace('100x100bb', '600x600bb') }],
              },
            }));

            if (!cancelled && artistTracks.length > 0) {
              const artistImg =
                playlist.images?.[0]?.url ||
                artistTracks[0]?.album?.images?.[0]?.url ||
                'https://i.scdn.co/image/ab6761610000e5eb4e015d3113dd88ee0cb71658';

              const updatedArtistPlaylist: Playlist = {
                ...playlist,
                name: cleanArtistName,
                description: 'Artista oficial • Verificado en Spotify',
                images: [{ url: artistImg }],
                tracks: {
                  total: artistTracks.length,
                  items: artistTracks,
                },
              };
              setDynamicTracks(artistTracks);
              setDynamicPlaylist(updatedArtistPlaylist);
              setLoading(false);
              artistTracks.slice(0, 3).forEach((t) => {
                const q = `${t.name} ${t.artists?.[0]?.name || ''}`.trim();
                audioEngine.prefetchTrack(q, t.id);
              });
              return;
            }
          }
        } catch (err) {
          console.error('Error loading artist tracks:', err);
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      if (isLikedInitially || (playlist.tracks?.items && playlist.tracks.items.length > 0)) return;
      setLoading(true);
      try {
        const userCookie = typeof window !== 'undefined' ? window.localStorage.getItem('user_spotify_cookie') || '' : '';
        const accessToken = typeof window !== 'undefined' ? window.localStorage.getItem('spotify_access_token') || '' : '';

        const headers: Record<string, string> = {};
        if (userCookie) headers['x-spotify-cookie'] = userCookie;
        if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

        const res = await fetch(`/api/spotify/playlist/${encodeURIComponent(playlist.id)}`, {
          headers,
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.tracks?.items) {
            const isSlugName = data.name && data.name.toLowerCase() === playlist.id.replace(/[-_]/g, ' ').toLowerCase();
            const hasValidScrapedImage = data.images?.length > 0 && data.images[0].url && !data.images[0].url.includes('liked-songs');
            const hasInitialHdImage = playlist.images && playlist.images.length > 0 && playlist.images[0].url && !playlist.images[0].url.includes('liked-songs');
            const removedSet = getRemovedTrackIdsForPlaylist(playlist.id);
            const isNotRemoved = (t: Track) => {
              const c = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
              return !removedSet.has(t.id) && !removedSet.has(c);
            };
            const filteredDataItems = (data.tracks?.items || []).filter(isNotRemoved);

            const updated: Playlist = {
              ...playlist,
              ...data,
              name: (data.name && data.name !== 'Tu biblioteca' && data.name !== 'Playlist' && !isSlugName) ? data.name : playlist.name,
              description: data.description || playlist.description,
              images: hasInitialHdImage ? playlist.images : (hasValidScrapedImage ? data.images : playlist.images),
              color: data.color || playlist.color,
              owner: data.owner || playlist.owner,
              tracks: { total: filteredDataItems.length, items: filteredDataItems },
            };
            const hydrated = filteredDataItems.map((t: Track) => {
              if (TRACK_COVER_CACHE.has(t.id)) {
                return {
                  ...t,
                  album: {
                    ...t.album,
                    id: t.album?.id || `alb-${t.id}`,
                    name: t.album?.name || t.name,
                    images: [{ url: TRACK_COVER_CACHE.get(t.id)! }],
                  },
                };
              }
              return t;
            });
            setDynamicTracks(hydrated);
            setDynamicPlaylist(updated);
            try {
              useSpotifyDataStore.getState().cachePlaylistDetails(updated);
              useSpotifyDataStore.getState().updatePlaylist(playlist.id, {
                tracks: { total: filteredDataItems.length, items: filteredDataItems },
                ...(hasInitialHdImage ? {} : (hasValidScrapedImage ? { images: data.images } : {})),
                ...(data.color ? { color: data.color } : {}),
                ...(data.owner ? { owner: data.owner } : {}),
              });
            } catch {}
          }
        }
      } catch (err) {
        console.error('Error loading dynamic tracks:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadTracks();
    return () => {
      cancelled = true;
    };
  }, [playlist.id, playlist.tracks]);

  // Synchronize dynamicPlaylist when props or cover image change from EditPlaylistModal
  useEffect(() => {
    setDynamicPlaylist(playlist);
    setHeroCoverError(false);
  }, [playlist.id, playlist.images?.[0]?.url, playlist.name, playlist.description]);

  // Asynchronously resolve individual album covers for all tracks in parallel
  useEffect(() => {
    if (!dynamicTracks || dynamicTracks.length === 0) return;
    let cancelled = false;

    const playlistCover = dynamicPlaylist.images?.[0]?.url;
    resolveTrackCoversBatch(dynamicTracks, playlistCover, (updates) => {
      if (cancelled || updates.size === 0) return;
      setTrackCovers((prev) => {
        const next = { ...prev };
        updates.forEach((url, id) => {
          next[id] = url;
        });
        return next;
      });
      setDynamicTracks((prev) =>
        prev.map((track) => {
          if (updates.has(track.id)) {
            return {
              ...track,
              album: {
                ...track.album,
                id: track.album?.id || `alb-${track.id}`,
                name: track.album?.name || track.name,
                images: [{ url: updates.get(track.id)! }],
              },
            };
          }
          return track;
        })
      );
    });

    return () => {
      cancelled = true;
    };
  }, [dynamicPlaylist.id, dynamicTracks.length]);

  const [heroCoverError, setHeroCoverError] = useState(false);

  useEffect(() => {
    setHeroCoverError(false);
  }, [dynamicPlaylist.id]);

  // Playlist tracks maintain their original sequence (Spotify parity: shuffle does not rearrange the visible list)
  const tracks = dynamicTracks;

  if (
    dynamicPlaylist.id === 'spotify-dj' ||
    dynamicPlaylist.id === 'dj' ||
    dynamicPlaylist.name?.toLowerCase().trim() === 'dj' ||
    (dynamicPlaylist as any).is_dj
  ) {
    return (
      <AIDJView
        onBack={() => useUIStore.getState().setActiveMainTab('home')}
        onOpenPlayer={() => useUIStore.getState().toggleRightSidebar('now-playing')}
      />
    );
  }

  const isLikedPlaylist =
    dynamicPlaylist.id === 'liked-songs' ||
    dynamicPlaylist.id === 'tracks' ||
    dynamicPlaylist.id.includes('collection:tracks') ||
    dynamicPlaylist.id.includes('collection-tracks') ||
    /^(canciones que te gustan|canciones que me gustan|tus me gusta|liked songs|liked tracks|saved songs|saved tracks|favoritas|favorites|my favorites|favorite songs)$/i.test(
      (dynamicPlaylist.name || '').trim()
    );

  // A playlist saved in the library (e.g. imported) is never shown as an artist page
  const isLibraryPlaylist = allUserPlaylists.some((p) => p.id === dynamicPlaylist.id && (p as any).type !== 'artist');
  const isArtist = !isLibraryPlaylist && (
    dynamicPlaylist.description?.toLowerCase() === 'artista' ||
    (dynamicPlaylist as any).type === 'artist' ||
    (dynamicPlaylist as any).is_artist === true ||
    dynamicPlaylist.id.startsWith('art-') ||
    dynamicPlaylist.id.startsWith('artist-'));

  const isFolder =
    dynamicPlaylist.id === 'nueva-carpeta' ||
    dynamicPlaylist.description?.toLowerCase().includes('listas');

  const isAlbum =
    (dynamicPlaylist as any).type === 'album' ||
    dynamicPlaylist.id.startsWith('alb-') ||
    dynamicPlaylist.id.startsWith('album-');

  const isUserCreatedPlaylist =
    !isLikedPlaylist &&
    !isAlbum &&
    !isArtist &&
    !isFolder &&
    !dynamicPlaylist.id.startsWith('37i9dQ') &&
    dynamicPlaylist.id !== '37i9dQZF1DWZdsS73T1ogG' &&
    dynamicPlaylist.id !== '37i9dQZF1DX2EiUAL7Wdfc' &&
    dynamicPlaylist.id !== 'el-nuevo-urbano' &&
    dynamicPlaylist.id !== 'miticas' &&
    dynamicPlaylist.owner?.display_name?.toLowerCase() !== 'spotify' &&
    dynamicPlaylist.owner?.id !== 'spotify' &&
    (
      (dynamicPlaylist as any).is_custom === true ||
      dynamicPlaylist.owner?.id === 'user' ||
      (user?.id && dynamicPlaylist.owner?.id === user.id) ||
      (user?.display_name && dynamicPlaylist.owner?.display_name?.toLowerCase() === user.display_name.toLowerCase())
    );

  const canAddTracksToThisList = !isArtist && !isAlbum && !isFolder && (isLikedPlaylist || isSavedInLibrary || isUserCreatedPlaylist);

  const tracksWithPlaylistId = tracks.map((t) => ({ ...t, playlistId: playlist.id }));

  const isCurrentPlaylistPlaying =
    isPlaying && tracks.some((t) => t.id === currentTrack?.id);

  const [rotatingTrackIndex, setRotatingTrackIndex] = useState(0);
  const [isClipsModalOpen, setIsClipsModalOpen] = useState(false);
  const [clipsTracks, setClipsTracks] = useState<Track[]>([]);
  const [clipsInitialIndex, setClipsInitialIndex] = useState(0);

  const _handleOpenPreview = (selectedTrack: Track, allList: Track[]) => {
    const ordered = [selectedTrack, ...allList.filter((t) => t.id !== selectedTrack.id)];
    setClipsTracks(ordered);
    setClipsInitialIndex(0);
    setIsClipsModalOpen(true);
  };
  void _handleOpenPreview;

  const isTrackLiked = (trackId: string, trackObj?: Track) => {
    if (isLikedPlaylist) return true;
    if (!trackId) return false;
    const clean = trackId.replace(/^spotify:track:/i, '').split('?')[0].trim();
    if (
      likedTrackIds.includes(trackId) ||
      likedTrackIds.includes(clean) ||
      likedTrackIds.includes(`spotify:track:${clean}`)
    ) {
      return true;
    }
    if (trackObj && trackObj.name) {
      const activeUserId = user?.id || 'active';
      const customLiked = getCustomLikedSongs(activeUserId);
      if (
        customLiked.some(
          (t) =>
            t.id === trackId ||
            t.id === clean ||
            (t.name === trackObj.name && t.artists?.[0]?.name === trackObj.artists?.[0]?.name)
        )
      ) {
        return true;
      }
    }
    return false;
  };

  const handleToggleTrackLike = (track: Track) => {
    const liked = isTrackLiked(track.id, track);
    if (liked) {
      toggleLike(track.id, track);
      if (isLikedPlaylist) {
        const clean = track.id.replace(/^spotify:track:/i, '').split('?')[0].trim();
        removeCustomLikedSong(track.id, user?.id, track);
        removeCustomLikedSong(clean, user?.id, track);
        useSpotifyDataStore.getState().removeTrackFromPlaylist('liked-songs', track.id, track);
        useSpotifyDataStore.getState().removeTrackFromPlaylist('liked-songs', clean, track);
        setDynamicTracks((prev) =>
          prev.filter((t) => {
            const tClean = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
            return (
              t.id !== track.id &&
              tClean !== clean &&
              (t.name !== track.name || t.artists?.[0]?.name !== track.artists?.[0]?.name)
            );
          })
        );
        setDynamicPlaylist((prev) => ({
          ...prev,
          tracks: {
            total: Math.max(0, (prev.tracks?.total || 1) - 1),
            items: (prev.tracks?.items || []).filter((t) => {
              const tClean = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
              return t.id !== track.id && tClean !== clean && (t.name !== track.name || t.artists?.[0]?.name !== track.artists?.[0]?.name);
            }),
          },
        }));
      }
    } else {
      openAddToPlaylistModal(track);
    }
  };

  useEffect(() => {
    if (!tracks || tracks.length <= 1 || isClipsModalOpen) return;
    const interval = setInterval(() => {
      setRotatingTrackIndex((prev) => (prev + 1) % tracks.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [tracks, isClipsModalOpen]);

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    if (isCurrentPlaylistPlaying) {
      togglePlay();
    } else {
      const isShuffleActive = shuffleMode !== 'off' || usePlayerStore.getState().isShuffle;
      const startTrack = isShuffleActive && tracksWithPlaylistId.length > 1
        ? tracksWithPlaylistId[Math.floor(Math.random() * tracksWithPlaylistId.length)]
        : tracksWithPlaylistId[0];
      playTrack(startTrack, tracksWithPlaylistId, playlist.id);
      if (shuffleMode === 'smart') {
        usePlayerStore.getState().populateSmartShuffleRecommendations(tracksWithPlaylistId);
      }
    }
  };

  const handleTrackClick = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      const clickedTrack = { ...track, playlistId: playlist.id };
      const clickedIndex = tracksWithPlaylistId.findIndex((t) => t.id === track.id);
      const sequentialQueue = clickedIndex >= 0
        ? [...tracksWithPlaylistId.slice(clickedIndex), ...tracksWithPlaylistId.slice(0, clickedIndex)]
        : tracksWithPlaylistId;
      playTrack(clickedTrack, sequentialQueue, playlist.id);
    }
  };

  const totalDurationMs = tracks.reduce((acc, t) => acc + (t.duration_ms || 0), 0);
  const totalMinutes = Math.floor(totalDurationMs / 60000);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  const formattedDuration =
    totalHours > 0
      ? `${totalHours} h ${remainingMinutes} min`
      : `${totalMinutes} min`;

  // Determine dominant theme color with always-on vibrant atmospheric glow (never dull grey)
  const [extractedThemeColor, setExtractedThemeColor] = useState<string>(() =>
    resolveVibrantColor(
      dynamicPlaylist.id,
      dynamicPlaylist.name,
      dynamicPlaylist.color
    )
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const scrollParent = containerRef.current?.closest('.overflow-y-auto') || containerRef.current?.parentElement;
    if (!scrollParent) return;
    const handleScroll = () => {
      setScrollY(scrollParent.scrollTop);
    };
    scrollParent.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollParent.removeEventListener('scroll', handleScroll);
  }, []);

  const convertPhotosToBanners = useUIStore((s) => s.convertPhotosToBanners);
  const resolvedBanner = resolvePlaylistBanner(dynamicPlaylist) || undefined;
  const bannerImgUrl = resolvedBanner || (convertPhotosToBanners ? dynamicPlaylist.images?.[0]?.url : undefined);
  const hasBanner = Boolean(bannerImgUrl);

  useEffect(() => {
    let cancelled = false;
    const imgUrl = isLikedPlaylist
      ? 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'
      : (hasBanner ? bannerImgUrl : (dynamicPlaylist.images?.[0]?.url || tracks[0]?.album?.images?.[0]?.url));
    if (imgUrl) {
      extractDominantColorFromImage(imgUrl).then((hex) => {
        if (!cancelled && hex) {
          setExtractedThemeColor(hex);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [dynamicPlaylist.id, dynamicPlaylist.images, tracks, hasBanner, bannerImgUrl]);

  const themeColor = extractedThemeColor;

  return (
    <div ref={containerRef} className="select-none min-h-full pb-20 relative bg-[#121212] animate-cascade-down">
      {/* Sticky Compact Header on Scroll */}
      <div
        className={`sticky top-0 z-30 px-8 py-2.5 h-[58px] -mb-[58px] flex items-center justify-between transition-all duration-300 ${
          scrollY > (hasBanner ? 320 : 250)
            ? 'opacity-100 backdrop-blur-xl border-b border-white/5 pointer-events-auto shadow-2xl'
            : 'opacity-0 pointer-events-none'
        }`}
        style={{ backgroundColor: hasBanner ? '#121212F5' : `${themeColor}F5` }}
      >
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={handlePlayAll}
            className="w-11 h-11 rounded-full bg-[#1ed760] hover:scale-105 active:scale-95 shadow-md flex items-center justify-center transition-all cursor-pointer shrink-0"
            title={isCurrentPlaylistPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isCurrentPlaylistPlaying ? (
              <PauseNativeIcon size={20} className="text-black" />
            ) : (
              <PlayNativeIcon size={20} className="text-black ml-0.5" />
            )}
          </button>
          <span className="text-xl font-bold text-white font-['SpotifyMixUITitle'] truncate">
            {dynamicPlaylist.name}
          </span>
        </div>
      </div>

      {hasBanner ? (
        /* Widescreen Banner Hero (Daily Mixes / Playlists with Wide Banner matching Photos 3 & 4) */
        <div
          className="w-full h-[340px] lg:h-[380px] relative overflow-hidden flex flex-col justify-end select-none"
        >
          <img
            src={bannerImgUrl}
            alt={dynamicPlaylist.name}
            onError={handleImageError}
            className="absolute inset-0 w-full h-full object-cover object-[center_12%] pointer-events-none"
            style={{
              filter: `brightness(${Math.max(0.7, 1 - scrollY / 500)})`,
              opacity: Math.max(0, 1 - scrollY / 420),
              transition: 'opacity 0.1s ease-out',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-black/40 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent pointer-events-none" />

          <div className="relative z-10 px-8 pb-6 flex flex-col justify-end gap-1.5 select-none">
            <span className="text-xs font-bold text-white uppercase tracking-wider drop-shadow">
              Lista pública
            </span>
            <h1 className="text-6xl lg:text-7xl font-black text-white tracking-tight leading-none font-['SpotifyMixUITitle'] drop-shadow-lg truncate">
              {dynamicPlaylist.name}
            </h1>
            <p className="text-sm font-semibold text-white/95 mt-1 drop-shadow line-clamp-1">
              {dynamicPlaylist.description
                ? stripHtml(dynamicPlaylist.description)
                : tracks.length > 0
                ? `${tracks
                    .slice(0, 5)
                    .map((t) => t.artists?.[0]?.name)
                    .filter(Boolean)
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .slice(0, 3)
                    .join(', ')} y más`
                : ''}
            </p>
            <div className="flex items-center gap-2 text-sm text-white font-medium mt-1 flex-wrap drop-shadow">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0">
                <circle cx="12" cy="12" r="12" fill="#1ed760" />
                <path
                  fill="#000000"
                  d="M17.503 17.308c-.215.353-.676.464-1.029.248-2.818-1.721-6.364-2.111-10.541-1.156-.402.092-.801-.158-.893-.56-.092-.403.158-.802.56-.894 4.571-1.045 8.493-.595 11.655 1.338.353.216.464.677.248 1.024zm1.469-3.268c-.271.44-.847.579-1.287.308-3.226-1.982-8.143-2.557-11.957-1.399-.495.15-1.017-.13-1.168-.623-.15-.495.13-1.017.623-1.168 4.358-1.322 9.776-.682 13.489 1.595.44.271.58.847.31 1.287zm.126-3.402C15.23 8.34 8.85 8.129 5.157 9.25c-.593.18-1.22-.155-1.4-.748-.18-.593.155-1.22.748-1.4C8.75 5.819 15.789 6.068 20.242 8.71c.535.317.71 1.006.393 1.54-.316.533-1.006.71-1.539.394v-.006z"
                />
              </svg>
              <span>
                Hecha para <span className="font-bold">{user?.display_name || 'ti'}</span>
              </span>
              <span>•</span>
              <span>
                {tracks.length} {tracks.length === 1 ? 'canción' : 'canciones'}, {formattedDuration}
              </span>
            </div>
            <button
              type="button"
              className="text-xs text-white/75 hover:text-white underline text-left mt-0.5 cursor-pointer w-fit drop-shadow-sm"
            >
              Recomendaciones e impacto de la promoción
            </button>
          </div>
        </div>
      ) : (
        /* Dynamic Reactive Hero Header with smooth gradient and atmospheric aura */
        <div
          className="px-8 pt-8 pb-6 flex items-end gap-6 relative transition-colors duration-700 overflow-hidden"
          style={{
            backgroundColor: themeColor,
            backgroundImage: 'linear-gradient(180deg, rgba(0, 0, 0, 0.15) 0%, rgba(18, 18, 18, 0.82) 70%, #121212 100%)',
            transition: 'background-color 1s cubic-bezier(0.2, 0, 0, 1)',
          }}
        >
          {/* Ambient atmospheric aura & luminous radial glow */}
          <div
            className="absolute -top-24 -left-24 w-[600px] h-[600px] rounded-full pointer-events-none blur-[110px] opacity-45 z-0"
            style={{ backgroundColor: themeColor }}
          />
          <div
            className="absolute top-0 right-1/4 w-[400px] h-[300px] rounded-full pointer-events-none blur-[130px] opacity-30 z-0"
            style={{ backgroundColor: themeColor }}
          />
          {/* Cover Art 232x232 */}
          <div
            onClick={() => isUserCreatedPlaylist && openEditPlaylistModal(dynamicPlaylist)}
            className={`w-56 h-56 shrink-0 shadow-2xl ${isArtist ? 'rounded-full' : 'rounded-[4px]'} overflow-hidden bg-[#282828] relative ${
              isUserCreatedPlaylist ? 'group cursor-pointer' : ''
            }`}
            title={isUserCreatedPlaylist ? "Elegir foto" : undefined}
          >
            {isLikedPlaylist ? (
              <img
                src="https://misc.scdn.co/liked-songs/liked-songs-640.jpg"
                alt="Canciones que te gustan"
                onError={handleImageError}
                className="w-full h-full object-cover shadow-2xl"
              />
            ) : !heroCoverError && dynamicPlaylist.images?.[0]?.url && !dynamicPlaylist.images[0].url.includes('liked-songs') ? (
              <img
                src={toHDImage(dynamicPlaylist.images[0].url)}
                alt={dynamicPlaylist.name}
                onError={() => setHeroCoverError(true)}
                className="w-full h-full object-cover shadow-2xl"
              />
            ) : isArtist ? (
              <div className="w-full h-full flex items-center justify-center bg-[#282828] text-[#b3b3b3]">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            ) : isFolder ? (
              <div className="w-full h-full flex items-center justify-center bg-[#282828] text-[#b3b3b3]">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                </svg>
              </div>
            ) : getAutoPlaylistCover(tracks) !== EMPTY_PLAYLIST_COVER ? (
              // No photo of its own: collage of its songs (or the first song's cover), like Spotify
              <img
                src={toHDImage(getAutoPlaylistCover(tracks))}
                alt={dynamicPlaylist.name}
                onError={handleImageError}
                className="w-full h-full object-cover shadow-2xl"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#282828] text-[#b3b3b3]">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
            )}
          </div>

          {/* Metadata */}
          {isArtist ? (
            <div className="flex flex-col gap-2 min-w-0 justify-end z-10">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <VerifiedArtistNativeIcon size={24} className="text-[#3d91f4]" />
                <span>Artista verificado</span>
              </div>
              <h1 className="text-6xl lg:text-8xl font-black text-white tracking-tight leading-none py-1 font-['SpotifyMixUITitle'] truncate">
                {dynamicPlaylist.name}
              </h1>
              <p className="text-base text-white/90 font-medium mt-2">
                {getArtistMonthlyListeners(dynamicPlaylist.name)}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 min-w-0">
              <span className="text-xs font-bold text-white capitalize">
                {dynamicPlaylist.id.includes('37i9dQZF1DX2EiUAL7Wdfc') || dynamicPlaylist.name.toLowerCase() === 'míticas'
                  ? 'Playlist'
                  : isAlbum
                  ? 'Álbum'
                  : isFolder
                  ? 'Carpeta'
                  : 'Lista'}
              </span>
              <h1
                onClick={() => isUserCreatedPlaylist && openEditPlaylistModal(dynamicPlaylist)}
                className={`text-5xl lg:text-7xl font-black text-white tracking-tight leading-none py-1 font-['SpotifyMixUITitle'] truncate ${
                  isUserCreatedPlaylist ? 'cursor-pointer hover:underline' : ''
                }`}
              >
                {dynamicPlaylist.name}
              </h1>

              {dynamicPlaylist.description && (
                <p className="text-sm text-[#b3b3b3] font-normal mt-1 line-clamp-2">
                  {stripHtml(dynamicPlaylist.description)}
                </p>
              )}

              {/* Single unified metadata line matching Real Spotify */}
              <div className="flex items-center gap-1.5 text-sm text-white font-normal mt-2 flex-wrap">
                {dynamicPlaylist.id.includes('37i9dQZF1DX2EiUAL7Wdfc') || dynamicPlaylist.name.toLowerCase() === 'míticas' ? (
                  <>
                    <span className="font-bold text-white hover:underline cursor-pointer">Spotifree</span>
                    <span>•</span>
                    <span className="text-white/90">
                      {loading
                        ? 'Cargando canciones...'
                        : `${tracks.length} ${tracks.length === 1 ? 'canción' : 'canciones'}, ${formattedDuration}`}
                    </span>
                  </>
                ) : dynamicPlaylist.name.toLowerCase().includes('mix diario') || dynamicPlaylist.id.includes('37i9dQZF1E35QYVMBRlDph') ? (
                  <>
                    <span className="font-bold text-white hover:underline cursor-pointer">Hecha para {user?.display_name || 'ti'}</span>
                    <span>•</span>
                    <span className="text-white/90">
                      {loading
                        ? 'Cargando canciones...'
                        : `${tracks.length} ${tracks.length === 1 ? 'canción' : 'canciones'}, ${formattedDuration}`}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="flex items-center gap-1.5 font-bold text-white hover:underline cursor-pointer">
                      <SpotifyBadgeIcon size={18} />
                      <span>{dynamicPlaylist.owner?.display_name === 'Spotify' ? 'Spotifree' : (dynamicPlaylist.owner?.display_name || 'Spotifree')}</span>
                    </span>
                    <span>•</span>
                    <span className="text-white/90">
                      {loading
                        ? 'Cargando canciones...'
                        : `${tracks.length} ${tracks.length === 1 ? 'canción' : 'canciones'}, ${formattedDuration}`}
                    </span>
                  </>
                )}
              </div>
              {dynamicPlaylist.name.toLowerCase().includes('mix diario') && (
                <p className="text-xs text-[#a7a7a7] mt-1 font-['SpotifyMixUI']">
                  Recomendaciones e impacto de la promoción
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action Bar */}
      <div
        className="px-8 pt-6 pb-2 flex flex-col gap-4 transition-colors duration-500 relative z-10"
        style={
          hasBanner
            ? {
                background: 'linear-gradient(180deg, rgba(18, 18, 18, 0.4) 0%, #121212 100%)',
              }
            : undefined
        }
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            {/* Play Button: Turntable Platter (Modo DJ) or Classic Big Green */}
            {isAutomixActive ? (
              <button
                onClick={handlePlayAll}
                className="relative w-14 h-14 rounded-full p-[2.5px] bg-[#1ed760] shadow-[0_0_20px_rgba(30,215,96,0.7)] hover:scale-106 active:scale-95 transition-all flex items-center justify-center cursor-pointer group shrink-0"
                title={isCurrentPlaylistPlaying ? 'Pausar (Modo DJ)' : 'Reproducir con transiciones DJ'}
              >
                <div className="w-full h-full rounded-full bg-[#121212] relative overflow-hidden flex items-center justify-center">
                  <div
                    className={`absolute inset-0 rounded-full ${
                      isCurrentPlaylistPlaying ? 'animate-[spin_8s_linear_infinite]' : ''
                    }`}
                    style={{
                      background:
                        'conic-gradient(from 0deg, #111111 0deg, #2a2a2a 45deg, #0d0d0d 90deg, #2a2a2a 135deg, #111111 180deg, #2a2a2a 225deg, #0d0d0d 270deg, #2a2a2a 315deg, #111111 360deg)',
                    }}
                  >
                    <div className="absolute inset-[3px] rounded-full border border-white/[0.12] pointer-events-none" />
                    <div className="absolute inset-[6px] rounded-full border border-white/[0.08] pointer-events-none" />
                    <div className="absolute inset-[9px] rounded-full border border-white/[0.06] pointer-events-none" />
                    <div className="absolute inset-[12px] rounded-full border border-white/[0.08] pointer-events-none" />
                    <div className="absolute inset-[15px] rounded-full border border-white/[0.05] pointer-events-none" />
                    <div className="absolute inset-[18px] rounded-full border border-white/[0.07] pointer-events-none" />
                  </div>
                  <div className="relative z-10 w-7 h-7 rounded-full bg-[#181818] border border-white/15 flex items-center justify-center shadow-lg pointer-events-none">
                    {isCurrentPlaylistPlaying ? (
                      <PauseNativeIcon size={16} className="text-white drop-shadow-md" />
                    ) : (
                      <PlayNativeIcon size={16} className="text-white ml-0.5 drop-shadow-md" />
                    )}
                  </div>
                </div>
              </button>
            ) : (
              <button
                onClick={handlePlayAll}
                className="w-14 h-14 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 active:scale-96 shadow-lg flex items-center justify-center transition-all duration-200 cursor-pointer shrink-0"
                title={isCurrentPlaylistPlaying ? "Pausar" : "Reproducir"}
              >
                {isCurrentPlaylistPlaying ? (
                  <PauseNativeIcon size={24} className="text-black" />
                ) : (
                  <PlayNativeIcon size={24} className="text-black ml-1" />
                )}
              </button>
            )}

            {/* Small Rotating Track Cover Thumbnail (Clips Preview Trigger - available in both normal & banner mode) */}
            {tracks.length > 0 && (
              <button
                type="button"
                onClick={() => setIsClipsModalOpen(true)}
                className="group/thumb relative w-11 h-11 rounded-lg overflow-hidden shadow-lg bg-[#282828] shrink-0 border border-white/15 hover:border-[#1ed760] transition-all hover:scale-105 active:scale-95 cursor-pointer ring-1 ring-white/10 hover:ring-[#1ed760]/50"
                title="Ver clips y avances de la playlist"
              >
                <img
                  key={tracks[rotatingTrackIndex]?.id || rotatingTrackIndex}
                  src={
                    tracks[rotatingTrackIndex]?.album?.images?.[0]?.url ||
                    (tracks[rotatingTrackIndex] as any)?.image ||
                    bannerImgUrl ||
                    dynamicPlaylist.images?.[0]?.url
                  }
                  alt={tracks[rotatingTrackIndex]?.name || 'Preview clip'}
                  onError={handleImageError}
                  className="w-full h-full object-cover transition-all duration-700 group-hover/thumb:scale-110"
                />

                {/* Hover Play icon overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                  <PlayNativeIcon size={14} className="text-white ml-0.5 drop-shadow" />
                </div>
              </button>
            )}

            {/* Shuffle button */}
            <button
              onClick={toggleShuffle}
              className={`p-1.5 transition-colors relative flex flex-col items-center ${
                shuffleMode !== 'off' ? 'text-[#1ed760]' : 'text-[#b3b3b3] hover:text-white'
              }`}
              title={
                shuffleMode === 'smart'
                  ? 'Aleatorio inteligente activado'
                  : shuffleMode === 'all'
                  ? 'Aleatorio activado'
                  : 'Habilitar la reproducción aleatoria'
              }
            >
              {shuffleMode === 'smart' ? (
                <SmartShuffleNativeIcon size={20} className="text-[#1ed760]" />
              ) : (
                <ShuffleNativeIcon size={20} className={shuffleMode === 'all' ? 'text-[#1ed760]' : 'text-[#b3b3b3]'} />
              )}
            </button>

            {/* DJ Mode Toggle (Automix Faders icon) */}
            <button
              onClick={handleToggleAutomix}
              className={`p-1.5 transition-all relative flex flex-col items-center hover:scale-106 active:scale-95 cursor-pointer ${
                isAutomixActive ? 'text-[#1ed760]' : 'text-[#b3b3b3] hover:text-white'
              }`}
              title={
                isAutomixActive
                  ? 'Modo DJ activado (Orden armónico, BPM y transiciones automáticas)'
                  : 'Activar Modo DJ'
              }
            >
              <AutomixNativeIcon
                size={24}
                className={isAutomixActive ? 'text-[#1ed760]' : 'text-[#b3b3b3]'}
              />
            </button>

            {/* Add to Library / Checkmark toggle button (+ / ✓) */}
            {!isLikedPlaylist && !isFolder && (
              <button
                onClick={handleToggleLibrary}
                className={`w-8 h-8 rounded-full flex items-center justify-center hover:scale-106 active:scale-95 transition-all cursor-pointer ${
                  isSavedInLibrary ? 'text-[#1ed760]' : 'text-[#b3b3b3] hover:text-white'
                }`}
                title={isSavedInLibrary ? "Guardada en Tu biblioteca (clic para eliminar)" : "Añadir a Tu biblioteca"}
              >
                {isSavedInLibrary ? (
                  <CheckCircleNativeIcon size={24} className="text-[#1ed760]" />
                ) : (
                  <PlusCircleNativeIcon size={24} className="text-white/80 hover:text-white" />
                )}
              </button>
            )}

            {/* Download button (↓) Real Offline */}
            <button
              onClick={handleToggleDownload}
              disabled={isDownloading}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isDownloaded
                  ? 'text-[#1ed760]'
                  : isDownloading
                  ? 'text-[#1ed760] animate-pulse'
                  : 'text-[#b3b3b3] hover:text-white'
              }`}
              title={
                isDownloading
                  ? `Descargando (${downloadProgress.current}/${downloadProgress.total})...`
                  : isDownloaded
                  ? "Descargada sin conexión en «musica-spotifree»"
                  : "Descargar playlist completa para escuchar sin conexión"
              }
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M1 12C1 5.925 5.925 1 12 1s11 4.925 11 11-4.925 11-11 11S1 18.075 1 12" />
                <path d="M12 6.05a1 1 0 0 1 1 1v7.486l1.793-1.793a1 1 0 1 1 1.414 1.414L12 18.364l-4.207-4.207a1 1 0 1 1 1.414-1.414L11 14.536V7.05a1 1 0 0 1 1-1" />
              </svg>
            </button>

            {/* More options (...) */}
            <button
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                openContextMenu(e.clientX || rect.left, rect.bottom + 8, undefined, dynamicPlaylist.id);
              }}
              className="text-[#b3b3b3] hover:text-white hover:scale-106 transition-all p-1"
              title="Más opciones para esta lista"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4.5 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m15 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3m-7.5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3" />
              </svg>
            </button>

            {isArtist && (
              <button className="px-6 py-2 rounded-full border border-white/30 text-white font-bold text-xs uppercase hover:border-white hover:scale-105 active:scale-95 transition-all cursor-pointer">
                Seguir
              </button>
            )}
          </div>

          {/* Right view switcher */}
          <div className="flex items-center gap-4 text-xs text-[#b3b3b3]">
            <div className="flex items-center gap-1.5 font-semibold hover:text-white cursor-pointer transition-colors">
              <span>Lista</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M15 14.5H5V13h10zm0-5.75H5v-1.5h10zM15 3H5V1.5h10zM3 3H1V1.5h2zm0 11.5H1V13h2zm0-5.75H1v-1.5h2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Track List Table */}
      <div className="px-8">
        {isArtist && (
          <h2 className="text-2xl font-black text-white font-['SpotifyMixUITitle'] mb-4">
            Populares
          </h2>
        )}
        {/* Table Header - Only rendered when tracks exist */}
        {tracks.length > 0 && (
          <div
            className={`grid ${
              isAutomixActive
                ? 'grid-cols-[20px_4fr_2.5fr_100px_90px_2fr_minmax(80px,1fr)]'
                : 'grid-cols-[20px_4fr_3fr_2fr_minmax(80px,1fr)]'
            } gap-4 px-4 py-2 border-b border-white/10 text-xs font-semibold text-[#b3b3b3] uppercase tracking-wider mb-2`}
          >
            <span>#</span>
            <span>Título</span>
            <span>Álbum</span>
            {isAutomixActive && <span>BPM</span>}
            {isAutomixActive && <span>Tono</span>}
            <span>Fecha en la que se añadió</span>
            <div className="flex justify-end pr-8">
              <ClockIcon size={16} />
            </div>
          </div>
        )}

        {/* Skeleton Loader while loading */}
        {loading && tracks.length === 0 && (
          <div className="space-y-3 py-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div key={n} className="flex items-center gap-4 px-4 py-2">
                <div className="w-4 h-4 spf-skeleton rounded" />
                <div className="w-10 h-10 spf-skeleton rounded" />
                <div className="flex-1 space-y-2">
                  <div className="w-1/3 h-3 spf-skeleton rounded-full" />
                  <div className="w-1/4 h-2 spf-skeleton rounded-full" />
                </div>
                <div className="w-1/4 h-3 spf-skeleton rounded-full" />
                <div className="w-12 h-3 spf-skeleton rounded-full" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State when tracks.length === 0 and not loading */}
        {!loading && tracks.length === 0 && (
          <div className="py-8 flex flex-col items-center justify-center text-center max-w-xl mx-auto">
            {isLikedPlaylist ? (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#282828] flex items-center justify-center text-white/50 mx-auto shadow-inner">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-black text-white font-['SpotifyMixUITitle']">
                  Las canciones que te gusten aparecerán aquí
                </h2>
                <p className="text-sm text-[#b3b3b3] max-w-md mx-auto">
                  Guarda canciones haciendo clic en el icono del corazón mientras escuchas música en Spotifree o búscalas abajo para añadirlas.
                </p>
                <div className="p-3.5 bg-[#181818] border border-white/10 rounded-xl text-xs text-[#a7a7a7] text-left space-y-1.5 shadow">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="#1ed760">
                      <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0m.75 4.5v5h-1.5v-5zm0 6.5v1.5h-1.5V11z"/>
                    </svg>
                    <span>Colección privada en Spotify</span>
                  </div>
                  <p className="text-[12px] text-[#b3b3b3] leading-relaxed">
                    Tu lista de <em>«Canciones que te gustan»</em> es una colección personal privada y protegida en Spotify, por lo que no es accesible a través de listas públicas. Utiliza el buscador interactivo de abajo para añadir tus canciones y crear tu lista personalizada en Spotifree.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-full bg-[#282828] flex items-center justify-center text-white/50 mx-auto shadow-inner">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-black text-white font-['SpotifyMixUITitle']">
                  Esta lista está vacía
                </h2>
                <p className="text-sm text-[#b3b3b3] max-w-md mx-auto">
                  Busquemos algo para tu lista para que puedas empezar a escuchar música.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Track Rows */}
        {tracks.length > 0 && (
          <div className="space-y-0.5">
            {tracks.map((track, index) => {
              const isThisTrackPlaying = isPlaying && currentTrack?.id === track.id;
              const isThisTrackSelected = currentTrack?.id === track.id;
              const isLiked = isTrackLiked(track.id, track);
              const isHovered = hoveredTrackId === track.id;

              const cleanId = (track.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
              const feat: AudioFeature =
                audioFeatures[cleanId] ||
                audioFeatures[track.id] ||
                resolveClientSideRealFeature(cleanId, track.name, track.artists?.[0]?.name);

              return (
                <React.Fragment key={`${track.id}-${index}`}>
                  <div
                    data-testid="track-row"
                    onMouseEnter={() => setHoveredTrackId(track.id)}
                    onMouseLeave={() => setHoveredTrackId(null)}
                    onClick={() => handleTrackClick(track)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      openContextMenu(e.clientX, e.clientY, track.id, dynamicPlaylist.id);
                    }}
                    className={`grid ${
                      isAutomixActive
                        ? 'grid-cols-[20px_4fr_2.5fr_100px_90px_2fr_minmax(80px,1fr)]'
                        : 'grid-cols-[20px_4fr_3fr_2fr_minmax(80px,1fr)]'
                    } gap-4 px-4 py-2 rounded-md hover:bg-white/10 cursor-pointer items-center transition-colors group ${
                      isThisTrackSelected ? 'bg-white/10' : ''
                    }`}
                  >
                    {/* Index / Play / Pause / Equalizer */}
                    <div className="flex items-center justify-center text-sm font-normal text-[#b3b3b3] w-5">
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
                        <div className="w-4 h-4 flex items-end justify-center gap-[2.5px] pb-0.5" title="Reproduciendo">
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

                    {/* Track Title + Artists */}
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <TrackArtwork
                        src={trackCovers[track.id] || getTrackCoverUrl(track, dynamicPlaylist.images?.[0]?.url)}
                        alt={track.name}
                        size={40}
                        className="w-10 h-10 rounded shrink-0 object-cover shadow"
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-semibold truncate ${
                            isThisTrackPlaying ? 'text-[#1ed760]' : 'text-white'
                          }`}
                        >
                          {track.name}
                        </p>
                        <p className="text-xs text-[#b3b3b3] truncate mt-0.5 group-hover:text-white transition-colors">
                          {(() => {
                            const parsed = parseTrackArtists(track.artists);
                            return parsed.map((a, aIdx) => (
                              <span
                                key={`${track.id}-art-${aIdx}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onSelectPlaylistById) {
                                    onSelectPlaylistById(a.id, a.name);
                                  }
                                }}
                                className="hover:underline hover:text-white cursor-pointer"
                              >
                                {a.name}
                                {aIdx < parsed.length - 1 ? ', ' : ''}
                              </span>
                            ));
                          })()}
                        </p>
                      </div>
                    </div>

                    {/* Album Name */}
                    <div className="text-xs text-[#b3b3b3] truncate group-hover:text-white transition-colors">
                      {track.album?.name || dynamicPlaylist.name}
                    </div>

                    {/* BPM Column (Modo DJ) */}
                    {isAutomixActive && (
                      <div className="text-xs text-[#a7a7a7] font-['SpotifyMixUI'] tabular-nums font-medium">
                        {feat?.tempo || 128} bpm
                      </div>
                    )}

                    {/* Camelot Tonalidad Badge (Modo DJ) */}
                    {isAutomixActive && (
                      <div className="flex items-center">
                        <span
                          className="px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase tracking-tight font-['SpotifyMixUI']"
                          style={{
                            backgroundColor: feat?.color || '#cfa23e',
                            color: feat?.textColor || '#000000',
                          }}
                        >
                          {feat?.camelot || '9A'}
                        </span>
                      </div>
                    )}

                    {/* Date Added */}
                    <div className="text-xs text-[#b3b3b3]">
                      {track.added_at || 'Reciente'}
                    </div>

                    {/* Duration, Spotify Checkmark/Plus, and 3-Dots Menu */}
                    <div className="flex items-center justify-end gap-3 text-xs text-[#b3b3b3] pr-4">
                      {/* Like status: Spotify Green Checkmark if liked, + in circle on hover if not liked */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTrackLike(track);
                        }}
                        className={`transition-all cursor-pointer ${
                          isLiked
                            ? 'text-[#1ed760] opacity-100 hover:scale-110 active:scale-95'
                            : 'text-[#b3b3b3] hover:text-white opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95'
                        }`}
                        title={
                          isLiked
                            ? (isLikedPlaylist ? "Eliminar de Canciones que te gustan" : "Guardada en Canciones que te gustan (clic para quitar)")
                            : "Añadir a playlist"
                        }
                      >
                        {isLiked ? (
                          <CheckCircleNativeIcon size={16} className="text-[#1ed760]" />
                        ) : (
                          <PlusCircleNativeIcon size={16} className="text-[#b3b3b3] hover:text-white" />
                        )}
                      </button>

                      {/* Download status / trigger */}
                      {downloadingTrackIds.has(cleanId) ? (
                        <div className="w-4 h-4 border-2 border-white/20 border-t-[#1ed760] rounded-full animate-spin shrink-0" title="Descargando audio para modo avión..." />
                      ) : downloadedTrackIds.has(cleanId) ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleTrackDownload(track);
                          }}
                          className="text-[#1ed760] hover:scale-110 active:scale-95 transition-transform shrink-0 cursor-pointer"
                          title="Descargada en este dispositivo (Modo avión). Clic para eliminar."
                        >
                          <DownloadActiveCircleNativeIcon size={16} className="text-[#1ed760]" />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleTrackDownload(track);
                          }}
                          className={`text-[#b3b3b3] hover:text-white hover:scale-110 active:scale-95 transition-all shrink-0 cursor-pointer ${
                            isHovered ? 'opacity-100' : 'opacity-0'
                          }`}
                          title="Descargar para escuchar sin conexión (Modo avión)"
                        >
                          <DownloadCircleNativeIcon size={16} className="text-[#b3b3b3] hover:text-white" />
                        </button>
                      )}

                      <span className="font-['SpotifyMixUI'] tabular-nums w-10 text-right">
                        {formatDuration(track.duration_ms)}
                      </span>

                      {/* 3-dots button on hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openContextMenu(e.clientX, e.clientY, track.id, dynamicPlaylist.id);
                        }}
                        className={`p-1 text-[#b3b3b3] hover:text-white transition-opacity ${
                          isHovered ? 'opacity-100' : 'opacity-0'
                        }`}
                        title="Más opciones de la canción"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M3 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm6.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM16 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* DJ Transition Connector between tracks */}
                  {isAutomixActive && index < tracks.length - 1 && (() => {
                    const nextTrack = tracks[index + 1];
                    // Same plan the live mix and the editor use
                    const plannedTrans = djTransitionService.getPlannedTransition(track, nextTrack);
                    const smartTrans = {
                      title: mixStyleName(mixStyleOf(plannedTrans)),
                      detail: plannedTrans.reason || plannedTrans.detail || '',
                    };

                    return (
                      <div className="relative pl-14 py-1 flex items-center my-0.5">
                        <div className="absolute left-[36px] top-0 bottom-0 w-[1.5px] bg-white/15" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTransitionModalPair({
                              trackA: track,
                              trackB: nextTrack,
                            });
                          }}
                          className="relative z-10 h-7 px-3 rounded-[6px] bg-[#222222] hover:bg-[#2a2a2a] active:bg-[#333333] border border-white/10 flex items-center gap-2 cursor-pointer shadow-sm transition-all group"
                          title={`Editar transición DJ: ${smartTrans.detail || ''}`}
                        >
                          <div className="w-3.5 h-3.5 rounded-[3px] bg-[#1ed760] flex items-center justify-center text-black text-[9px] font-black group-hover:scale-105 transition-transform">
                            ✦
                          </div>
                          <span className="text-xs font-semibold text-white tracking-tight">
                            {smartTrans.title || 'Automática'}
                          </span>
                          <span className="text-white/60 text-xs font-bold leading-none">
                            ›
                          </span>
                        </button>
                      </div>
                    );
                  })()}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* Spotify "Busquemos algo para tu lista" Section (Only shown if user can add tracks: saved or owned playlist, never on artists) */}
      {canAddTracksToThisList && (
        <div className="px-8 pt-8 pb-16 mt-4 border-t border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-xl font-black text-white font-['SpotifyMixUITitle']">
                Busquemos algo para tu lista
              </h3>
              <button
                onClick={() => loadRecommendations()}
                disabled={isLoadingSuggestions}
                className="px-3 py-1 rounded-full border border-white/20 hover:border-white text-xs font-bold text-[#b3b3b3] hover:text-white transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
                title="Actualizar recomendaciones de Spotify"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className={isLoadingSuggestions ? 'animate-spin' : ''}
                >
                  <path d="M13.65 2.35a8 8 0 1 0 1.63 8.65.75.75 0 1 0-1.39-.56A6.5 6.5 0 1 1 12.5 3.5H9.75a.75.75 0 0 0 0 1.5H14a.75.75 0 0 0 .75-.75V0a.75.75 0 0 0-1.5 0v2.35z" />
                </svg>
                <span>{isLoadingSuggestions ? 'Actualizando...' : 'Actualizar'}</span>
              </button>
            </div>
            <p className="text-xs text-[#b3b3b3] mt-0.5">
              Recomendaciones de Spotify en tiempo real basadas en esta playlist
            </p>
          </div>
          {/* Capsule search input */}
          <div className="relative w-full sm:w-80">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#b3b3b3] pointer-events-none">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M7 1.75a5.25 5.25 0 1 0 0 10.5 5.25 5.25 0 0 0 0-10.5zM.25 7a6.75 6.75 0 1 1 12.096 4.12l3.184 3.185a.75.75 0 1 1-1.06 1.06L11.286 12.18A6.75 6.75 0 0 1 .25 7z" />
              </svg>
            </div>
            <input
              type="text"
              value={addSearchQuery}
              onChange={(e) => setAddSearchQuery(e.target.value)}
              placeholder="Buscar canciones o artistas..."
              className="w-full h-10 pl-10 pr-9 rounded-full bg-[#242424] hover:bg-[#2a2a2a] focus:bg-[#2a2a2a] text-white text-xs border border-transparent focus:border-white/20 outline-none transition-all placeholder:text-[#727272]"
            />
            {addSearchQuery && (
              <button
                onClick={() => setAddSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b3b3b3] hover:text-white text-xs p-1 cursor-pointer"
                title="Borrar búsqueda"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Results / Suggestions Rows */}
        <div className="space-y-1">
          {isSearchingAdd ? (
            <div className="py-8 text-center text-xs text-[#b3b3b3] flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>Buscando canciones...</span>
            </div>
          ) : (addSearchQuery ? addSearchResults : popularSuggestions).map((tr) => {
            const alreadyInList = dynamicTracks.some(
              (t) => t.id === tr.id || (t.name === tr.name && t.artists[0]?.name === tr.artists[0]?.name)
            );

            const currentClean = (currentTrack?.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
            const trClean = (tr.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
            const isPlayingThisTrack = isPlaying && Boolean(currentClean && currentClean === trClean);
            const isThisSelected = Boolean(currentClean && currentClean === trClean);

            const handlePlaySuggestion = () => {
              if (currentClean && currentClean === trClean) {
                togglePlay();
              } else {
                const list = addSearchQuery ? addSearchResults : popularSuggestions;
                const recQueue = [tr, ...list.filter((t) => (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim() !== trClean)];
                playTrack(tr, recQueue, 'playlist-recommendations');
              }
            };

            return (
              <div
                key={tr.id}
                onClick={handlePlaySuggestion}
                className={`flex items-center justify-between px-3.5 py-2 rounded-md hover:bg-white/10 transition-colors group cursor-pointer ${
                  isThisSelected ? 'bg-white/5' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                  {/* Artwork with play preview button overlay */}
                  <div
                    className="relative group/cover w-10 h-10 shrink-0 cursor-pointer overflow-hidden rounded shadow bg-[#282828]"
                    title={isPlayingThisTrack ? 'Pausar' : `Reproducir ${tr.name}`}
                  >
                    <TrackArtwork src={tr.album?.images?.[0]?.url} alt={tr.name} size={40} className="w-10 h-10 object-cover" />
                    {/* Hover play/pause overlay matching playlist tracks */}
                    <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-all duration-200 ${
                      isPlayingThisTrack ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}>
                      {isPlayingThisTrack ? (
                        <PauseNativeIcon size={16} className="text-[#1ed760] drop-shadow-md" />
                      ) : (
                        <PlayNativeIcon size={16} className="text-white ml-0.5 drop-shadow-md" />
                      )}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${
                      isThisSelected ? 'text-[#1ed760]' : 'text-white'
                    }`}>
                      {tr.name}
                    </p>
                    <p className="text-xs text-[#b3b3b3] truncate mt-0.5">
                      {parseTrackArtists(tr.artists).map((a) => a.name).join(', ')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs text-[#b3b3b3] hidden md:block max-w-[180px] truncate">
                    {tr.album?.name}
                  </span>
                  <button
                    disabled={alreadyInList}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddTrack(tr);
                    }}
                    className={`h-8 px-4 rounded-full border text-xs font-bold transition-all cursor-pointer ${
                      alreadyInList
                        ? 'border-white/10 text-white/40 cursor-default'
                        : 'border-white/30 text-white hover:border-white hover:scale-104 active:scale-96 hover:bg-white hover:text-black'
                    }`}
                  >
                    {alreadyInList ? 'Añadida' : 'Añadir'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Interactive DJ Transition Editor Modal (✦ Automática) */}
      {transitionModalPair && (
        <TransitionEditorModal
          isOpen={!!transitionModalPair}
          onClose={() => setTransitionModalPair(null)}
          trackA={transitionModalPair.trackA}
          trackB={transitionModalPair.trackB}
          onSaved={() => {}}
        />
      )}

      {/* 15s Clips Mini-Player Modal */}
      <PlaylistClipsMiniPlayer
        tracks={clipsTracks.length > 0 ? clipsTracks : tracks}
        initialTrackIndex={clipsTracks.length > 0 ? clipsInitialIndex : rotatingTrackIndex}
        skipShuffle={clipsTracks.length > 0}
        playlistTitle={dynamicPlaylist.name}
        isOpen={isClipsModalOpen}
        onClose={() => {
          setIsClipsModalOpen(false);
          setClipsTracks([]);
        }}
        onPlayFullTrack={(track, allTracks) => {
          playTrack(
            { ...track, playlistId: dynamicPlaylist.id },
            allTracks.map((t) => ({ ...t, playlistId: dynamicPlaylist.id }))
          );
        }}
      />
    </div>
  );
};
