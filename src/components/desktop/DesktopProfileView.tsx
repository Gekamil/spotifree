import React, { useState } from 'react';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { useStatsStore } from '../../store/useStatsStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import type { Playlist, Track } from '../../types/spotify';
import { PlayNativeIcon } from '../icons/SpotifyNativeIcons';
import { formatDuration } from '../../utils/formatters';
import { resolveVibrantColor } from '../../utils/spotifyColor';

interface DesktopProfileViewProps {
  onSelectPlaylist?: (playlist: Playlist) => void;
  onSelectArtist?: (artistName: string) => void;
}

const ProfileArtistCard: React.FC<{
  artist: any;
  idx: number;
  onClick?: () => void;
}> = ({ artist, idx, onClick }) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      onClick={onClick}
      className="p-4 rounded-lg bg-[#181818] hover:bg-[#282828] transition-all cursor-pointer group flex flex-col items-center text-center shadow-md hover:shadow-xl relative"
    >
      <div className="w-28 h-28 rounded-full overflow-hidden mb-3 relative shadow-lg bg-[#242424] flex items-center justify-center">
        {!imgFailed && artist.image ? (
          <img
            src={artist.image}
            alt={artist.name}
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#5018f0] to-[#1ed760] flex items-center justify-center text-black font-black text-2xl shadow">
            {(artist.name || 'A').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/70 text-[#1ed760] font-black text-xs flex items-center justify-center">
          #{idx + 1}
        </div>
      </div>
      <span className="font-bold text-white text-sm truncate w-full">
        {artist.name}
      </span>
      <span className="text-xs text-[#b3b3b3] mt-1">Artista</span>
    </div>
  );
};

export const DesktopProfileView: React.FC<DesktopProfileViewProps> = ({
  onSelectPlaylist,
  onSelectArtist,
}) => {
  const { user, playlists } = useSpotifyDataStore();
  const { totalSeconds, totalTracksPlayed, getTopArtists, getTopTracks } = useStatsStore();
  const { playTrack } = usePlayerStore();

  const userPlaylists = playlists.filter(
    (p) => !p.id.includes('collection:tracks') && p.id !== 'liked-songs' && p.type !== 'folder'
  );

  const topArtists = getTopArtists(6);
  const topTracks = getTopTracks(5);

  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = (totalMinutes / 60).toFixed(1);

  const avatarUrl = user?.images?.[0]?.url;
  const displayName = user?.display_name || 'Usuario de Spotify';
  const followersCount = user?.followers?.total || 0;
  const profileColor = resolveVibrantColor(user?.id || 'profile', displayName);

  const handleTrackClick = (trk: any) => {
    const trackObj: Track = {
      id: trk.id,
      name: trk.name,
      duration_ms: trk.duration_ms || 180000,
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
          background: `linear-gradient(180deg, ${profileColor}CC 0%, ${profileColor}44 60%, #121212 100%)`,
        }}
      >
        {/* Glow */}
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-35 blur-3xl pointer-events-none"
          style={{ backgroundColor: profileColor }}
        />

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
            <span className="text-[#1ed760] font-bold">
              {Number(totalHours) > 0 ? `${totalHours} horas escuchadas` : `${totalMinutes} min escuchados`}
            </span>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="px-8 py-8 space-y-10">
        {/* Real Listening Stats Card */}
        <div className="p-6 rounded-2xl bg-[#181818] border border-white/5 shadow-xl flex items-center justify-around flex-wrap gap-4">
          <div className="text-center">
            <span className="text-3xl font-black text-white font-['SpotifyMixUITitle'] block">
              {totalHours} h
            </span>
            <span className="text-xs text-[#b3b3b3] font-semibold">Tiempo en música</span>
          </div>
          <div className="h-10 w-px bg-white/10 hidden sm:block" />
          <div className="text-center">
            <span className="text-3xl font-black text-[#1ed760] font-['SpotifyMixUITitle'] block">
              {totalTracksPlayed}
            </span>
            <span className="text-xs text-[#b3b3b3] font-semibold">Canciones reproducidas</span>
          </div>
          <div className="h-10 w-px bg-white/10 hidden sm:block" />
          <div className="text-center">
            <span className="text-3xl font-black text-white font-['SpotifyMixUITitle'] block">
              {topArtists.length}
            </span>
            <span className="text-xs text-[#b3b3b3] font-semibold">Artistas escuchados</span>
          </div>
        </div>

        {/* 1. Artistas más escuchados */}
        {topArtists.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white font-['SpotifyMixUITitle']">
                  Artistas más escuchados
                </h2>
                <p className="text-xs text-[#b3b3b3]">Visibles solo para ti en base a tu escucha real</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {topArtists.map((artist, idx) => (
                <ProfileArtistCard
                  key={artist.id || idx}
                  artist={artist}
                  idx={idx}
                  onClick={() => onSelectArtist?.(artist.name)}
                />
              ))}
            </div>
          </div>
        )}

        {/* 2. Canciones más escuchadas */}
        {topTracks.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white font-['SpotifyMixUITitle']">
                  Canciones más escuchadas
                </h2>
                <p className="text-xs text-[#b3b3b3]">Tus temas reproducidos recientemente</p>
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
                    <span className="text-xs text-[#b3b3b3] font-mono pr-4">
                      {formatDuration(180000)}
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
        )}

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
