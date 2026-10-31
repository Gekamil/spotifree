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
  // Top Artists con fotos reales y verificadas
  {
    id: 'artist:bad_bunny',
    name: 'Bad Bunny',
    type: 'artist',
    image: 'https://cdn-images.dzcdn.net/images/artist/9867d5112c6714c935a86b98b4dd288c/250x250-000000-80-0-0.jpg',
    subtitle: 'Artista',
  },
  {
    id: 'artist:quevedo',
    name: 'Quevedo',
    type: 'artist',
    image: 'https://cdn-images.dzcdn.net/images/artist/79880cc1b999b15567e332203464c34e/250x250-000000-80-0-0.jpg',
    subtitle: 'Artista',
  },
  {
    id: 'artist:feid',
    name: 'Feid',
    type: 'artist',
    image: 'https://cdn-images.dzcdn.net/images/artist/e629c93e03b3c225d8d52a42bae71537/250x250-000000-80-0-0.jpg',
    subtitle: 'Artista',
  },
  {
    id: 'artist:rosalia',
    name: 'ROSALÍA',
    type: 'artist',
    image: 'https://cdn-images.dzcdn.net/images/artist/98d80d739eea47a52c21ce5e34dd15f3/250x250-000000-80-0-0.jpg',
    subtitle: 'Artista',
  },
  {
    id: 'artist:myke_towers',
    name: 'Myke Towers',
    type: 'artist',
    image: 'https://cdn-images.dzcdn.net/images/artist/d3a7418b4e44bf8ee3ae268067a86f09/250x250-000000-80-0-0.jpg',
    subtitle: 'Artista',
  },
  {
    id: 'artist:mora',
    name: 'Mora',
    type: 'artist',
    image: 'https://cdn-images.dzcdn.net/images/artist/41f7c7b1d3e4ead41fa9ec6aea33d736/250x250-000000-80-0-0.jpg',
    subtitle: 'Artista',
  },
  {
    id: 'artist:aitana',
    name: 'Aitana',
    type: 'artist',
    image: 'https://cdn-images.dzcdn.net/images/artist/41a75229e7fb63066c6b8be08ff0dbce/250x250-000000-80-0-0.jpg',
    subtitle: 'Artista',
  },
  {
    id: 'artist:duki',
    name: 'Duki',
    type: 'artist',
    image: 'https://cdn-images.dzcdn.net/images/artist/795d09a17bc833425e4b88639bb931af/250x250-000000-80-0-0.jpg',
    subtitle: 'Artista',
  },
  {
    id: 'artist:bizarrap',
    name: 'Bizarrap',
    type: 'artist',
    image: 'https://cdn-images.dzcdn.net/images/artist/e121c1ef9b1135e6a5b71c1e65ab10b4/250x250-000000-80-0-0.jpg',
    subtitle: 'Artista',
  },
  {
    id: 'artist:anuel_aa',
    name: 'Anuel AA',
    type: 'artist',
    image: 'https://cdn-images.dzcdn.net/images/artist/d128822eb60817b362b9d6e8c696e933/250x250-000000-80-0-0.jpg',
    subtitle: 'Artista',
  },
  {
    id: 'artist:rauw_alejandro',
    name: 'Rauw Alejandro',
    type: 'artist',
    image: 'https://cdn-images.dzcdn.net/images/artist/0e7b2b93b91789a054bc3f08bb3df3a8/250x250-000000-80-0-0.jpg',
    subtitle: 'Artista',
  },
  {
    id: 'artist:the_weeknd',
    name: 'The Weeknd',
    type: 'artist',
    image: 'https://cdn-images.dzcdn.net/images/artist/581693b4724a7fcfa754455101e13a44/250x250-000000-80-0-0.jpg',
    subtitle: 'Artista',
  },
  // Top Playlists con portadas oficiales
  {
    id: '37i9dQZF1DXcBWIGoYBM5M',
    name: "Today's Top Hits",
    type: 'playlist',
    image: 'https://cdn-images.dzcdn.net/images/cover/518d7d043e005c17c96db2afb94f790f-141bba4b1ed8b5f04bf5f688c426dfab-a486d07805b171a5ba074ef59f5e7f8b-f7f85b17171a8b1d062dca5484c022de/250x250-000000-80-0-0.jpg',
    subtitle: 'Playlist • Spotify',
  },
  {
    id: '37i9dQZF1DX10zKzsJ2jva',
    name: '¡Viva Latino!',
    type: 'playlist',
    image: 'https://cdn-images.dzcdn.net/images/cover/f12cffbd0bf4451d7bbd3b1c636357c6-06bcdb6df8577e669479d57ca94dd78a-eff0e0e2fdd26ab5bd8a3d1529a12f3a-68b6ebdd0514f16c57a87552a33d26d3/250x250-000000-80-0-0.jpg',
    subtitle: 'Playlist • Spotify',
  },
  {
    id: '37i9dQZF1DX5q67ZpWyRrZ',
    name: 'Éxitos España',
    type: 'playlist',
    image: 'https://cdn-images.dzcdn.net/images/playlist/ef999f5fd9af88db516ad6626dcf4a89/250x250-000000-80-0-0.jpg',
    subtitle: 'Playlist • Spotify',
  },
  {
    id: '37i9dQZF1DX4vth7idTQch',
    name: 'Pop con Ñ',
    type: 'playlist',
    image: 'https://cdn-images.dzcdn.net/images/playlist/c4fc444ba8f01b78163f2232a23b11fa/250x250-000000-80-0-0.jpg',
    subtitle: 'Playlist • Spotify',
  },
  {
    id: '37i9dQZF1DX8SfyweOX9ve',
    name: 'Mansión Reggaetón',
    type: 'playlist',
    image: 'https://cdn-images.dzcdn.net/images/cover/fee4b7345f658a57a39747bf24b7466b-75aca8c6d242de6db22a9e22fbbf1ba9-7b2f6f5a8aeabafef0bd9ee26f937423-83d6fc387d304ee19772bf970ab7b477/250x250-000000-80-0-0.jpg',
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

  // Live search lookup with real artist photos & playlist covers
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

        // 1. Search iTunes for artists and songs
        const itunesRes = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=10`
        );
        let foundCandidates: LibraryCandidateItem[] = [];

        if (itunesRes.ok) {
          const data = await itunesRes.json();
          if (data.results && data.results.length > 0) {
            const seenArtists = new Set<string>();

            for (const r of data.results) {
              const artName = r.artistName;
              if (artName && !seenArtists.has(artName.toLowerCase())) {
                seenArtists.add(artName.toLowerCase());

                // Try to get artist portrait from artist-image endpoint or use high-res iTunes artwork
                let artImg = (r.artworkUrl100 || '').replace('100x100bb', '600x600bb');
                try {
                  const artRes = await fetch(`/api/artist-image?name=${encodeURIComponent(artName)}`);
                  if (artRes.ok) {
                    const artData = await artRes.json();
                    if (artData.picture) {
                      artImg = artData.picture;
                    }
                  }
                } catch {}

                foundCandidates.push({
                  id: `artist:${r.artistId || artName}`,
                  name: artName,
                  type: 'artist',
                  image: artImg || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg',
                  subtitle: 'Artista',
                });
              }

              // Also add collection/album as playlist candidate
              if (r.collectionName && !foundCandidates.some(c => c.name.toLowerCase() === r.collectionName.toLowerCase())) {
                const albCover = (r.artworkUrl100 || '').replace('100x100bb', '600x600bb');
                foundCandidates.push({
                  id: `album:${r.collectionId || r.collectionName}`,
                  name: r.collectionName,
                  type: 'playlist',
                  image: albCover || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg',
                  subtitle: `Álbum • ${artName}`,
                });
              }
            }
          }
        }

        // 2. Filter local catalog matches
        const localMatches = DEFAULT_POPULAR_CANDIDATES.filter((item) =>
          item.name.toLowerCase().includes(q.toLowerCase())
        );

        if (!cancelled) {
          const combined = [...localMatches];
          foundCandidates.forEach((cand) => {
            if (!combined.some((x) => x.name.toLowerCase() === cand.name.toLowerCase())) {
              combined.push(cand);
            }
          });
          setDynamicItems(combined);
          setIsSearching(false);
        }
      } catch {
        if (!cancelled) setIsSearching(false);
      }
    }, 300);

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
              className="absolute right-3 top-2.5 text-[#b3b3b3] hover:text-white p-0.5 text-xs cursor-pointer"
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
                  className={`w-12 h-12 object-cover bg-[#282828] shadow shrink-0 ${
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
