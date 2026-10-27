import React from 'react';
import { useUIStore } from '../../store/useUIStore';

export const DesktopShimmerFeed: React.FC = () => {
  const { setActiveMainTab } = useUIStore();

  return (
    <div className="select-none min-h-full pb-20 relative bg-[#121212] px-6 pt-4 space-y-8 font-['SpotifyMixUI',-apple-system,BlinkMacSystemFont,system-ui,sans-serif]">
      {/* Prominent Call-to-Action with Spotify native styling */}
      <div className="bg-gradient-to-r from-[#242424] to-[#181818] p-6 rounded-lg border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white tracking-tight font-['SpotifyMixUITitle']">
            Conecta tu biblioteca de Spotify
          </h2>
          <p className="text-sm text-[#b3b3b3]">
            Introduce tu cookie de sesión en opciones para sincronizar tus listas de reproducción personales.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            onClick={() => setActiveMainTab('guide')}
            className="text-xs font-bold text-[#b3b3b3] hover:text-white transition-colors px-3 py-2"
          >
            ¿Cómo obtener tu cookie?
          </button>
          <button
            onClick={() => setActiveMainTab('settings')}
            className="bg-white hover:bg-[#f0f0f0] active:scale-98 text-black text-xs font-bold px-5 py-2.5 rounded-full transition-transform shrink-0 cursor-pointer shadow hover:scale-104"
          >
            Ir a Configuración
          </button>
        </div>
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
