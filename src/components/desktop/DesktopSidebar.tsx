import React, { useState } from 'react';
import type { Playlist } from '../../types/spotify';
import {
  CollapseLibraryNativeIcon,
  CreateNativeIcon,
  ExpandLibraryNativeIcon,
  SearchLibraryNativeIcon,
  SortListNativeIcon,
  PinNativeIcon,
} from '../icons/SpotifyNativeIcons';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { useUIStore } from '../../store/useUIStore';
import { CreateMenuDropdown } from './CreateMenuDropdown';
import { SortMenuDropdown } from './SortMenuDropdown';

interface DesktopSidebarProps {
  playlists: Playlist[];
  selectedPlaylistId: string | null;
  onSelectPlaylist: (playlist: Playlist) => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  playlists,
  selectedPlaylistId,
  onSelectPlaylist,
}) => {
  const [filter, setFilter] = useState<'all' | 'playlists' | 'artists'>('all');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');

  const { currentTrack, isPlaying } = usePlayerStore();
  const { isAuthenticated } = useSpotifyDataStore();
  const {
    toggleCreateMenu,
    toggleSortMenu,
    openContextMenu,
    sortOrder,
    viewMode,
  } = useUIStore();

  let processedPlaylists = [...playlists];

  // 1. Filter by Type (Listas / Artistas)
  if (filter === 'playlists') {
    processedPlaylists = processedPlaylists.filter((p) => {
      const isArtist =
        (p as any).type === 'artist' ||
        (p as any).description?.toLowerCase()?.includes('artista') ||
        p.id === '3x7gz85amxEplGx7LQxE7Z' ||
        p.id === '5lwmRuXgjX8xIwlnauTZIP' ||
        p.id.startsWith('art-');
      return !isArtist;
    });
  } else if (filter === 'artists') {
    processedPlaylists = processedPlaylists.filter((p) => {
      const isArtist =
        (p as any).type === 'artist' ||
        (p as any).description?.toLowerCase()?.includes('artista') ||
        p.id === '3x7gz85amxEplGx7LQxE7Z' ||
        p.id === '5lwmRuXgjX8xIwlnauTZIP' ||
        p.id.startsWith('art-');
      return isArtist;
    });
  }

  // 2. Filter by search query
  if (librarySearch.trim()) {
    processedPlaylists = processedPlaylists.filter((p) =>
      p.name.toLowerCase().includes(librarySearch.toLowerCase())
    );
  }

  // 3. Separate pinned playlists (like Canciones que te gustan) so they remain pinned at top
  const pinnedPlaylists = processedPlaylists.filter(
    (p) => (p as any).is_pinned || p.id === 'liked-songs'
  );
  const unpinnedPlaylists = processedPlaylists.filter(
    (p) => !((p as any).is_pinned || p.id === 'liked-songs')
  );

  // 4. Sort unpinned items
  if (sortOrder === 'alfabetico') {
    unpinnedPlaylists.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (sortOrder === 'creador') {
    unpinnedPlaylists.sort((a, b) =>
      (a.owner?.display_name || '').localeCompare(b.owner?.display_name || '')
    );
  } else if (sortOrder === 'anadidos') {
    unpinnedPlaylists.reverse();
  }

  processedPlaylists = [...pinnedPlaylists, ...unpinnedPlaylists];

  const getSortLabel = () => {
    switch (sortOrder) {
      case 'recientes':
        return 'Recientes';
      case 'anadidos':
        return 'Añadidos recientemente';
      case 'alfabetico':
        return 'Orden alfabético';
      case 'creador':
        return 'Creador';
      default:
        return 'Recientes';
    }
  };

  return (
    <aside className="w-[330px] h-full flex flex-col bg-[#121212] rounded-lg select-none shrink-0 text-white relative">
      {/* Header: Tu biblioteca + Crear + Expand */}
      <div className="p-4 pb-2 flex items-center justify-between relative group/sidebar-header">
        <button
          className="flex items-center text-[#b3b3b3] hover:text-white transition-colors duration-200 group/collapse-btn overflow-hidden cursor-pointer"
          title="Contraer Tu biblioteca"
        >
          <span className="w-0 group-hover/sidebar-header:w-6 opacity-0 group-hover/sidebar-header:opacity-100 -translate-x-3 group-hover/sidebar-header:translate-x-0 transition-all duration-200 ease-out flex items-center justify-start overflow-hidden mr-0 group-hover/sidebar-header:mr-1 shrink-0">
            <CollapseLibraryNativeIcon size={18} className="text-[#b3b3b3] group-hover/collapse-btn:text-white transition-colors shrink-0" />
          </span>
          <span className="font-bold text-sm text-[#b3b3b3] group-hover/sidebar-header:text-white transition-colors">Tu biblioteca</span>
        </button>

        <div className="flex items-center gap-1 relative">
          <button
            onClick={toggleCreateMenu}
            title="Crea una lista o una carpeta"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white hover:bg-[#1f1f1f] hover:scale-104 active:scale-95 transition-all"
          >
            <CreateNativeIcon size={16} />
            <span className="text-sm font-bold font-['SpotifyMixUI']">Crear</span>
          </button>

          {/* Create Menu Dropdown */}
          <CreateMenuDropdown />

          <button
            title="Ampliar Tu biblioteca"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#b3b3b3] hover:text-white hover:bg-[#1f1f1f] hover:scale-104 transition-all"
          >
            <ExpandLibraryNativeIcon size={16} />
          </button>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="px-4 py-2 flex items-center gap-2">
        <button
          onClick={() => setFilter(filter === 'playlists' ? 'all' : 'playlists')}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            filter === 'playlists'
              ? 'bg-white text-black'
              : 'bg-[#242424] text-white hover:bg-[#2a2a2a]'
          }`}
        >
          Listas
        </button>
        <button
          onClick={() => setFilter(filter === 'artists' ? 'all' : 'artists')}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
            filter === 'artists'
              ? 'bg-white text-black'
              : 'bg-[#242424] text-white hover:bg-[#2a2a2a]'
          }`}
        >
          Artistas
        </button>
      </div>

      {/* Search & Sort inside Library */}
      <div className="px-4 py-1.5 flex items-center justify-between text-[#b3b3b3] text-xs relative">
        {showSearchInput ? (
          <div className="flex items-center bg-[#242424] rounded px-2 py-1 flex-1 mr-2">
            <SearchLibraryNativeIcon size={14} className="text-[#b3b3b3] mr-1 shrink-0" />
            <input
              type="text"
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              placeholder="Buscar en tu biblioteca"
              autoFocus
              onBlur={() => !librarySearch && setShowSearchInput(false)}
              className="bg-transparent text-white text-xs outline-none w-full"
            />
          </div>
        ) : (
          <button
            onClick={() => setShowSearchInput(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:text-white hover:bg-[#1f1f1f] transition-colors"
            title="Buscar en tu biblioteca"
          >
            <SearchLibraryNativeIcon size={16} />
          </button>
        )}

        {/* Sort Menu Button */}
        <div className="relative">
          <button
            onClick={toggleSortMenu}
            className="flex items-center gap-1.5 hover:text-white font-medium transition-colors py-1 px-2 rounded hover:bg-[#1f1f1f]"
          >
            <span>{getSortLabel()}</span>
            <SortListNativeIcon size={16} className="text-[#b3b3b3]" />
          </button>

          <SortMenuDropdown />
        </div>
      </div>

      {/* Playlists Container */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {!isAuthenticated ? (
          <div className="space-y-2 p-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={`sidebar-shimmer-${i}`}
                className="flex items-center gap-3 p-2 rounded-md animate-pulse"
              >
                <div className="w-12 h-12 rounded bg-[#1f1f1f] shrink-0 aspect-square" />
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="h-4 w-3/4 bg-[#1f1f1f] rounded opacity-70" />
                  <div className="h-3 w-1/2 bg-[#1f1f1f] rounded opacity-50" />
                </div>
              </div>
            ))}
          </div>
        ) : processedPlaylists.length === 0 ? (
          <div className="p-4 text-center text-[#b3b3b3] space-y-2">
            <p className="text-sm font-semibold text-white">Crea tu primera lista</p>
            <p className="text-xs">Es muy fácil, te echaremos una mano.</p>
          </div>
        ) : viewMode === 'cuadricula' || viewMode === 'cuadricula-compacta' ? (
          <div
            className={`grid gap-2 ${
              viewMode === 'cuadricula-compacta' ? 'grid-cols-3' : 'grid-cols-2'
            }`}
          >
            {processedPlaylists.map((playlist) => {
              const isSelected = selectedPlaylistId === playlist.id;
              const isLikedSongs = playlist.id === 'liked-songs';
              const isPlayingThis =
                isPlaying &&
                ((currentTrack as any)?.playlistId
                  ? (currentTrack as any).playlistId === playlist.id
                  : playlist.tracks?.items?.some((t) => t.id === currentTrack?.id));

              return (
                <div
                  key={playlist.id}
                  data-testid={`playlist-item-${playlist.id}`}
                  onClick={() => onSelectPlaylist(playlist)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openContextMenu(e.clientX, e.clientY, undefined, playlist.id);
                  }}
                  className={`p-2 rounded-md cursor-pointer transition-colors group flex flex-col ${
                    isSelected ? 'bg-[#282828]' : 'hover:bg-[#1a1a1a] active:bg-[#121212]'
                  }`}
                >
                  <div className="relative aspect-square w-full rounded overflow-hidden shadow mb-1.5 bg-[#282828]">
                    {isLikedSongs ? (
                      <img
                        src="https://misc.scdn.co/liked-songs/liked-songs-640.jpg"
                        alt="Canciones que te gustan"
                        className="w-full h-full object-cover"
                      />
                    ) : playlist.id === 'nueva-carpeta' ? (
                      <div className="w-full h-full flex items-center justify-center text-[#b3b3b3]">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                        </svg>
                      </div>
                    ) : (
                      <img
                        src={playlist.images[0]?.url}
                        alt={playlist.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    )}

                    {/* Centered play/pause on hover */}
                    {playlist.id !== 'nueva-carpeta' && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        {isPlayingThis ? (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                            <path d="M5.7 3a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7zm10 0a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7z" />
                          </svg>
                        ) : (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                            <path d="M7.05 3.606 20.54 11.394a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606" />
                          </svg>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between w-full">
                    <p
                      className={`text-[14px] font-normal truncate font-['SpotifyMixUI',sans-serif] ${
                        isPlayingThis ? 'text-[#1ed760]' : 'text-white'
                      }`}
                    >
                      {playlist.name}
                    </p>
                    {isPlayingThis && (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-[#1ed760] shrink-0 ml-1">
                        <path d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.64 3.64 0 0 1-1.33-4.967 3.64 3.64 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.14 2.14 0 0 0 0 3.7l5.8 3.35V2.8zm8.683 4.29V5.56a2.75 2.75 0 0 1 0 4.88" />
                        <path d="M11.5 13.614a5.752 5.752 0 0 0 0-11.228v1.55a4.252 4.252 0 0 1 0 8.127z" />
                      </svg>
                    )}
                  </div>
                  {viewMode === 'cuadricula' && (
                    <p className="text-[12px] text-[#b3b3b3] truncate mt-0.5 font-['SpotifyMixUI',sans-serif]">
                      {isLikedSongs ? 'Lista • 23 canciones' : playlist.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Standard list rows (Compacta or Lista) */
          <div className="space-y-0.5">
            {processedPlaylists.map((playlist) => {
              const isSelected = selectedPlaylistId === playlist.id;
              const isLikedSongs = playlist.id === 'liked-songs';
              const isPlayingThis =
                isPlaying &&
                ((currentTrack as any)?.playlistId
                  ? (currentTrack as any).playlistId === playlist.id
                  : playlist.tracks?.items?.some((t) => t.id === currentTrack?.id));

              return (
                <div
                  key={playlist.id}
                  data-testid={`playlist-item-${playlist.id}`}
                  onClick={() => onSelectPlaylist(playlist)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openContextMenu(e.clientX, e.clientY, undefined, playlist.id);
                  }}
                  className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors group ${
                    isSelected
                      ? 'bg-[#282828]'
                      : 'hover:bg-[#1a1a1a] active:bg-[#121212]'
                  } ${viewMode === 'compacta' ? 'py-1' : 'py-2'}`}
                >
                  {/* Thumbnail 48x48 (hidden in compact view mode) */}
                  {viewMode !== 'compacta' && (
                    <div className="relative w-12 h-12 rounded shrink-0 overflow-hidden shadow">
                      {isLikedSongs ? (
                        <img
                          src="https://misc.scdn.co/liked-songs/liked-songs-640.jpg"
                          alt="Canciones que te gustan"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : playlist.id === 'nueva-carpeta' ? (
                        <div className="w-full h-full bg-[#282828] flex items-center justify-center text-[#b3b3b3]">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                          </svg>
                        </div>
                      ) : (
                        <img
                          src={playlist.images[0]?.url}
                          alt={playlist.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      )}

                      {/* Hover Play/Pause Button directly centered on thumbnail */}
                      {playlist.id !== 'nueva-carpeta' && (
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          {isPlayingThis ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                              <path d="M5.7 3a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7zm10 0a.7.7 0 0 0-.7.7v16.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V3.7a.7.7 0 0 0-.7-.7z" />
                            </svg>
                          ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                              <path d="M7.05 3.606 20.54 11.394a.7.7 0 0 1 0 1.212L7.05 20.394A.7.7 0 0 1 6 19.788V4.212a.7.7 0 0 1 1.05-.606" />
                            </svg>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-[16px] font-normal truncate font-['SpotifyMixUI',sans-serif] leading-tight ${
                        isPlayingThis ? 'text-[#1ed760]' : 'text-white'
                      }`}
                    >
                      {playlist.name}
                    </p>
                    <div className="flex items-center gap-1.5 text-[14px] text-[#b3b3b3] mt-0.5 truncate font-['SpotifyMixUI',sans-serif]">
                      {playlist.is_pinned && (
                        <PinNativeIcon size={14} className="text-[#1ed760] shrink-0" />
                      )}
                      <span className="truncate">
                        {isLikedSongs
                          ? 'Lista • 23 canciones'
                          : playlist.description}
                      </span>
                    </div>
                  </div>

                  {/* Playing green speaker icon matching 1:1 real Spotify */}
                  {isPlayingThis && (
                    <span className="text-[#1ed760] shrink-0 ml-auto pr-1 flex items-center" title="Reproduciendo">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#1ed760]">
                        <path d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.64 3.64 0 0 1-1.33-4.967 3.64 3.64 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.14 2.14 0 0 0 0 3.7l5.8 3.35V2.8zm8.683 4.29V5.56a2.75 2.75 0 0 1 0 4.88" />
                        <path d="M11.5 13.614a5.752 5.752 0 0 0 0-11.228v1.55a4.252 4.252 0 0 1 0 8.127z" />
                      </svg>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
