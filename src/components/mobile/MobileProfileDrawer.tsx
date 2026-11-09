import React, { useEffect } from 'react';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { handleImageError } from '../../utils/imageFallback';

interface MobileProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: 'profile' | 'settings' | 'recents' | 'stats') => void;
  onOpenSharedSession: () => void;
  onOpenNotifications: () => void;
  onOpenLogin: () => void;
}

export const MobileProfileDrawer: React.FC<MobileProfileDrawerProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenSharedSession,
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
      {/* Darkened backdrop with smooth fade */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        aria-hidden="true"
      />

      {/* Drawer Container (Sliding in from the left, authentic Spotify Mobile layout) */}
      <aside
        style={{
          paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
        }}
        className="relative z-10 w-[84%] max-w-[330px] h-full bg-[#121212] flex flex-col justify-between px-5 text-white shadow-2xl overflow-y-auto transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] animate-in slide-in-from-left"
      >
        <div className="space-y-4">
          {/* 1. Profile Header Card */}
          <button
            type="button"
            onClick={() => {
              onClose();
              if (isAuthenticated) onNavigate('profile');
              else onOpenLogin();
            }}
            className="w-full flex items-center gap-3.5 text-left group pt-2 active:opacity-80 transition-opacity cursor-pointer"
          >
            {/* Avatar Circle - Spotify clean circle, NO borders */}
            <div className="w-13 h-13 rounded-full bg-[#535353] text-white flex items-center justify-center font-bold text-xl shrink-0 overflow-hidden shadow">
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
              <h2 className="text-lg font-bold text-white font-['SpotifyMixUITitle'] truncate">
                {isAuthenticated ? displayName : 'Iniciar sesión'}
              </h2>
              <span className="text-xs text-[#b3b3b3] group-hover:text-white transition-colors flex items-center gap-1 font-normal">
                {isAuthenticated ? 'Ver perfil' : 'Toca para conectar tu cuenta'}
              </span>
            </div>
          </button>

          {/* Divider */}
          <div className="h-px bg-white/[0.08]" />

          {/* 2. Añadir cuenta (matching image 1) */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLogin();
            }}
            className="w-full flex items-center gap-3.5 py-2.5 px-1 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-left cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-full bg-[#242424] flex items-center justify-center text-[#b3b3b3] group-hover:text-white shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-white tracking-tight">
                Añadir cuenta
              </span>
              <span className="text-[11px] text-[#b3b3b3] truncate">
                Añade una cuenta infantil o de adulto
              </span>
            </div>
          </button>

          {/* 3. Main Navigation List */}
          <div className="space-y-0.5 pt-1">
            {/* Estadísticas de escucha */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('stats');
              }}
              className="w-full flex items-center justify-between py-3 px-1 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-6 h-6 flex items-center justify-center text-[#b3b3b3] group-hover:text-white">
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

            {/* Recientes */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('recents');
              }}
              className="w-full flex items-center gap-3.5 py-3 px-1 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-left cursor-pointer group"
            >
              <div className="w-6 h-6 flex items-center justify-center text-[#b3b3b3] group-hover:text-white">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <span className="text-sm font-bold text-white tracking-tight">
                Recientes
              </span>
            </button>

            {/* Tus avisos */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenNotifications();
              }}
              className="w-full flex items-center gap-3.5 py-3 px-1 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-left cursor-pointer group"
            >
              <div className="w-6 h-6 flex items-center justify-center text-[#b3b3b3] group-hover:text-white">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <span className="text-sm font-bold text-white tracking-tight">
                Tus avisos
              </span>
            </button>

            {/* Configuración y privacidad */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('settings');
              }}
              className="w-full flex items-center gap-3.5 py-3 px-1 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors text-left cursor-pointer group"
            >
              <div className="w-6 h-6 flex items-center justify-center text-[#b3b3b3] group-hover:text-white">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </div>
              <span className="text-sm font-bold text-white tracking-tight">
                Configuración y privacidad
              </span>
            </button>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.08]" />

          {/* 4. Circular Quick Action Badges (matching image 1) */}
          <div className="flex items-start gap-6 pt-2 px-2">
            {/* Actividad circle */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('stats');
              }}
              className="flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-13 h-13 rounded-full bg-[#535353] flex items-center justify-center text-white font-bold text-lg overflow-hidden shadow">
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
              <span className="text-xs font-bold text-white">Actividad</span>
              <span className="text-[11px] text-[#b3b3b3] -mt-1">Ver datos</span>
            </button>

            {/* Invitar a amigos circle */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSharedSession();
              }}
              className="flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-13 h-13 rounded-full bg-[#242424] hover:bg-[#2a2a2a] flex items-center justify-center text-[#b3b3b3] hover:text-white shadow">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <span className="text-xs font-bold text-white">Invitar a</span>
              <span className="text-[11px] text-[#b3b3b3] -mt-1">amigos</span>
            </button>
          </div>
        </div>

        {/* 5. Bottom Footer: Cerrar sesión (if authenticated) */}
        {isAuthenticated && (
          <div className="pt-4 pb-2 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={() => {
                onClose();
                logout();
              }}
              className="w-full py-2.5 rounded-full border border-[#727272] hover:border-white text-white font-bold text-xs uppercase tracking-wider active:scale-95 transition-all text-center cursor-pointer hover:bg-white/5"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};
