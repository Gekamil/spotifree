import React, { useEffect, useRef } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { logoutSpotifreeAccount } from '../../services/spotifreeAuth';

export const ProfileDropdown: React.FC = () => {
  const { isProfileOpen, closeProfile, setActiveMainTab, openLoginModal } = useUIStore();
  const { isAuthenticated, logout, user } = useSpotifyDataStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeProfile();
      }
    };
    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileOpen, closeProfile]);

  const handleLogout = async () => {
    closeProfile();
    await logoutSpotifreeAccount();
    logout();
  };

  if (!isProfileOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute top-14 right-4 w-56 bg-[#282828] rounded-[4px] shadow-[0_16px_24px_rgba(0,0,0,0.6),0_6px_8px_rgba(0,0,0,0.4)] p-1 z-50 text-white select-none border border-white/5 animate-in fade-in zoom-in-95 duration-100 font-['SpotifyMixUI']"
    >
      {!isAuthenticated ? (
        <>
          <button
            onClick={() => {
              openLoginModal();
              closeProfile();
            }}
            className="w-full h-10 px-3 flex items-center justify-between text-sm font-semibold text-white hover:bg-white/10 rounded-[2px] transition-colors cursor-pointer"
          >
            <span className="text-[#1ed760] font-bold">Iniciar sesión</span>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-[#1ed760]">
              <path d="M6 3.5l4.5 4.5L6 12.5" />
            </svg>
          </button>

          <div className="h-[1px] bg-white/10 my-1" />

          <button
            onClick={() => {
              setActiveMainTab('settings');
              closeProfile();
            }}
            className="w-full h-10 px-3 flex items-center text-sm font-normal text-white hover:bg-white/10 rounded-[2px] transition-colors cursor-pointer"
          >
            Configuración
          </button>

          <button
            onClick={() => {
              setActiveMainTab('guide');
              closeProfile();
            }}
            className="w-full h-10 px-3 flex items-center text-sm font-normal text-white hover:bg-white/10 rounded-[2px] transition-colors cursor-pointer"
          >
            Ayuda
          </button>
        </>
      ) : (
        <>
          {/* Active User Header */}
          <div
            onClick={() => {
              setActiveMainTab('profile');
              closeProfile();
            }}
            className="px-3 py-2.5 hover:bg-white/10 rounded-[2px] cursor-pointer transition-colors flex items-center justify-between group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#181818] flex items-center justify-center font-bold text-xs text-white shrink-0 overflow-hidden shadow">
                {user?.images?.[0]?.url ? (
                  <img src={user.images[0].url} alt={user.display_name} className="w-full h-full object-cover" />
                ) : (
                  (user?.display_name || 'U').charAt(0).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{user?.display_name || 'Usuario'}</p>
                <p className="text-[11px] text-[#1ed760] flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760]" />
                  Cuenta activa
                </p>
              </div>
            </div>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" className="text-[#b3b3b3] group-hover:text-white shrink-0">
              <path d="M6 3.5l4.5 4.5L6 12.5" />
            </svg>
          </div>

          <div className="h-[1px] bg-white/10 my-1" />

          <button
            onClick={() => {
              setActiveMainTab('settings');
              closeProfile();
            }}
            className="w-full h-10 px-3 flex items-center text-sm font-normal text-white hover:bg-white/10 rounded-[2px] transition-colors cursor-pointer"
          >
            Configuración
          </button>

          <div className="h-[1px] bg-white/10 my-1" />

          <button
            onClick={handleLogout}
            className="w-full h-10 px-3 flex items-center text-sm font-normal text-red-400 hover:text-red-300 hover:bg-white/10 rounded-[2px] transition-colors cursor-pointer"
          >
            Cerrar sesión
          </button>
        </>
      )}
    </div>
  );
};
