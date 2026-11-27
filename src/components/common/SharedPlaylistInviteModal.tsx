import React, { useEffect, useState } from 'react';
import { usePlaylistInviteStore } from '../../store/usePlaylistInviteStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { useUIStore } from '../../store/useUIStore';
import { getAutoPlaylistCover, EMPTY_PLAYLIST_COVER } from '../../utils/playlistCover';
import { showGlobalToast } from '../../utils/globalToast';
import type { Playlist } from '../../types/spotify';

function clearInviteQueryParams() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    let changed = false;
    for (const key of ['collab', 'playlist', 'share']) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) {
      const next = `${url.pathname}${url.search ? url.search : ''}${url.hash || ''}`;
      window.history.replaceState({}, document.title, next || '/');
    }
  } catch {}
}

function navigateToPlaylistView(playlist: Playlist) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('spotifree_open_playlist', { detail: playlist }));
    (window as any).__mobileSelectPlaylist?.(playlist);
    (window as any).__desktopSelectPlaylist?.(playlist);
  }
  useUIStore.getState().setActiveMainTab('playlist');
}

export const SharedPlaylistInviteModal: React.FC = () => {
  const {
    isOpen,
    isLoading,
    isAccepting,
    pendingAcceptAfterAuth,
    collabCode,
    shareCode,
    preview,
    error,
    setAccepting,
    setPendingAcceptAfterAuth,
    closeInvite,
  } = usePlaylistInviteStore();
  const isAuthenticated = useSpotifyDataStore((s) => s.isAuthenticated);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setClosing(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Resume pending import automatically right after the user signs in
  useEffect(() => {
    if (isOpen && pendingAcceptAfterAuth && isAuthenticated && preview && !isAccepting) {
      setPendingAcceptAfterAuth(false);
      void handleAccept();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, pendingAcceptAfterAuth, isAuthenticated, preview]);

  if (!isOpen) return null;

  function handleDismiss() {
    setClosing(true);
    clearInviteQueryParams();
    setTimeout(() => {
      closeInvite();
    }, 150);
  }

  async function handleAccept() {
    if (!preview || isAccepting) return;

    if (!isAuthenticated) {
      setPendingAcceptAfterAuth(true);
      useUIStore.getState().openLoginModal();
      showGlobalToast('Inicia sesión para importar esta playlist a tu cuenta');
      return;
    }

    setAccepting(true);
    try {
      const codeToJoin = collabCode || shareCode || preview.code;
      let targetPlaylist: Playlist | undefined;

      if (codeToJoin && (preview.kind === 'collab' || preview.kind === 'snapshot')) {
        const { joinSharedPlaylist } = await import('../../services/sharedPlaylists');
        const localId = await joinSharedPlaylist(codeToJoin);
        if (localId) {
          targetPlaylist = useSpotifyDataStore.getState().playlists.find((p) => p.id === localId);
        }
      }

      if (!targetPlaylist) {
        const cleanId = preview.playlistId.replace(/^spotify:playlist:/i, '').split('?')[0].trim();
        const importedId = preview.alreadyInLibrary ? preview.playlistId : cleanId || `shared-${Date.now()}`;
        const existing = useSpotifyDataStore.getState().playlists.find(
          (p) => p.id === importedId || p.id === preview.playlistId
        );

        if (existing) {
          targetPlaylist = existing;
        } else {
          const newPl: Playlist = {
            id: importedId,
            name: preview.name,
            description: preview.description || `Importada de ${preview.ownerName}`,
            images: preview.image ? [{ url: preview.image }] : [],
            owner: { id: preview.ownerId || 'spotifree', display_name: preview.ownerName || 'Spotifree' },
            tracks: { total: preview.tracks.length, items: preview.tracks },
            is_custom: true,
            collaborative: preview.collaborative,
          } as Playlist;
          useSpotifyDataStore.getState().addCustomPlaylist(newPl);
          targetPlaylist = newPl;
          try {
            const { syncSpotifreeAccount } = await import('../../services/spotifreeAuth');
            void syncSpotifreeAccount({ playlists: useSpotifyDataStore.getState().playlists }).catch(() => {});
          } catch {}
        }
      }

      clearInviteQueryParams();
      closeInvite();
      if (targetPlaylist) {
        navigateToPlaylistView(targetPlaylist);
      }
      showGlobalToast(
        preview.alreadyInLibrary
          ? `Abriendo: ${preview.name}`
          : preview.kind === 'collab'
          ? `Playlist colaborativa importada: ${preview.name}`
          : `Playlist importada a tu biblioteca: ${preview.name}`
      );
    } catch (err) {
      console.warn('[PlaylistInviteModal] Import failed:', err);
      showGlobalToast('No se pudo importar la playlist');
      setAccepting(false);
    }
  }

  function handleViewOnly() {
    if (!preview) return;
    if (!isAuthenticated) {
      useUIStore.getState().openLoginModal();
      showGlobalToast('Inicia sesión para abrir la playlist');
      return;
    }
    const viewPl: Playlist = {
      id: preview.playlistId || `preview-${Date.now()}`,
      name: preview.name,
      description: preview.description,
      images: preview.image ? [{ url: preview.image }] : [],
      owner: { id: preview.ownerId || 'spotifree', display_name: preview.ownerName || 'Spotifree' },
      tracks: { total: preview.tracks.length, items: preview.tracks },
      type: 'playlist',
    };
    clearInviteQueryParams();
    closeInvite();
    navigateToPlaylistView(viewPl);
  }

  const resolvedCover =
    preview?.image ||
    (preview?.tracks?.length ? getAutoPlaylistCover(preview.tracks) : '') ||
    EMPTY_PLAYLIST_COVER;

  const trackCount = preview?.tracks?.length || 0;

  return (
    <div
      className={`fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm font-['SpotifyMixUI'] transition-opacity duration-150 ${
        closing ? 'opacity-0' : 'opacity-100 animate-in fade-in'
      }`}
      onClick={handleDismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={preview?.name || 'Invitación de playlist'}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-[440px] rounded-2xl bg-[#242424] border border-white/10 p-6 text-white shadow-[0_24px_64px_rgba(0,0,0,0.75)] transition-transform duration-150 ${
          closing ? 'scale-95' : 'scale-100 animate-in zoom-in-95'
        }`}
      >
        {isLoading && (
          <div className="py-10 flex flex-col items-center text-center gap-4">
            <div className="w-10 h-10 rounded-full border-2 border-[#1ed760] border-t-transparent animate-spin" />
            <p className="text-sm font-semibold text-[#b3b3b3]">Cargando playlist compartida...</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold font-['SpotifyMixUITitle']">Enlace no disponible</h2>
            <p className="text-sm text-[#b3b3b3] leading-relaxed">{error}</p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleDismiss}
                className="h-10 px-6 rounded-full bg-white text-black text-sm font-bold hover:scale-[1.03] active:scale-95 transition-transform cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {!isLoading && !error && preview && (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <img
                src={resolvedCover}
                alt={preview.name}
                className="w-24 h-24 rounded-lg object-cover bg-[#181818] shadow-xl shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#1ed760]/15 text-[#1ed760] text-[11px] font-bold uppercase tracking-wider mb-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5zm8-3a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-.7 0-1.4.1-2 .3 1.7.9 2.9 2.3 3 4.2V20h5v-1.5c0-2.1-2.7-3.5-6-3.5z" />
                  </svg>
                  <span>
                    {preview.kind === 'collab'
                      ? 'Invitación colaborativa'
                      : 'Playlist compartida'}
                  </span>
                </div>
                <h2 className="text-xl font-black font-['SpotifyMixUITitle'] leading-tight line-clamp-2">
                  {preview.name}
                </h2>
                <p className="text-xs text-[#b3b3b3] mt-1">
                  De <span className="text-white font-semibold">{preview.ownerName}</span> • {trackCount}{' '}
                  {trackCount === 1 ? 'canción' : 'canciones'}
                  {preview.kind === 'collab' && preview.memberCount > 1
                    ? ` • ${preview.memberCount} participantes`
                    : ''}
                </p>
              </div>
            </div>

            {preview.description && (
              <p className="text-xs text-[#b3b3b3] line-clamp-2 leading-relaxed">{preview.description}</p>
            )}

            {preview.tracks.length > 0 && (
              <div className="rounded-xl bg-black/35 border border-white/5 divide-y divide-white/5 overflow-hidden">
                {preview.tracks.slice(0, 4).map((t, idx) => (
                  <div key={`${t.id || idx}-${idx}`} className="px-3 py-2 flex items-center gap-3">
                    <span className="text-xs text-[#7a7a7a] w-4 text-right font-mono">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white truncate">{t.name}</p>
                      <p className="text-[11px] text-[#a7a7a7] truncate">
                        {t.artists?.map((a) => a.name).join(', ') || 'Artista'}
                      </p>
                    </div>
                  </div>
                ))}
                {preview.tracks.length > 4 && (
                  <div className="px-3 py-1.5 text-[11px] text-[#9b9b9b] text-center bg-black/20">
                    y {preview.tracks.length - 4} canciones más
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleDismiss}
                disabled={isAccepting}
                className="h-10 px-5 rounded-full text-sm font-bold text-[#e5e5e5] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              {preview.kind === 'public' && !preview.alreadyInLibrary && (
                <button
                  type="button"
                  onClick={handleViewOnly}
                  disabled={isAccepting}
                  className="h-10 px-5 rounded-full border border-white/25 text-sm font-bold text-white hover:border-white transition-colors cursor-pointer"
                >
                  Solo abrir
                </button>
              )}

              <button
                type="button"
                autoFocus
                disabled={isAccepting}
                onClick={() => void handleAccept()}
                className="h-10 px-6 rounded-full bg-[#1ed760] text-black text-sm font-bold hover:scale-[1.03] hover:bg-[#3be477] active:scale-95 transition-all cursor-pointer disabled:opacity-60"
              >
                {isAccepting
                  ? 'Importando...'
                  : !isAuthenticated
                  ? 'Iniciar sesión e importar'
                  : preview.alreadyInLibrary
                  ? 'Abrir en tu biblioteca'
                  : preview.kind === 'collab'
                  ? 'Aceptar y unirme'
                  : 'Aceptar e importar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
