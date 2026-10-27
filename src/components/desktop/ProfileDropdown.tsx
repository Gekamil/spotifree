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

  const externalArrow = (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-[#b3b3b3]">
      <path d="M1 2.75C1 1.784 1.784 1 2.75 1h5.5a.75.75 0 0 1 0 1.5h-5.5a.25.25 0 0 0-.25.25v10.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-5.5a.75.75 0 0 1 1.5 0v5.5A1.75 1.75 0 0 1 13.25 15H2.75A1.75 1.75 0 0 1 1 13.25V2.75z" />
      <path d="M15 1.75a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0 0 1.5h3.69L7.22 7.72a.75.75 0 0 0 1.06 1.06l5.22-5.22v3.69a.75.75 0 0 0 1.5 0v-5.5z" />
    </svg>
  );

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
              window.open('https://www.spotify.com/account/overview/', '_blank', 'noopener,noreferrer');
              closeProfile();
            }}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded hover:bg-white/10 transition-colors text-left text-xs font-semibold"
          >
            <span>Cuenta</span>
            {externalArrow}
          </button>

          <button
            onClick={closeProfile}
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
