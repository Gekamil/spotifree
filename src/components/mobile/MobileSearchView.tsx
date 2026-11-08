import React, { useState, useEffect } from 'react';
import { searchSpotify } from '../../services/spotifyApi';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useShallow } from 'zustand/react/shallow';
import { formatDuration } from '../../utils/formatters';
import { handleImageError } from '../../utils/imageFallback';
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  type RecentSearchItem,
} from '../../utils/recentSearches';
import { parseTrackArtists } from '../../utils/trackArtists';
import { CloseNativeIcon, SearchNativeIcon } from '../icons/SpotifyNativeIcons';
import { BROWSE_CATEGORIES } from '../../data/browseCategories';
import { useDailyCategoryHub } from '../../services/dailyCategoryHub';

interface MobileSearchViewProps {
  onSelectPlaylistById: (id: string, name?: string, image?: string) => void;
}

// Same tiles as the car's Explorar tab (src/data/browseCategories.ts)
const MOBILE_CATEGORIES = BROWSE_CATEGORIES;

export const MobileSearchView: React.FC<MobileSearchViewProps> = ({ onSelectPlaylistById }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ tracks: any[]; artists: any[]; playlists: any[] }>({
    tracks: [],
    artists: [],
    playlists: [],
  });
  const [filter, setFilter] = useState<'todo' | 'canciones' | 'artistas' | 'playlists'>('todo');
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>(() => getRecentSearches());
  const [selectedCat, setSelectedCat] = useState<(typeof MOBILE_CATEGORIES)[number] | null>(null);
  // Changes every day: curated playlists reshuffled + today's live picks
  const catShelves = useDailyCategoryHub(selectedCat?.id);

  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayerStore(
    useShallow((s) => ({ playTrack: s.playTrack, currentTrack: s.currentTrack, isPlaying: s.isPlaying, togglePlay: s.togglePlay }))
  );

  useEffect(() => {
    const handleRecentUpdate = () => {
      setRecentSearches(getRecentSearches());
    };
    window.addEventListener('spotifree_recent_searches_updated', handleRecentUpdate);
    return () => {
      window.removeEventListener('spotifree_recent_searches_updated', handleRecentUpdate);
    };
  }, []);

  const handleRecentItemClick = (item: RecentSearchItem) => {
    if (item.type === 'query') {
      setQuery(item.title);
    } else if (item.type === 'track') {
      const trackData = item.data || {
        id: item.id,
        name: item.title,
        artists: [{ name: item.subtitle.replace('Canción • ', '') }],
        duration_ms: 200000,
        album: { id: item.id, name: item.title, images: item.image ? [{ url: item.image }] : [] },
      };
      playTrack(trackData, [trackData]);
    } else if (item.type === 'artist') {
      const artistId = item.id.startsWith('art-') ? item.id : `art-${item.title.toLowerCase().replace(/[\s&]+/g, '-')}`;
      onSelectPlaylistById(artistId, item.title, item.image);
    } else if (item.type === 'playlist' || item.type === 'album') {
      onSelectPlaylistById(item.id, item.title, item.image);
    }
  };

  useEffect(() => {
    if (!query.trim()) {
      setResults({ tracks: [], artists: [], playlists: [] });
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const data = await searchSpotify(query);
        setResults({
          tracks: data?.tracks?.items || [],
          artists: data?.artists?.items || [],
          playlists: data?.playlists?.items || [],
        });
      } catch {
        setResults({ tracks: [], artists: [], playlists: [] });
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  if (selectedCat) {
    return (
      <div className="select-none text-white font-['SpotifyMixUI'] pb-36 -mx-4 -mt-4 spf-page-enter">
        <div
          className="relative px-4 pt-3 pb-7 overflow-hidden"
          style={{ backgroundColor: selectedCat.bgColor, backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0) 35%, #121212 100%)' }}
        >
          <button
            onClick={() => setSelectedCat(null)}
            className="w-9 h-9 -ml-1.5 flex items-center justify-center rounded-full active:bg-black/20 cursor-pointer"
            aria-label="Volver"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.957 2.793a1 1 0 0 1 0 1.414L8.164 12l7.793 7.793a1 1 0 1 1-1.414 1.414L5.336 12l9.207-9.207a1 1 0 0 1 1.414 0z" />
            </svg>
          </button>
          <h1 className="mt-6 text-[32px] leading-none font-black tracking-tight font-['SpotifyMixUITitle'] max-w-[70%]">
            {selectedCat.title}
          </h1>
          <img
            src={selectedCat.imgSrc}
            alt=""
            onError={handleImageError}
            className="absolute right-3 bottom-3 w-24 h-24 rounded shadow-xl rotate-[18deg] object-cover pointer-events-none"
          />
        </div>
        <div className="space-y-7 pt-2">
          {catShelves.map((shelf, i) => (
            <section key={`${shelf.title}-${i}`}>
              <h2 className="px-4 mb-3 text-[19px] font-bold tracking-tight font-['SpotifyMixUITitle']">{shelf.title}</h2>
              <div className="flex gap-3 overflow-x-auto px-4 scroll-px-4 no-scrollbar snap-x">
                {shelf.cards.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => onSelectPlaylistById(card.id, card.title, card.image)}
                    className="w-[132px] shrink-0 text-left snap-start active:scale-[0.97] transition-transform cursor-pointer"
                  >
                    <img
                      src={card.image}
                      alt={card.title}
                      loading="lazy"
                      onError={handleImageError}
                      className="w-[132px] h-[132px] rounded-md object-cover shadow-lg bg-[#282828]"
                    />
                    <p className="mt-2 text-[13px] font-semibold text-white line-clamp-1">{card.title}</p>
                    <p className="text-xs text-[#a7a7a7] line-clamp-2 leading-snug">{card.subtitle}</p>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="select-none text-white font-['SpotifyMixUI'] pb-36">
      {/* Title */}
      <h1 className="text-3xl font-black text-white font-['SpotifyMixUITitle'] tracking-tight mb-4 px-1">
        Buscar
      </h1>

      {/* Search Input Bar */}
      <div className="relative mb-5">
        <div className="h-12 bg-white rounded-md flex items-center px-3.5 shadow-md">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#121212" className="shrink-0 mr-2.5">
            <path d="M10.533 1.279c-5.18 0-9.407 4.14-9.407 9.279s4.226 9.279 9.407 9.279c2.234 0 4.29-.77 5.907-2.058l4.353 4.353a1 1 0 1 0 1.414-1.414l-4.344-4.344a9.157 9.157 0 0 0 2.077-5.816c0-5.14-4.226-9.279-9.407-9.279zm-7.407 9.279c0-4.006 3.302-7.279 7.407-7.279s7.407 3.273 7.407 7.279-3.302 7.279-7.407 7.279-7.407-3.273-7.407-7.279z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                addRecentSearch({
                  id: 'query-' + query.trim().toLowerCase(),
                  type: 'query',
                  title: query.trim(),
                  subtitle: 'Búsqueda',
                });
              }
            }}
            placeholder="¿Qué te apetece escuchar?"
            className="w-full h-full bg-transparent text-black text-sm font-semibold outline-none placeholder:text-[#535353]"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-[#535353] hover:text-black p-1 shrink-0 flex items-center justify-center"
              title="Borrar búsqueda"
            >
              <CloseNativeIcon size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Query Active: Filter Chips + Results */}
      {query.trim() ? (
        <div className="space-y-4">
          {/* Filter Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {(['todo', 'canciones', 'artistas', 'playlists'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`h-8 px-4 rounded-full text-xs font-bold capitalize shrink-0 transition-all ${
                  filter === f
                    ? 'bg-[#1ed760] text-black shadow'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {isSearching && (
            <div className="py-6 text-center text-xs text-[#b3b3b3] flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white/20 border-t-[#1ed760] rounded-full animate-spin" />
              <span>Buscando...</span>
            </div>
          )}

          {/* Results: Songs */}
          {(filter === 'todo' || filter === 'canciones') && results.tracks.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white mb-2">Canciones</h3>
              {results.tracks.slice(0, filter === 'todo' ? 5 : 20).map((trk) => {
                const isThisPlaying = isPlaying && currentTrack?.id === trk.id;
                const cover = trk.album?.images?.[0]?.url;

                return (
                  <div
                    key={trk.id}
                    onClick={() => {
                      addRecentSearch({
                        id: trk.id,
                        type: 'track',
                        title: trk.name,
                        subtitle: `Canción • ${parseTrackArtists(trk.artists).map((a: any) => a.name).join(', ') || ''}`,
                        image: cover,
                        data: trk,
                      });
                      if (currentTrack?.id === trk.id) {
                        togglePlay();
                      } else {
                        playTrack(trk, results.tracks);
                      }
                    }}
                    className="flex items-center justify-between p-2 rounded-lg active:bg-white/10 cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                      <div className="w-11 h-11 rounded overflow-hidden bg-[#242424] shrink-0 shadow">
                        {cover && (
                          <img
                            src={cover}
                            alt={trk.name}
                            onError={handleImageError}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span
                          className={`font-bold text-sm truncate ${
                            isThisPlaying ? 'text-[#1ed760]' : 'text-white'
                          }`}
                        >
                          {trk.name}
                        </span>
                        <span className="text-xs text-[#b3b3b3] truncate mt-0.5">
                          {parseTrackArtists(trk.artists).map((a: any) => a.name).join(', ')}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-[#b3b3b3]">
                      {formatDuration(trk.duration_ms)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Results: Artists */}
          {(filter === 'todo' || filter === 'artistas') && results.artists.length > 0 && (
            <div className="space-y-2 pt-2">
              <h3 className="text-sm font-bold text-white mb-2">Artistas</h3>
              {results.artists.slice(0, filter === 'todo' ? 4 : 12).map((art) => (
                <div
                  key={art.id}
                  onClick={() => {
                    addRecentSearch({
                      id: `art-${art.name.toLowerCase().replace(/\s+/g, '-')}`,
                      type: 'artist',
                      title: art.name,
                      subtitle: 'Artista',
                      image: art.images?.[0]?.url,
                    });
                    onSelectPlaylistById(`art-${art.name.toLowerCase().replace(/\s+/g, '-')}`, art.name, art.images?.[0]?.url);
                  }}
                  className="flex items-center gap-3 p-2 rounded-lg active:bg-white/10 cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-[#242424] shrink-0 shadow">
                    {art.images?.[0]?.url ? (
                      <img
                        src={art.images[0].url}
                        alt={art.name}
                        onError={handleImageError}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-lg bg-gradient-to-tr from-[#5018f0] to-[#1ed760] text-black">
                        {art.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-white truncate">
                      {art.name}
                    </span>
                    <span className="text-xs text-[#b3b3b3] mt-0.5">Artista</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Results: Playlists */}
          {(filter === 'todo' || filter === 'playlists') && results.playlists.length > 0 && (
            <div className="space-y-2 pt-2">
              <h3 className="text-sm font-bold text-white mb-2">Playlists</h3>
              {results.playlists.slice(0, filter === 'todo' ? 4 : 12).map((pl) => (
                <div
                  key={pl.id}
                  onClick={() => {
                    addRecentSearch({
                      id: pl.id,
                      type: 'playlist',
                      title: pl.name,
                      subtitle: `Playlist • ${pl.owner?.display_name || 'Spotify'}`,
                      image: pl.images?.[0]?.url,
                    });
                    onSelectPlaylistById(pl.id, pl.name, pl.images?.[0]?.url);
                  }}
                  className="flex items-center gap-3 p-2 rounded-lg active:bg-white/10 cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-md overflow-hidden bg-[#242424] shrink-0 shadow">
                    {pl.images?.[0]?.url && (
                      <img
                        src={pl.images[0].url}
                        alt={pl.name}
                        onError={handleImageError}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-white truncate">
                      {pl.name}
                    </span>
                    <span className="text-xs text-[#b3b3b3] mt-0.5 truncate">
                      Playlist • {pl.owner?.display_name || 'Spotify'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {recentSearches.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-base font-bold text-white font-['SpotifyMixUITitle']">
                  Búsquedas recientes
                </h2>
                <button
                  onClick={() => clearRecentSearches()}
                  className="text-xs font-semibold text-[#b3b3b3] active:text-white transition-colors"
                >
                  Borrar todo
                </button>
              </div>
              <div className="space-y-1">
                {recentSearches.slice(0, 10).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleRecentItemClick(item)}
                    className="flex items-center justify-between p-2 rounded-lg active:bg-white/10 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                      <div className={`w-12 h-12 overflow-hidden bg-[#242424] shrink-0 shadow ${item.type === 'artist' ? 'rounded-full' : 'rounded-md'}`}>
                        {item.image ? (
                          <img src={item.image} alt={item.title} className="w-full h-full object-cover" onError={handleImageError} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#727272]">
                            {item.type === 'query' ? <SearchNativeIcon size={24} className="text-[#a7a7a7]" /> : '♪'}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate leading-snug">{item.title}</p>
                        <p className="text-xs text-[#b3b3b3] truncate mt-0.5">{item.subtitle}</p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentSearch(item.id);
                      }}
                      className="text-[#b3b3b3] active:text-white p-2 shrink-0 text-sm"
                      title="Eliminar de búsquedas recientes"
                    >
                      <CloseNativeIcon size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2-Column "Explorar todo" Genre Cards Grid matching Spotify Mobile 02_mobile_search.png */}
          <div className="space-y-3">
            <h2 className="text-base font-bold text-white font-['SpotifyMixUITitle'] px-1">
              Explorar todo
            </h2>

            <div className="grid grid-cols-2 gap-3">
              {MOBILE_CATEGORIES.map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => {
                    setSelectedCat(cat);
                    try {
                      document.querySelector('[data-mobile-scroll]')?.scrollTo({ top: 0 });
                    } catch {}
                  }}
                  style={{ backgroundColor: cat.bgColor }}
                  className="relative h-24 rounded-lg p-3 overflow-hidden cursor-pointer active:scale-98 transition-transform shadow-md"
                >
                  <h3 className="text-base font-black text-white leading-tight break-words max-w-[65%] z-10 relative font-['SpotifyMixUITitle']">
                    {cat.title}
                  </h3>
                  <img
                    src={cat.imgSrc}
                    alt={cat.title}
                    onError={handleImageError}
                    className="absolute -bottom-2 -right-3 w-16 h-16 rounded shadow-lg transform rotate-[25deg] object-cover pointer-events-none"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
