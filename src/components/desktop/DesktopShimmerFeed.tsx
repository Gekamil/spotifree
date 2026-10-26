import React from 'react';

interface DesktopShimmerFeedProps {
  onLogin?: () => void;
}

export const DesktopShimmerFeed: React.FC<DesktopShimmerFeedProps> = ({ onLogin }) => {
  return (
    <div className="select-none min-h-full pb-20 relative bg-[#121212] px-6 pt-4 space-y-8">
      {/* Prominent Call-to-Action to connect Spotify */}
      <div className="bg-gradient-to-r from-[#242424] to-[#181818] p-6 rounded-lg border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white tracking-tight font-['SpotifyMixUITitle']">
            Conecta tu cuenta de Spotify
          </h2>
          <p className="text-sm text-[#b3b3b3] opacity-80">
            Accede a tus listas, artistas y recomendaciones personalizadas
          </p>
        </div>
        {onLogin && (
          <button
            onClick={onLogin}
            className="bg-white hover:bg-[#f0f0f0] active:scale-98 text-black text-sm font-bold px-6 py-2.5 rounded-full transition-all shrink-0 cursor-pointer shadow hover:scale-104"
            title="Iniciar sesión con Spotify"
          >
            Iniciar sesión con Spotify
          </button>
        )}
      </div>

      {/* Quick Access Top 8 Grid Skeleton */}
      <div className="space-y-3">
        <div className="h-6 w-44 bg-[#1f1f1f] rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`shimmer-quick-${i}`}
              className="h-[48px] flex items-center bg-[#1f1f1f] rounded-[4px] overflow-hidden animate-pulse pr-3"
            >
              <div className="w-[48px] h-[48px] shrink-0 bg-[#282828] aspect-square" />
              <div className="ml-3 flex-1 space-y-1.5 min-w-0 pr-2">
                <div className="h-3.5 w-3/4 bg-[#282828] rounded opacity-60" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3 Shelf Shimmer Carousels */}
      {Array.from({ length: 3 }).map((_, shelfIdx) => (
        <div key={`shimmer-shelf-${shelfIdx}`} className="space-y-3">
          {/* Shelf Title Shimmer */}
          <div className="h-6 w-56 bg-[#1f1f1f] rounded animate-pulse mb-3" />

          {/* Carousel Track Shimmer */}
          <div className="flex gap-4 overflow-hidden py-2">
            {Array.from({ length: 6 }).map((_, cardIdx) => (
              <div
                key={`shimmer-card-${shelfIdx}-${cardIdx}`}
                className="w-[180px] shrink-0 bg-[#181818] p-3 rounded-md animate-pulse flex flex-col"
              >
                {/* 1:1 Aspect Ratio Artwork Placeholder */}
                <div className="aspect-square w-full rounded-[4px] bg-[#282828] mb-3" />
                {/* Title Line Placeholder */}
                <div className="h-3.5 w-3/4 bg-[#1f1f1f] rounded mb-2 opacity-70" />
                {/* Subtitle Line Placeholder */}
                <div className="h-3 w-1/2 bg-[#1f1f1f] rounded opacity-50" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
