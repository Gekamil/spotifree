import React from 'react';

interface SpotifyHomeSkeletonProps {
  isMobile?: boolean;
}

export const SpotifyHomeSkeleton: React.FC<SpotifyHomeSkeletonProps> = ({ isMobile = false }) => {
  if (isMobile) {
    return (
      <div className="min-h-full px-4 pt-2 pb-12 space-y-6 animate-pulse select-none" aria-busy="true" aria-label="Cargando contenido">
        {/* Greeting placeholder */}
        <div className="pt-2 pb-1">
          <div className="h-7 w-44 rounded-full spf-skeleton" />
        </div>

        {/* Quick Access 2-Column Grid */}
        <div className="grid grid-cols-2 gap-1.5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={`m-skel-qa-${i}`}
              className="h-12 bg-[#242424] rounded-[4px] overflow-hidden flex items-center pr-2"
            >
              <div className="w-12 h-12 spf-skeleton shrink-0 rounded-l-[4px]" />
              <div className="ml-2.5 flex-1 min-w-0 pr-1">
                <div
                  className="h-3 rounded-full spf-skeleton"
                  style={{ width: `${60 + ((i * 17) % 35)}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Shelf 1 */}
        <div className="space-y-3 pt-2">
          <div className="h-5 w-36 rounded-full spf-skeleton" />
          <div className="flex gap-3.5 overflow-hidden -mx-4 px-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={`m-skel-s1-${i}`} className="w-36 shrink-0 space-y-2">
                <div className="w-36 h-36 rounded-md spf-skeleton shadow-md" />
                <div className="h-3 w-28 rounded-full spf-skeleton" />
                <div className="h-2.5 w-16 rounded-full spf-skeleton opacity-70" />
              </div>
            ))}
          </div>
        </div>

        {/* Shelf 2 */}
        <div className="space-y-3 pt-2">
          <div className="h-5 w-48 rounded-full spf-skeleton" />
          <div className="flex gap-3.5 overflow-hidden -mx-4 px-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={`m-skel-s2-${i}`} className="w-36 shrink-0 space-y-2">
                <div className="w-36 h-36 rounded-md spf-skeleton shadow-md" />
                <div className="h-3 w-24 rounded-full spf-skeleton" />
                <div className="h-2.5 w-20 rounded-full spf-skeleton opacity-70" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Desktop Home Skeleton
  return (
    <div className="min-h-full px-6 pt-4 pb-16 space-y-8 animate-pulse select-none" aria-busy="true" aria-label="Cargando contenido">
      {/* Top Filter Chips placeholder */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-14 rounded-full spf-skeleton" />
        <div className="h-8 w-18 rounded-full spf-skeleton opacity-70" />
      </div>

      {/* Quick Access Shortcuts Grid (2 cols or 4 cols) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={`d-skel-qa-${i}`}
            className="h-[56px] bg-white/[0.04] rounded-[4px] overflow-hidden flex items-center pr-3"
          >
            <div className="w-[56px] h-[56px] spf-skeleton shrink-0" />
            <div className="ml-3 flex-1 min-w-0">
              <div
                className="h-3.5 rounded-full spf-skeleton"
                style={{ width: `${55 + ((i * 19) % 35)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Shelf 1 */}
      <div className="space-y-3 pt-4">
        <div className="h-6 w-48 rounded-full spf-skeleton" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={`d-skel-s1-${i}`} className="p-3 bg-[#181818]/60 rounded-md space-y-2.5">
              <div className="aspect-square w-full rounded-md spf-skeleton shadow-lg" />
              <div className="h-3.5 w-3/4 rounded-full spf-skeleton" />
              <div className="h-2.5 w-1/2 rounded-full spf-skeleton opacity-70" />
            </div>
          ))}
        </div>
      </div>

      {/* Shelf 2 */}
      <div className="space-y-3 pt-4">
        <div className="h-6 w-56 rounded-full spf-skeleton" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={`d-skel-s2-${i}`} className="p-3 bg-[#181818]/60 rounded-md space-y-2.5">
              <div className="aspect-square w-full rounded-md spf-skeleton shadow-lg" />
              <div className="h-3.5 w-2/3 rounded-full spf-skeleton" />
              <div className="h-2.5 w-1/3 rounded-full spf-skeleton opacity-70" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SpotifyHomeSkeleton;
