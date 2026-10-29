import React, { useState, useEffect } from 'react';
import type { Playlist, Track } from '../../types/spotify';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { resolveVibrantColor } from '../../utils/spotifyColor';
import {
  PlayNativeIcon,
  PauseNativeIcon,
  AddTrackNativeIcon,
  CheckTrackNativeIcon,
  ShuffleNativeIcon,
  SmartShuffleNativeIcon,
  VerifiedArtistNativeIcon,
} from '../icons/SpotifyNativeIcons';
import { formatDuration } from '../../utils/formatters';
import { searchSpotify } from '../../services/spotifyApi';
import { handleImageError } from '../../utils/imageFallback';
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
    shuffleMode,
    toggleShuffle,
  } = usePlayerStore();
  const { user } = useSpotifyDataStore();

  const isLikedPlaylist =
    playlist.id === 'liked-songs' ||
    playlist.id === 'tracks' ||
    playlist.id.includes('collection:tracks') ||
    playlist.name?.toLowerCase().trim() === 'canciones que te gustan';

  const cleanId = (playlist.id || '')
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
  const [isSavedInLibrary, setIsSavedInLibrary] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = window.localStorage.getItem('spotifree_saved_library_playlists');
      if (saved) {
        const list: string[] = JSON.parse(saved);
        if (list.includes(playlist.id)) return true;
      }
    } catch {}
    return false;
  });

  // Track search state for empty lists
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [addSearchResults, setAddSearchResults] = useState<Track[]>([]);
  const [isSearchingAdd, setIsSearchingAdd] = useState(false);
  const [popularSuggestions, setPopularSuggestions] = useState<Track[]>([]);

  const themeColor = resolveVibrantColor(playlist.id, playlist.name, (playlist as any).color);

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

  // Load tracks accurately if playlist only had stub
  useEffect(() => {
    let cancelled = false;

    // 1. Direct items
    if (playlist.tracks?.items && playlist.tracks.items.length > 0) {
      setTracks(playlist.tracks.items);
      return;
    }

    // 2. Check playlistDetailsCache
    const cached =
      useSpotifyDataStore.getState().playlistDetailsCache[cleanId] ||
      useSpotifyDataStore.getState().playlistDetailsCache[playlist.id];
    if (cached?.tracks?.items && cached.tracks.items.length > 0) {
      setTracks(cached.tracks.items);
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
      setTracks(storePl.tracks.items);
      return;
    }

    // 5. Check custom saved tracks in localStorage
    const savedCustom = getSavedCustomTracks(cleanId, false, user?.id);
    if (savedCustom.length > 0) {
      setTracks(savedCustom);
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
            setTracks(data.tracks.items);
            if (typeof window !== 'undefined') {
              try {
                window.localStorage.setItem(`spotifree_playlist_tracks_${cleanId}`, JSON.stringify(data.tracks.items));
              } catch {}
            }
            useSpotifyDataStore.getState().cachePlaylistDetails({
              ...playlist,
              ...data,
              tracks: data.tracks,
            });
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Backend playlist fetch notice:', err);
      }

      // 7. If it's an artist, resolve artist songs
      const isArtist =
        playlist.type === 'artist' ||
        playlist.description === 'Artista' ||
        cleanId.startsWith('art-') ||
        cleanId.startsWith('artist-');

      if (isArtist) {
        try {
          const cleanArtistName = playlist.name.replace(/^(art-|artist-)/i, '').trim();
          const itunesRes = await fetch(
            `https://itunes.apple.com/search?term=${encodeURIComponent(cleanArtistName)}&media=music&entity=song&limit=25`
          );
          if (itunesRes.ok) {
            const data = await itunesRes.json();
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
              setTracks(artistTracks);
              useSpotifyDataStore.getState().cachePlaylistDetails({
                ...playlist,
                tracks: { total: artistTracks.length, items: artistTracks },
              });
              setLoading(false);
              artistTracks.slice(0, 3).forEach((t) => {
                const q = `${t.name} ${t.artists?.[0]?.name || ''}`.trim();
                audioEngine.prefetchTrack(q, t.id);
              });
              return;
            }
          }
        } catch {}
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
      playTrack(tracks[0], tracks);
    }
  };

  const handleAddTrack = (track: Track) => {
    const trackWithMeta: Track = {
      ...track,
      added_at: 'Hoy',
    };

    setTracks((prev) => {
      if (prev.some((t) => t.id === track.id || (t.name === track.name && t.artists[0]?.name === track.artists[0]?.name))) {
        return prev;
      }
      return [trackWithMeta, ...prev];
    });

    toggleLike(track.id, trackWithMeta);

    if (isLikedPlaylist) {
      saveCustomLikedSong(trackWithMeta, user?.id);
    } else {
      saveCustomTrackToStorage(cleanId, false, trackWithMeta, user?.id);
    }
  };

  const isCurrentPlaylistPlaying =
    isPlaying && tracks.some((t) => t.id === currentTrack?.id);

  const coverUrl =
    isLikedPlaylist
      ? 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'
      : playlist.images?.[0]?.url || tracks[0]?.album?.images?.[0]?.url;

  return (
    <div
      className="select-none min-h-screen text-white font-['SpotifyMixUI'] pb-36 relative overflow-hidden"
      style={{
        backgroundColor: themeColor,
        backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(18,18,18,0.85) 280px, #121212 420px)',
      }}
    >
      {/* Ambient atmospheric aura & glow shine at the top */}
      <div
        className="absolute -top-20 left-1/2 -translate-x-1/2 w-[340px] h-[340px] rounded-full pointer-events-none blur-[90px] opacity-50 z-0"
        style={{ backgroundColor: themeColor }}
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
              onClick={handleToggleLibrary}
              className="w-9 h-9 flex items-center justify-center text-white/80 hover:text-white"
              title={isSavedInLibrary ? 'Guardada en tu biblioteca' : 'Guardar en biblioteca'}
            >
              {isSavedInLibrary ? (
                <CheckTrackNativeIcon size={22} className="text-[#1ed760]" />
              ) : (
                <AddTrackNativeIcon size={22} />
              )}
            </button>
          </div>

          {/* Regular Playlist Hero */}
          <div className="px-6 pt-4 pb-4 flex flex-col items-center text-center">
            <div className="w-52 h-52 rounded-lg overflow-hidden shadow-2xl bg-[#242424] mb-4 border border-white/10">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={playlist.name}
                  onError={handleImageError}
                  className="w-full h-full object-cover"
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
                {playlist.description}
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
        <div className="flex items-center gap-5">
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
              title={isSavedInLibrary ? 'Guardada en tu biblioteca' : 'Añadir a tu biblioteca'}
            >
              {isSavedInLibrary ? (
                <CheckTrackNativeIcon size={26} className="text-[#1ed760]" />
              ) : (
                <AddTrackNativeIcon size={26} className="text-white/80 hover:text-white" />
              )}
            </button>
          )}

          {!isArtist && (
            <button
              className="text-white/70 hover:text-white active:scale-90 transition-transform cursor-pointer"
              title="Descargar"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.59l3.3-3.3-1.42-1.41L13 13.76V6h-2v7.76l-1.88-1.88-1.42 1.41 3.3 3.3a1 1 0 0 0 1.41 0z" />
              </svg>
            </button>
          )}

          <button
            className="text-white/70 hover:text-white active:scale-90 transition-transform cursor-pointer"
            title="Más opciones"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4.5 12a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm9 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm9 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-4">
          {/* Shuffle button */}
          <button
            onClick={toggleShuffle}
            className={`p-2 transition-colors relative flex flex-col items-center active:scale-90 ${
              shuffleMode !== 'off' ? 'text-[#1ed760]' : 'text-white/70 hover:text-white'
            }`}
          >
            {shuffleMode === 'smart' ? (
              <SmartShuffleNativeIcon size={24} className="text-[#1ed760]" />
            ) : (
              <ShuffleNativeIcon size={24} className={shuffleMode === 'all' ? 'text-[#1ed760]' : 'text-white/70'} />
            )}
            {shuffleMode !== 'off' && (
              <span className="absolute bottom-0 w-1 h-1 rounded-full bg-[#1ed760]" />
            )}
          </button>

          {/* Large Green Play Button */}
          <button
            onClick={handlePlayAll}
            className="w-14 h-14 rounded-full bg-[#1ed760] hover:scale-106 active:scale-95 shadow-2xl flex items-center justify-center text-black transition-all"
            title={isCurrentPlaylistPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isCurrentPlaylistPlaying ? (
              <PauseNativeIcon size={24} className="text-black" />
            ) : (
              <PlayNativeIcon size={24} className="text-black ml-1" />
            )}
          </button>
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

              return (
                <div
                  key={track.id || idx}
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
                      {isThisPlaying && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <div className="w-3 h-3 bg-[#1ed760] rounded-full animate-ping" />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span
                        className={`font-bold text-sm truncate ${
                          isThisPlaying ? 'text-[#1ed760]' : 'text-white'
                        }`}
                      >
                        {track.name}
                      </span>
                      <span className="text-xs text-[#b3b3b3] truncate mt-0.5">
                        {isArtist
                          ? `${Math.max(1200000, 1482910293 - idx * 85000000).toLocaleString('es-ES')} reproducciones`
                          : track.artists?.map((a) => a.name).join(', ') || 'Artista'}
                      </span>
                    </div>
                  </div>

                  {/* Right: Like button + duration + options */}
                  <div className="flex items-center gap-3 shrink-0 text-[#b3b3b3]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLike(track.id, track);
                      }}
                      className={`p-1 transition-colors ${isLiked ? 'text-[#1ed760]' : 'text-white/60 hover:text-white'}`}
                      title={isLiked ? 'Eliminar de Tus me gusta' : 'Guardar en Tus me gusta'}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill={isLiked ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        strokeWidth={isLiked ? '0' : '1.5'}
                      >
                        <path d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z" />
                      </svg>
                    </button>
                    <span className="text-xs">{formatDuration(track.duration_ms)}</span>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 hover:text-white"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M3 8a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm6.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm6.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
                      </svg>
                    </button>
                  </div>
                </div>
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
    </div>
  );
};
