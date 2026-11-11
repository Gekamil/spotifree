import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useShallow } from 'zustand/react/shallow';
import { PlayNativeIcon, PauseNativeIcon, CloseNativeIcon, SearchNativeIcon } from '../icons/SpotifyNativeIcons';
import { formatDuration } from '../../utils/formatters';
import { searchSpotify } from '../../services/spotifyApi';
import { DesktopShelfCarousel } from './DesktopShelfCarousel';
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch,
  clearRecentSearches,
  type RecentSearchItem,
} from '../../utils/recentSearches';
import { parseTrackArtists } from '../../utils/trackArtists';

import { useDailyCategoryHub } from '../../services/dailyCategoryHub';

const CategoryCardItem: React.FC<{
  cat: typeof officialCategories[0];
  onClick: () => void;
}> = ({ cat, onClick }) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      onClick={onClick}
      style={{ backgroundColor: cat.bgColor }}
      className="relative h-[180px] rounded-lg p-4 overflow-hidden cursor-pointer select-none shadow-md group hover:brightness-105 active:scale-98 transition-all"
    >
      <h3 className="text-2xl font-black text-white leading-tight break-words max-w-[65%] z-10 relative font-['SpotifyMixUITitle'] tracking-tight">
        {cat.title}
      </h3>
      {!imgFailed && cat.imgSrc ? (
        <img
          src={cat.imgSrc}
          alt={cat.title}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="absolute -bottom-2 -right-4 w-[100px] h-[100px] rounded-[4px] shadow-[-2px_4px_12px_rgba(0,0,0,0.4)] transform rotate-[25deg] translate-x-2 translate-y-1 group-hover:scale-105 group-hover:rotate-[28deg] transition-transform duration-200 object-cover"
        />
      ) : (
        <div className="absolute -bottom-2 -right-4 w-[96px] h-[96px] rounded-full bg-white/10 flex items-center justify-center transform rotate-[20deg] translate-x-1 translate-y-1">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </div>
      )}
    </div>
  );
};

const officialCategories = [
  {
    id: 'cat-musica',
    title: 'Música',
    bgColor: 'rgb(220, 20, 140)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/fe/4c/99/fe4c99b8-c55b-6cab-4799-520953a9e74d/artwork.jpg/600x600bb.jpg',
  },
  {
    id: 'cat-eventos',
    title: 'Eventos en directo',
    bgColor: 'rgb(115, 88, 255)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/3d/ac/6a/3dac6a5f-d4be-32c6-6e4a-c7a79fe5bfd9/715187754720.png/600x600bb.jpg',
  },
  {
    id: 'cat-para-ti',
    title: 'Especialmente para ti',
    bgColor: 'rgb(30, 50, 100)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/4a/b8/51/4ab851d0-7c24-2406-6647-d6622f99d39b/199066743287.jpg/600x600bb.jpg',
  },
  {
    id: 'cat-novedades',
    title: 'Novedades',
    bgColor: 'rgb(45, 70, 185)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b8/02/bd/b802bd1d-c601-74a9-c194-b2fea8d5ed1b/5026854930541.jpg/600x600bb.jpg',
  },
  {
    id: 'cat-latina',
    title: 'Latina',
    bgColor: 'rgb(13, 115, 236)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b1/e2/3f/b1e23f6e-29ba-c816-cd4a-2f995c19a25d/886447345481.jpg/600x600bb.jpg',
  },
  {
    id: 'cat-pop',
    title: 'Pop',
    bgColor: 'rgb(20, 138, 8)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/33/87/c8/3387c827-adaa-681d-bd10-ce7d8e888b9c/22UMGIM21054.rgb.jpg/600x600bb.jpg',
  },
  {
    id: 'cat-rock',
    title: 'Rock',
    bgColor: 'rgb(188, 89, 0)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/3d/ac/6a/3dac6a5f-d4be-32c6-6e4a-c7a79fe5bfd9/715187754720.png/600x600bb.jpg',
  },
  {
    id: 'cat-futbol',
    title: 'Fútbol',
    bgColor: 'rgb(13, 115, 236)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a5/7e/97/a57e978e-6c3c-7ff5-d683-9976e754faac/8445888314351.png/600x600bb.jpg',
  },
  {
    id: 'cat-listas',
    title: 'Listas de éxitos',
    bgColor: 'rgb(141, 103, 171)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/f1/74/df/f174df13-f2f9-51ad-0801-5a0168f0a1c5/cover.jpg/600x600bb.jpg',
  },
  {
    id: 'cat-urbano',
    title: 'Urbano latino',
    bgColor: 'rgb(188, 89, 0)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/49/f1/6949f1a9-db34-b9cb-4e58-6321d007c79b/artwork.jpg/600x600bb.jpg',
  },
  {
    id: 'cat-indie',
    title: 'Indie',
    bgColor: 'rgb(96, 129, 8)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/9c/ae/7a/9cae7a72-29ed-08aa-1b42-913776bbb6ec/886443855571.jpg/600x600bb.jpg',
  },
  {
    id: 'cat-dance',
    title: 'Dance / Electrónica',
    bgColor: 'rgb(220, 20, 140)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6c/c5/c2/6cc5c243-7151-05b8-6942-b98168cefa01/21UMGIM47963.rgb.jpg/600x600bb.jpg',
  },
  {
    id: 'cat-descubrir',
    title: 'Descubrir',
    bgColor: 'rgb(141, 103, 171)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/fe/4c/99/fe4c99b8-c55b-6cab-4799-520953a9e74d/artwork.jpg/600x600bb.jpg',
  },
];

interface FullSearchResults {
  tracks: any[];
  soundcloudTracks: any[];
  artists: any[];
  albums: any[];
  playlists: any[];
}

const ArtistSearchCard: React.FC<{
  artist: any;
  onClick: () => void;
}> = ({ artist, onClick }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const avatarUrl = artist.images?.[0]?.url;

  return (
    <div
      onClick={onClick}
      className="p-4 rounded-lg bg-[#181818] hover:bg-[#282828] transition-all cursor-pointer group flex flex-col items-center text-center shadow-md hover:shadow-xl relative"
    >
      <div className="w-28 h-28 rounded-full overflow-hidden mb-3 relative shadow-lg bg-[#242424] flex items-center justify-center">
        {!imgFailed && avatarUrl ? (
          <img
            src={avatarUrl}
            alt={artist.name}
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full rounded-full bg-gradient-to-tr from-[#5018f0] to-[#1ed760] flex items-center justify-center text-black font-black text-2xl shadow">
            {(artist.name || 'A').charAt(0).toUpperCase()}
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="absolute bottom-1 right-1 w-10 h-10 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
          title={`Ver ${artist.name}`}
        >
          <PlayNativeIcon size={16} className="text-black ml-0.5" />
        </button>
      </div>
      <span className="font-bold text-white text-sm truncate w-full">
        {artist.name}
      </span>
      <span className="text-xs text-[#b3b3b3] mt-1">Artista</span>
    </div>
  );
};

const AlbumSearchCard: React.FC<{
  album: any;
  onClick: () => void;
}> = ({ album, onClick }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const cover = album.images?.[0]?.url;

  return (
    <div
      onClick={onClick}
      className="p-3.5 rounded-lg bg-[#181818] hover:bg-[#282828] transition-all cursor-pointer group flex flex-col shadow-md hover:shadow-xl relative"
    >
      <div className="relative aspect-square w-full rounded-md overflow-hidden mb-3 bg-[#242424] shadow-md flex items-center justify-center">
        {!imgFailed && cover ? (
          <img
            src={cover}
            alt={album.name}
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#535353]">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
          title={`Reproducir ${album.name}`}
        >
          <PlayNativeIcon size={16} className="text-black ml-0.5" />
        </button>
      </div>
      <span className="font-bold text-white text-sm truncate">
        {album.name}
      </span>
      <span className="text-xs text-[#b3b3b3] truncate mt-1">
        {album.release_date || 'Álbum'} • {album.artists?.[0]?.name || 'Artista'}
      </span>
    </div>
  );
};

interface DesktopSearchViewProps {
  onSelectPlaylistById?: (id: string, customName?: string, customImage?: string) => void;
}

export const DesktopSearchView: React.FC<DesktopSearchViewProps> = ({ onSelectPlaylistById }) => {
  const { searchQuery } = useUIStore();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayerStore(
    useShallow((s) => ({ playTrack: s.playTrack, currentTrack: s.currentTrack, isPlaying: s.isPlaying, togglePlay: s.togglePlay }))
  );
  const [selectedCategory, setSelectedCategory] = useState<typeof officialCategories[0] | null>(null);
  // Changes every day: curated playlists reshuffled + today's live picks
  const categoryShelves = useDailyCategoryHub(selectedCategory?.id);
  const [searchFilter, setSearchFilter] = useState<'todo' | 'canciones' | 'soundcloud' | 'artistas' | 'albumes' | 'playlists'>('todo');
  const [searchResults, setSearchResults] = useState<FullSearchResults>({
    tracks: [],
    soundcloudTracks: [],
    artists: [],
    albums: [],
    playlists: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>(() => getRecentSearches());

  useEffect(() => {
    const handleUpdate = () => {
      setRecentSearches(getRecentSearches());
    };
    window.addEventListener('spotifree_recent_searches_updated', handleUpdate);
    return () => {
      window.removeEventListener('spotifree_recent_searches_updated', handleUpdate);
    };
  }, []);

  useEffect(() => {
    if (searchQuery.trim() && selectedCategory) {
      setSelectedCategory(null);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ tracks: [], soundcloudTracks: [], artists: [], albums: [], playlists: [] });
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const data = await searchSpotify(searchQuery);
        if (active) {
          setSearchResults({
            tracks: data?.tracks?.items || [],
            soundcloudTracks: data?.soundcloudTracks?.items || [],
            artists: data?.artists?.items || [],
            albums: data?.albums?.items || [],
            playlists: data?.playlists?.items || [],
          });
          setHasSearched(true);
        }
      } catch {
        if (active) {
          setSearchResults({ tracks: [], soundcloudTracks: [], artists: [], albums: [], playlists: [] });
          setHasSearched(true);
        }
      } finally {
        if (active) setIsSearching(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const handleTrackClick = (track: any) => {
    addRecentSearch({
      id: track.id,
      type: 'track',
      title: track.name,
      subtitle: `Canción • ${parseTrackArtists(track.artists).map((a: any) => a.name).join(', ') || 'Artista'}`,
      image: track.album?.images?.[0]?.url,
      data: track,
    });
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track, searchResults.tracks);
    }
  };

  const handleArtistClick = (artist: any) => {
    addRecentSearch({
      id: artist.id,
      type: 'artist',
      title: artist.name,
      subtitle: 'Artista',
      image: artist.images?.[0]?.url,
      data: artist,
    });
    if (onSelectPlaylistById) {
      onSelectPlaylistById(artist.id, artist.name, artist.images?.[0]?.url);
    }
  };

  const handleAlbumClick = (album: any) => {
    addRecentSearch({
      id: album.id,
      type: 'album',
      title: album.name,
      subtitle: `Álbum • ${album.artists?.[0]?.name || ''}`,
      image: album.images?.[0]?.url,
      data: album,
    });
    if (onSelectPlaylistById) {
      onSelectPlaylistById(album.id, album.name, album.images?.[0]?.url);
    }
  };

  const handlePlaylistClick = (playlist: any) => {
    addRecentSearch({
      id: playlist.id,
      type: 'playlist',
      title: playlist.name,
      subtitle: 'Playlist',
      image: playlist.images?.[0]?.url,
      data: playlist,
    });
    if (onSelectPlaylistById) {
      onSelectPlaylistById(playlist.id, playlist.name, playlist.images?.[0]?.url);
    }
  };

  const handleRecentItemClick = (item: RecentSearchItem) => {
    if (item.type === 'track') {
      const trackData = item.data || {
        id: item.id,
        name: item.title,
        artists: [{ name: item.subtitle.replace('Canción • ', '') }],
        album: { images: item.image ? [{ url: item.image }] : [] },
        duration_ms: 210000,
      };
      playTrack(trackData, [trackData]);
    } else if (item.type === 'artist' || item.type === 'album' || item.type === 'playlist') {
      if (onSelectPlaylistById) {
        onSelectPlaylistById(item.id, item.title, item.image);
      }
    } else if (item.type === 'query') {
      useUIStore.getState().setSearchQuery(item.title);
    }
  };

  return (
    <div className="p-6 pb-16 space-y-6 select-none bg-[#121212] min-h-full">
      {!searchQuery.trim() ? (
        selectedCategory ? (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Category Hero Banner Matching Spotify Screenshot 2 */}
            <div
              style={{ backgroundColor: selectedCategory.bgColor }}
              className="relative rounded-2xl p-8 lg:p-12 overflow-hidden shadow-2xl transition-all"
            >
              <button
                onClick={() => setSelectedCategory(null)}
                className="inline-flex items-center gap-2 text-white/90 hover:text-white font-bold text-xs uppercase tracking-wider bg-black/30 hover:bg-black/50 px-3.5 py-1.5 rounded-full transition-all duration-200 cursor-pointer mb-4"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11.03.47a.75.75 0 0 1 0 1.06L4.81 7.75l6.22 6.22a.75.75 0 1 1-1.06 1.06l-6.75-6.75a.75.75 0 0 1 0-1.06l6.75-6.75a.75.75 0 0 1 1.06 0z" />
                </svg>
                <span>Explorar todo</span>
              </button>

              <h1 className="text-5xl lg:text-7xl font-black text-white tracking-tight font-['SpotifyMixUITitle'] drop-shadow-md">
                {selectedCategory.title}
              </h1>

              {selectedCategory.imgSrc && (
                <img
                  src={selectedCategory.imgSrc}
                  alt={selectedCategory.title}
                  className="absolute right-6 -bottom-6 w-44 h-44 lg:w-56 lg:h-56 rounded-xl shadow-[-6px_8px_24px_rgba(0,0,0,0.6)] transform rotate-[18deg] object-cover opacity-90 pointer-events-none"
                />
              )}
            </div>

            {/* Hub Shelves */}
            <div className="space-y-8">
              {categoryShelves.map(
                (shelf, idx) => (
                  <DesktopShelfCarousel
                    key={`${selectedCategory.id}-shelf-${idx}`}
                    title={shelf.title}
                    items={shelf.cards}
                    onCardClick={(card) => {
                      if (onSelectPlaylistById) {
                        onSelectPlaylistById(card.id, card.title, card.image);
                      }
                    }}
                    onPlayClick={(card) => {
                      if (onSelectPlaylistById) {
                        onSelectPlaylistById(card.id, card.title, card.image);
                      }
                    }}
                  />
                )
              )}
            </div>
          </div>
        ) : (
          <>
            {recentSearches.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-black text-white tracking-tight font-['SpotifyMixUITitle']">
                    Búsquedas recientes
                  </h2>
                  <button
                    onClick={() => clearRecentSearches()}
                    className="text-xs font-bold text-[#b3b3b3] hover:text-white transition-colors cursor-pointer"
                  >
                    Borrar todo
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                  {recentSearches.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleRecentItemClick(item)}
                      className="group relative bg-[#181818] hover:bg-[#282828] p-3 rounded-md transition-colors cursor-pointer flex flex-col"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRecentSearch(item.id);
                        }}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 hover:bg-black/90 text-[#b3b3b3] hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        title="Eliminar de búsquedas recientes"
                      >
                        <CloseNativeIcon size={12} className="text-[#b3b3b3] group-hover:text-white" />
                      </button>
                      <div className={`w-full aspect-square mb-3 overflow-hidden shadow-lg bg-[#282828] ${item.type === 'artist' ? 'rounded-full' : 'rounded-md'}`}>
                        {item.image ? (
                          <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#282828] text-[#727272]">
                            {item.type === 'query' ? <SearchNativeIcon size={28} className="text-[#a7a7a7]" /> : '♪'}
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-bold text-white truncate font-['SpotifyMixUI']">{item.title}</p>
                      <p className="text-xs text-[#b3b3b3] truncate mt-0.5">{item.subtitle}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h2 className="text-2xl font-black text-white tracking-tight font-['SpotifyMixUITitle']">
              Explorar todo
            </h2>

            {/* Real 4-column responsive grid with rotated 25deg cards matching Spotify exactly */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-6">
              {officialCategories.map((cat) => (
                <CategoryCardItem
                  key={cat.id}
                  cat={cat}
                  onClick={() => setSelectedCategory(cat)}
                />
              ))}
            </div>
          </>
        )
      ) : (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white font-['SpotifyMixUITitle']">
            Resultados para «{searchQuery}»
          </h2>

          {/* Filter Pills matching Spotify Desktop Search */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {(['todo', 'canciones', 'soundcloud', 'artistas', 'albumes', 'playlists'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setSearchFilter(filter)}
                className={`h-8 px-4 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
                  searchFilter === filter
                    ? 'bg-white text-black shadow'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {filter === 'todo'
                  ? 'Todo'
                  : filter === 'canciones'
                  ? 'Canciones'
                  : filter === 'soundcloud'
                  ? `Remixes y Leaks${searchResults.soundcloudTracks.length > 0 ? ` (${searchResults.soundcloudTracks.length})` : ''}`
                  : filter === 'artistas'
                  ? 'Artistas'
                  : filter === 'albumes'
                  ? 'Álbumes'
                  : 'Playlists'}
              </button>
            ))}
          </div>

          {searchResults.tracks.length > 0 || searchResults.soundcloudTracks.length > 0 || searchResults.artists.length > 0 || searchResults.playlists.length > 0 ? (
            <div className="space-y-10">
              {/* TAB: TODO */}
              {searchFilter === 'todo' && (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Top Result */}
                    {(() => {
                      const topArtist = searchResults.artists[0];
                      const topTrack = searchResults.tracks[0];
                      const trimmedQuery = searchQuery.toLowerCase().trim();

                      // If search query matches both track and artist, prioritize the song if title matches
                      const isTrackMatch =
                        topTrack &&
                        (topTrack.name.toLowerCase().trim() === trimmedQuery ||
                          topTrack.name.toLowerCase().includes(trimmedQuery) ||
                          trimmedQuery.includes(topTrack.name.toLowerCase().trim()));

                      const isArtistTop =
                        !isTrackMatch &&
                        topArtist &&
                        (trimmedQuery === topArtist.name.toLowerCase().trim() ||
                          topArtist.name.toLowerCase().includes(trimmedQuery) ||
                          trimmedQuery.includes(topArtist.name.toLowerCase()));

                      if (isArtistTop) {
                        return (
                          <div
                            onClick={() => handleArtistClick(topArtist)}
                            className="lg:col-span-5 bg-[#181818] hover:bg-[#282828] p-5 rounded-lg cursor-pointer transition-colors group relative flex flex-col justify-between"
                          >
                            <div>
                              <div className="w-28 h-28 rounded-full overflow-hidden mb-4 shadow-xl bg-[#242424]">
                                {topArtist.images?.[0]?.url ? (
                                  <img
                                    src={topArtist.images[0].url}
                                    alt={topArtist.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white/70">
                                    {(topArtist.name || '?').charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <h3 className="text-3xl font-black text-white font-['SpotifyMixUITitle'] leading-tight">
                                {topArtist.name}
                              </h3>
                              <span className="inline-block px-2.5 py-1 bg-black/40 text-white font-bold text-xs rounded-full uppercase tracking-wider mt-2">
                                Artista
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArtistClick(topArtist);
                              }}
                              className="absolute bottom-5 right-5 w-12 h-12 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 shadow-lg flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all"
                              title={`Reproducir ${topArtist.name}`}
                            >
                              <PlayNativeIcon size={20} className="text-black ml-0.5" />
                            </button>
                          </div>
                        );
                      }

                      if (!topTrack) return null;

                      return (
                        <div
                          onClick={() => handleTrackClick(topTrack)}
                          className="lg:col-span-5 bg-[#181818] hover:bg-[#282828] p-5 rounded-lg cursor-pointer transition-colors group relative flex flex-col justify-between"
                        >
                          <div>
                            <img
                              src={topTrack.album?.images[0]?.url}
                              alt={topTrack.name}
                              className="w-24 h-24 rounded-lg object-cover shadow-xl mb-4"
                            />
                            <h3 className={`text-3xl font-black leading-tight font-['SpotifyMixUITitle'] ${
                              currentTrack?.id === topTrack.id ? 'text-[#1ed760]' : 'text-white'
                            }`}>
                              {topTrack.name}
                            </h3>
                            <p className="text-sm text-[#b3b3b3] mt-1">
                              Canción • {topTrack.artists?.map((a: any) => a.name).join(', ')}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTrackClick(topTrack);
                            }}
                            className={`absolute bottom-5 right-5 w-12 h-12 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 shadow-lg flex items-center justify-center transition-all ${
                              isPlaying && currentTrack?.id === topTrack.id
                                ? 'opacity-100 scale-100'
                                : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'
                            }`}
                            title={isPlaying && currentTrack?.id === topTrack.id ? "Pausar" : "Reproducir"}
                          >
                            {isPlaying && currentTrack?.id === topTrack.id ? (
                              <PauseNativeIcon size={20} className="text-black" />
                            ) : (
                              <PlayNativeIcon size={20} className="text-black ml-0.5" />
                            )}
                          </button>
                        </div>
                      );
                    })()}

                    {/* Matching Songs List */}
                    <div className="lg:col-span-7 space-y-1">
                      <h3 className="text-lg font-bold text-white mb-2 font-['SpotifyMixUITitle']">
                        Canciones
                      </h3>
                      {searchResults.tracks.slice(0, 4).map((track: any) => {
                        const isThisPlaying = isPlaying && currentTrack?.id === track.id;
                        const isThisSelected = currentTrack?.id === track.id;

                        return (
                          <div
                            key={track.id}
                            onClick={() => handleTrackClick(track)}
                            className={`group flex items-center justify-between p-2 rounded hover:bg-white/10 cursor-pointer transition-colors ${
                              isThisSelected ? 'bg-white/10' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <img
                                src={track.album?.images[0]?.url}
                                alt={track.name}
                                className="w-10 h-10 rounded object-cover shadow"
                              />
                              <div className="flex flex-col min-w-0">
                                <span className={`font-medium truncate ${
                                  isThisPlaying ? 'text-[#1ed760]' : 'text-white group-hover:text-white'
                                }`}>
                                  {track.name}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5 truncate">
                                  {track.scVariantLabel && (
                                    <span className="shrink-0 rounded px-1.5 py-px text-[9px] font-bold bg-[#ff5500]/20 text-[#ff8a4c] border border-[#ff5500]/40">
                                      {track.scVariantLabel}
                                    </span>
                                  )}
                                  <span className="text-xs text-[#b3b3b3] truncate">
                                    {parseTrackArtists(track.artists).map((a: any) => a.name).join(', ')}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <span className="text-xs text-[#b3b3b3] font-['SpotifyMixUI'] tabular-nums pr-4">
                              {formatDuration(track.duration_ms)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Artistas Row */}
                  {searchResults.artists.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold text-white mb-4 font-['SpotifyMixUITitle']">
                        Artistas
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {searchResults.artists.slice(0, 6).map((artist: any) => (
                          <ArtistSearchCard
                            key={artist.id}
                            artist={artist}
                            onClick={() => handleArtistClick(artist)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Álbumes Row */}
                  {searchResults.albums.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold text-white mb-4 font-['SpotifyMixUITitle']">
                        Álbumes
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {searchResults.albums.slice(0, 6).map((album: any) => (
                          <AlbumSearchCard
                            key={album.id}
                            album={album}
                            onClick={() => handleAlbumClick(album)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SoundCloud Remixes, Slowed & Leaks Shelf */}
                  {searchResults.soundcloudTracks.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xl font-bold text-white font-['SpotifyMixUITitle']">
                          Remixes, Slowed e Inéditas (SoundCloud)
                        </h3>
                        <button
                          type="button"
                          onClick={() => setSearchFilter('soundcloud')}
                          className="text-xs font-bold text-[#b3b3b3] hover:text-white hover:underline cursor-pointer"
                        >
                          Mostrar todo
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {searchResults.soundcloudTracks.slice(0, 4).map((track: any) => {
                          const isThisPlaying = isPlaying && currentTrack?.id === track.id;
                          return (
                            <div
                              key={track.id}
                              onClick={() => {
                                addRecentSearch({
                                  id: track.id,
                                  type: 'track',
                                  title: track.name,
                                  subtitle: `${track.isOfficial ? 'Remix Oficial' : 'SoundCloud'} • ${parseTrackArtists(track.artists).map((a: any) => a.name).join(', ') || ''}`,
                                  image: track.album?.images?.[0]?.url,
                                  data: track,
                                });
                                if (currentTrack?.id === track.id) togglePlay();
                                else playTrack(track, searchResults.soundcloudTracks);
                              }}
                              className={`group flex items-center justify-between p-2.5 rounded-lg bg-[#181818] hover:bg-[#282828] cursor-pointer transition-colors ${
                                currentTrack?.id === track.id ? 'bg-[#282828]' : ''
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0 pr-3">
                                <img
                                  src={track.album?.images?.[0]?.url}
                                  alt={track.name}
                                  className="w-11 h-11 rounded object-cover shadow bg-[#242424] shrink-0"
                                />
                                <div className="min-w-0">
                                  <p className={`text-sm font-semibold truncate ${isThisPlaying ? 'text-[#1ed760]' : 'text-white'}`}>
                                    {track.name}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-bold ${
                                      track.isOfficial || track.scVariantLabel === 'Remix Oficial'
                                        ? 'bg-[#1ed760]/15 text-[#1ed760] border border-[#1ed760]/30'
                                        : 'bg-[#ff5500]/15 text-[#ff8a4c] border border-[#ff5500]/30'
                                    }`}>
                                      {track.isOfficial ? (track.scVariantLabel || 'Remix Oficial') : (track.scVariantLabel || 'SoundCloud')}
                                    </span>
                                    <span className="text-xs text-[#b3b3b3] truncate">
                                      {parseTrackArtists(track.artists).map((a: any) => a.name).join(', ')}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs text-[#b3b3b3] tabular-nums shrink-0">
                                {formatDuration(track.duration_ms)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Playlists Row */}
                  {searchResults.playlists.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold text-white mb-4 font-['SpotifyMixUITitle']">
                        Playlists
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {searchResults.playlists.slice(0, 6).map((pl: any) => {
                          const cover = pl.images?.[0]?.url;
                          return (
                            <div
                              key={pl.id}
                              onClick={() => handlePlaylistClick(pl)}
                              className="p-3.5 rounded-lg bg-[#181818] hover:bg-[#282828] transition-all cursor-pointer group flex flex-col shadow-md hover:shadow-xl relative"
                            >
                              <div className="relative aspect-square w-full rounded-md overflow-hidden mb-3 bg-[#242424] shadow-md">
                                {cover && (
                                  <img
                                    src={cover}
                                    alt={pl.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  />
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onSelectPlaylistById) {
                                      onSelectPlaylistById(pl.id, pl.name, cover);
                                    }
                                  }}
                                  className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                                  title={`Reproducir ${pl.name}`}
                                >
                                  <PlayNativeIcon size={16} className="text-black ml-0.5" />
                                </button>
                              </div>
                              <span className="font-bold text-white text-sm truncate">
                                {pl.name}
                              </span>
                              <span className="text-xs text-[#b3b3b3] truncate mt-1">
                                De {pl.owner?.display_name || 'Spotify'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* TAB: CANCIONES */}
              {searchFilter === 'canciones' && (
                <div className="space-y-1">
                  {searchResults.tracks.map((track: any) => {
                    const isThisPlaying = isPlaying && currentTrack?.id === track.id;
                    const isThisSelected = currentTrack?.id === track.id;

                    return (
                      <div
                        key={track.id}
                        onClick={() => handleTrackClick(track)}
                        className={`group flex items-center justify-between p-2.5 rounded-lg hover:bg-white/10 cursor-pointer transition-colors ${
                          isThisSelected ? 'bg-white/10' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <img
                            src={track.album?.images[0]?.url}
                            alt={track.name}
                            className="w-11 h-11 rounded object-cover shadow"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className={`font-semibold text-sm truncate ${
                              isThisPlaying ? 'text-[#1ed760]' : 'text-white'
                            }`}>
                              {track.name}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5 truncate">
                              {track.scVariantLabel && (
                                <span className="shrink-0 rounded px-1.5 py-px text-[9px] font-bold bg-[#ff5500]/20 text-[#ff8a4c] border border-[#ff5500]/40">
                                  {track.scVariantLabel}
                                </span>
                              )}
                              <span className="text-xs text-[#b3b3b3] truncate">
                                {parseTrackArtists(track.artists).map((a: any) => a.name).join(', ')} • {track.album?.name}
                              </span>
                            </div>
                          </div>
                        </div>
                        <span className="text-xs text-[#b3b3b3] font-['SpotifyMixUI'] tabular-nums pr-4">
                          {formatDuration(track.duration_ms)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB: SOUNDCLOUD REMIXES, SLOWED & LEAKS */}
              {searchFilter === 'soundcloud' && (
                <div className="space-y-1">
                  {searchResults.soundcloudTracks.length > 0 ? (
                    searchResults.soundcloudTracks.map((track: any) => {
                      const isThisPlaying = isPlaying && currentTrack?.id === track.id;
                      const isThisSelected = currentTrack?.id === track.id;
                      return (
                        <div
                          key={track.id}
                          onClick={() => {
                            addRecentSearch({
                              id: track.id,
                              type: 'track',
                              title: track.name,
                              subtitle: `${track.isOfficial ? 'Remix Oficial' : 'SoundCloud'} • ${parseTrackArtists(track.artists).map((a: any) => a.name).join(', ') || ''}`,
                              image: track.album?.images?.[0]?.url,
                              data: track,
                            });
                            if (currentTrack?.id === track.id) togglePlay();
                            else playTrack(track, searchResults.soundcloudTracks);
                          }}
                          className={`group flex items-center justify-between p-2.5 rounded-lg hover:bg-white/10 cursor-pointer transition-colors ${
                            isThisSelected ? 'bg-white/10' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0 pr-3">
                            <img
                              src={track.album?.images?.[0]?.url}
                              alt={track.name}
                              className="w-11 h-11 rounded object-cover shadow bg-[#242424] shrink-0"
                            />
                            <div className="flex flex-col min-w-0">
                              <span className={`font-semibold text-sm truncate ${isThisPlaying ? 'text-[#1ed760]' : 'text-white'}`}>
                                {track.name}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5 min-w-0">
                                <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-bold ${
                                  track.isOfficial || track.scVariantLabel === 'Remix Oficial'
                                    ? 'bg-[#1ed760]/15 text-[#1ed760] border border-[#1ed760]/30'
                                    : 'bg-[#ff5500]/15 text-[#ff8a4c] border border-[#ff5500]/30'
                                }`}>
                                  {track.isOfficial ? (track.scVariantLabel || 'Remix Oficial') : (track.scVariantLabel || 'SoundCloud')}
                                </span>
                                <span className="text-xs text-[#b3b3b3] truncate">
                                  {parseTrackArtists(track.artists).map((a: any) => a.name).join(', ')}
                                </span>
                              </div>
                            </div>
                          </div>
                          <span className="text-xs text-[#b3b3b3] font-['SpotifyMixUI'] tabular-nums pr-4">
                            {formatDuration(track.duration_ms)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-[#b3b3b3] py-6">
                      No se encontraron remixes oficiales ni versiones en SoundCloud para «{searchQuery}».
                    </p>
                  )}
                </div>
              )}

              {/* TAB: ARTISTAS */}
              {searchFilter === 'artistas' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {searchResults.artists.map((artist: any) => (
                    <ArtistSearchCard
                      key={artist.id}
                      artist={artist}
                      onClick={() => handleArtistClick(artist)}
                    />
                  ))}
                </div>
              )}

              {/* TAB: ÁLBUMES */}
              {searchFilter === 'albumes' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {searchResults.albums.map((album: any) => (
                    <AlbumSearchCard
                      key={album.id}
                      album={album}
                      onClick={() => handleAlbumClick(album)}
                    />
                  ))}
                </div>
              )}

              {/* TAB: PLAYLISTS */}
              {searchFilter === 'playlists' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {searchResults.playlists.map((pl: any) => {
                    const cover = pl.images?.[0]?.url;
                    return (
                      <div
                        key={pl.id}
                        onClick={() => handlePlaylistClick(pl)}
                        className="p-3.5 rounded-lg bg-[#181818] hover:bg-[#282828] transition-all cursor-pointer group flex flex-col shadow-md hover:shadow-xl relative"
                      >
                        <div className="relative aspect-square w-full rounded-md overflow-hidden mb-3 bg-[#242424] shadow-md">
                          {cover && (
                            <img
                              src={cover}
                              alt={pl.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectPlaylistById) {
                                onSelectPlaylistById(pl.id, pl.name, cover);
                              }
                            }}
                            className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200"
                            title={`Reproducir ${pl.name}`}
                          >
                            <PlayNativeIcon size={16} className="text-black ml-0.5" />
                          </button>
                        </div>
                        <span className="font-bold text-white text-sm truncate">
                          {pl.name}
                        </span>
                        <span className="text-xs text-[#b3b3b3] truncate mt-1">
                          De {pl.owner?.display_name || 'Spotify'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : isSearching ? (
            <p className="text-[#b3b3b3] text-sm">Buscando en Spotify en tiempo real...</p>
          ) : hasSearched ? (
            <div className="py-12 text-center text-[#b3b3b3] space-y-2">
              <h3 className="text-xl font-bold text-white font-['SpotifyMixUITitle']">
                No se han encontrado resultados para «{searchQuery}»
              </h3>
              <p className="text-sm text-[#a7a7a7]">
                Asegúrate de que las palabras estén bien escritas o prueba a utilizar otras palabras clave.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
