import React, { useEffect, useRef } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';

export const ProfileDropdown: React.FC = () => {
  const { isProfileOpen, closeProfile, setActiveMainTab } = useUIStore();
  const { isAuthenticated, logout } = useSpotifyDataStore();
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
      className="absolute top-14 right-4 w-56 bg-[#282828] rounded-md shadow-2xl p-1 z-50 text-white text-sm font-semibold select-none border border-white/5 animate-in fade-in zoom-in-95 duration-100"
    >
      {!isAuthenticated ? (
        <>
          <button
            onClick={() => {
              setActiveMainTab('guide');
              closeProfile();
            }}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded hover:bg-white/10 transition-colors text-left text-xs font-semibold text-[#1ed760]"
          >
            <span>Conectar con cookie (sp_dc)</span>
          </button>

          <button
            onClick={() => {
              setActiveMainTab('settings');
              closeProfile();
            }}
            className="w-full px-3 py-2.5 rounded hover:bg-white/10 transition-colors text-left text-xs font-semibold text-white"
          >
            Configuración
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => {
              setActiveMainTab('profile');
              closeProfile();
            }}
            className="w-full px-3 py-2.5 rounded hover:bg-white/10 transition-colors text-left text-xs font-semibold"
          >
            Perfil
          </button>

          <button
            onClick={() => {
              setActiveMainTab('settings');
              closeProfile();
            }}
            className="w-full px-3 py-2.5 rounded hover:bg-white/10 transition-colors text-left text-xs font-semibold text-white"
          >
            Configuración
          </button>

          <div className="h-px bg-white/10 my-1 mx-2" />

          <button
            onClick={() => {
              logout();
              closeProfile();
            }}
            className="w-full px-3 py-2.5 rounded hover:bg-white/10 transition-colors text-left text-xs font-semibold text-red-400 hover:text-red-300"
          >
            Cerrar sesión
          </button>
        </>
      )}
    </div>
  );
};
