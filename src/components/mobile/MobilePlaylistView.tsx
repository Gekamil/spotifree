import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Playlist, Track } from '../../types/spotify';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { resolveVibrantColor, extractDominantColorFromImage } from '../../utils/spotifyColor';
import {
  PlayNativeIcon,
  PauseNativeIcon,
  AddTrackNativeIcon,
  CheckTrackNativeIcon,
  ShuffleNativeIcon,
  SmartShuffleNativeIcon,
  VerifiedArtistNativeIcon,
  OptionsNativeIcon,
  ShareNativeIcon,
  DownloadCircleNativeIcon,
  DownloadActiveCircleNativeIcon,
  AutomixNativeIcon,
  EditNativeIcon,
  TrashNativeIcon,
  PlusCircleNativeIcon,
  CheckCircleNativeIcon,
  QueueNativeIcon,
} from '../icons/SpotifyNativeIcons';
import { formatDuration, stripHtml } from '../../utils/formatters';
import { fetchAudioFeaturesBatch, resolveClientSideRealFeature, type AudioFeature } from '../../utils/audioFeatures';
import { searchSpotify } from '../../services/spotifyApi';
import { handleImageError } from '../../utils/imageFallback';
import { downloadPlaylist, deleteDownloadedPlaylist, isPlaylistDownloaded } from '../../utils/offlineStorage';
import { TransitionEditorModal } from '../modals/TransitionEditorModal';
import { djTransitionService } from '../../services/djTransitionService';
import { audioEngine } from '../../services/audioEngine';
import {
  getTrackCoverUrl,
  resolveTrackCoversBatch,
  TrackArtwork,
} from '../../utils/trackCovers';
import {
  getCustomLikedSongs,
  saveCustomLikedSong,
  getSavedCustomTracks,
  saveCustomTrackToStorage,
  saveSharedPlaylist,
  getSharedPlaylistById,
} from '../../utils/userStorage';

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

interface MobilePlaylistViewProps {
  playlist: Playlist;
  onBack: () => void;
  onSelectPlaylistById?: (id: string, name?: string, image?: string) => void;
}

export const MobilePlaylistView: React.FC<MobilePlaylistViewProps> = ({
  playlist,
  onBack,
}) => {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
    toggleLike,
    likedTrackIds,
    isShuffle,
    shuffleMode,
    toggleShuffle,
  } = usePlayerStore();
  const isTrackLiked = (id: string) => Array.isArray(likedTrackIds) ? likedTrackIds.includes(id) : Boolean((likedTrackIds as any)?.has?.(id));
  const { user, playlists: allUserPlaylists, updatePlaylist, deletePlaylist } = useSpotifyDataStore();

  const [activePlaylist, setActivePlaylist] = useState<Playlist>(playlist);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(playlist.name || '');
  const [editDesc, setEditDesc] = useState(playlist.description || '');
  const [editCover, setEditCover] = useState(playlist.images?.[0]?.url || '');
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [activeTrackMenu, setActiveTrackMenu] = useState<Track | null>(null);
  const [isAddToPlaylistModalOpen, setIsAddToPlaylistModalOpen] = useState(false);
  const [transitionModalPair, setTransitionModalPair] = useState<{ trackA: Track; trackB: Track } | null>(null);

  const isLikedPlaylist =
    playlist.id === 'liked-songs' ||
    playlist.id === 'tracks' ||
    playlist.id.includes('collection:tracks') ||
    playlist.name?.toLowerCase().trim() === 'canciones que te gustan';

  useEffect(() => {
    setActivePlaylist(playlist);
    setEditName(playlist.name || '');
    setEditDesc(playlist.description || '');
    setEditCover(playlist.images?.[0]?.url || '');
  }, [playlist]);

  const cleanId = (activePlaylist.id || playlist.id || '')
    .replace(/^spotify:(playlist|album):/, '')
    .split('?')[0];

  const isArtist =
    playlist.type === 'artist' ||
    playlist.description === 'Artista' ||
    cleanId.startsWith('art-') ||
    cleanId.startsWith('artist-');

  const [tracks, setTracks] = useState<Track[]>(() => {
    if (playlist.tracks?.items && playlist.tracks.items.length > 0) {
      return playlist.tracks.items;
    }
    const cached =
      useSpotifyDataStore.getState().playlistDetailsCache[cleanId] ||
      useSpotifyDataStore.getState().playlistDetailsCache[playlist.id];
    if (cached?.tracks?.items && cached.tracks.items.length > 0) {
      return cached.tracks.items;
    }
    if (typeof window !== 'undefined') {
      try {
        const storedTracks = window.localStorage.getItem(`spotifree_playlist_tracks_${cleanId}`);
        if (storedTracks) {
          const parsed = JSON.parse(storedTracks);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    if (isLikedPlaylist) {
      return getCustomLikedSongs(user?.id);
    }
    return getSavedCustomTracks(cleanId, false, user?.id);
  });

  const [loading, setLoading] = useState(false);
  const checkIsInLibrary = (id: string, clean: string): boolean => {
    if (!id) return false;
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

  const [isSavedInLibrary, setIsSavedInLibrary] = useState<boolean>(() => checkIsInLibrary(playlist.id, cleanId));

  useEffect(() => {
    setIsSavedInLibrary(checkIsInLibrary(playlist.id, cleanId));
  }, [playlist.id, cleanId, allUserPlaylists]);

  // Track search state for empty lists
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [addSearchResults, setAddSearchResults] = useState<Track[]>([]);
  const [isSearchingAdd, setIsSearchingAdd] = useState(false);
  const [popularSuggestions, setPopularSuggestions] = useState<Track[]>([]);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [extractedThemeColor, setExtractedThemeColor] = useState<string>(() =>
    resolveVibrantColor(playlist.id, playlist.name, (playlist as any).color)
  );

  // Load popular suggestions for instant 1-click add
  useEffect(() => {
    let cancelled = false;
    async function loadSuggestions() {
      try {
        const res = await fetch(
          'https://itunes.apple.com/search?term=bad+bunny+feid+quevedo+romeo+santos&media=music&entity=song&limit=6'
        );
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.results) {
            const mapped: Track[] = data.results.map((t: any, idx: number) => ({
              id: `rec-song-${t.trackId || idx}`,
              name: t.trackName || 'Canción',
              duration_ms: t.trackTimeMillis || 210000,
              artists: [{ id: `art-${t.artistId || idx}`, name: t.artistName || 'Artista' }],
              album: {
                id: `alb-${t.collectionId || idx}`,
                name: t.collectionName || t.trackName,
                images: [{ url: (t.artworkUrl100 || '').replace('100x100bb', '600x600bb') }],
              },
            }));
            setPopularSuggestions(mapped);
          }
        }
      } catch {}
    }
    loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, []);

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
        const data = await searchSpotify(q);
        if (!cancelled) {
          setAddSearchResults(data?.tracks?.items || []);
        }
      } catch {
        if (!cancelled) setAddSearchResults([]);
      } finally {
        if (!cancelled) setIsSearchingAdd(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [addSearchQuery]);

  // Load tracks accurately if playlist only had stub or is an artist
  useEffect(() => {
    let cancelled = false;

    // A. ARTIST PROFILE: Fetch real popular top songs for this artist immediately
    const isArtist =
      playlist.type === 'artist' ||
      playlist.description === 'Artista' ||
      cleanId.startsWith('art-') ||
      cleanId.startsWith('artist-');

    if (isArtist) {
      setLoading(true);
      const cleanArtistName = playlist.name.replace(/^(art-|artist-)/i, '').trim();

      (async () => {
        try {
          let songs: Track[] = [];

          // 1. Try Spotify search endpoint
          try {
            const sRes = await fetch(`/api/spotify/search?q=${encodeURIComponent(cleanArtistName)}`);
            if (sRes.ok) {
              const sData = await sRes.json();
              if (Array.isArray(sData.tracks?.items) && sData.tracks.items.length > 0) {
                songs = sData.tracks.items.filter((t: Track) =>
                  t.artists.some((a) => a.name.toLowerCase().includes(cleanArtistName.toLowerCase()))
                );
                if (songs.length === 0) songs = sData.tracks.items.slice(0, 20);
              }
            }
          } catch {}

          // 2. iTunes search fallback for artist top tracks
          if (songs.length === 0) {
            try {
              const itunesRes = await fetch(
                `https://itunes.apple.com/search?term=${encodeURIComponent(cleanArtistName)}&media=music&entity=song&limit=25`
              );
              if (itunesRes.ok) {
                const data = await itunesRes.json();
                songs = (data.results || []).map((t: any, idx: number) => ({
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
              }
            } catch {}
          }

          if (!cancelled && songs.length > 0) {
            setTracks(songs);
            useSpotifyDataStore.getState().cachePlaylistDetails({
              ...playlist,
              tracks: { total: songs.length, items: songs },
            });
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    // B. REGULAR PLAYLIST: Merge with any saved custom tracks
    const savedCustom = getSavedCustomTracks(cleanId, false, user?.id);
    const mergeWithCustom = (baseList: Track[]): Track[] => {
      if (savedCustom.length === 0) return baseList;
      const baseIds = new Set(baseList.map((t) => t.id));
      const toAdd = savedCustom.filter((t) => !baseIds.has(t.id));
      return [...toAdd, ...baseList];
    };

    // 1. Direct items
    if (playlist.tracks?.items && playlist.tracks.items.length > 0) {
      setTracks(mergeWithCustom(playlist.tracks.items));
      return;
    }

    // 2. Check playlistDetailsCache
    const cached =
      useSpotifyDataStore.getState().playlistDetailsCache[cleanId] ||
      useSpotifyDataStore.getState().playlistDetailsCache[playlist.id];
    if (cached?.tracks?.items && cached.tracks.items.length > 0) {
      setTracks(mergeWithCustom(cached.tracks.items));
      return;
    }

    // 3. Check Liked Songs specifically (isolated per user)
    if (isLikedPlaylist) {
      const customLiked = getCustomLikedSongs(user?.id);
      if (customLiked.length > 0) {
        setTracks(customLiked);
      }
    }

    // 4. Check store user playlists
    const storePl = useSpotifyDataStore.getState().playlists.find((p) => p.id === cleanId || p.id === playlist.id);
    if (storePl?.tracks?.items && storePl.tracks.items.length > 0) {
      setTracks(mergeWithCustom(storePl.tracks.items));
      return;
    }

    // 5. Check custom saved tracks in localStorage
    if (savedCustom.length > 0) {
      setTracks(savedCustom);
      return;
    }

    // 5b. Check shared collaborative playlist storage
    const sharedPl = getSharedPlaylistById(cleanId);
    if (sharedPl && sharedPl.tracks && sharedPl.tracks.length > 0) {
      setTracks(mergeWithCustom(sharedPl.tracks));
      return;
    }

    // 6. Fetch from backend endpoint with Spotify session / cookies
    async function fetchTracks() {
      if (tracks.length === 0) {
        setLoading(true);
      }
      try {
        const userCookie = typeof window !== 'undefined' ? window.localStorage.getItem('user_spotify_cookie') || '' : '';
        const accessToken = typeof window !== 'undefined' ? window.localStorage.getItem('spotify_access_token') || '' : '';
        const headers: Record<string, string> = {};
        if (userCookie) headers['x-spotify-cookie'] = userCookie;
        if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

        const res = await fetch(`/api/spotify/playlist/${encodeURIComponent(cleanId)}`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.tracks?.items && data.tracks.items.length > 0) {
            const merged = mergeWithCustom(data.tracks.items);
            setTracks(merged);
            if (typeof window !== 'undefined') {
              try {
                window.localStorage.setItem(`spotifree_playlist_tracks_${cleanId}`, JSON.stringify(merged));
              } catch {}
            }
            useSpotifyDataStore.getState().cachePlaylistDetails({
              ...playlist,
              ...data,
              tracks: { total: merged.length, items: merged },
            });
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Backend playlist fetch notice:', err);
      }

      if (!cancelled) setLoading(false);
    }

    fetchTracks();
    return () => {
      cancelled = true;
    };
  }, [playlist.id, playlist.name, isLikedPlaylist, user?.id]);

  // Batch resolve individual track covers asynchronously on mobile
  useEffect(() => {
    if (!tracks || tracks.length === 0) return;
    let cancelled = false;

    const playlistCover = playlist.images?.[0]?.url;
    resolveTrackCoversBatch(tracks, playlistCover, (updates) => {
      if (cancelled || updates.size === 0) return;
      setTracks((prev) =>
        prev.map((t) => {
          if (updates.has(t.id)) {
            const newUrl = updates.get(t.id)!;
            return {
              ...t,
              album: {
                ...t.album,
                id: t.album?.id || `alb-${t.id}`,
                name: t.album?.name || t.name,
                images: [{ url: newUrl }],
              },
            };
          }
          return t;
        })
      );
    });

    return () => {
      cancelled = true;
    };
  }, [tracks.length, cleanId, playlist.images]);

  // Preload and pre-warm audio & video IDs for top tracks in this playlist for instant 0ms playback
  useEffect(() => {
    if (!tracks || tracks.length === 0) return;
    audioEngine.warmupInitialTracks(tracks.slice(0, 8));
  }, [cleanId, tracks.length]);

  const handleToggleLibrary = () => {
    const next = !isSavedInLibrary;
    setIsSavedInLibrary(next);
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('spotifree_saved_library_playlists');
        let list: string[] = raw ? JSON.parse(raw) : [];
        if (next) {
          if (!list.includes(playlist.id)) list.push(playlist.id);
          useSpotifyDataStore.getState().addCustomPlaylist(playlist);
        } else {
          list = list.filter((id) => id !== playlist.id);
          useSpotifyDataStore.getState().deletePlaylist(playlist.id);
        }
        window.localStorage.setItem('spotifree_saved_library_playlists', JSON.stringify(list));
      } catch {}
    }
  };

  const handleTrackClick = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track, tracks);
    }
  };

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    if (isPlaying && tracks.some((t) => t.id === currentTrack?.id)) {
      togglePlay();
    } else {
      if (isShuffle || shuffleMode !== 'off') {
        const randomIndex = Math.floor(Math.random() * tracks.length);
        playTrack(tracks[randomIndex], tracks);
      } else {
        playTrack(tracks[0], tracks);
      }
    }
  };

  const handleAddTrack = (track: Track) => {
    const trackWithMeta: Track = {
      ...track,
      added_at: 'Hoy',
      added_by: user?.display_name || 'Jorge',
    };

    setTracks((prev) => {
      if (prev.some((t) => t.id === track.id || (t.name === track.name && t.artists[0]?.name === track.artists[0]?.name))) {
        return prev;
      }
      return [trackWithMeta, ...prev];
    });

    if (isLikedPlaylist) {
      saveCustomLikedSong(trackWithMeta, user?.id);
      toggleLike(track.id, trackWithMeta);
    } else {
      saveCustomTrackToStorage(cleanId, false, trackWithMeta, user?.id);
    }

    const store = useSpotifyDataStore.getState();
    const currentPl = store.playlists.find((p) => p.id === cleanId || p.id === playlist.id);
    if (currentPl) {
      const existingItems = currentPl.tracks?.items || [];
      const updatedItems = [trackWithMeta, ...existingItems.filter((t) => t.id !== track.id)];
      const updatedPl = {
        ...currentPl,
        tracks: { total: updatedItems.length, items: updatedItems },
      };
      useSpotifyDataStore.setState((s) => ({
        playlists: s.playlists.map((p) => (p.id === currentPl.id ? updatedPl : p)),
        playlistDetailsCache: {
          ...s.playlistDetailsCache,
          [cleanId]: updatedPl,
          [playlist.id]: updatedPl,
        },
      }));
    }
  };

  const isCurrentPlaylistPlaying =
    isPlaying && tracks.some((t) => t.id === currentTrack?.id);

  const coverUrl =
    isLikedPlaylist
      ? 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'
      : playlist.images?.[0]?.url || tracks[0]?.album?.images?.[0]?.url;

  useEffect(() => {
    let cancelled = false;
    if (coverUrl) {
      extractDominantColorFromImage(coverUrl).then((hex) => {
        if (!cancelled && hex) {
          setExtractedThemeColor(hex);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [coverUrl]);

  // Offline download state
  const [isDownloaded, setIsDownloaded] = useState<boolean>(() => isPlaylistDownloaded(cleanId));
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Automix / Transiciones inteligentes (Modo DJ)
  const [isAutomixActive, setIsAutomixActive] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      return window.localStorage.getItem('spotifree_crossfade_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  // Spotify Audio Features (BPM, Key, Mode, Camelot Wheel)
  const [audioFeatures, setAudioFeatures] = useState<Record<string, AudioFeature>>({});
  const originalTracksRef = useRef<Track[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (tracks && tracks.length > 0) {
      fetchAudioFeaturesBatch(tracks).then((feats) => {
        if (!cancelled && feats) {
          setAudioFeatures(feats);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [tracks, isAutomixActive]);

  const handleToggleDownload = async () => {
    if (isDownloading) return;
    if (isDownloaded) {
      await deleteDownloadedPlaylist(cleanId, tracks.map((t) => t.id));
      setIsDownloaded(false);
      setToastMessage('Descargas eliminadas de este dispositivo');
      setTimeout(() => setToastMessage(null), 2500);
    } else {
      setIsDownloading(true);
      setToastMessage(`Descargando ${tracks.length} canciones para escuchar sin conexión...`);
      try {
        const res = await downloadPlaylist(activePlaylist, tracks, (completed, total) => {
          setToastMessage(`Descargando canciones (${completed}/${total})...`);
        });
        if (res && res.downloaded > 0) {
          setIsDownloaded(true);
          setToastMessage(`¡${res.downloaded} canciones guardadas en «musica-spotifree» para escuchar sin conexión!`);
        } else {
          setIsDownloaded(false);
          setToastMessage('No se pudo descargar el audio. Comprueba tu conexión a internet.');
        }
      } catch {
        setToastMessage('Error al descargar canciones');
      } finally {
        setIsDownloading(false);
        setTimeout(() => setToastMessage(null), 4000);
      }
    }
  };

  const handleSavePlaylistEdit = () => {
    const trimmedName = editName.trim() || activePlaylist.name;
    const trimmedDesc = editDesc.trim();
    const updatedImages = editCover.trim() ? [{ url: editCover.trim() }] : activePlaylist.images;
    
    const updated: Partial<Playlist> = {
      name: trimmedName,
      description: trimmedDesc,
      images: updatedImages,
    };

    updatePlaylist(activePlaylist.id, updated);
    setActivePlaylist((prev) => ({ ...prev, ...updated }));
    setIsEditModalOpen(false);
    setToastMessage('Playlist actualizada con éxito');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleRemoveTrackFromPlaylist = (trackId: string) => {
    const nextTracks = tracks.filter((t) => t.id !== trackId);
    setTracks(nextTracks);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(`spotifree_playlist_tracks_${cleanId}`, JSON.stringify(nextTracks));
        const updatedPlaylist: Playlist = {
          ...activePlaylist,
          tracks: { total: nextTracks.length, items: nextTracks },
        };
        updatePlaylist(activePlaylist.id, updatedPlaylist);
      } catch {}
    }
    setToastMessage('Canción eliminada de la playlist');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleToggleAutomix = () => {
    const next = !isAutomixActive;
    setIsAutomixActive(next);
    try {
      window.localStorage.setItem('spotifree_crossfade_enabled', String(next));
      window.localStorage.setItem('spotifree_dj_mode', String(next));
      window.localStorage.setItem('spotifree_dj_mode_desktop', String(next));
      if (next) {
        window.localStorage.setItem('spotifree_crossfade_sec', '0');
      }
    } catch {}

    if (next) {
      // 1. Save original order before harmonic sorting
      originalTracksRef.current = [...tracks];
      // 2. Sort tracks along Camelot Wheel & BPM proximity
      const harmonized = djTransitionService.sortPlaylistHarmonically(tracks, audioFeatures);
      setTracks(harmonized);
      setToastMessage('✦ Modo DJ activado: orden armónico y transiciones calculadas');
    } else {
      // 3. Restore exact original order when leaving DJ mode
      if (originalTracksRef.current && originalTracksRef.current.length > 0) {
        setTracks(originalTracksRef.current);
        originalTracksRef.current = null;
      }
      setToastMessage('Modo DJ desactivado: orden original restaurado');
    }
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSharePlaylist = async () => {
    const shareUrl = `${window.location.origin}/?playlist=${encodeURIComponent(cleanId)}`;
    const shareData = {
      title: playlist.name,
      text: `Escucha ${playlist.name} en Spotifree`,
      url: shareUrl,
    };

    saveSharedPlaylist({
      id: cleanId,
      name: playlist.name,
      description: playlist.description,
      coverUrl,
      ownerId: user?.id || 'me',
      ownerName: playlist.owner?.display_name || user?.display_name || 'Spotify',
      tracks,
      isCollaborative: true,
      updatedAt: Date.now(),
    });

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (e) {}
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setToastMessage('¡Enlace copiado al portapapeles!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch {
      setToastMessage('¡Playlist compartida!');
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  return (
    <div
      className="select-none min-h-screen text-white font-['SpotifyMixUI'] pb-36 relative overflow-hidden"
      style={{
        backgroundColor: extractedThemeColor,
        backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(18,18,18,0.85) 280px, #121212 420px)',
      }}
    >
      {/* Ambient atmospheric aura & glow shine at the top */}
      <div
        className="absolute -top-20 left-1/2 -translate-x-1/2 w-[340px] h-[340px] rounded-full pointer-events-none blur-[90px] opacity-50 z-0"
        style={{ backgroundColor: extractedThemeColor }}
      />

      {/* Hero / Header matching Spotify Mobile */}
      {isArtist ? (
        <div className="relative w-full">
          {/* Full panoramic artist hero banner */}
          <div className="relative w-full h-80 overflow-hidden bg-[#242424]">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={playlist.name}
                onError={handleImageError}
                className="w-full h-full object-cover object-top"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/40">
                <svg width="72" height="72" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-black/35 to-black/30" />
            
            {/* Top Bar Floating Buttons */}
            <div className="absolute top-0 left-0 right-0 z-20 px-4 py-3 flex items-center justify-between">
              <button
                onClick={onBack}
                className="p-1.5 text-white hover:text-white/80 active:scale-90 transition-transform -ml-1 cursor-pointer"
                title="Atrás"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.54 21.15L6.39 12l9.15-9.15.71.71L7.81 12l8.44 8.44-.71.71z" />
                </svg>
              </button>
            </div>

            {/* Bottom Artist Info */}
            <div className="absolute bottom-5 left-5 right-5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white mb-1.5">
                <VerifiedArtistNativeIcon size={20} className="text-[#3d91f4]" />
                <span>Artista verificado</span>
              </div>
              <h1 className="text-4xl font-black text-white font-['SpotifyMixUITitle'] leading-none truncate">
                {playlist.name}
              </h1>
              <p className="text-xs text-[#b3b3b3] font-medium pt-1">
                {getArtistMonthlyListeners(playlist.name)}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Sticky Top Header */}
          <div className="sticky top-0 z-30 px-4 py-3 flex items-center justify-between backdrop-blur-md bg-black/40 border-b border-white/5">
            <button
              onClick={onBack}
              className="p-1.5 text-white hover:text-white/80 active:scale-90 transition-transform -ml-1 cursor-pointer"
              title="Atrás"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.54 21.15L6.39 12l9.15-9.15.71.71L7.81 12l8.44 8.44-.71.71z" />
              </svg>
            </button>

            <span className="font-bold text-sm text-white truncate max-w-[200px]">
              {playlist.name}
            </span>

            <button
              onClick={() => setIsOptionsOpen(true)}
              className="w-9 h-9 flex items-center justify-center text-white/80 hover:text-white cursor-pointer active:scale-90 transition-transform"
              title="Más opciones de la playlist"
            >
              <OptionsNativeIcon size={20} className="text-white" />
            </button>
          </div>

          {/* Regular Playlist Hero */}
          <div className="px-6 pt-4 pb-4 flex flex-col items-center text-center">
            <div className="w-52 h-52 rounded-lg overflow-hidden shadow-[0_16px_36px_rgba(0,0,0,0.85)] bg-black mb-4 border border-white/10 relative z-10 shrink-0">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={playlist.name}
                  onError={handleImageError}
                  className="w-full h-full object-cover opacity-100 block"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/40">
                  <svg width="56" height="56" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
                </div>
              )}
            </div>

            <h1 className="text-2xl font-black text-white font-['SpotifyMixUITitle'] leading-tight mb-1 max-w-[90%]">
              {playlist.name}
            </h1>

            {playlist.description && (
              <p className="text-xs text-[#b3b3b3] line-clamp-2 max-w-[85%] mb-2">
                {stripHtml(playlist.description)}
              </p>
            )}

            <div className="flex items-center gap-2 text-xs text-[#b3b3b3] font-medium">
              <span className="text-white font-bold">{playlist.owner?.display_name || user?.display_name || 'Spotify'}</span>
              <span>•</span>
              <span>{tracks.length} canciones</span>
            </div>
          </div>
        </>
      )}

      {/* Action Row matching Spotify Mobile */}
      <div className="px-6 py-2 flex items-center justify-between">
        {/* Left side: 1) Add/Check library, 2) Download, 3) Share */}
        <div className="flex items-center gap-5">
          {/* 1. Add / Check to Library */}
          {isArtist ? (
            <button
              onClick={handleToggleLibrary}
              className="px-5 py-2 rounded-full border border-white/30 text-white font-bold text-xs uppercase hover:border-white active:scale-95 transition-all cursor-pointer"
            >
              {isSavedInLibrary ? 'Siguiendo' : 'Seguir'}
            </button>
          ) : (
            <button
              onClick={handleToggleLibrary}
              className="text-white hover:scale-105 active:scale-90 transition-transform cursor-pointer"
              title={isSavedInLibrary ? 'Guardada en tu biblioteca (clic para eliminar)' : 'Añadir a tu biblioteca'}
            >
              {isSavedInLibrary ? (
                <CheckCircleNativeIcon size={26} className="text-[#1ed760]" />
              ) : (
                <PlusCircleNativeIcon size={26} className="text-white/80 hover:text-white" />
              )}
            </button>
          )}

          {/* 2. Download Circle Button */}
          {!isArtist && (
            <button
              onClick={handleToggleDownload}
              className="hover:scale-105 active:scale-90 transition-transform cursor-pointer"
              title={isDownloaded ? 'Descargado (escucha offline)' : 'Descargar para escuchar offline'}
            >
              {isDownloading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-[#1ed760] rounded-full animate-spin" />
              ) : isDownloaded ? (
                <DownloadActiveCircleNativeIcon size={24} className="text-[#1ed760]" />
              ) : (
                <DownloadCircleNativeIcon size={24} className="text-white/80 hover:text-white" />
              )}
            </button>
          )}

          {/* 3. Share playlist button */}
          <button
            onClick={handleSharePlaylist}
            className="text-white/80 hover:text-white active:scale-90 transition-transform cursor-pointer"
            title="Compartir playlist"
          >
            <ShareNativeIcon size={22} className="text-white/80 hover:text-white" />
          </button>
        </div>

        {/* Right side: 4) DJ Automix bars, 5) Shuffle button, 6) Large Green Play */}
        <div className="flex items-center gap-3">
          {/* 4. DJ Mixer Faders Toggle Button */}
          <button
            onClick={handleToggleAutomix}
            className={`p-2 rounded-full transition-all cursor-pointer relative flex items-center justify-center active:scale-90 ${
              isAutomixActive ? 'text-[#1ed760]' : 'text-white/70 hover:text-white'
            }`}
            title={
              isAutomixActive
                ? 'Modo DJ activado: BPM, tonalidad armónica y transiciones inteligentes'
                : 'Activar Modo DJ'
            }
          >
            <AutomixNativeIcon
              size={24}
              className={isAutomixActive ? 'text-[#1ed760]' : 'text-white/70 hover:text-white'}
            />
          </button>

          {/* 5. Shuffle button (dos flechitas) */}
          <button
            onClick={toggleShuffle}
            className={`p-2 transition-colors relative flex flex-col items-center active:scale-90 cursor-pointer ${
              shuffleMode !== 'off' ? 'text-[#1ed760]' : 'text-white/70 hover:text-white'
            }`}
            title="Reproducción aleatoria"
          >
            {shuffleMode === 'smart' ? (
              <SmartShuffleNativeIcon size={24} className="text-[#1ed760]" />
            ) : (
              <ShuffleNativeIcon size={24} className={shuffleMode === 'all' ? 'text-[#1ed760]' : 'text-white/70'} />
            )}
          </button>

          {/* 6. Play Button: Authentic Vinyl Turntable (Modo DJ) or Classic Green */}
          {isAutomixActive ? (
            <button
              onClick={handlePlayAll}
              className="relative w-14 h-14 rounded-full p-[2.5px] bg-[#1ed760] shadow-[0_0_20px_rgba(30,215,96,0.7)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer group shrink-0"
              title={isCurrentPlaylistPlaying ? 'Pausar (Modo DJ)' : 'Reproducir con transiciones DJ'}
            >
              {/* Outer vinyl chassis */}
              <div className="w-full h-full rounded-full bg-[#121212] relative overflow-hidden flex items-center justify-center">
                {/* Rotating vinyl platter with realistic grooves and angular sheen */}
                <div
                  className={`absolute inset-0 rounded-full ${
                    isCurrentPlaylistPlaying ? 'animate-[spin_8s_linear_infinite]' : ''
                  }`}
                  style={{
                    background:
                      'conic-gradient(from 0deg, #111111 0deg, #2a2a2a 45deg, #0d0d0d 90deg, #2a2a2a 135deg, #111111 180deg, #2a2a2a 225deg, #0d0d0d 270deg, #2a2a2a 315deg, #111111 360deg)',
                  }}
                >
                  {/* Concentric microgroove borders */}
                  <div className="absolute inset-[3px] rounded-full border border-white/[0.12] pointer-events-none" />
                  <div className="absolute inset-[6px] rounded-full border border-white/[0.08] pointer-events-none" />
                  <div className="absolute inset-[9px] rounded-full border border-white/[0.06] pointer-events-none" />
                  <div className="absolute inset-[12px] rounded-full border border-white/[0.08] pointer-events-none" />
                  <div className="absolute inset-[15px] rounded-full border border-white/[0.05] pointer-events-none" />
                  <div className="absolute inset-[18px] rounded-full border border-white/[0.07] pointer-events-none" />
                </div>

                {/* Center vinyl spindle label - stays steady and upright */}
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
              className="w-14 h-14 rounded-full bg-[#1ed760] hover:scale-106 active:scale-95 shadow-2xl flex items-center justify-center text-black transition-all cursor-pointer shrink-0"
              title={isCurrentPlaylistPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isCurrentPlaylistPlaying ? (
                <PauseNativeIcon size={24} className="text-black" />
              ) : (
                <PlayNativeIcon size={24} className="text-black ml-1" />
              )}
            </button>
          )}
        </div>
      </div>

      {isArtist && (
        <div className="px-5 pt-3 pb-1">
          <h2 className="text-xl font-black text-white font-['SpotifyMixUITitle']">
            Populares
          </h2>
        </div>
      )}

      {/* Track List */}
      <div className="px-4 pt-2 space-y-1">
        {loading ? (
          <div className="p-8 text-center text-[#b3b3b3] text-sm flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-white/20 border-t-[#1ed760] rounded-full animate-spin" />
            <span>Cargando canciones...</span>
          </div>
        ) : tracks.length === 0 ? (
          <div className="p-4 text-center space-y-4">
            {isLikedPlaylist ? (
              <div className="p-4 bg-[#181818] border border-white/10 rounded-2xl text-left space-y-2 shadow-lg">
                <div className="flex items-center gap-2 font-bold text-white text-sm">
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="#1ed760" className="shrink-0">
                    <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0m.75 4.5v5h-1.5v-5zm0 6.5v1.5h-1.5V11z"/>
                  </svg>
                  <span>Colección privada en Spotify</span>
                </div>
                <p className="text-xs text-[#b3b3b3] leading-relaxed">
                  Tu lista de <em>«Canciones que te gustan»</em> es una colección personal privada y protegida en Spotify. Añade tus temas favoritos con el buscador inferior para crear y personalizar tu lista aquí.
                </p>
              </div>
            ) : (
              <div className="py-2">
                <p className="text-sm font-bold text-white">Esta lista está vacía</p>
                <p className="text-xs text-[#b3b3b3] mt-1">Busca canciones a continuación para añadirlas a tu lista.</p>
              </div>
            )}

            {/* In-place Track Searcher matching Spotify Mobile */}
            <div className="space-y-3 pt-2">
              <div className="relative w-full">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#b3b3b3] pointer-events-none">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M7 1.75a5.25 5.25 0 1 0 0 10.5 5.25 5.25 0 0 0 0-10.5zM.25 7a6.75 6.75 0 1 1 12.096 4.12l3.184 3.185a.75.75 0 1 1-1.06 1.06L11.286 12.18A6.75 6.75 0 0 1 .25 7z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={addSearchQuery}
                  onChange={(e) => setAddSearchQuery(e.target.value)}
                  placeholder="Buscar canciones o artistas para añadir..."
                  className="w-full h-11 pl-10 pr-9 bg-[#242424] text-white text-xs rounded-full outline-none placeholder:text-[#a7a7a7] border border-white/10 focus:border-white/30 transition-all"
                />
                {addSearchQuery && (
                  <button
                    onClick={() => {
                      setAddSearchQuery('');
                      setAddSearchResults([]);
                    }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#b3b3b3] hover:text-white text-xs p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {isSearchingAdd && (
                <div className="py-3 text-xs text-[#b3b3b3] flex items-center justify-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Buscando temas...</span>
                </div>
              )}

              <div className="space-y-1.5 text-left">
                {!addSearchQuery && (
                  <p className="text-xs font-bold text-[#b3b3b3] px-1 pt-1">Recomendadas para ti</p>
                )}
                {(addSearchQuery ? addSearchResults : popularSuggestions).map((trk) => {
                  const alreadyInList = tracks.some(
                    (t) => t.id === trk.id || (t.name === trk.name && t.artists[0]?.name === trk.artists[0]?.name)
                  );
                  const trackCover = trk.album?.images?.[0]?.url;

                  return (
                    <div
                      key={trk.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-white/5 active:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#242424] shrink-0 shadow">
                          {trackCover ? (
                            <img src={trackCover} alt={trk.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-white/40">♪</div>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-white text-xs truncate">{trk.name}</span>
                          <span className="text-[11px] text-[#b3b3b3] truncate">
                            {trk.artists?.map((a) => a.name).join(', ')}
                          </span>
                        </div>
                      </div>
                      <button
                        disabled={alreadyInList}
                        onClick={() => handleAddTrack(trk)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition-transform active:scale-95 ${
                          alreadyInList
                            ? 'bg-white/10 text-white/40 cursor-default'
                            : 'bg-white text-black hover:bg-[#1ed760]'
                        }`}
                      >
                        {alreadyInList ? '✓ Añadida' : 'Añadir'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <>
            {tracks.map((track, idx) => {
              const isThisPlaying = isPlaying && currentTrack?.id === track.id;
              const trackCover = getTrackCoverUrl(track, isLikedPlaylist ? undefined : playlist.images?.[0]?.url);
              const isLiked = likedTrackIds.includes(track.id);
              const cleanTrackId = (track.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
              const feat =
                audioFeatures[cleanTrackId] ||
                audioFeatures[track.id] ||
                resolveClientSideRealFeature(cleanTrackId, track.name, track.artists?.[0]?.name);

              return (
                <React.Fragment key={track.id || idx}>
                  <div
                    onClick={() => handleTrackClick(track)}
                    className="flex items-center justify-between p-2.5 rounded-lg active:bg-white/10 cursor-pointer transition-colors group"
                  >
                    {/* Left: Cover or Number + Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                      {isArtist && (
                        <span className={`w-4 text-center text-xs font-bold shrink-0 ${isThisPlaying ? 'text-[#1ed760]' : 'text-[#b3b3b3]'}`}>
                          {idx + 1}
                        </span>
                      )}

                      <div className="w-11 h-11 rounded overflow-hidden bg-[#242424] shrink-0 shadow relative">
                        <TrackArtwork
                          src={trackCover}
                          alt={track.name}
                          className="w-11 h-11 rounded"
                          size={44}
                        />
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span
                          className={`font-bold text-sm truncate ${
                            isThisPlaying ? 'text-[#1ed760]' : 'text-white'
                          }`}
                        >
                          {track.name}
                        </span>
                        <span className="text-xs text-[#b3b3b3] truncate mt-0.5 flex items-center gap-1.5">
                          <span className="truncate">
                            {isArtist
                              ? `${Math.max(1200000, 1482910293 - idx * 85000000).toLocaleString('es-ES')} reproducciones`
                              : track.artists?.map((a) => a.name).join(', ') || 'Artista'}
                          </span>
                          {track.added_by && (
                            <span className="text-[10px] text-[#1ed760] font-medium shrink-0">
                              • {typeof track.added_by === 'string' ? track.added_by : track.added_by.name}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Right: DJ Mode (BPM + Camelot chip + Duration + Options) or Regular Mode */}
                    {isAutomixActive ? (
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {/* Top: BPM */}
                        <span className="text-[12px] font-bold text-white/90 font-['SpotifyMixUI'] tracking-tight">
                          {feat?.tempo || 130} bpm
                        </span>

                        {/* Bottom: Camelot chip + Duration + Options */}
                        <div className="flex items-center gap-2">
                          <span
                            className="px-1.5 py-0.5 rounded-[3px] text-[10px] font-black leading-none tracking-tight uppercase"
                            style={{
                              backgroundColor: feat?.color || '#9d78db',
                              color: feat?.textColor || '#ffffff',
                            }}
                          >
                            {feat?.camelot || '9A'}
                          </span>

                          <span className="text-xs font-['SpotifyMixUI'] tabular-nums text-[#b3b3b3]">
                            {formatDuration(track.duration_ms)}
                          </span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveTrackMenu(track);
                            }}
                            className="p-1 text-[#b3b3b3] hover:text-white cursor-pointer active:scale-90 transition-transform -mr-1"
                            title="Opciones de la canción"
                          >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M3 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm6.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm6.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 shrink-0 text-[#b3b3b3]">
                        {isLiked && (
                          <CheckTrackNativeIcon size={16} className="text-[#1ed760] shrink-0" />
                        )}
                        <span className="text-xs font-['SpotifyMixUI'] tabular-nums text-[#b3b3b3]">{formatDuration(track.duration_ms)}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTrackMenu(track);
                          }}
                          className="p-1 text-[#b3b3b3] hover:text-white cursor-pointer active:scale-90 transition-transform"
                          title="Opciones de la canción"
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M3 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm6.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm6.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* DJ Mode Transition Indicator between tracks */}
                  {isAutomixActive && idx < tracks.length - 1 && (() => {
                    const nextTrack = tracks[idx + 1];
                    const nextCleanId = (nextTrack?.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
                    const nextFeat: AudioFeature =
                      audioFeatures[nextCleanId] ||
                      audioFeatures[nextTrack?.id] ||
                      resolveClientSideRealFeature(nextCleanId, nextTrack?.name, nextTrack?.artists?.[0]?.name);

                    const smartTrans = djTransitionService.getTransitionConfig(
                      track.id,
                      nextTrack.id,
                      feat?.tempo,
                      nextFeat?.tempo,
                      feat?.camelot,
                      nextFeat?.camelot,
                      idx
                    );

                    return (
                      <div className="relative pl-7 py-1 flex items-center">
                        <div className="absolute left-[34px] top-0 bottom-0 w-[1.5px] bg-white/15" />
                        <button
                          onClick={() => {
                            if (nextTrack) {
                              setTransitionModalPair({ trackA: track, trackB: nextTrack });
                            }
                          }}
                          className="relative z-10 ml-2 h-7 px-3 rounded-[6px] bg-[#222222] hover:bg-[#2a2a2a] active:bg-[#333333] border border-white/10 flex items-center gap-2 cursor-pointer shadow-sm transition-all"
                          title={`Editar transición DJ: ${smartTrans.detail || ''}`}
                        >
                          <div className="w-3.5 h-3.5 rounded-[3px] bg-[#1ed760] flex items-center justify-center text-black text-[9px] font-black">
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

            {/* Bottom Add Songs section matching Spotify */}
            <div className="pt-6 pb-4 border-t border-white/10 mt-6 px-1">
              <h3 className="text-base font-bold text-white mb-1">
                ¿Quieres añadir más canciones?
              </h3>
              <p className="text-xs text-[#b3b3b3] mb-3">
                Busca temas para sumarlos a esta lista
              </p>
              <div className="relative w-full mb-3">
                <input
                  type="text"
                  value={addSearchQuery}
                  onChange={(e) => setAddSearchQuery(e.target.value)}
                  placeholder="Buscar más canciones..."
                  className="w-full h-10 pl-4 pr-9 bg-[#242424] text-white text-xs rounded-full outline-none placeholder:text-[#a7a7a7] border border-white/10 focus:border-white/30"
                />
                {addSearchQuery && (
                  <button
                    onClick={() => {
                      setAddSearchQuery('');
                      setAddSearchResults([]);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b3b3b3] hover:text-white text-xs p-1"
                  >
                    ✕
                  </button>
                )}
              </div>

              {isSearchingAdd && (
                <div className="py-2 text-xs text-[#b3b3b3] text-center">Buscando...</div>
              )}

              {addSearchResults.map((trk) => {
                const alreadyInList = tracks.some(
                  (t) => t.id === trk.id || (t.name === trk.name && t.artists[0]?.name === trk.artists[0]?.name)
                );
                return (
                  <div
                    key={trk.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-white/5 mb-1.5"
                  >
                    <div className="flex flex-col min-w-0 pr-2 text-left">
                      <span className="font-bold text-white text-xs truncate">{trk.name}</span>
                      <span className="text-[11px] text-[#b3b3b3] truncate">
                        {trk.artists?.map((a) => a.name).join(', ')}
                      </span>
                    </div>
                    <button
                      disabled={alreadyInList}
                      onClick={() => handleAddTrack(trk)}
                      className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
                        alreadyInList
                          ? 'bg-white/10 text-white/40 cursor-default'
                          : 'bg-white text-black hover:bg-[#1ed760]'
                      }`}
                    >
                      {alreadyInList ? '✓ Añadida' : 'Añadir'}
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Options Bottom Sheet Modal (Portaled to body to fix positioning) */}
      {typeof document !== 'undefined' && isOptionsOpen && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/80 backdrop-blur-sm animate-in fade-in select-none"
          onClick={() => setIsOptionsOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-[#181818] rounded-t-3xl p-6 pb-9 space-y-4 shadow-[0_-10px_40px_rgba(0,0,0,0.85)] border-t border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 rounded-full bg-white/20 mx-auto -mt-1 mb-2" />

            <div className="flex items-center gap-3 pb-3 border-b border-white/10">
              <img
                src={coverUrl || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'}
                alt={playlist.name}
                className="w-12 h-12 rounded object-cover shadow"
              />
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-white text-sm truncate">{playlist.name}</span>
                <span className="text-xs text-[#b3b3b3] truncate">{playlist.owner?.display_name || 'Spotify'}</span>
              </div>
            </div>

            <div className="space-y-1">
              {/* Option: Compartir */}
              <button
                onClick={() => {
                  setIsOptionsOpen(false);
                  handleSharePlaylist();
                }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors text-left cursor-pointer"
              >
                <ShareNativeIcon size={20} className="text-white" />
                <span className="font-bold text-white text-sm">Compartir playlist</span>
              </button>

              {/* Option: Guardar en biblioteca */}
              <button
                onClick={() => {
                  handleToggleLibrary();
                  setIsOptionsOpen(false);
                  setToastMessage(isSavedInLibrary ? 'Eliminada de tu biblioteca' : 'Añadida a tu biblioteca');
                  setTimeout(() => setToastMessage(null), 2500);
                }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors text-left cursor-pointer"
              >
                {isSavedInLibrary ? (
                  <CheckTrackNativeIcon size={20} className="text-[#1ed760]" />
                ) : (
                  <AddTrackNativeIcon size={20} className="text-white" />
                )}
                <span className="font-bold text-white text-sm">
                  {isSavedInLibrary ? 'Eliminar de tu biblioteca' : 'Añadir a tu biblioteca'}
                </span>
              </button>

              {/* Option: Editar playlist */}
              {cleanId !== 'liked-songs' && cleanId !== 'collection:tracks' && (
                <button
                  onClick={() => {
                    setIsOptionsOpen(false);
                    setIsEditModalOpen(true);
                  }}
                  className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors text-left cursor-pointer"
                >
                  <EditNativeIcon size={20} className="text-white" />
                  <span className="font-bold text-white text-sm">Editar detalles de la playlist</span>
                </button>
              )}

              {/* Option: Copiar enlace */}
              <button
                onClick={async () => {
                  setIsOptionsOpen(false);
                  const shareUrl = `${window.location.origin}/?playlist=${encodeURIComponent(cleanId)}`;
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    setToastMessage('¡Enlace copiado al portapapeles!');
                  } catch {
                    setToastMessage('Enlace listo');
                  }
                  setTimeout(() => setToastMessage(null), 2500);
                }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors text-left cursor-pointer"
              >
                <ShareNativeIcon size={20} className="text-white" />
                <span className="font-bold text-white text-sm">Copiar enlace</span>
              </button>

              {/* Option: Eliminar playlist (sin window.confirm modal) */}
              {cleanId !== 'liked-songs' && cleanId !== 'collection:tracks' && (
                <div>
                  {!isConfirmDeleteOpen ? (
                    <button
                      onClick={() => setIsConfirmDeleteOpen(true)}
                      className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-red-500/10 active:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors text-left cursor-pointer"
                    >
                      <TrashNativeIcon size={20} />
                      <span className="font-bold text-sm">Eliminar playlist</span>
                    </button>
                  ) : (
                    <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl space-y-2 mt-1">
                      <p className="text-xs text-white/90 font-medium">
                        ¿Seguro que deseas eliminar «{activePlaylist.name}» de tu biblioteca?
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setIsConfirmDeleteOpen(false);
                            setIsOptionsOpen(false);
                            deletePlaylist(activePlaylist.id);
                            onBack();
                          }}
                          className="flex-1 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
                        >
                          Eliminar
                        </button>
                        <button
                          onClick={() => setIsConfirmDeleteOpen(false)}
                          className="flex-1 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={() => setIsOptionsOpen(false)}
              className="w-full py-3 rounded-full bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider mt-2 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Track 3-Dots Action Sheet */}
      {activeTrackMenu && createPortal(
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex flex-col justify-end animate-fadeIn select-none"
          onClick={() => setActiveTrackMenu(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#242424] rounded-t-3xl max-h-[85vh] overflow-y-auto p-5 pb-8 space-y-4 shadow-2xl border-t border-white/10"
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-2" />

            {/* Track Info Header */}
            <div className="flex items-center gap-3.5 pb-3 border-b border-white/10">
              <img
                src={getTrackCoverUrl(activeTrackMenu)}
                alt={activeTrackMenu.name}
                onError={handleImageError}
                className="w-12 h-12 rounded-[4px] object-cover shadow bg-[#181818] shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-base truncate">{activeTrackMenu.name}</p>
                <p className="text-xs text-[#b3b3b3] truncate mt-0.5">
                  {activeTrackMenu.artists?.map((a) => a.name).join(', ') || 'Artista'}
                </p>
              </div>
            </div>

            {/* Track Actions */}
            <div className="space-y-1">
              <button
                onClick={() => {
                  toggleLike(activeTrackMenu.id, activeTrackMenu);
                  setActiveTrackMenu(null);
                }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 active:bg-white/15 text-left text-white"
              >
                {isTrackLiked(activeTrackMenu.id) ? (
                  <CheckTrackNativeIcon size={22} className="text-[#1ed760] shrink-0" />
                ) : (
                  <AddTrackNativeIcon size={22} className="text-white/80 shrink-0" />
                )}
                <span className="font-bold text-sm">
                  {isTrackLiked(activeTrackMenu.id)
                    ? 'Eliminar de Canciones que te gustan'
                    : 'Añadir a Canciones que te gustan'}
                </span>
              </button>

              <button
                onClick={() => {
                  usePlayerStore.getState().addToQueue(activeTrackMenu);
                  setActiveTrackMenu(null);
                  setToastMessage('Añadido a la cola');
                  setTimeout(() => setToastMessage(null), 2500);
                }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 active:bg-white/15 text-left text-white"
              >
                <QueueNativeIcon size={22} className="text-white/80 shrink-0" />
                <span className="font-bold text-sm">Añadir a la cola</span>
              </button>

              <button
                onClick={() => {
                  setIsAddToPlaylistModalOpen(true);
                }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 active:bg-white/15 text-left text-white"
              >
                <PlusCircleNativeIcon size={22} className="text-white/80 shrink-0" />
                <span className="font-bold text-sm">Añadir a otra playlist</span>
              </button>

              <button
                onClick={() => {
                  setActiveTrackMenu(null);
                  if (navigator.share) {
                    navigator.share({
                      title: activeTrackMenu.name,
                      text: `Escucha ${activeTrackMenu.name} en Spotifree`,
                      url: window.location.href,
                    }).catch(() => {});
                  } else {
                    navigator.clipboard?.writeText(window.location.href);
                    setToastMessage('Enlace copiado al portapapeles');
                    setTimeout(() => setToastMessage(null), 2500);
                  }
                }}
                className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-white/10 active:bg-white/15 text-left text-white"
              >
                <ShareNativeIcon size={20} className="text-white/80 shrink-0" />
                <span className="font-bold text-sm">Compartir canción</span>
              </button>

              {cleanId !== 'liked-songs' && (
                <button
                  onClick={() => {
                    handleRemoveTrackFromPlaylist(activeTrackMenu.id);
                    setActiveTrackMenu(null);
                  }}
                  className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl hover:bg-red-500/10 active:bg-red-500/20 text-left text-red-400"
                >
                  <TrashNativeIcon size={20} className="shrink-0" />
                  <span className="font-bold text-sm">Eliminar de esta playlist</span>
                </button>
              )}
            </div>

            <button
              onClick={() => setActiveTrackMenu(null)}
              className="w-full py-3 rounded-full bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider mt-2 cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Add To Playlist Picker Modal */}
      {isAddToPlaylistModalOpen && activeTrackMenu && createPortal(
        <div
          className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-md flex flex-col justify-end select-none"
          onClick={() => setIsAddToPlaylistModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#242424] rounded-t-3xl max-h-[75vh] overflow-y-auto p-5 pb-8 space-y-4 shadow-2xl border-t border-white/10"
          >
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-2" />
            <h3 className="text-base font-bold text-white text-center">Añadir a una playlist</h3>
            <div className="space-y-1">
              {allUserPlaylists
                .filter((p) => p.id !== activePlaylist.id && p.id !== 'liked-songs')
                .map((targetPl) => (
                  <button
                    key={targetPl.id}
                    onClick={() => {
                      saveCustomTrackToStorage(targetPl.id, false, activeTrackMenu, user?.id);

                      // Update in-memory playlist tracks and cache immediately
                      const store = useSpotifyDataStore.getState();
                      const currentPl = store.playlists.find((p) => p.id === targetPl.id);
                      if (currentPl) {
                        const existingItems = currentPl.tracks?.items || [];
                        if (!existingItems.some((t) => t.id === activeTrackMenu.id)) {
                          const newItems = [activeTrackMenu, ...existingItems];
                          const updatedPl = {
                            ...currentPl,
                            tracks: { total: newItems.length, items: newItems },
                          };
                          useSpotifyDataStore.setState((s) => ({
                            playlists: s.playlists.map((p) => (p.id === targetPl.id ? updatedPl : p)),
                            playlistDetailsCache: {
                              ...s.playlistDetailsCache,
                              [targetPl.id]: updatedPl,
                            },
                          }));
                        }
                      }

                      setIsAddToPlaylistModalOpen(false);
                      setActiveTrackMenu(null);
                      setToastMessage(`Añadido a «${targetPl.name}»`);
                      setTimeout(() => setToastMessage(null), 2500);
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors text-left"
                  >
                    <img
                      src={targetPl.images?.[0]?.url || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'}
                      alt={targetPl.name}
                      onError={handleImageError}
                      className="w-10 h-10 rounded-[4px] object-cover bg-[#181818] shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-white truncate">{targetPl.name}</p>
                      <p className="text-xs text-[#b3b3b3] truncate">Playlist</p>
                    </div>
                  </button>
                ))}
            </div>
            <button
              onClick={() => setIsAddToPlaylistModalOpen(false)}
              className="w-full py-3 rounded-full bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider mt-2 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Playlist Modal */}
      {isEditModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[125] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none"
          onClick={() => setIsEditModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#282828] rounded-2xl p-6 shadow-2xl border border-white/10 space-y-4"
          >
            <h3 className="text-lg font-bold text-white text-center">Editar información</h3>

            {/* Cover image preview & URL */}
            <div className="flex flex-col items-center gap-2">
              <img
                src={editCover || activePlaylist.images?.[0]?.url || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'}
                alt="Carátula"
                onError={handleImageError}
                className="w-28 h-28 rounded-lg object-cover shadow-lg border border-white/10 bg-[#181818]"
              />
              <input
                type="text"
                value={editCover}
                onChange={(e) => setEditCover(e.target.value)}
                placeholder="URL de imagen de portada..."
                className="w-full text-xs bg-[#181818] border border-white/15 focus:border-[#1ed760] rounded-lg p-2.5 text-white placeholder:text-[#888] outline-none"
              />
            </div>

            {/* Name */}
            <div>
              <label className="text-xs text-[#b3b3b3] font-semibold block mb-1">Nombre</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nombre de la playlist..."
                className="w-full text-sm bg-[#181818] border border-white/15 focus:border-[#1ed760] rounded-lg p-2.5 text-white placeholder:text-[#888] outline-none font-bold"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-[#b3b3b3] font-semibold block mb-1">Descripción</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={2}
                placeholder="Añade una descripción opcional..."
                className="w-full text-xs bg-[#181818] border border-white/15 focus:border-[#1ed760] rounded-lg p-2.5 text-white placeholder:text-[#888] outline-none resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-bold text-xs uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePlaylistEdit}
                className="flex-1 py-2.5 rounded-full bg-[#1ed760] hover:scale-103 active:scale-95 text-black font-bold text-xs uppercase tracking-wider shadow-lg"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Interactive DJ Transition Editor Modal (✦ Automática) */}
      {transitionModalPair && typeof document !== 'undefined' && createPortal(
        <TransitionEditorModal
          isOpen={!!transitionModalPair}
          onClose={() => setTransitionModalPair(null)}
          trackA={transitionModalPair.trackA}
          trackB={transitionModalPair.trackB}
          onSaved={() => {
            setToastMessage('✦ Transición DJ guardada correctamente');
            setTimeout(() => setToastMessage(null), 3000);
          }}
        />,
        document.body
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[120] max-w-[90vw] text-center px-5 py-2.5 rounded-full bg-white text-black font-bold text-xs shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toastMessage}
        </div>
      )}
    </div>
  );
};
