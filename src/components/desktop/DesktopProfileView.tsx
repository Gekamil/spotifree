import React from 'react';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { useStatsStore } from '../../store/useStatsStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import type { Playlist, Track } from '../../types/spotify';
import { PlayNativeIcon } from '../icons/SpotifyNativeIcons';

interface DesktopProfileViewProps {
  onSelectPlaylist?: (playlist: Playlist) => void;
  onSelectArtist?: (artistName: string) => void;
}

export const DesktopProfileView: React.FC<DesktopProfileViewProps> = ({
  onSelectPlaylist,
  onSelectArtist,
}) => {
  const { user, playlists } = useSpotifyDataStore();
  const { totalSeconds, getTopArtists, getTopTracks, openWrapped } = useStatsStore();
  const { playTrack } = usePlayerStore();

  const userPlaylists = playlists.filter(
    (p) => !p.id.includes('collection:tracks') && p.id !== 'liked-songs' && p.type !== 'folder'
  );

  const topArtists = getTopArtists(6);
  const topTracks = getTopTracks(5);

  const totalMinutes = Math.max(1420, Math.floor(totalSeconds / 60));
  const totalHours = Math.floor(totalMinutes / 60);

  const avatarUrl = user?.images?.[0]?.url;
  const displayName = user?.display_name || 'Usuario de Spotify';
  const followersCount = user?.followers?.total || 0;

  const handleTrackClick = (trk: any) => {
    const trackObj: Track = {
      id: trk.id,
      name: trk.name,
      duration_ms: 180000,
      artists: [{ id: `art-${trk.artist}`, name: trk.artist }],
      album: {
        id: `alb-${trk.id}`,
        name: trk.name,
        images: [{ url: trk.image }],
      },
    };
    playTrack(trackObj);
  };

  return (
    <div className="select-none min-h-full pb-20 relative bg-[#121212] font-['SpotifyMixUI']">
      {/* Ambient Gradient Header */}
      <div
        className="px-8 pt-16 pb-8 flex items-end gap-6 relative overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #5018f0 0%, #281850 60%, #121212 100%)',
        }}
      >
        {/* Glow */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#5018f0] opacity-40 blur-3xl pointer-events-none" />

        {/* User Big Circular Avatar */}
        <div className="w-52 h-52 rounded-full overflow-hidden shrink-0 shadow-2xl bg-[#282828] border-4 border-black/30 flex items-center justify-center relative z-10">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#282828] text-white/60">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
          )}
        </div>

        {/* Profile Metadata */}
        <div className="flex flex-col gap-2 min-w-0 pb-2 relative z-10">
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Perfil
          </span>
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight truncate font-['SpotifyMixUITitle']">
            {displayName}
          </h1>
          <div className="flex items-center gap-3 text-sm text-[#b3b3b3] mt-2 font-medium">
            <span className="text-white font-semibold">{userPlaylists.length} listas públicas</span>
            <span>•</span>
            <span>{followersCount} seguidores</span>
            <span>•</span>
            <span className="text-[#1ed760] font-bold">{totalHours} horas de música</span>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="px-8 py-8 space-y-10">
        {/* Spotify Wrapped 2026 Interactive Card */}
        <div className="relative rounded-2xl p-6 md:p-8 bg-gradient-to-r from-[#5018f0] via-[#9c18a0] to-[#e91429] shadow-2xl overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-lg z-10">
            <span className="text-xs font-black uppercase tracking-widest text-white/80 bg-black/30 px-3 py-1 rounded-full">
              SPOTIFREE WRAPPED
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-white font-['SpotifyMixUITitle'] tracking-tight">
              Tu 2026 en música ya está listo
            </h2>
            <p className="text-sm text-white/90">
              Descubre tus artistas más escuchados, tu canción estrella y tu personalidad sonora en un resumen animado exclusivo.
            </p>
          </div>
          <button
            onClick={openWrapped}
            className="shrink-0 z-10 px-8 py-4 rounded-full bg-white hover:bg-[#1ed760] text-black font-black text-sm tracking-wider uppercase transition-all hover:scale-105 active:scale-95 shadow-2xl cursor-pointer"
          >
            Ver tu Wrapped
          </button>
          {/* Decorative vinyl shape */}
          <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-black/20 pointer-events-none blur-sm" />
        </div>

        {/* 1. Artistas más escuchados (Circular Spotify Style) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white font-['SpotifyMixUITitle']">
                Artistas más escuchados
              </h2>
              <p className="text-xs text-[#b3b3b3]">Visibles solo para ti este mes</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {topArtists.map((artist, idx) => (
              <div
                key={artist.id || idx}
                onClick={() => onSelectArtist?.(artist.name)}
                className="p-4 rounded-lg bg-[#181818] hover:bg-[#282828] transition-all cursor-pointer group flex flex-col items-center text-center shadow-md hover:shadow-xl"
              >
                <div className="w-28 h-28 rounded-full overflow-hidden mb-3 relative shadow-lg bg-[#242424]">
                  <img
                    src={artist.image}
                    alt={artist.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/70 text-[#1ed760] font-black text-xs flex items-center justify-center">
                    #{idx + 1}
                  </div>
                </div>
                <span className="font-bold text-white text-sm truncate w-full">
                  {artist.name}
                </span>
                <span className="text-xs text-[#b3b3b3] mt-1">
                  {Math.floor(artist.minutes)} min escuchados
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Canciones más escuchadas */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white font-['SpotifyMixUITitle']">
                Canciones más escuchadas
              </h2>
              <p className="text-xs text-[#b3b3b3]">Tus temas favoritos en bucle</p>
            </div>
          </div>

          <div className="space-y-1">
            {topTracks.map((track, idx) => (
              <div
                key={track.id || idx}
                onClick={() => handleTrackClick(track)}
                className="group flex items-center justify-between p-2.5 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-sm font-bold text-[#b3b3b3] w-4 text-center group-hover:text-white">
                    {idx + 1}
                  </span>
                  <img
                    src={track.image}
                    alt={track.name}
                    className="w-11 h-11 rounded object-cover shadow"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-white text-sm truncate group-hover:text-[#1ed760] transition-colors">
                      {track.name}
                    </span>
                    <span className="text-xs text-[#b3b3b3] truncate mt-0.5">
                      {track.artist}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-xs text-[#b3b3b3] font-mono">
                    {track.plays} reproducciones
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTrackClick(track);
                    }}
                    className="w-8 h-8 rounded-full bg-[#1ed760] hover:scale-106 text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title={`Reproducir ${track.name}`}
                  >
                    <PlayNativeIcon size={14} className="text-black ml-0.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Listas públicas */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4 font-['SpotifyMixUITitle']">
            Listas públicas
          </h2>
          {userPlaylists.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {userPlaylists.map((pl) => {
                const cover = pl.images?.[0]?.url;
                return (
                  <div
                    key={pl.id}
                    onClick={() => onSelectPlaylist?.(pl)}
                    className="p-3 rounded-md bg-[#181818] hover:bg-[#282828] transition-all cursor-pointer group flex flex-col shadow-sm hover:shadow-xl"
                  >
                    <div className="relative aspect-square w-full rounded-[4px] overflow-hidden mb-3 bg-[#242424] shadow-md">
                      {cover ? (
                        <img
                          src={cover}
                          alt={pl.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#535353]">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                          </svg>
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPlaylist?.(pl);
                        }}
                        className="absolute bottom-2 right-2 w-11 h-11 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 active:scale-95 shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                        title={`Reproducir ${pl.name}`}
                      >
                        <PlayNativeIcon size={18} className="text-black ml-0.5" />
                      </button>
                    </div>
                    <p className="font-bold text-white text-sm truncate">{pl.name}</p>
                    <p className="text-xs text-[#b3b3b3] truncate mt-1">De {displayName}</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[#b3b3b3]">No hay listas públicas todavía.</p>
          )}
        </div>
      </div>
    </div>
  );
};
