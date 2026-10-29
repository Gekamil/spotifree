import React, { useState, useEffect } from 'react';
import type { Playlist, Track } from '../../types/spotify';
import {
  PlayNativeIcon,
  PauseNativeIcon,
  ShuffleNativeIcon,
  VerifiedArtistNativeIcon,
} from '../icons/SpotifyNativeIcons';
import { ClockIcon } from '../icons/SpotifyIcons';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { formatDuration } from '../../utils/formatters';
import { resolveVibrantColor } from '../../utils/spotifyColor';
import { getSavedCustomTracks, saveCustomTrackToStorage } from '../../utils/userStorage';
import { audioEngine } from '../../services/audioEngine';

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


const TrackArtwork: React.FC<{
  src?: string;
  alt: string;
}> = ({ src, alt }) => {
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

import { handleImageError } from '../../utils/imageFallback';
import { getTrackCoverUrl, resolveTrackCoversBatch, TRACK_COVER_CACHE } from '../../utils/trackCovers';

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
    isShuffle,
    toggleShuffle,
  } = usePlayerStore();

  const { openContextMenu, openEditPlaylistModal } = useUIStore();
  const user = useSpotifyDataStore((s) => s.user);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [hoveredTrackId, setHoveredTrackId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const isLikedInitially =
    playlist.id === 'liked-songs' ||
    playlist.id === 'tracks' ||
    playlist.id.includes('collection:tracks') ||
    playlist.name?.toLowerCase().trim() === 'canciones que te gustan';

  const customSaved = getSavedCustomTracks(playlist.id, isLikedInitially, user?.id);
  const storePl = useSpotifyDataStore.getState().playlists.find((p) => p.id === playlist.id);
  const baseTracks = (playlist.tracks?.items && playlist.tracks.items.length > 0)
    ? playlist.tracks.items
    : (storePl?.tracks?.items && storePl.tracks.items.length > 0)
    ? storePl.tracks.items
    : customSaved;

  const initialTracks = baseTracks.map((t) => {
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

  const [dynamicTracks, setDynamicTracks] = useState<Track[]>(initialTracks);
  const [dynamicPlaylist, setDynamicPlaylist] = useState<Playlist>(playlist);

  // Library Saved status (+ / ✓)
  const [isSavedInLibrary, setIsSavedInLibrary] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = window.localStorage.getItem('spotifree_saved_library_playlists');
      if (saved) {
        const list: string[] = JSON.parse(saved);
        if (list.includes(playlist.id)) return true;
      }
      const currentLists = useSpotifyDataStore.getState().playlists;
      return currentLists.some((p) => p.id === playlist.id);
    } catch {}
    return false;
  });

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

  // Load popular suggestion hits for empty state
  useEffect(() => {
    let cancelled = false;
    async function loadSuggestions() {
      try {
        const res = await fetch('https://itunes.apple.com/search?term=bad+bunny+feid+quevedo&media=music&entity=song&limit=6');
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
            setAddSearchResults(mapped);
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
      toggleLike(track.id, newTrack);
    }
    saveCustomTrackToStorage(dynamicPlaylist.id, isLikedInitially, newTrack, user?.id);
  };

  useEffect(() => {
    let cancelled = false;
    const currentCustom = getSavedCustomTracks(playlist.id, isLikedInitially, user?.id);
    const sourceTracks = (playlist.tracks?.items && playlist.tracks.items.length > 0)
      ? playlist.tracks.items
      : currentCustom;

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

    setDynamicTracks(mapped);
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

      if (playlist.tracks?.items && playlist.tracks.items.length > 0) return;
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
            const updated: Playlist = {
              ...playlist,
              ...data,
              name: (data.name && data.name !== 'Tu biblioteca' && data.name !== 'Playlist' && !isSlugName) ? data.name : playlist.name,
              description: data.description || playlist.description,
              images: hasInitialHdImage ? playlist.images : (hasValidScrapedImage ? data.images : playlist.images),
              color: data.color || playlist.color,
              owner: data.owner || playlist.owner,
              tracks: data.tracks,
            };
            const hydrated = data.tracks.items.map((t: Track) => {
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
                tracks: data.tracks,
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

  // Asynchronously resolve individual album covers for all tracks in parallel
  useEffect(() => {
    if (!dynamicTracks || dynamicTracks.length === 0) return;
    let cancelled = false;

    const playlistCover = dynamicPlaylist.images?.[0]?.url;
    resolveTrackCoversBatch(dynamicTracks, playlistCover, (updates) => {
      if (cancelled || updates.size === 0) return;
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

  const tracks = dynamicTracks;
  const isLikedPlaylist =
    dynamicPlaylist.id === 'liked-songs' ||
    dynamicPlaylist.id === 'tracks' ||
    dynamicPlaylist.id.includes('collection:tracks') ||
    dynamicPlaylist.name?.toLowerCase().trim() === 'canciones que te gustan';

  const isArtist =
    dynamicPlaylist.id === '3x7gz85amxEplGx7LQxE7Z' ||
    dynamicPlaylist.id === '5lwmRuXgjX8xIwlnauTZIP' ||
    dynamicPlaylist.id === 'romeo-santos' ||
    dynamicPlaylist.description?.toLowerCase() === 'artista' ||
    (dynamicPlaylist as any).type === 'artist' ||
    dynamicPlaylist.id.startsWith('art-');

  const isFolder =
    dynamicPlaylist.id === 'nueva-carpeta' ||
    dynamicPlaylist.description?.toLowerCase().includes('listas');

  const isAlbum =
    dynamicPlaylist.id === '4f0YTBqSbvM1iJpuY9r3yQ' ||
    dynamicPlaylist.id === 'zizi' ||
    (dynamicPlaylist as any).type === 'album' ||
    dynamicPlaylist.id.startsWith('alb-');

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
      dynamicPlaylist.id === '7b3MrCWtettvBKlfBSdorn' ||
      dynamicPlaylist.id === '7HsL4sBaR3dJMa0UJ5e4zG' ||
      dynamicPlaylist.owner?.id === 'user' ||
      dynamicPlaylist.owner?.id === user?.id ||
      dynamicPlaylist.owner?.display_name?.toLowerCase() === (user?.display_name || 'jorgeperezvk').toLowerCase()
    );

  const tracksWithPlaylistId = tracks.map((t) => ({ ...t, playlistId: playlist.id }));

  const isCurrentPlaylistPlaying =
    isPlaying && tracks.some((t) => t.id === currentTrack?.id);

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    if (isCurrentPlaylistPlaying) {
      togglePlay();
    } else {
      playTrack({ ...tracks[0], playlistId: playlist.id }, tracksWithPlaylistId);
    }
  };

  const handleTrackClick = (track: Track) => {
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack({ ...track, playlistId: playlist.id }, tracksWithPlaylistId);
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
  const themeColor = resolveVibrantColor(
    dynamicPlaylist.id,
    dynamicPlaylist.name,
    dynamicPlaylist.color
  );

  return (
    <div className="select-none min-h-full pb-20 relative bg-[#121212]">
      {/* Dynamic Reactive Hero Header with smooth gradient and atmospheric aura */}
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
              src={dynamicPlaylist.images[0].url}
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
                {dynamicPlaylist.description}
              </p>
            )}

            {/* Single unified metadata line matching Real Spotify */}
            <div className="flex items-center gap-1.5 text-sm text-white font-normal mt-2 flex-wrap">
              {dynamicPlaylist.id.includes('37i9dQZF1DX2EiUAL7Wdfc') || dynamicPlaylist.name.toLowerCase() === 'míticas' ? (
                <>
                  <span className="font-bold text-white hover:underline cursor-pointer">Spotify</span>
                  <span>•</span>
                  <span className="text-white/90">guardada 625.055 veces</span>
                  <span>•</span>
                  <span className="text-white/90">
                    {loading
                      ? 'Cargando canciones...'
                      : `${tracks.length} ${tracks.length === 1 ? 'canción' : 'canciones'}, ${formattedDuration}`}
                  </span>
                </>
              ) : dynamicPlaylist.name.toLowerCase().includes('mix diario') || dynamicPlaylist.id.includes('37i9dQZF1E35QYVMBRlDph') ? (
                <>
                  <span className="font-bold text-white hover:underline cursor-pointer">Hecha para Jorgeperezvk</span>
                  <span>•</span>
                  <span className="text-white/90">
                    {loading
                      ? 'Cargando canciones...'
                      : `${tracks.length} ${tracks.length === 1 ? 'canción' : 'canciones'}, ${formattedDuration}`}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-bold text-white hover:underline cursor-pointer">
                    {dynamicPlaylist.owner?.display_name || 'Spotify'}
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
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          {/* Big Green Play/Pause Button */}
          <button
            onClick={handlePlayAll}
            className="w-14 h-14 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 active:scale-96 shadow-lg flex items-center justify-center transition-all duration-200"
            title={isCurrentPlaylistPlaying ? "Pausar" : "Reproducir"}
          >
            {isCurrentPlaylistPlaying ? (
              <PauseNativeIcon size={24} className="text-black" />
            ) : (
              <PlayNativeIcon size={24} className="text-black ml-1" />
            )}
          </button>

          {/* Shuffle button */}
          <button
            onClick={toggleShuffle}
            className={`p-1.5 transition-colors ${
              isShuffle ? 'text-[#1ed760]' : 'text-[#b3b3b3] hover:text-white'
            }`}
            title="Habilitar la reproducción aleatoria"
          >
            <ShuffleNativeIcon size={20} />
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M1 12C1 5.925 5.925 1 12 1s11 4.925 11 11-4.925 11-11 11S1 18.075 1 12m16.398-2.38a1 1 0 0 0-1.414-1.413l-6.011 6.01-1.894-1.893a1 1 0 0 0-1.414 1.414l3.308 3.308z" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8m-4-4h8" />
                </svg>
              )}
            </button>
          )}

          {/* Download button (↓) */}
          <button
            onClick={() => setIsDownloaded(!isDownloaded)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              isDownloaded ? 'text-[#1ed760]' : 'text-[#b3b3b3] hover:text-white'
            }`}
            title={isDownloaded ? "Descargada" : "Descargar"}
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

      {/* Track List Table */}
      <div className="px-8">
        {isArtist && (
          <h2 className="text-2xl font-black text-white font-['SpotifyMixUITitle'] mb-4">
            Populares
          </h2>
        )}
        {/* Table Header - Only rendered when tracks exist */}
        {tracks.length > 0 && (
          <div className="grid grid-cols-[20px_4fr_3fr_2fr_minmax(80px,1fr)] gap-4 px-4 py-2 border-b border-white/10 text-xs font-semibold text-[#b3b3b3] uppercase tracking-wider mb-2">
            <span>#</span>
            <span>Título</span>
            <span>Álbum</span>
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
              <div key={n} className="flex items-center gap-4 px-4 py-2 animate-pulse">
                <div className="w-4 h-4 bg-white/10 rounded" />
                <div className="w-10 h-10 bg-white/10 rounded" />
                <div className="flex-1 space-y-2">
                  <div className="w-1/3 h-3 bg-white/10 rounded" />
                  <div className="w-1/4 h-2 bg-white/5 rounded" />
                </div>
                <div className="w-1/4 h-3 bg-white/5 rounded" />
                <div className="w-12 h-3 bg-white/10 rounded" />
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
              const isLiked = likedTrackIds.includes(track.id);
              const isHovered = hoveredTrackId === track.id;

              return (
                <div
                  key={`${track.id}-${index}`}
                  data-testid="track-row"
                  onMouseEnter={() => setHoveredTrackId(track.id)}
                  onMouseLeave={() => setHoveredTrackId(null)}
                  onClick={() => handleTrackClick(track)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openContextMenu(e.clientX, e.clientY, track.id);
                  }}
                  className={`grid grid-cols-[20px_4fr_3fr_2fr_minmax(80px,1fr)] gap-4 px-4 py-2 rounded-md hover:bg-white/10 cursor-pointer items-center transition-colors group ${
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
                      src={getTrackCoverUrl(track, dynamicPlaylist.images?.[0]?.url)}
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
                      <p className="text-xs text-[#b3b3b3] truncate mt-0.5 group-hover:text-white transition-colors">
                        {track.artists.map((a, aIdx) => (
                          <span
                            key={`${track.id}-art-${aIdx}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectPlaylistById) {
                                onSelectPlaylistById(
                                  `art-${a.name.toLowerCase().replace(/\s+/g, '-')}`,
                                  a.name
                                );
                              }
                            }}
                            className="hover:underline hover:text-white cursor-pointer"
                          >
                            {a.name}
                            {aIdx < track.artists.length - 1 ? ', ' : ''}
                          </span>
                        ))}
                      </p>
                    </div>
                  </div>

                  {/* Album Name */}
                  <div className="text-xs text-[#b3b3b3] truncate group-hover:text-white transition-colors">
                    {track.album?.name || dynamicPlaylist.name}
                  </div>

                  {/* Date Added */}
                  <div className="text-xs text-[#b3b3b3]">
                    {track.added_at || 'Reciente'}
                  </div>

                  {/* Duration + Like Heart */}
                  <div className="flex items-center justify-end gap-3 text-xs text-[#b3b3b3] pr-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLike(track.id, track);
                      }}
                      className={`transition-colors ${
                        isLiked
                          ? 'text-[#1ed760] opacity-100'
                          : 'text-[#b3b3b3] hover:text-white opacity-0 group-hover:opacity-100'
                      }`}
                      title={isLiked ? "Eliminar de Tus me gusta" : "Guardar en Tus me gusta"}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill={isLiked ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth={isLiked ? "0" : "1.5"}
                      >
                        <path d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314z" />
                      </svg>
                    </button>
                    <span className="font-['SpotifyMixUI'] tabular-nums w-10 text-right">
                      {formatDuration(track.duration_ms)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Spotify "Busquemos algo para tu lista" Section (1:1 Spotify Fidelity) */}
      <div className="px-8 pt-8 pb-16 mt-4 border-t border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-xl font-black text-white font-['SpotifyMixUITitle']">
              Busquemos algo para tu lista
            </h3>
            <p className="text-xs text-[#b3b3b3] mt-0.5">
              Busca una canción o añade las recomendaciones populares
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

            return (
              <div
                key={tr.id}
                className="flex items-center justify-between px-3.5 py-2 rounded-md hover:bg-white/10 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                  <TrackArtwork src={tr.album?.images?.[0]?.url} alt={tr.name} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{tr.name}</p>
                    <p className="text-xs text-[#b3b3b3] truncate mt-0.5">
                      {tr.artists.map((a) => a.name).join(', ')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs text-[#b3b3b3] hidden md:block max-w-[180px] truncate">
                    {tr.album?.name}
                  </span>
                  <button
                    disabled={alreadyInList}
                    onClick={() => handleAddTrack(tr)}
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
    </div>
  );
};
