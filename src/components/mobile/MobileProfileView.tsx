import React, { useState } from 'react';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { useStatsStore } from '../../store/useStatsStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import type { Playlist, Track } from '../../types/spotify';
import { resolveVibrantColor } from '../../utils/spotifyColor';
import { handleImageError } from '../../utils/imageFallback';
import {
  getSavedAccounts,
  switchActiveAccount,
  saveAccount,
  removeSavedAccount,
  syncUserProfileToServer,
  type SavedAccount,
} from '../../utils/userAccounts';
import { MobileEditProfileModal } from './MobileEditProfileModal';

interface MobileProfileViewProps {
  onBack: () => void;
  onOpenSettings: () => void;
  onSelectPlaylist?: (playlist: Playlist) => void;
}

export const MobileProfileView: React.FC<MobileProfileViewProps> = ({
  onBack,
  onOpenSettings,
  onSelectPlaylist,
}) => {
  const { user, playlists, isAuthenticated, logout } = useSpotifyDataStore();
  const { getTopArtists, getTopTracks } = useStatsStore();
  const { playTrack } = usePlayerStore();
  const { openLoginModal } = useUIStore();

  const activeUserId = user?.id || (typeof window !== 'undefined' ? window.localStorage.getItem('spotifree_active_user_id') : '') || 'default';
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() => getSavedAccounts());
  const [customProfile, setCustomProfile] = useState<{
    displayName?: string;
    avatarUrl?: string;
    bannerUrl?: string;
  }>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = window.localStorage.getItem(`spotifree_custom_profile_${activeUserId}`) || window.localStorage.getItem('spotifree_custom_profile');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Sync profile when active user changes
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const targetId = user?.id || activeUserId;
      const saved = window.localStorage.getItem(`spotifree_custom_profile_${targetId}`);
      if (saved) {
        setCustomProfile(JSON.parse(saved));
      } else {
        const found = getSavedAccounts().find((a) => a.id === targetId);
        setCustomProfile({
          displayName: found?.displayName || user?.display_name,
          avatarUrl: found?.avatarUrl || user?.images?.[0]?.url,
          bannerUrl: found?.bannerUrl,
        });
      }
    } catch {}
  }, [user?.id, activeUserId]);

  const userPlaylists = playlists.filter(
    (p) => !p.id.includes('collection:tracks') && p.id !== 'liked-songs' && p.type !== 'folder'
  );

  const topArtists = getTopArtists(5);
  const topTracks = getTopTracks(5);

  const avatarUrl = customProfile.avatarUrl || user?.images?.[0]?.url;
  const displayName = customProfile.displayName || user?.display_name || 'Usuario de Spotify';
  const bannerUrl = customProfile.bannerUrl;
  const followersCount = user?.followers?.total || 0;
  const followingCount = (user as any)?.following?.total ?? ((user as any)?.followingCount ?? 0);
  const profileColor = resolveVibrantColor(user?.id || 'profile', displayName);

  const handleSaveProfile = (data: { displayName: string; avatarUrl?: string; bannerUrl?: string }) => {
    setCustomProfile(data);
    const targetId = user?.id || activeUserId;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(`spotifree_custom_profile_${targetId}`, JSON.stringify(data));
        window.localStorage.setItem('spotifree_custom_profile', JSON.stringify(data));
      } catch {}
    }

    const currentCookie = typeof window !== 'undefined' ? window.localStorage.getItem('user_spotify_cookie') || '' : '';

    syncUserProfileToServer({
      userId: targetId,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
      bannerUrl: data.bannerUrl,
      cookie: currentCookie,
    });

    const accounts = getSavedAccounts();
    const existing = accounts.find((a) => a.id === targetId || a.displayName === data.displayName);
    if (existing) {
      saveAccount({
        ...existing,
        displayName: data.displayName || existing.displayName,
        avatarUrl: data.avatarUrl || existing.avatarUrl,
        bannerUrl: data.bannerUrl || existing.bannerUrl,
      });
      setSavedAccounts(getSavedAccounts());
    }
    if (user) {
      useSpotifyDataStore.setState({
        user: {
          ...user,
          display_name: data.displayName,
          images: data.avatarUrl ? [{ url: data.avatarUrl }] : user.images,
          bannerUrl: data.bannerUrl || (user as any).bannerUrl,
        } as any,
      });
    }
  };

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

  const handleSwitchAccount = async (acc: SavedAccount) => {
    if (acc.id === user?.id) return;
    try {
      await switchActiveAccount(acc);
      setSavedAccounts(getSavedAccounts());
    } catch (err) {
      console.error('Error switching account on mobile profile:', err);
    }
  };

  return (
    <div className="select-none min-h-full pb-28 relative bg-[#121212] font-['SpotifyMixUI'] text-white">
      {/* Top Sticky Navigation Bar */}
      <div className="sticky top-0 z-30 px-4 py-3 bg-[#121212]/90 backdrop-blur-md flex items-center justify-between border-b border-white/[0.06]">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white/90 hover:text-white active:scale-90 transition-transform cursor-pointer"
          title="Volver"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>

        <h2 className="text-base font-bold text-white tracking-tight">Perfil</h2>

        <button
          onClick={onOpenSettings}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:text-white active:scale-90 transition-transform cursor-pointer"
          title="Configuración"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
          </svg>
        </button>
      </div>

      {/* Hero Header with Profile Ambient Gradient or Custom Banner */}
      <div
        className="px-6 pt-6 pb-8 flex flex-col items-center text-center relative overflow-hidden"
        style={{
          background: bannerUrl
            ? undefined
            : `linear-gradient(180deg, ${profileColor}88 0%, rgba(18, 18, 18, 0.95) 280px, #121212 100%)`,
        }}
      >
        {bannerUrl && (
          <>
            <img
              src={bannerUrl}
              alt="Banner"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-[#121212]/75 to-[#121212] pointer-events-none" />
          </>
        )}

        {/* Avatar */}
        <div className="w-28 h-28 rounded-full overflow-hidden shadow-2xl bg-[#242424] border-2 border-white/10 flex items-center justify-center shrink-0 z-10">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              onError={handleImageError}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-tr from-[#1ed760] to-[#121212] flex items-center justify-center text-black font-black text-3xl">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Display Name */}
        <h1 className="text-2xl font-black text-white mt-4 font-['SpotifyMixUITitle'] tracking-tight z-10">
          {displayName}
        </h1>

        {/* Followers / Stats */}
        <p className="text-xs text-[#b3b3b3] mt-1.5 font-medium z-10 flex items-center justify-center gap-1.5">
          <span>{followersCount} seguidores</span>
          <span>•</span>
          <span>{followingCount} siguiendo</span>
          {userPlaylists.length > 0 && (
            <>
              <span>•</span>
              <span>{userPlaylists.length} listas</span>
            </>
          )}
        </p>

        {/* Action Pills */}
        <div className="flex items-center justify-center mt-4 z-10">
          <button
            onClick={() => setIsEditingProfile(true)}
            className="px-6 py-2 rounded-full border border-[#727272] hover:border-white text-xs font-bold text-white active:scale-95 transition-all shadow-sm cursor-pointer hover:bg-white/5"
          >
            Editar perfil
          </button>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="px-4 space-y-7">
        {/* SECTION 1: Playlists públicas del usuario */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-black text-white font-['SpotifyMixUITitle']">
              Playlists públicas
            </h3>
            {userPlaylists.length > 0 && (
              <span className="text-xs text-[#b3b3b3]">{userPlaylists.length}</span>
            )}
          </div>

          {userPlaylists.length === 0 ? (
            <div className="py-6 px-4 bg-[#181818] rounded-xl text-center">
              <p className="text-xs text-[#b3b3b3]">No tienes playlists públicas creadas aún.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {userPlaylists.slice(0, 8).map((pl) => {
                const cached = useSpotifyDataStore.getState().playlistDetailsCache[pl.id];
                const count = cached?.tracks?.total || cached?.tracks?.items?.length || pl.tracks?.total || pl.tracks?.items?.length || 0;
                return (
                  <div
                    key={pl.id}
                    onClick={() => onSelectPlaylist && onSelectPlaylist(pl)}
                    className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.03] active:bg-white/[0.1] cursor-pointer transition-colors"
                  >
                    <img
                      src={pl.images?.[0]?.url || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'}
                      alt={pl.name}
                      onError={handleImageError}
                      className="w-12 h-12 rounded-[4px] object-cover bg-[#242424] shadow shrink-0"
                    />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-bold text-white text-sm truncate">{pl.name}</span>
                      <span className="text-xs text-[#b3b3b3] mt-0.5 truncate">
                        Playlist {count > 0 ? `• ${count} canciones` : ''}
                      </span>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-white/40">
                      <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
                    </svg>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 2: Artistas más escuchados */}
        {topArtists.length > 0 && (
          <div>
            <h3 className="text-lg font-black text-white font-['SpotifyMixUITitle'] mb-3">
              Artistas más escuchados este mes
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
              {topArtists.map((artist, idx) => (
                <div
                  key={artist.name}
                  className="w-24 shrink-0 flex flex-col items-center text-center space-y-1.5 cursor-pointer active:scale-95 transition-transform"
                >
                  <div className="w-20 h-20 rounded-full overflow-hidden shadow-lg bg-[#242424] relative border border-white/5">
                    {artist.image ? (
                      <img
                        src={artist.image}
                        alt={artist.name}
                        onError={handleImageError}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#333] flex items-center justify-center font-bold text-white text-lg">
                        {(artist.name || 'A').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-black/80 text-[#1ed760] font-black text-[10px] flex items-center justify-center border border-black">
                      #{idx + 1}
                    </span>
                  </div>
                  <span className="font-bold text-white text-xs truncate w-full">
                    {artist.name}
                  </span>
                  <span className="text-[10px] text-[#b3b3b3]">Artista</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 3: Canciones más escuchadas */}
        {topTracks.length > 0 && (
          <div>
            <h3 className="text-lg font-black text-white font-['SpotifyMixUITitle'] mb-3">
              Canciones más escuchadas este mes
            </h3>
            <div className="space-y-1.5">
              {topTracks.map((trk, idx) => (
                <div
                  key={trk.id}
                  onClick={() => handleTrackClick(trk)}
                  className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.03] active:bg-white/[0.1] cursor-pointer transition-colors"
                >
                  <span className="w-4 text-center font-bold text-xs text-[#b3b3b3]">
                    {idx + 1}
                  </span>
                  <img
                    src={trk.image}
                    alt={trk.name}
                    onError={handleImageError}
                    className="w-11 h-11 rounded-[4px] object-cover bg-[#242424] shadow shrink-0"
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-bold text-white text-sm truncate">{trk.name}</span>
                    <span className="text-xs text-[#b3b3b3] mt-0.5 truncate">{trk.artist}</span>
                  </div>
                  <span className="text-xs text-[#b3b3b3] font-mono shrink-0">
                    {trk.plays} reps
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 4: Conmutador de Cuentas Guardadas */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-black text-white font-['SpotifyMixUITitle']">
              Tus cuentas de Spotify
            </h3>
            <button
              onClick={openLoginModal}
              className="text-xs text-[#1ed760] font-bold hover:underline cursor-pointer"
            >
              + Añadir cuenta
            </button>
          </div>

          <div className="space-y-2">
            {savedAccounts.map((acc) => {
              const isCurrent = acc.id === user?.id;
              return (
                <div
                  key={acc.id}
                  onClick={() => handleSwitchAccount(acc)}
                  className={`flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-white/[0.08] border border-[#1ed760]/30'
                      : 'bg-[#181818] hover:bg-[#222222] active:bg-[#282828]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-[#242424] shrink-0 border border-white/10 flex items-center justify-center">
                      {acc.avatarUrl ? (
                        <img
                          src={acc.avatarUrl}
                          alt={acc.displayName}
                          onError={handleImageError}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-bold text-white text-sm">
                          {acc.displayName.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-white text-sm truncate">
                        {acc.displayName}
                      </span>
                      <span className="text-xs text-[#b3b3b3] truncate">
                        {isCurrent ? 'Cuenta activa' : 'Guardada'}
                      </span>
                    </div>
                  </div>

                  {isCurrent ? (
                    <span className="px-2.5 py-1 rounded-full bg-[#1ed760]/20 text-[#1ed760] text-[11px] font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760]" />
                      Activa
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSwitchAccount(acc);
                        }}
                        className="px-3 py-1 rounded-full border border-white/20 text-xs font-bold text-white hover:border-white active:scale-95 cursor-pointer"
                      >
                        Cambiar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSavedAccount(acc.id);
                          removeSavedAccount(acc.displayName);
                          setSavedAccounts(getSavedAccounts());
                        }}
                        className="p-1.5 rounded-full text-[#b3b3b3] hover:text-red-400 hover:bg-white/10 active:scale-90 transition-colors cursor-pointer"
                        title="Eliminar cuenta guardada"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 5: Botón de Cerrar Sesión */}
        {isAuthenticated && (
          <div className="pt-4 pb-8 flex flex-col items-center">
            <button
              onClick={logout}
              className="px-8 py-3 rounded-full border border-white/30 text-white font-bold text-xs uppercase tracking-wider active:scale-95 hover:border-white transition-all shadow-md cursor-pointer"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>

      <MobileEditProfileModal
        isOpen={isEditingProfile}
        onClose={() => setIsEditingProfile(false)}
        initialDisplayName={displayName}
        initialAvatarUrl={avatarUrl}
        initialBannerUrl={bannerUrl}
        onSave={handleSaveProfile}
      />
    </div>
  );
};
