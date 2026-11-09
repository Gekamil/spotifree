import React, { useEffect } from 'react';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { handleImageError } from '../../utils/imageFallback';

interface MobileProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: 'profile' | 'settings') => void;
  onOpenSharedSession: () => void;
  onOpenTaste: () => void;
  onOpenNotifications: () => void;
  onOpenLogin: () => void;
}

export const MobileProfileDrawer: React.FC<MobileProfileDrawerProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenSharedSession,
  onOpenTaste,
  onOpenNotifications,
  onOpenLogin,
}) => {
  const { user, isAuthenticated, logout } = useSpotifyDataStore();

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Custom avatar per active account or user image
  const activeId = user?.id || (typeof window !== 'undefined' ? window.localStorage.getItem('spotifree_active_user_id') : '') || 'default';
  let customAvatar: string | undefined;
  if (typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(`spotifree_custom_profile_${activeId}`) || window.localStorage.getItem('spotifree_custom_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.avatarUrl) customAvatar = parsed.avatarUrl;
      }
    } catch {}
  }
  const avatarUrl = customAvatar || user?.images?.[0]?.url;
  const displayName = user?.display_name || 'Jorgete';
  const initial = displayName.charAt(0).toUpperCase() || 'J';

  return (
    <div className="fixed inset-0 z-50 flex font-['SpotifyMixUI'] select-none">
      {/* Darkened backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/65 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        aria-hidden="true"
      />

      {/* Drawer Container (Sliding in from the left, authentic Spotify Mobile layout) */}
      <aside
        style={{ paddingTop: 'max(24px, env(safe-area-inset-top, 24px))', paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}
        className="relative z-10 w-[84%] max-w-[340px] h-full bg-[#181818] border-r border-white/[0.08] flex flex-col justify-between px-5 text-white shadow-2xl animate-in slide-in-from-left duration-250 ease-out overflow-y-auto"
      >
        <div className="space-y-6">
          {/* 1. Profile Header Card */}
          <button
            type="button"
            onClick={() => {
              onClose();
              if (isAuthenticated) onNavigate('profile');
              else onOpenLogin();
            }}
            className="w-full flex items-center gap-4 text-left group pt-2 active:opacity-80 transition-opacity cursor-pointer"
          >
            {/* Avatar Circle */}
            <div className="w-14 h-14 rounded-full bg-[#3b82f6] text-white flex items-center justify-center font-bold text-2xl shrink-0 overflow-hidden shadow-lg border-2 border-white/10">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  onError={handleImageError}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{initial}</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-black text-white font-['SpotifyMixUITitle'] truncate">
                {isAuthenticated ? displayName : 'Iniciar sesión'}
              </h2>
              <span className="text-xs text-[#a7a7a7] group-hover:text-white transition-colors flex items-center gap-1 font-medium">
                {isAuthenticated ? 'Ver perfil' : 'Toca para conectar tu cuenta'}
              </span>
            </div>
          </button>

          {/* Divider */}
          <div className="h-px bg-white/10" />

          {/* 2. Menu Navigation Items */}
          <div className="space-y-1">
            {/* Configuración y privacidad */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('settings');
              }}
              className="w-full flex items-center gap-4 px-2 py-3 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-left cursor-pointer group"
            >
              <div className="w-6 h-6 flex items-center justify-center text-white/90 group-hover:text-white">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <span className="text-sm font-bold text-white tracking-tight">
                Configuración y privacidad
              </span>
            </button>

            {/* Recientes */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('profile');
              }}
              className="w-full flex items-center gap-4 px-2 py-3 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-left cursor-pointer group"
            >
              <div className="w-6 h-6 flex items-center justify-center text-white/90 group-hover:text-white">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <span className="text-sm font-bold text-white tracking-tight">
                Recientes
              </span>
            </button>

            {/* Estadísticas de escucha */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenTaste();
              }}
              className="w-full flex items-center justify-between px-2 py-3 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-left cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <div className="w-6 h-6 flex items-center justify-center text-white/90 group-hover:text-white">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </div>
                <span className="text-sm font-bold text-white tracking-tight">
                  Estadísticas de escucha
                </span>
              </div>
              <span className="text-[10px] font-bold text-[#3b82f6] uppercase tracking-wider">
                Novedad
              </span>
            </button>

            {/* Tus avisos y novedades */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenNotifications();
              }}
              className="w-full flex items-center gap-4 px-2 py-3 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-left cursor-pointer group"
            >
              <div className="w-6 h-6 flex items-center justify-center text-white/90 group-hover:text-white">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <span className="text-sm font-bold text-white tracking-tight">
                Tus avisos
              </span>
            </button>

            {/* Invitar a amigos / Sesión compartida */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSharedSession();
              }}
              className="w-full flex items-center gap-4 px-2 py-3 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-left cursor-pointer group"
            >
              <div className="w-6 h-6 flex items-center justify-center text-white/90 group-hover:text-white">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white tracking-tight">
                  Invitar a amigos
                </span>
                <span className="text-[11px] text-[#a7a7a7]">
                  Compartir música y sesión en tiempo real
                </span>
              </div>
            </button>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/10" />

          {/* 3. Account Actions */}
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLogin();
              }}
              className="w-full flex items-center gap-4 px-2 py-3 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-left cursor-pointer group"
            >
              <div className="w-6 h-6 flex items-center justify-center text-white/90 group-hover:text-white">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white tracking-tight">
                  Añadir o cambiar cuenta
                </span>
                <span className="text-[11px] text-[#a7a7a7]">
                  Conectar otra cuenta de Spotify o Spotifree
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* 4. Bottom Footer: Cerrar sesión (if authenticated) */}
        {isAuthenticated && (
          <div className="pt-4 pb-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => {
                onClose();
                logout();
              }}
              className="w-full py-2.5 rounded-full border border-white/20 hover:border-white text-white font-bold text-xs uppercase tracking-wider active:scale-95 transition-all text-center cursor-pointer"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};
