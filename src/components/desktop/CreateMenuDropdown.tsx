import React, { useEffect, useRef } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';

export const CreateMenuDropdown: React.FC = () => {
  const { isCreateMenuOpen, closeCreateMenu } = useUIStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeCreateMenu();
      }
    };
    if (isCreateMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCreateMenuOpen, closeCreateMenu]);

  if (!isCreateMenuOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute top-10 right-0 w-64 bg-[#282828] rounded-md shadow-2xl p-1.5 z-50 text-white select-none border border-white/5 animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Option 1: Lista */}
      <button
        onClick={() => {
          const newPl = useSpotifyDataStore.getState().createPlaylist();
          (newPl as any).is_new = true;
          useUIStore.getState().openEditPlaylistModal(newPl);
          closeCreateMenu();
        }}
        className="w-full flex items-center gap-3.5 p-2.5 rounded-md hover:bg-white/10 transition-colors text-left group"
      >
        <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center shrink-0 text-[#b3b3b3] group-hover:text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </div>
        <div>
          <h5 className="font-bold text-sm text-white leading-tight">Lista</h5>
          <p className="text-xs text-[#b3b3b3] mt-0.5 leading-snug">
            Crea una lista con canciones o episodios
          </p>
        </div>
      </button>

      {/* Option 2: Fusión */}
      <button
        onClick={() => {
          closeCreateMenu();
        }}
        className="w-full flex items-center gap-3.5 p-2.5 rounded-md hover:bg-white/10 transition-colors text-left group"
      >
        <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center shrink-0 text-[#b3b3b3] group-hover:text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
          </svg>
        </div>
        <div>
          <h5 className="font-bold text-sm text-white leading-tight">Fusión</h5>
          <p className="text-xs text-[#b3b3b3] mt-0.5 leading-snug">
            Combina los gustos de tu grupo en una lista
          </p>
        </div>
      </button>

      {/* Option 3: Carpeta */}
      <button
        onClick={() => {
          closeCreateMenu();
        }}
        className="w-full flex items-center gap-3.5 p-2.5 rounded-md hover:bg-white/10 transition-colors text-left group"
      >
        <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center shrink-0 text-[#b3b3b3] group-hover:text-white">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
          </svg>
        </div>
        <div>
          <h5 className="font-bold text-sm text-white leading-tight">Carpeta</h5>
          <p className="text-xs text-[#b3b3b3] mt-0.5 leading-snug">
            Organiza tus listas
          </p>
        </div>
      </button>
    </div>
  );
};
