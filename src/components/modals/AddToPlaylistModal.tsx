import React, { useState, useEffect, useMemo } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { useLanguageStore, useTranslation } from '../../utils/i18n';
import { saveCustomTrackToStorage } from '../../utils/userStorage';
import { handleImageError } from '../../utils/imageFallback';
import { getPlaylistCover } from '../../utils/playlistCover';
import type { Track, Playlist } from '../../types/spotify';

export const AddToPlaylistModal: React.FC = () => {
  const { isAddToPlaylistModalOpen, trackForAddToPlaylist, closeAddToPlaylistModal } = useUIStore();
  const { likedTrackIds, toggleLike } = usePlayerStore();
  const { playlists, user } = useSpotifyDataStore();
  const { t } = useTranslation();
  const { language } = useLanguageStore();

  const track = trackForAddToPlaylist;

  // Track initially liked state and selected playlist IDs
  const [isLikedState, setIsLikedState] = useState(false);
  const [selectedPlaylistIds, setSelectedPlaylistIds] = useState<Set<string>>(new Set());
  const [initialPlaylistIds, setInitialPlaylistIds] = useState<Set<string>>(new Set());
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newPlaylistTitle, setNewPlaylistTitle] = useState('');
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);

  // Load all user playlists (filtering out non-playlists or duplicates)
  const userPlaylists = useMemo(() => {
    let localPlaylists: Playlist[] = [];
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('user_imported_playlists');
        if (raw) localPlaylists = JSON.parse(raw);
      } catch {}
    }
    const combined = [...playlists, ...localPlaylists];
    const seen = new Set<string>();
    return combined.filter((p) => {
      if (!p || !p.id || p.id === 'liked-songs' || p.id === 'spotify-dj') return false;
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [playlists]);

  // When modal opens with a track, detect current membership across playlists
  useEffect(() => {
    if (!isAddToPlaylistModalOpen || !track) {
      setIsAnimatingIn(false);
      return;
    }

    // Modal open animation
    const raf = requestAnimationFrame(() => setIsAnimatingIn(true));

    // When clicking (+) to add to playlist, Spotify defaults "Canciones que te gustan" to checked:
    setIsLikedState(true);

    const initialMatches = new Set<string>();
    userPlaylists.forEach((pl) => {
      // Check in-memory items
      const hasTrackInMemory = pl.tracks?.items?.some((t) => t.id === track.id);
      // Check localStorage custom tracks
      let hasInLocal = false;
      if (typeof window !== 'undefined') {
        try {
          const targetId = user?.id || 'spotify-user';
          const key = targetId !== 'spotify-user'
            ? `spotifree_playlist_tracks_${targetId}_${pl.id}`
            : `spotifree_playlist_tracks_${pl.id}`;
          const raw = window.localStorage.getItem(key);
          if (raw) {
            const list: Track[] = JSON.parse(raw);
            hasInLocal = list.some((t) => t.id === track.id);
          }
        } catch {}
      }
      if (hasTrackInMemory || hasInLocal) {
        initialMatches.add(pl.id);
      }
    });

    setSelectedPlaylistIds(new Set(initialMatches));
    setInitialPlaylistIds(new Set(initialMatches));
    setIsCreatingNew(false);
    setNewPlaylistTitle('');

    return () => cancelAnimationFrame(raf);
  }, [isAddToPlaylistModalOpen, track, likedTrackIds, userPlaylists, user?.id]);

  if (!isAddToPlaylistModalOpen || !track) return null;

  const handleTogglePlaylist = (playlistId: string) => {
    setSelectedPlaylistIds((prev) => {
      const next = new Set(prev);
      if (next.has(playlistId)) {
        next.delete(playlistId);
      } else {
        next.add(playlistId);
      }
      return next;
    });
  };

  const handleToggleLiked = () => {
    setIsLikedState((prev) => !prev);
  };

  const handleCreateNewPlaylist = () => {
    const finalName = newPlaylistTitle.trim() || `Mi playlist nº ${userPlaylists.length + 1}`;
    const newId = `pl-custom-${Date.now()}`;
    const newPlaylist: Playlist = {
      id: newId,
      name: finalName,
      description: '',
      images: track.album?.images?.[0]?.url ? [{ url: track.album.images[0].url }] : [],
      owner: { display_name: user?.display_name || 'Tú', id: user?.id || 'user' },
      tracks: { total: 1, items: [{ ...track, added_at: track.added_at || 'Hoy' }] },
      is_custom: true,
    } as Playlist;

    // Save to user storage
    saveCustomTrackToStorage(newId, false, track, user?.id);

    // Library + every storage layer + cloud account (same path as "Crear lista")
    useSpotifyDataStore.getState().addCustomPlaylist(newPlaylist);

    // Auto-select this newly created playlist
    setSelectedPlaylistIds((prev) => new Set(prev).add(newId));
    setInitialPlaylistIds((prev) => new Set(prev).add(newId));
    setIsCreatingNew(false);
    setNewPlaylistTitle('');
  };

  const handleSaveAndClose = () => {
    if (!track) {
      closeAddToPlaylistModal();
      return;
    }

    // 1. Commit Liked Songs change if toggled
    const cleanId = (track.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
    const wasLiked =
      likedTrackIds.includes(track.id) ||
      likedTrackIds.includes(cleanId) ||
      likedTrackIds.includes(`spotify:track:${cleanId}`);
    if (isLikedState !== wasLiked) {
      toggleLike(track.id, track);
    }

    // 2. Commit Playlists changes
    selectedPlaylistIds.forEach((plId) => {
      if (!initialPlaylistIds.has(plId)) {
        // Newly added to plId
        saveCustomTrackToStorage(plId, false, track, user?.id);

        const store = useSpotifyDataStore.getState();
        const currentPl = store.playlists.find((p) => p.id === plId);
        if (currentPl) {
          const existing = currentPl.tracks?.items || [];
          if (!existing.some((t) => t.id === track.id)) {
            const updated = [track, ...existing];
            useSpotifyDataStore.getState().updatePlaylist(plId, {
              tracks: { total: updated.length, items: updated },
            });
          }
        }
      }
    });

    initialPlaylistIds.forEach((plId) => {
      if (!selectedPlaylistIds.has(plId)) {
        // Removed from plId: same path as "Quitar de esta lista" (blacklist + all layers + open views)
        useSpotifyDataStore.getState().removeTrackFromPlaylist(plId, track.id, track);
      }
    });

    // Close
    closeAddToPlaylistModal();
  };

  return (
    <div
      className={`fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex flex-col justify-end sm:justify-center sm:items-center select-none transition-opacity duration-300 ${
        isAnimatingIn ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleSaveAndClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-[#181818] w-full sm:w-[440px] rounded-t-3xl sm:rounded-2xl max-h-[82vh] sm:max-h-[640px] flex flex-col shadow-2xl border border-white/10 overflow-hidden transform transition-all duration-350 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isAnimatingIn ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-12 sm:translate-y-4 scale-95 opacity-0'
        }`}
      >
        {/* Top Handle (Mobile only) */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="min-w-0 pr-3">
            <h3 className="text-base font-black text-white font-['SpotifyMixUITitle'] truncate">
              {t('addToPlaylist') || 'Añadir a playlist'}
            </h3>
            <p className="text-xs text-[#a7a7a7] truncate mt-0.5">
              {track.name} • {track.artists?.map((a) => a.name).join(', ')}
            </p>
          </div>
          <button
            onClick={handleSaveAndClose}
            className="px-4 py-1.5 rounded-full bg-white text-black font-black text-xs tracking-wider uppercase hover:scale-105 active:scale-95 transition-transform cursor-pointer shrink-0 shadow-md"
          >
            {t('done') || (language === 'en' ? 'Done' : 'Hecho')}
          </button>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {/* SECTION 1: Canciones que te gustan (Liked Songs) - Separated at top */}
          <div
            onClick={handleToggleLiked}
            className={`flex items-center justify-between p-3 rounded-xl hover:bg-white/10 active:bg-white/15 cursor-pointer transition-colors ${
              isLikedState ? 'bg-white/5' : ''
            }`}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#450af5] to-[#c4efd9] flex items-center justify-center shrink-0 shadow-md">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>
              <div className="truncate">
                <p className="text-sm font-bold text-white truncate font-['SpotifyMixUI']">
                  {t('likedSongs') || 'Canciones que te gustan'}
                </p>
                <p className="text-xs text-[#a7a7a7] truncate mt-0.5">
                  {isLikedState ? 'Guardada en tus Me Gusta' : 'Guardar en tus Me Gusta'}
                </p>
              </div>
            </div>

            {/* Checkmark circle with smooth scale/fade animation */}
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                isLikedState
                  ? 'bg-[#1ed760] text-black scale-100 shadow-[0_0_12px_rgba(30,215,96,0.5)]'
                  : 'border-2 border-white/30 text-transparent scale-90'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>

          {/* Clean divider between Liked Songs and user playlists */}
          <div className="border-t border-white/10 my-2 pt-2 px-1">
            <span className="text-[11px] font-bold text-[#727272] uppercase tracking-wider">
              {t('playlists') || 'Playlists'}
            </span>
          </div>

          {/* SECTION 2: User Playlists list */}
          {userPlaylists.length === 0 ? (
            <div className="text-center py-6 text-sm text-[#727272]">
              No tienes playlists creadas todavía
            </div>
          ) : (
            userPlaylists.map((pl) => {
              const isSelected = selectedPlaylistIds.has(pl.id);
              const coverImg = getPlaylistCover(pl);

              return (
                <div
                  key={pl.id}
                  onClick={() => handleTogglePlaylist(pl.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl hover:bg-white/10 active:bg-white/15 cursor-pointer transition-colors ${
                    isSelected ? 'bg-white/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <img
                      src={coverImg}
                      alt={pl.name}
                      onError={handleImageError}
                      className="w-12 h-12 rounded-lg object-cover bg-[#282828] shrink-0 shadow-sm"
                    />
                    <div className="truncate">
                      <p className={`text-sm font-bold truncate ${isSelected ? 'text-[#1ed760]' : 'text-white'}`}>
                        {pl.name}
                      </p>
                      <p className="text-xs text-[#a7a7a7] truncate mt-0.5">
                        {pl.tracks?.total || 0} canciones
                      </p>
                    </div>
                  </div>

                  {/* Smooth Checkmark indicator */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 ${
                      isSelected
                        ? 'bg-[#1ed760] text-black scale-100 shadow-[0_0_12px_rgba(30,215,96,0.5)]'
                        : 'border-2 border-white/30 text-transparent scale-90'
                    }`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                </div>
              );
            })
          )}

          {/* SECTION 3: Create New Playlist button at bottom of list */}
          <div className="pt-2">
            {!isCreatingNew ? (
              <button
                onClick={() => setIsCreatingNew(true)}
                className="w-full flex items-center gap-3.5 p-3 rounded-xl hover:bg-white/10 active:bg-white/15 text-left text-white transition-colors cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-lg bg-white/10 group-hover:bg-white/20 flex items-center justify-center shrink-0 transition-colors">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <div className="truncate">
                  <p className="text-sm font-bold text-white group-hover:text-[#1ed760] transition-colors">
                    {t('newPlaylist') || 'Nueva playlist'}
                  </p>
                  <p className="text-xs text-[#a7a7a7]">Crear y guardar esta canción</p>
                </div>
              </button>
            ) : (
              <div className="p-3 bg-white/5 rounded-2xl border border-white/15 space-y-3 animate-in fade-in duration-200">
                <input
                  type="text"
                  autoFocus
                  placeholder="Nombre de la nueva playlist..."
                  value={newPlaylistTitle}
                  onChange={(e) => setNewPlaylistTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateNewPlaylist();
                    if (e.key === 'Escape') setIsCreatingNew(false);
                  }}
                  className="w-full bg-[#242424] border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#1ed760] transition-colors"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setIsCreatingNew(false)}
                    className="px-3.5 py-1.5 rounded-full text-xs font-bold text-white/70 hover:text-white cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleCreateNewPlaylist}
                    className="px-4 py-1.5 rounded-full bg-[#1ed760] text-black font-bold text-xs hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                  >
                    Crear y añadir
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer: Prominent bottom "Hecho" button */}
        <div className="p-4 border-t border-white/10 bg-[#141414]">
          <button
            onClick={handleSaveAndClose}
            className="w-full py-3 rounded-full bg-white text-black font-black text-sm tracking-wide hover:scale-[1.02] active:scale-95 transition-transform cursor-pointer shadow-lg"
          >
            {t('done') || (language === 'en' ? 'Done' : 'Hecho')}
          </button>
        </div>
      </div>
    </div>
  );
};
