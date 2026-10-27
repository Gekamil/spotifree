import React, { useState, useEffect } from 'react';
import type { Playlist, Track } from '../../types/spotify';
import {
  PlayNativeIcon,
  PauseNativeIcon,
  ShuffleNativeIcon,
} from '../icons/SpotifyNativeIcons';
import { ClockIcon } from '../icons/SpotifyIcons';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { formatDuration } from '../../utils/formatters';

const TRACK_COVER_CACHE = new Map<string, string>();

if (typeof window !== 'undefined') {
  try {
    const saved = window.localStorage.getItem('spotifree_track_covers');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.entries(parsed).forEach(([k, v]) => {
        if (typeof v === 'string') TRACK_COVER_CACHE.set(k, v);
      });
    }
  } catch {}
}

function persistTrackCover(id: string, url: string) {
  TRACK_COVER_CACHE.set(id, url);
  if (typeof window !== 'undefined') {
    try {
      const obj: Record<string, string> = {};
      let count = 0;
      for (const [k, v] of TRACK_COVER_CACHE.entries()) {
        obj[k] = v;
        if (++count > 1000) break;
      }
      window.localStorage.setItem('spotifree_track_covers', JSON.stringify(obj));
    } catch {}
  }
}

function toHDImage(url: string): string {
  if (!url) return url;
  return url;
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
  const initialTracks = (playlist.tracks?.items || []).map((t) => {
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

  useEffect(() => {
    let cancelled = false;
    const mapped = (playlist.tracks?.items || []).map((t) => {
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

  // Asynchronously resolve individual album covers for all tracks in chunks of 20
  useEffect(() => {
    if (!dynamicTracks || dynamicTracks.length === 0) return;
    let cancelled = false;

    const playlistCover = dynamicPlaylist.images?.[0]?.url;
    const tracksToResolve = dynamicTracks.filter((t) => {
      const isSpotifyId = /^[0-9a-zA-Z]{22}$/.test(t.id);
      if (!isSpotifyId) return false;
      const currentCover = t.album?.images?.[0]?.url;
      const isSameAsPlaylist = currentCover && playlistCover && currentCover === playlistCover;
      return !currentCover || isSameAsPlaylist || !TRACK_COVER_CACHE.has(t.id);
    });

    if (tracksToResolve.length === 0) return;

    const chunkSize = 20;
    const runAllChunks = async () => {
      for (let i = 0; i < tracksToResolve.length; i += chunkSize) {
        if (cancelled) break;
        const chunk = tracksToResolve.slice(i, i + chunkSize);
        const results = await Promise.allSettled(
          chunk.map(async (t) => {
            if (TRACK_COVER_CACHE.has(t.id)) {
              return { id: t.id, cover: TRACK_COVER_CACHE.get(t.id)! };
            }
            try {
              const res = await fetch(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${t.id}`);
              if (res.ok) {
                const json = await res.json();
                if (json.thumbnail_url) {
                  const hd = toHDImage(json.thumbnail_url);
                  persistTrackCover(t.id, hd);
                  return { id: t.id, cover: hd };
                }
              }
            } catch {}
            return null;
          })
        );

        if (cancelled) break;
        const updates = new Map(
          results
            .filter((r): r is PromiseFulfilledResult<{ id: string; cover: string } | null> => r.status === 'fulfilled' && !!r.value)
            .map((r) => [r.value!.id, r.value!.cover])
        );

        if (updates.size > 0) {
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
        }
      }
    };

    runAllChunks();

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

  // Determine dominant theme color
  const themeColor =
    dynamicPlaylist.color ||
    (isLikedPlaylist ? '#5018F0' : '#282828');

  return (
    <div className="select-none min-h-full pb-20 relative bg-[#121212]">
      {/* Dynamic Reactive Hero Header with smooth gradient */}
      <div
        className="px-8 pt-8 pb-6 flex items-end gap-6 relative transition-colors duration-500"
        style={{
          background: `linear-gradient(180deg, ${themeColor} 0%, ${themeColor}cc 65%, #121212 100%)`,
        }}
      >
        {/* Cover Art 232x232 */}
        <div
          onClick={() => isUserCreatedPlaylist && openEditPlaylistModal(dynamicPlaylist)}
          className={`w-56 h-56 shrink-0 shadow-2xl rounded-[4px] overflow-hidden bg-[#282828] relative ${
            isUserCreatedPlaylist ? 'group cursor-pointer' : ''
          }`}
          title={isUserCreatedPlaylist ? "Elegir foto" : undefined}
        >
          {isLikedPlaylist ? (
            <img
              src="https://misc.scdn.co/liked-songs/liked-songs-640.jpg"
              alt="Canciones que te gustan"
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
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="text-xs font-bold text-white capitalize">
            {dynamicPlaylist.id.includes('37i9dQZF1DX2EiUAL7Wdfc') || dynamicPlaylist.name.toLowerCase() === 'míticas'
              ? 'Playlist'
              : isArtist
              ? 'Artista'
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

          {/* Green checkmark circle button (✓) - Hidden on system lists, user lists, and folders */}
          {!isLikedPlaylist && !isUserCreatedPlaylist && !isFolder && (
            <button
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#1ed760] hover:scale-106 transition-all"
              title="Guardada en Tu biblioteca"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1 12C1 5.925 5.925 1 12 1s11 4.925 11 11-4.925 11-11 11S1 18.075 1 12m16.398-2.38a1 1 0 0 0-1.414-1.413l-6.011 6.01-1.894-1.893a1 1 0 0 0-1.414 1.414l3.308 3.308z" />
              </svg>
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
        {/* Table Header */}
        <div className="grid grid-cols-[20px_4fr_3fr_2fr_minmax(80px,1fr)] gap-4 px-4 py-2 border-b border-white/10 text-xs font-semibold text-[#b3b3b3] uppercase tracking-wider mb-2">
          <span>#</span>
          <span>Título</span>
          <span>Álbum</span>
          <span>Fecha en la que se añadió</span>
          <div className="flex justify-end pr-8">
            <ClockIcon size={16} />
          </div>
        </div>

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

        {/* Track Rows */}
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
                    src={
                      track.album?.images?.[0]?.url ||
                      (dynamicPlaylist.images?.[0]?.url && !dynamicPlaylist.images[0].url.includes('liked-songs')
                        ? dynamicPlaylist.images[0].url
                        : isLikedPlaylist
                        ? 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'
                        : '')
                    }
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
                      toggleLike(track.id);
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
      </div>
    </div>
  );
};
