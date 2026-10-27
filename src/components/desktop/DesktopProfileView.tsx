import React from 'react';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import type { Playlist } from '../../types/spotify';
import { PlayNativeIcon } from '../icons/SpotifyNativeIcons';

interface DesktopProfileViewProps {
  onSelectPlaylist?: (playlist: Playlist) => void;
}

export const DesktopProfileView: React.FC<DesktopProfileViewProps> = ({ onSelectPlaylist }) => {
  const { user, playlists } = useSpotifyDataStore();

  const userPlaylists = playlists.filter(
    (p) => !p.id.includes('collection:tracks') && p.id !== 'liked-songs' && p.type !== 'folder'
  );

  const avatarUrl = user?.images?.[0]?.url;
  const displayName = user?.display_name || 'Usuario de Spotify';
  const followersCount = user?.followers?.total || 0;

  return (
    <div className="select-none min-h-full pb-20 relative bg-[#121212] font-['SpotifyMixUI']">
      {/* Ambient Gradient Header */}
      <div
        className="px-8 pt-16 pb-8 flex items-end gap-6 relative"
        style={{
          background: 'linear-gradient(180deg, #535353 0%, #282828 60%, #121212 100%)',
        }}
      >
        {/* User Big Circular Avatar */}
        <div className="w-52 h-52 rounded-full overflow-hidden shrink-0 shadow-2xl bg-[#282828] border-4 border-black/20 flex items-center justify-center">
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
        <div className="flex flex-col gap-2 min-w-0 pb-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Perfil
          </span>
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight truncate font-['SpotifyMixUITitle']">
            {displayName}
          </h1>
          <div className="flex items-center gap-2 text-sm text-[#b3b3b3] mt-2 font-medium">
            <span className="text-white font-semibold">{userPlaylists.length} listas públicas</span>
            <span>•</span>
            <span>{followersCount} seguidores</span>
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="px-8 py-6 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">Listas públicas</h2>
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
