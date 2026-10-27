import React from 'react';
import type { UserProfile } from '../../types/spotify';
import { SearchIconSmall } from '../icons/SpotifyIcons';

interface DesktopHeaderProps {
  user: UserProfile;
  isScrolled: boolean;
  backgroundColor?: string;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
  user,
  isScrolled,
  backgroundColor = 'transparent',
}) => {
  return (
    <header
      className={`sticky top-0 z-40 h-16 px-6 flex items-center justify-between transition-colors duration-300 select-none ${
        isScrolled ? 'bg-[#121212]/95 backdrop-blur-md shadow-md' : 'bg-transparent'
      }`}
      style={{
        backgroundColor: isScrolled ? '#121212' : backgroundColor ? `${backgroundColor}33` : 'transparent',
      }}
    >
      {/* Navigation Arrows */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          className="w-8 h-8 rounded-full bg-black/70 hover:bg-black flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer"
          title="Atrás"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.03.47a.75.75 0 0 1 0 1.06L4.81 7.75l6.22 6.22a.75.75 0 1 1-1.06 1.06l-6.75-6.75a.75.75 0 0 1 0-1.06l6.75-6.75a.75.75 0 0 1 1.06 0z" />
          </svg>
        </button>

        <button
          className="w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white/30 cursor-not-allowed"
          title="Adelante"
          disabled
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.97.47a.75.75 0 0 0 0 1.06L11.19 7.75l-6.22 6.22a.75.75 0 1 0 1.06 1.06l6.75-6.75a.75.75 0 0 0 0-1.06l-6.75-6.75a.75.75 0 0 0 0-1.06z" />
          </svg>
        </button>
      </div>

      {/* Central Search Bar (Spotify Style) */}
      <div className="flex-1 max-w-[480px] mx-4">
        <div className="relative flex items-center">
          <div className="absolute left-3.5 text-spotify-textSubdued pointer-events-none">
            <SearchIconSmall size={18} />
          </div>
          <input
            type="text"
            placeholder="¿Qué te apetece escuchar?"
            className="w-full h-11 bg-[#242424] hover:bg-[#2a2a2a] focus:bg-[#242424] text-white text-sm rounded-full pl-10 pr-10 border border-transparent focus:border-white/20 outline-none transition-colors placeholder:text-spotify-textSubdued"
          />
          <button
            title="Explorar"
            className="absolute right-3 text-spotify-textSubdued hover:text-white border-l border-white/20 pl-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 4h7v7H4V4zm0 9h7v7H4v-7zm9-9h7v7h-7V4zm0 9h7v7h-7v-7z" />
            </svg>
          </button>
        </div>
      </div>

      {/* User & Actions */}
      <div className="flex items-center gap-3 shrink-0">
        <button className="px-3.5 py-1.5 rounded-full bg-black/60 hover:bg-black/90 text-white font-bold text-sm flex items-center gap-2 hover:scale-104 transition-all">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.995 8.745a.75.75 0 0 1 1.06 0L7.25 9.939V1.75a.75.75 0 0 1 1.5 0v8.189l1.195-1.194a.75.75 0 1 1 1.06 1.06L8 12.811l-3.005-3.006a.75.75 0 0 1 0-1.06zM1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-2.25a.75.75 0 0 0-1.5 0v2.25a.25.25 0 0 1-.25.25h-11a.25.25 0 0 1-.25-.25v-2.25a.75.75 0 0 0-1.5 0v2.25z" />
          </svg>
          <span>Instalar app</span>
        </button>

        <button
          className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-spotify-textSubdued hover:text-white flex items-center justify-center transition-colors"
          title="Novedades"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1.5a4 4 0 0 0-4 4v3.268l-.938 1.876A1 1 0 0 0 3.956 12h8.088a1 1 0 0 0 .894-1.356L12 8.768V5.5a4 4 0 0 0-4-4zM2.5 5.5a5.5 5.5 0 1 1 11 0v3.01l1.042 2.084A2.5 2.5 0 0 1 12.044 13.5H3.956a2.5 2.5 0 0 1-2.498-2.906L2.5 8.51V5.5zM6 14.5a2 2 0 1 0 4 0H6z" />
          </svg>
        </button>

        {/* Profile Avatar Button */}
        <button
          className="w-8 h-8 rounded-full bg-black/60 p-0.5 hover:scale-104 transition-transform flex items-center justify-center border border-transparent hover:border-white/20"
          title={user.display_name}
        >
          <img
            src={user.images[0]?.url}
            alt={user.display_name}
            className="w-full h-full rounded-full object-cover"
          />
        </button>
      </div>
    </header>
  );
};
