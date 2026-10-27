import React from 'react';
import {
  HomeNativeIcon,
  HomeFilledNativeIcon,
  SearchNativeIcon,
} from '../icons/SpotifyNativeIcons';

interface MobileBottomNavProps {
  activeTab: 'home' | 'search' | 'library';
  onTabChange: (tab: 'home' | 'search' | 'library') => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 bg-[#121212]/95 backdrop-blur-xl border-t border-white/10 flex items-center justify-around z-40 px-2 select-none font-['SpotifyMixUI']">
      {/* 1. Inicio */}
      <button
        onClick={() => onTabChange('home')}
        className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 transition-colors cursor-pointer ${
          activeTab === 'home' ? 'text-white' : 'text-[#a7a7a7] hover:text-white'
        }`}
      >
        {activeTab === 'home' ? (
          <HomeFilledNativeIcon size={22} className="text-white" />
        ) : (
          <HomeNativeIcon size={22} />
        )}
        <span className="text-[10px] font-bold tracking-tight">Inicio</span>
      </button>

      {/* 2. Buscar */}
      <button
        onClick={() => onTabChange('search')}
        className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 transition-colors cursor-pointer ${
          activeTab === 'search' ? 'text-white' : 'text-[#a7a7a7] hover:text-white'
        }`}
      >
        <SearchNativeIcon size={22} className={activeTab === 'search' ? 'text-white' : 'text-[#a7a7a7]'} />
        <span className="text-[10px] font-bold tracking-tight">Buscar</span>
      </button>

      {/* 3. Tu biblioteca */}
      <button
        onClick={() => onTabChange('library')}
        className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 transition-colors cursor-pointer ${
          activeTab === 'library' ? 'text-white' : 'text-[#a7a7a7] hover:text-white'
        }`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14.5 2.25a.75.75 0 0 1 .75.75v18a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75zM4 3a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 .75.75v18a.75.75 0 0 1-.75.75h-2.5A.75.75 0 0 1 4 21V3zm2 17.25h1V3.75H6v16.5zM18.868 2.378a.75.75 0 0 1 1.01.372l5.5 13.5a.75.75 0 0 1-1.382.563l-5.5-13.5a.75.75 0 0 1 .372-1.01z" />
        </svg>
        <span className="text-[10px] font-bold tracking-tight">Tu biblioteca</span>
      </button>
    </nav>
  );
};
