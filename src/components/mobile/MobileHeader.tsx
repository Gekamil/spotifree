import React from 'react';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { useUIStore } from '../../store/useUIStore';

interface MobileHeaderProps {
  activeTab: 'todo' | 'musica';
  onTabChange: (tab: 'todo' | 'musica') => void;
  onOpenProfile: () => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  activeTab,
  onTabChange,
  onOpenProfile,
}) => {
  const { user, isAuthenticated } = useSpotifyDataStore();
  const { openLoginModal } = useUIStore();

  const avatarUrl = user?.images?.[0]?.url;

  return (
    <header className="sticky top-0 z-30 px-4 pt-3 pb-3 flex items-center justify-between gap-3 select-none font-['SpotifyMixUI']">
      {/* Left: Avatar / Profile */}
      <button
        onClick={isAuthenticated ? onOpenProfile : openLoginModal}
        className="w-8 h-8 rounded-full bg-[#242424] overflow-hidden shrink-0 shadow flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
        title={isAuthenticated ? user?.display_name : 'Iniciar sesión'}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={user?.display_name || 'Usuario'}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-xs font-bold text-white">
            {isAuthenticated ? (user?.display_name || 'J').charAt(0).toUpperCase() : (
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z" />
              </svg>
            )}
          </span>
        )}
      </button>

      {/* Center: Filter Pills */}
      <div className="flex items-center gap-2 flex-1">
        <button
          onClick={() => onTabChange('todo')}
          className={`h-8 px-4 rounded-full text-xs font-bold transition-all ${
            activeTab === 'todo'
              ? 'bg-[#1ed760] text-black shadow'
              : 'bg-[#242424] text-white hover:bg-[#2a2a2a]'
          }`}
        >
          Todo
        </button>
        <button
          onClick={() => onTabChange('musica')}
          className={`h-8 px-4 rounded-full text-xs font-bold transition-all ${
            activeTab === 'musica'
              ? 'bg-[#1ed760] text-black shadow'
              : 'bg-[#242424] text-white hover:bg-[#2a2a2a]'
          }`}
        >
          Música
        </button>
      </div>

      {/* Right: Connect or Bell */}
      {!isAuthenticated ? (
        <button
          onClick={openLoginModal}
          className="px-3 py-1.5 rounded-full bg-white text-black font-black text-xs uppercase tracking-wider shrink-0 shadow active:scale-95"
        >
          Conectar
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenProfile}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#b3b3b3] hover:text-white"
            title="Perfil"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1.5a4 4 0 0 0-4 4v3.268l-.938 1.876A1 1 0 0 0 3.956 12h8.088a1 1 0 0 0 .894-1.356L12 8.768V5.5a4 4 0 0 0-4-4zM2.5 5.5a5.5 5.5 0 1 1 11 0v3.01l1.042 2.084A2.5 2.5 0 0 1 12.044 13.5H3.956a2.5 2.5 0 0 1-2.498-2.906L2.5 8.51V5.5zM6 14.5a2 2 0 1 0 4 0H6z" />
            </svg>
          </button>
        </div>
      )}
    </header>
  );
};
