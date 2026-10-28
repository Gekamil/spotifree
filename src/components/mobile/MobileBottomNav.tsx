import React from 'react';

interface MobileBottomNavProps {
  activeTab: 'home' | 'search' | 'library';
  onTabChange: (tab: 'home' | 'search' | 'library') => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 h-[68px] pb-3 flex items-center justify-around z-40 px-3 select-none font-['SpotifyMixUI'] pointer-events-auto"
      style={{
        background:
          'linear-gradient(180deg, rgba(18, 18, 18, 0.4) 0%, rgba(10, 10, 10, 0.85) 25%, rgba(0, 0, 0, 0.98) 100%)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      }}
    >
      {/* 1. Inicio */}
      <button
        onClick={() => onTabChange('home')}
        className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group active:scale-95 ${
          activeTab === 'home' ? 'text-white' : 'text-[#b3b3b3] hover:text-white'
        }`}
      >
        <div className="w-6 h-6 flex items-center justify-center">
          {activeTab === 'home' ? (
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M12.5 3.247a1 1 0 0 0-1 0L4 7.577V20h4.5v-6a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v6H20V7.577l-7.5-4.33z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M13.5 1.515a3 3 0 0 0-3 0L3 5.845a2 2 0 0 0-1 1.732V21a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6h4v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7.577a2 2 0 0 0-1-1.732l-7.5-4.33zM4 7.577l7.5-4.33 7.5 4.33V20h-4v-6a3 3 0 0 0-3-3h-4a3 3 0 0 0-3 3v6H4V7.577z" />
            </svg>
          )}
        </div>
        <span
          className={`text-[11px] tracking-tight font-medium ${
            activeTab === 'home' ? 'font-bold text-white' : 'text-[#b3b3b3]'
          }`}
        >
          Inicio
        </span>
      </button>

      {/* 2. Buscar */}
      <button
        onClick={() => onTabChange('search')}
        className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group active:scale-95 ${
          activeTab === 'search' ? 'text-white' : 'text-[#b3b3b3] hover:text-white'
        }`}
      >
        <div className="w-6 h-6 flex items-center justify-center">
          {activeTab === 'search' ? (
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M15.356 10.533a4.824 4.824 0 1 1-9.647 0 4.824 4.824 0 0 1 9.647 0z" />
              <path d="M10.533 1.279c-5.18 0-9.407 4.14-9.407 9.279s4.226 9.279 9.407 9.279c2.234 0 4.29-.77 5.907-2.058l4.353 4.353a1 1 0 1 0 1.414-1.414l-4.344-4.344a9.157 9.157 0 0 0 2.077-5.816c0-5.14-4.226-9.279-9.407-9.279zm-7.407 9.279c0-4.006 3.302-7.279 7.407-7.279s7.407 3.273 7.407 7.279-3.302 7.279-7.407 7.279-7.407-3.273-7.407-7.279z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M10.533 1.279c-5.18 0-9.407 4.14-9.407 9.279s4.226 9.279 9.407 9.279c2.234 0 4.29-.77 5.907-2.058l4.353 4.353a1 1 0 1 0 1.414-1.414l-4.344-4.344a9.157 9.157 0 0 0 2.077-5.816c0-5.14-4.226-9.279-9.407-9.279zm-7.407 9.279c0-4.006 3.302-7.279 7.407-7.279s7.407 3.273 7.407 7.279-3.302 7.279-7.407 7.279-7.407-3.273-7.407-7.279z" />
            </svg>
          )}
        </div>
        <span
          className={`text-[11px] tracking-tight font-medium ${
            activeTab === 'search' ? 'font-bold text-white' : 'text-[#b3b3b3]'
          }`}
        >
          Buscar
        </span>
      </button>

      {/* 3. Tu biblioteca */}
      <button
        onClick={() => onTabChange('library')}
        className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all cursor-pointer group active:scale-95 ${
          activeTab === 'library' ? 'text-white' : 'text-[#b3b3b3] hover:text-white'
        }`}
      >
        <div className="w-6 h-6 flex items-center justify-center">
          {activeTab === 'library' ? (
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M3 22a1 1 0 0 1-1-1V3a1 1 0 0 1 2 0v18a1 1 0 0 1-1 1zM15.5 2.25a.75.75 0 0 1 .75.75v18a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75zM6 4h4v16H6V4zm12.868-1.622a.75.75 0 0 1 1.01.372l5.5 13.5a.75.75 0 0 1-1.382.563l-5.5-13.5a.75.75 0 0 1 .372-1.01z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
              <path d="M14.5 2.25a.75.75 0 0 1 .75.75v18a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75zM4 3a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 .75.75v18a.75.75 0 0 1-.75.75h-2.5A.75.75 0 0 1 4 21V3zm2 17.25h1V3.75H6v16.5zM18.868 2.378a.75.75 0 0 1 1.01.372l5.5 13.5a.75.75 0 0 1-1.382.563l-5.5-13.5a.75.75 0 0 1 .372-1.01z" />
            </svg>
          )}
        </div>
        <span
          className={`text-[11px] tracking-tight font-medium ${
            activeTab === 'library' ? 'font-bold text-white' : 'text-[#b3b3b3]'
          }`}
        >
          Tu biblioteca
        </span>
      </button>
    </nav>
  );
};
