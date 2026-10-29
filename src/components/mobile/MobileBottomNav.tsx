import React from 'react';
import { SearchActiveNativeIcon } from '../icons/SpotifyNativeIcons';

interface MobileBottomNavProps {
  activeTab: 'home' | 'search' | 'library' | 'create';
  onTabChange: (tab: 'home' | 'search' | 'library') => void;
  onOpenCreate?: () => void;
  isCreateOpen?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  onOpenCreate,
  isCreateOpen = false,
}) => {
  return (
    <nav
      data-testid="bottom-tab-navigation"
      className="fixed bottom-0 left-0 right-0 h-[56px] flex items-center justify-around z-50 px-2 select-none font-['SpotifyMixUI'] bg-[#121212] border-t border-white/[0.08] pointer-events-auto"
    >
      {/* 1. Inicio */}
      <button
        onClick={() => onTabChange('home')}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 transition-colors cursor-pointer group active:scale-95 ${
          activeTab === 'home' ? 'text-white' : 'text-[#b3b3b3] hover:text-white'
        }`}
      >
        <div className="w-6 h-6 flex items-center justify-center">
          {activeTab === 'home' ? (
            /* Active Filled Home (Official Spotify Mobile SVG) */
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M12.5 3.247a1 1 0 0 0-1 0L4 7.577V20h4.5v-6a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6H20V7.577l-7.5-4.33z" />
            </svg>
          ) : (
            /* Inactive Outline Home (Official Spotify Mobile SVG) */
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M12.5 3.247a1 1 0 0 0-1 0L4 7.577V20h4.5v-6a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6H20V7.577zm-2-1.732a3 3 0 0 1 3 0l7.5 4.33a2 2 0 0 1 1 1.732V21a1 1 0 0 1-1 1h-6.5a1 1 0 0 1-1-1v-6h-3v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7.577a2 2 0 0 1 1-1.732z" />
            </svg>
          )}
        </div>
        <span
          className={`text-[10px] tracking-tight ${
            activeTab === 'home' ? 'font-bold text-white' : 'font-medium text-[#b3b3b3]'
          }`}
        >
          Inicio
        </span>
      </button>

      {/* 2. Buscar */}
      <button
        onClick={() => onTabChange('search')}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 transition-colors cursor-pointer group active:scale-95 ${
          activeTab === 'search' ? 'text-white' : 'text-[#b3b3b3] hover:text-white'
        }`}
      >
        <div className="w-6 h-6 flex items-center justify-center">
          {activeTab === 'search' ? (
            /* Active Search with circle inside (matching user requirement & Spotify Mobile) */
            <SearchActiveNativeIcon size={24} className="text-white" />
          ) : (
            /* Inactive Outline Search (Official Spotify Mobile SVG) */
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M10.533 1.27893C5.35215 1.27893 1.12598 5.41887 1.12598 10.5579C1.12598 15.697 5.35215 19.8369 10.533 19.8369C12.767 19.8369 14.8235 19.0671 16.4402 17.7794L20.7929 22.132C21.1834 22.5226 21.8166 22.5226 22.2071 22.132C22.5976 21.7415 22.5976 21.1083 22.2071 20.7178L17.8634 16.3741C19.1616 14.7849 19.94 12.7634 19.94 10.5579C19.94 5.41887 15.7138 1.27893 10.533 1.27893ZM3.12598 10.5579C3.12598 6.55226 6.42768 3.27893 10.533 3.27893C14.6383 3.27893 17.94 6.55226 17.94 10.5579C17.94 14.5636 14.6383 17.8369 10.533 17.8369C6.42768 17.8369 3.12598 14.5636 3.12598 10.5579Z" />
            </svg>
          )}
        </div>
        <span
          className={`text-[10px] tracking-tight ${
            activeTab === 'search' ? 'font-bold text-white' : 'font-medium text-[#b3b3b3]'
          }`}
        >
          Buscar
        </span>
      </button>

      {/* 3. Tu biblioteca */}
      <button
        onClick={() => onTabChange('library')}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 transition-colors cursor-pointer group active:scale-95 ${
          activeTab === 'library' ? 'text-white' : 'text-[#b3b3b3] hover:text-white'
        }`}
      >
        <div className="w-6 h-6 flex items-center justify-center">
          {activeTab === 'library' ? (
            /* Active Filled Library (Official Spotify Mobile SVG) */
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M14.5 2.134a1 1 0 0 1 1 0l6 3.464a1 1 0 0 1 .5.866V21a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V3a1 1 0 0 1 .5-.866zM3 22a1 1 0 0 1-1-1V3a1 1 0 0 1 2 0v18a1 1 0 0 1-1 1zm6 0a1 1 0 0 1-1-1V3a1 1 0 0 1 2 0v18a1 1 0 0 1-1 1z" />
            </svg>
          ) : (
            /* Inactive Slanted Books Library (Official Spotify Mobile SVG) */
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M14.5 2.134a1 1 0 0 1 1 0l6 3.464a1 1 0 0 1 .5.866V21a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V3a1 1 0 0 1 .5-.866M16 4.732V20h4V7.041zM3 22a1 1 0 0 1-1-1V3a1 1 0 0 1 2 0v18a1 1 0 0 1-1 1m6 0a1 1 0 0 1-1-1V3a1 1 0 0 1 2 0v18a1 1 0 0 1-1 1" />
            </svg>
          )}
        </div>
        <span
          className={`text-[10px] tracking-tight ${
            activeTab === 'library' ? 'font-bold text-white' : 'font-medium text-[#b3b3b3]'
          }`}
        >
          Tu biblioteca
        </span>
      </button>

      {/* 4. Crear with smooth + to × rotation and label hiding */}
      <button
        onClick={() => {
          if (onOpenCreate) {
            onOpenCreate();
          }
        }}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-1 transition-colors cursor-pointer group active:scale-95 ${
          isCreateOpen ? 'text-white' : 'text-[#b3b3b3] hover:text-white'
        }`}
        title="Crear"
      >
        <div
          className={`w-6 h-6 flex items-center justify-center transform transition-transform duration-300 ease-out ${
            isCreateOpen ? 'rotate-45 text-white' : 'rotate-0 text-[#b3b3b3] group-hover:text-white'
          }`}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M11 4.5a1 1 0 0 1 2 0v6.5H19.5a1 1 0 0 1 0 2H13V19.5a1 1 0 0 1-2 0V13H4.5a1 1 0 0 1 0-2H11V4.5z" />
          </svg>
        </div>
        <span
          className={`text-[10px] tracking-tight font-medium transition-all duration-200 overflow-hidden ${
            isCreateOpen
              ? 'opacity-0 max-h-0 -translate-y-1'
              : 'opacity-100 max-h-4 text-[#b3b3b3] group-hover:text-white'
          }`}
        >
          Crear
        </span>
      </button>
    </nav>
  );
};
