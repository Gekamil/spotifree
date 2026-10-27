import React, { useEffect, useRef } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';

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

  if (!isProfileOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute top-14 right-4 w-60 bg-[#282828] rounded-xl shadow-2xl p-1.5 z-50 text-white text-sm font-semibold select-none border border-white/10 animate-in fade-in zoom-in-95 duration-100"
    >
      {!isAuthenticated ? (
        <>
          <button
            onClick={() => {
              openLoginModal();
              closeProfile();
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg hover:bg-white/10 transition-colors text-left text-xs font-bold text-[#1ed760] cursor-pointer"
          >
            <span>Conectar con Spotify</span>
            <span>➔</span>
          </button>

          <button
            onClick={() => {
              setActiveMainTab('guide');
              closeProfile();
            }}
            className="w-full px-3.5 py-2 rounded-lg hover:bg-white/10 transition-colors text-left text-xs font-semibold text-white/80"
          >
            Guía y ayuda
          </button>

          <button
            onClick={() => {
              setActiveMainTab('settings');
              closeProfile();
            }}
            className="w-full px-3.5 py-2 rounded-lg hover:bg-white/10 transition-colors text-left text-xs font-semibold text-white/80"
          >
            Configuración
          </button>
        </>
      ) : (
        <>
          <div className="px-3.5 py-2 border-b border-white/10 mb-1">
            <p className="text-xs font-bold text-white truncate">{user?.display_name || 'Usuario'}</p>
            <p className="text-[11px] text-[#1ed760]">Cuenta activa</p>
          </div>

          <button
            onClick={() => {
              setActiveMainTab('profile');
              closeProfile();
            }}
            className="w-full px-3.5 py-2 rounded-lg hover:bg-white/10 transition-colors text-left text-xs font-semibold"
          >
            Perfil
          </button>

          <button
            onClick={() => {
              openLoginModal();
              closeProfile();
            }}
            className="w-full px-3.5 py-2 rounded-lg hover:bg-white/10 transition-colors text-left text-xs font-semibold text-[#1ed760] flex items-center justify-between"
          >
            <span>Cambiar o añadir cuenta</span>
            <span>+</span>
          </button>

          <button
            onClick={() => {
              setActiveMainTab('settings');
              closeProfile();
            }}
            className="w-full px-3.5 py-2 rounded-lg hover:bg-white/10 transition-colors text-left text-xs font-semibold text-white"
          >
            Configuración
          </button>

          <div className="h-px bg-white/10 my-1 mx-2" />

          <button
            onClick={() => {
              logout();
              closeProfile();
            }}
            className="w-full px-3.5 py-2 rounded-lg hover:bg-white/10 transition-colors text-left text-xs font-semibold text-red-400 hover:text-red-300"
          >
            Cerrar sesión
          </button>
        </>
      )}
    </div>
  );
};
