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

interface DesktopPlaylistViewProps {
  playlist: Playlist;
}

export const DesktopPlaylistView: React.FC<DesktopPlaylistViewProps> = ({ playlist }) => {
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
  const [dynamicTracks, setDynamicTracks] = useState<Track[]>(playlist.tracks?.items || []);
  const [dynamicPlaylist, setDynamicPlaylist] = useState<Playlist>(playlist);

  useEffect(() => {
    let cancelled = false;
    setDynamicTracks(playlist.tracks?.items || []);
    setDynamicPlaylist(playlist);

    async function loadTracks() {
      if (playlist.tracks?.items && playlist.tracks.items.length > 0) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/spotify/playlist/${encodeURIComponent(playlist.id)}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.tracks?.items) {
            const isSlugName = data.name && data.name.toLowerCase() === playlist.id.replace(/[-_]/g, ' ').toLowerCase();
            const updated: Playlist = {
              ...playlist,
              ...data,
              name: (data.name && data.name !== 'Tu biblioteca' && data.name !== 'Playlist' && !isSlugName) ? data.name : playlist.name,
              description: data.description || playlist.description,
              images: data.images?.length > 0 ? data.images : playlist.images,
              color: data.color || playlist.color,
              owner: data.owner || playlist.owner,
              tracks: data.tracks,
            };
            setDynamicTracks(data.tracks.items);
            setDynamicPlaylist(updated);
            try {
              useSpotifyDataStore.getState().cachePlaylistDetails(updated);
              useSpotifyDataStore.getState().updatePlaylist(playlist.id, {
                tracks: data.tracks,
                ...(data.images?.length > 0 ? { images: data.images } : {}),
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
          <img
            src={
              isLikedPlaylist
                ? 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'
                : dynamicPlaylist.images?.[0]?.url || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'
            }
            alt={dynamicPlaylist.name}
            className="w-full h-full object-cover shadow-2xl"
          />
          {isUserCreatedPlaylist && (
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 text-white">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14.06 2.94a2.25 2.25 0 0 1 3.18 0l3.82 3.82a2.25 2.25 0 0 1 0 3.18L8.18 22.82a.75.75 0 0 1-.53.22H3a.75.75 0 0 1-.75-.75v-4.65a.75.75 0 0 1 .22-.53L14.06 2.94zm2.12 1.06a.75.75 0 0 0-1.06 0l-1.5 1.5 3.82 3.82 1.5-1.5a.75.75 0 0 0 0-1.06l-2.76-2.76zM12.56 6.56 4.75 14.37v2.88h2.88l7.81-7.81-2.88-2.88z" />
              </svg>
              <span className="text-sm font-bold">Elegir foto</span>
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
                  <img
                    src={track.album?.images?.[0]?.url || dynamicPlaylist.images?.[0]?.url || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'}
                    alt={track.name}
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
                      {track.artists.map((a) => a.name).join(', ')}
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
