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
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        aria-hidden="true"
      />

      {/* Drawer Container (Sliding in from the left, authentic Spotify Mobile layout) */}
      <aside
        style={{
          paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
        }}
        className="relative z-10 w-[84%] max-w-[340px] h-full bg-[#1f1f1f] flex flex-col justify-between px-4 text-white shadow-2xl overflow-y-auto transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] animate-in slide-in-from-left"
      >
        <div className="space-y-4">
          {/* 1. Profile Header Card + Añadir Cuenta inside unified rounded panel matching Spotify */}
          <div className="bg-[#282828] rounded-xl overflow-hidden">
            {/* Profile Row */}
            <button
              type="button"
              onClick={() => {
                onClose();
                if (isAuthenticated) onNavigate('profile');
                else onOpenLogin();
              }}
              className="w-full flex items-center gap-3.5 p-3 text-left group active:bg-white/5 transition-colors cursor-pointer"
            >
              {/* Avatar Circle */}
              <div className="w-12 h-12 rounded-full bg-[#3b82f6] text-white flex items-center justify-center font-bold text-xl shrink-0 overflow-hidden shadow">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    onError={handleImageError}
                    referrerPolicy="no-referrer"
                    className="w-full h-full max-w-full max-h-full object-cover rounded-full"
                  />
                ) : (
                  <span>{initial}</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-bold text-white font-['SpotifyMixUITitle'] truncate leading-snug">
                  {isAuthenticated ? displayName : 'Iniciar sesión'}
                </h2>
                <span className="text-xs text-[#a7a7a7] group-hover:text-white transition-colors flex items-center font-normal">
                  {isAuthenticated ? 'Ver perfil' : 'Toca para conectar tu cuenta'}
                </span>
              </div>
            </button>

            {/* Separator line inside card */}
            <div className="h-px bg-white/[0.06] mx-3" />

            {/* Añadir cuenta Row */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLogin();
              }}
              className="w-full flex items-center gap-3.5 p-3 active:bg-white/5 transition-colors text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-full bg-[#363636] flex items-center justify-center text-[#b3b3b3] group-hover:text-white shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] font-bold text-white tracking-tight leading-tight">
                  Añadir cuenta
                </span>
                <span className="text-[11.5px] text-[#a7a7a7] truncate font-normal">
                  Añade una cuenta infantil o de adulto
                </span>
              </div>
            </button>
          </div>

          {/* 2. Main Navigation List (matching real Spotify mobile menu order and styling) */}
          <div className="space-y-1 pt-1">
            {/* Tu Premium with green 'Individual' badge */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('settings');
              }}
              className="w-full flex items-center justify-between py-2.5 px-2 rounded-lg active:bg-white/5 transition-colors text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-6 h-6 flex items-center justify-center text-white shrink-0">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.494 17.306c-.215.353-.676.466-1.028.25-2.817-1.721-6.362-2.11-10.537-1.157-.404.093-.807-.156-.9-.56-.092-.404.157-.807.561-.9 4.568-1.044 8.49-.606 11.654 1.339.352.215.466.675.25 1.028zm1.467-3.264c-.27.44-.847.58-1.287.31-3.226-1.983-8.144-2.557-11.96-1.398-.498.15-1.03-.135-1.18-.633-.15-.498.136-1.03.634-1.18 4.364-1.324 9.782-.684 13.483 1.593.44.27.58.847.31 1.288zm.126-3.41c-3.868-2.296-10.248-2.508-13.94-1.387-.593.18-1.22-.16-1.4-.753-.18-.593.16-1.22.753-1.4 4.246-1.29 11.292-1.043 15.753 1.605.534.317.708 1.01.39 1.545-.317.534-1.01.708-1.545.39z" />
                  </svg>
                </div>
                <span className="text-[15px] font-bold text-white tracking-tight">
                  Tu Premium
                </span>
              </div>
              <span className="bg-[#1ed760] text-black font-bold text-[11px] px-2.5 py-0.5 rounded-full tracking-wide">
                Individual
              </span>
            </button>

            {/* Estadísticas de escucha with 'Novedad' blue label */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('stats');
              }}
              className="w-full flex items-center justify-between py-2.5 px-2 rounded-lg active:bg-white/5 transition-colors text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-6 h-6 flex items-center justify-center text-white shrink-0">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-[15px] font-bold text-white tracking-tight">
                    Estadísticas de escucha
                  </span>
                  <span className="text-[11px] font-medium text-[#3b82f6]">
                    Novedad
                  </span>
                </div>
              </div>
            </button>

            {/* Recientes */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('recents');
              }}
              className="w-full flex items-center gap-3.5 py-2.5 px-2 rounded-lg active:bg-white/5 transition-colors text-left cursor-pointer group"
            >
              <div className="w-6 h-6 flex items-center justify-center text-white shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <span className="text-[15px] font-bold text-white tracking-tight">
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
              className="w-full flex items-center gap-3.5 py-2.5 px-2 rounded-lg active:bg-white/5 transition-colors text-left cursor-pointer group"
            >
              <div className="w-6 h-6 flex items-center justify-center text-white shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              </div>
              <span className="text-[15px] font-bold text-white tracking-tight">
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
              className="w-full flex items-center gap-3.5 py-2.5 px-2 rounded-lg active:bg-white/5 transition-colors text-left cursor-pointer group"
            >
              <div className="w-6 h-6 flex items-center justify-center text-white shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </div>
              <span className="text-[15px] font-bold text-white tracking-tight">
                Configuración y privacidad
              </span>
            </button>
          </div>

          {/* 3. Dual circular quick action badges (matching Image 1 exactly) */}
          <div className="flex items-start gap-5 pt-3 px-1">
            {/* Actividad circle */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigate('stats');
              }}
              className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 rounded-full bg-[#3b82f6] text-white flex items-center justify-center font-bold text-lg overflow-hidden shadow shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    onError={handleImageError}
                    referrerPolicy="no-referrer"
                    className="w-full h-full max-w-full max-h-full object-cover rounded-full"
                  />
                ) : (
                  <span>{initial}</span>
                )}
              </div>
              <span className="text-[12.5px] font-bold text-white leading-tight">Actividad</span>
              <span className="text-[11px] text-[#a7a7a7] leading-tight font-normal">Activar</span>
            </button>

            {/* Invitar a amigos circle */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSharedSession();
              }}
              className="flex flex-col items-center gap-1 cursor-pointer active:scale-95 transition-transform"
            >
              <div className="w-12 h-12 rounded-full bg-[#282828] active:bg-[#333333] flex items-center justify-center text-white shadow shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <span className="text-[12.5px] font-bold text-white leading-tight">Invitar a</span>
              <span className="text-[11px] text-[#a7a7a7] leading-tight font-normal">amigos</span>
            </button>
          </div>
        </div>

        {/* 4. Bottom Footer: Cerrar sesión (if authenticated) */}
        {isAuthenticated && (
          <div className="pt-4 pb-1">
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
