import React, { useState, useEffect, useMemo } from 'react';
import { handleImageError } from '../../utils/imageFallback';

export interface LibraryCandidateItem {
  id: string;
  name: string;
  type: 'playlist' | 'artist';
  image: string;
  subtitle: string;
}

const DEFAULT_POPULAR_CANDIDATES: LibraryCandidateItem[] = [
  // Top Artists / Cantantes
  {
    id: 'artist:bad_bunny',
    name: 'Bad Bunny',
    type: 'artist',
    image: 'https://i.scdn.co/image/ab6761610000e5eb9ad50e478a4696881775a6fe',
    subtitle: 'Artista',
  },
  {
    id: 'artist:quevedo',
    name: 'Quevedo',
    type: 'artist',
    image: 'https://i.scdn.co/image/ab6761610000e5eb5b23d91c7844ccb7541e25e8',
    subtitle: 'Artista',
  },
  {
    id: 'artist:feid',
    name: 'Feid',
    type: 'artist',
    image: 'https://i.scdn.co/image/ab6761610000e5eb5629c1936c0a762ce3b879a9',
    subtitle: 'Artista',
  },
  {
    id: 'artist:rosalia',
    name: 'ROSALÍA',
    type: 'artist',
    image: 'https://i.scdn.co/image/ab6761610000e5eb4f4cb1be773e34b9d5c4125c',
    subtitle: 'Artista',
  },
  {
    id: 'artist:myke_towers',
    name: 'Myke Towers',
    type: 'artist',
    image: 'https://i.scdn.co/image/ab6761610000e5ebcb7f4a72d73fc7ae3e085e92',
    subtitle: 'Artista',
  },
  {
    id: 'artist:mora',
    name: 'Mora',
    type: 'artist',
    image: 'https://i.scdn.co/image/ab6761610000e5eb268a2bf6cb87c2b3e5a5933c',
    subtitle: 'Artista',
  },
  {
    id: 'artist:aitana',
    name: 'Aitana',
    type: 'artist',
    image: 'https://i.scdn.co/image/ab6761610000e5ebcae02611e3b6a96f849cf271',
    subtitle: 'Artista',
  },
  {
    id: 'artist:duki',
    name: 'Duki',
    type: 'artist',
    image: 'https://i.scdn.co/image/ab6761610000e5ebd1c416e09fb581c7f5367873',
    subtitle: 'Artista',
  },
  {
    id: 'artist:bizarrap',
    name: 'Bizarrap',
    type: 'artist',
    image: 'https://i.scdn.co/image/ab6761610000e5eb5b2149b14f8fa9596395dcfa',
    subtitle: 'Artista',
  },
  {
    id: 'artist:anuel_aa',
    name: 'Anuel AA',
    type: 'artist',
    image: 'https://i.scdn.co/image/ab6761610000e5eb36d9365e6d6286fa6c9a05a4',
    subtitle: 'Artista',
  },
  {
    id: 'artist:rauw_alejandro',
    name: 'Rauw Alejandro',
    type: 'artist',
    image: 'https://i.scdn.co/image/ab6761610000e5ebb6b9f5a052fffa480b0949d0',
    subtitle: 'Artista',
  },
  {
    id: 'artist:the_weeknd',
    name: 'The Weeknd',
    type: 'artist',
    image: 'https://i.scdn.co/image/ab6761610000e5eb214f3cf1cbe7139c1e26ffbb',
    subtitle: 'Artista',
  },
  // Top Playlists
  {
    id: '37i9dQZF1DXcBWIGoYBM5M',
    name: "Today's Top Hits",
    type: 'playlist',
    image: 'https://i.scdn.co/image/ab67706f000000025f1ff414b434c75953531b79',
    subtitle: 'Playlist • Spotify',
  },
  {
    id: '37i9dQZF1DX10zKzsJ2jva',
    name: '¡Viva Latino!',
    type: 'playlist',
    image: 'https://i.scdn.co/image/ab67706f000000022d4f23e20d20d489b09ff382',
    subtitle: 'Playlist • Spotify',
  },
  {
    id: '37i9dQZF1DX5q67ZpWyRrZ',
    name: 'Éxitos España',
    type: 'playlist',
    image: 'https://i.scdn.co/image/ab67706f000000021c327cfebbb8144bda2f785a',
    subtitle: 'Playlist • Spotify',
  },
  {
    id: '37i9dQZF1DX4vth7idTQch',
    name: 'Pop con Ñ',
    type: 'playlist',
    image: 'https://i.scdn.co/image/ab67706f000000029b3c43491f2479e0fa950cb6',
    subtitle: 'Playlist • Spotify',
  },
  {
    id: '37i9dQZF1DX8SfyweOX9ve',
    name: 'Mansión Reggaetón',
    type: 'playlist',
    image: 'https://i.scdn.co/image/ab67706f00000002eec87a275466a0fe38779c13',
    subtitle: 'Playlist • Spotify',
  },
  {
    id: '37i9dQZEVXbMDoHDwVN2tF',
    name: 'Top 50 - Global',
    type: 'playlist',
    image: 'https://charts-images.scdn.co/assets/locale_en/regional/daily/region_global_default.jpg',
    subtitle: 'Playlist • Spotify',
  },
];

interface MobileAddLibraryItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItems: (items: LibraryCandidateItem[]) => void;
  existingIds?: string[];
}

export const MobileAddLibraryItemsModal: React.FC<MobileAddLibraryItemsModalProps> = ({
  isOpen,
  onClose,
  onAddItems,
  existingIds = [],
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'artists' | 'playlists'>('all');
  const [selectedMap, setSelectedMap] = useState<Map<string, LibraryCandidateItem>>(new Map());
  const [dynamicItems, setDynamicItems] = useState<LibraryCandidateItem[]>(DEFAULT_POPULAR_CANDIDATES);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedMap(new Map());
      setSearchQuery('');
      setActiveFilter('all');
    }
  }, [isOpen]);

  // Live search lookup
  useEffect(() => {
    if (!searchQuery.trim()) {
      setDynamicItems(DEFAULT_POPULAR_CANDIDATES);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const q = searchQuery.trim();
        // 1. Search iTunes for matching artists
        const itunesRes = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=musicArtist&limit=6`
        );
        let artistCandidates: LibraryCandidateItem[] = [];
        if (itunesRes.ok) {
          const data = await itunesRes.json();
          if (data.results && data.results.length > 0) {
            artistCandidates = data.results.map((r: any) => ({
              id: `artist:${r.artistId || r.artistName}`,
              name: r.artistName,
              type: 'artist' as const,
              image: `https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80`,
              subtitle: 'Artista',
            }));
          }
        }

        // 2. Filter local catalog
        const localMatches = DEFAULT_POPULAR_CANDIDATES.filter((item) =>
          item.name.toLowerCase().includes(q.toLowerCase())
        );

        if (!cancelled) {
          // Combine unique
          const combined = [...localMatches];
          artistCandidates.forEach((art) => {
            if (!combined.some((x) => x.name.toLowerCase() === art.name.toLowerCase())) {
              combined.push(art);
            }
          });
          setDynamicItems(combined);
          setIsSearching(false);
        }
      } catch {
        if (!cancelled) setIsSearching(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const displayedItems = useMemo(() => {
    return dynamicItems.filter((item) => {
      if (activeFilter === 'artists') return item.type === 'artist';
      if (activeFilter === 'playlists') return item.type === 'playlist';
      return true;
    });
  }, [dynamicItems, activeFilter]);

  if (!isOpen) return null;

  const toggleSelect = (item: LibraryCandidateItem) => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, item);
      }
      return next;
    });
  };

  const handleDone = () => {
    const items = Array.from(selectedMap.values());
    if (items.length > 0) {
      onAddItems(items);
    }
    onClose();
  };

  const count = selectedMap.size;

  return (
    <div className="fixed inset-0 z-[120] bg-[#121212] flex flex-col font-['SpotifyMixUI'] select-none animate-in slide-in-from-bottom duration-250">
      {/* Top Header */}
      <div className="sticky top-0 z-20 px-4 pt-3 pb-2 bg-[#121212]/95 backdrop-blur-md border-b border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-white/70 hover:text-white active:scale-90 transition-transform cursor-pointer"
            title="Cerrar"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" />
            </svg>
          </button>

          <h2 className="text-base font-black text-white font-['SpotifyMixUITitle'] text-center flex-1">
            Añadir a tu biblioteca
          </h2>

          <div className="w-9" />
        </div>

        {/* Search input bar */}
        <div className="relative w-full">
          <div className="absolute left-3.5 top-2.5 text-[#b3b3b3]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10.533 1.27893C5.35215 1.27893 1.12598 5.41887 1.12598 10.5579C1.12598 15.697 5.35215 19.8369 10.533 19.8369C12.767 19.8369 14.8235 19.0671 16.4402 17.7794L20.7929 22.132C21.1834 22.5226 21.8166 22.5226 22.2071 22.132C22.5976 21.7415 22.5976 21.1083 22.2071 20.7178L17.8634 16.3741C19.1616 14.7849 19.94 12.7634 19.94 10.5579C19.94 5.41887 15.7138 1.27893 10.533 1.27893ZM3.12598 10.5579C3.12598 6.55226 6.42768 3.27893 10.533 3.27893C14.6383 3.27893 17.94 6.55226 17.94 10.5579C17.94 14.5636 14.6383 17.8369 10.533 17.8369C6.42768 17.8369 3.12598 14.5636 3.12598 10.5579Z" />
            </svg>
          </div>
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar playlists y cantantes..."
            className="w-full h-10 pl-10 pr-9 bg-[#242424] text-white text-sm rounded-full outline-none placeholder:text-[#a7a7a7] border border-white/10 focus:border-white/30 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-[#b3b3b3] hover:text-white p-0.5 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 pb-1 overflow-x-auto scrollbar-none">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'artists', label: 'Artistas' },
            { id: 'playlists', label: 'Playlists' },
          ].map((chip) => {
            const isSelected = activeFilter === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setActiveFilter(chip.id as any)}
                className={`h-7 px-3.5 rounded-full text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-white text-black font-black'
                    : 'bg-white/10 text-white hover:bg-white/15'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Items List */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1 pb-28">
        {isSearching && (
          <div className="py-4 text-center text-xs text-[#b3b3b3] flex items-center justify-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-[#1ed760] rounded-full animate-spin" />
            <span>Buscando...</span>
          </div>
        )}

        {displayedItems.map((item) => {
          const isSelected = selectedMap.has(item.id);
          const isAlreadyInLibrary = existingIds.includes(item.id);

          return (
            <div
              key={item.id}
              onClick={() => toggleSelect(item)}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1 mr-3">
                <img
                  src={item.image}
                  alt={item.name}
                  onError={handleImageError}
                  className={`w-14 h-14 object-cover bg-[#282828] shadow shrink-0 ${
                    item.type === 'artist' ? 'rounded-full' : 'rounded-[4px]'
                  }`}
                />
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-white text-sm truncate">
                    {item.name}
                  </span>
                  <span className="text-xs text-[#b3b3b3] truncate mt-0.5">
                    {item.subtitle}
                  </span>
                </div>
              </div>

              {/* Tick Button */}
              <div className="shrink-0 pl-2">
                {isSelected || isAlreadyInLibrary ? (
                  <div className="w-7 h-7 rounded-full bg-[#1ed760] flex items-center justify-center text-black shadow transition-transform active:scale-90">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full border-2 border-white/40 group-hover:border-white transition-colors flex items-center justify-center active:scale-90" />
                )}
              </div>
            </div>
          );
        })}

        {displayedItems.length === 0 && !isSearching && (
          <div className="py-16 text-center text-[#b3b3b3] text-sm">
            No se han encontrado resultados para "{searchQuery}"
          </div>
        )}
      </div>

      {/* Sticky Bottom Bar with "Hecho" button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#121212] via-[#121212]/95 to-transparent flex items-center justify-center pointer-events-none z-30">
        <button
          onClick={handleDone}
          className="pointer-events-auto w-full max-w-sm h-12 rounded-full bg-white text-black font-bold text-sm tracking-wide shadow-2xl hover:scale-102 active:scale-95 transition-all flex items-center justify-center cursor-pointer"
        >
          {count > 0 ? `Hecho (${count})` : 'Hecho'}
        </button>
      </div>
    </div>
  );
};
