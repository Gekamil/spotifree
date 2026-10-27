import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { PlayNativeIcon, PauseNativeIcon } from '../icons/SpotifyNativeIcons';
import { formatDuration } from '../../utils/formatters';
import { searchSpotify } from '../../services/spotifyApi';
import { DesktopShelfCarousel } from './DesktopShelfCarousel';

const CATEGORY_HUBS: Record<
  string,
  {
    shelves: Array<{
      title: string;
      cards: Array<{ id: string; title: string; subtitle: string; image: string }>;
    }>;
  }
> = {
  'cat-musica': {
    shelves: [
      {
        title: 'Descubrir música nueva',
        cards: [
          {
            id: '37i9dQZF1DWY1Pf31eEcxL',
            title: 'Novedades Viernes España',
            subtitle: 'Lo más nuevo de Quevedo, Saiko, Myke Towers y más.',
            image: 'https://i.scdn.co/image/ab67706f00000002eaecef062c2877a5c0f5f10e',
          },
          {
            id: '37i9dQZEVXcQ9NknPpJyRU',
            title: 'Descubrimiento semanal',
            subtitle: 'Joyas ocultas y canciones seleccionadas para ti.',
            image: 'https://newjams-images.scdn.co/image/ab676477000033ad/dt/v3/discover-weekly/aAbca41100000000/es',
          },
          {
            id: '37i9dQZEVXbxJjY5x43H57',
            title: 'Radar de Novedades',
            subtitle: 'Las novedades de los artistas que sigues.',
            image: 'https://i.scdn.co/image/ab67706f00000002a973a9cc67d246b7865e3e43',
          },
          {
            id: '37i9dQZF1DXcBWIGoYBM5M',
            title: 'Éxitos España',
            subtitle: 'Los temas más escuchados ahora en España.',
            image: 'https://i.scdn.co/image/ab67706f00000002e8ccdd567fff6a597b87586b',
          },
          {
            id: '37i9dQZEVXbNFJfN1Vw8d9',
            title: 'Top 50: España',
            subtitle: 'Tu actualización diaria de los temas más reproducidos.',
            image: 'https://charts-images.scdn.co/assets/locale_en/regional/daily/region_es_large.jpg',
          },
          {
            id: '37i9dQZF1DWZdsS73T1ogG',
            title: 'el nuevo urbano',
            subtitle: 'Lo más nuevo de la música urbana.',
            image: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426',
          },
        ],
      },
      {
        title: 'Listas populares y éxitos',
        cards: [
          {
            id: '37i9dQZF1DX2EiUAL7Wdfc',
            title: 'míticas',
            subtitle: 'Canciones que nunca pasarán de moda.',
            image: 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6',
          },
          {
            id: '37i9dQZF1EQncLwOalG3K7',
            title: 'Pop con Ñ',
            subtitle: 'El mejor pop en español fresco y actual.',
            image: 'https://i.scdn.co/image/ab67706f000000020ad613a778fc3ef5c91f54cf',
          },
          {
            id: '37i9dQZF1DX10zKzsJ2jva',
            title: 'Viva Latino',
            subtitle: 'El corazón y la energía de la música latina.',
            image: 'https://i.scdn.co/image/ab67706f00000002f232ffabeb0f993f45f20f06',
          },
          {
            id: '37i9dQZF1DWXRqgorJj26U',
            title: 'Rock Classics',
            subtitle: 'Grandes leyendas y clásicos del rock.',
            image: 'https://i.scdn.co/image/ab67706f00000002b0e6e76cf0d4948a3952f481',
          },
        ],
      },
    ],
  },
  'cat-pop': {
    shelves: [
      {
        title: 'Lo mejor del Pop',
        cards: [
          {
            id: '37i9dQZF1EQncLwOalG3K7',
            title: 'Pop con Ñ',
            subtitle: 'Pop actual en español.',
            image: 'https://i.scdn.co/image/ab67706f000000020ad613a778fc3ef5c91f54cf',
          },
          {
            id: '37i9dQZF1DXcBWIGoYBM5M',
            title: 'Éxitos España',
            subtitle: 'Las canciones pop más escuchadas.',
            image: 'https://i.scdn.co/image/ab67706f00000002e8ccdd567fff6a597b87586b',
          },
          {
            id: '37i9dQZF1DX4JAvHpjipBk',
            title: 'New Music Friday',
            subtitle: 'Estrenos pop de la semana.',
            image: 'https://i.scdn.co/image/ab67706f000000020fe6127163cb15bf8bfd7df3',
          },
        ],
      },
    ],
  },
  'cat-latina': {
    shelves: [
      {
        title: 'Éxitos de la música latina',
        cards: [
          {
            id: '37i9dQZF1DX10zKzsJ2jva',
            title: 'Viva Latino',
            subtitle: 'Hoy suena lo mejor de Bad Bunny, Feid, Karol G y Rauw Alejandro.',
            image: 'https://i.scdn.co/image/ab67706f00000002f232ffabeb0f993f45f20f06',
          },
          {
            id: '37i9dQZF1DWZdsS73T1ogG',
            title: 'el nuevo urbano',
            subtitle: 'El sonido urbano que rompe esquemas.',
            image: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426',
          },
          {
            id: '37i9dQZF1DXcBWIGoYBM5M',
            title: 'Éxitos España',
            subtitle: 'Los ritmos latinos más sonados en la península.',
            image: 'https://i.scdn.co/image/ab67706f00000002e8ccdd567fff6a597b87586b',
          },
          {
            id: '37i9dQZF1DX2EiUAL7Wdfc',
            title: 'míticas',
            subtitle: 'Los clásicos latinos que nunca pasarán de moda.',
            image: 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6',
          },
        ],
      },
    ],
  },
  'cat-rock': {
    shelves: [
      {
        title: 'Leyendas y Clásicos del Rock',
        cards: [
          {
            id: '37i9dQZF1DWXRqgorJj26U',
            title: 'Rock Classics',
            subtitle: 'Queen, AC/DC, Led Zeppelin, Guns N Roses y más.',
            image: 'https://i.scdn.co/image/ab67706f00000002b0e6e76cf0d4948a3952f481',
          },
          {
            id: '37i9dQZF1DX3oM43CtKnRV',
            title: 'Rock Español',
            subtitle: 'Fito & Fitipaldis, Extremoduro, Héroes del Silencio.',
            image: 'https://i.scdn.co/image/ab67706f00000002da4c849095796a9e5d2c4ddb',
          },
          {
            id: '37i9dQZF1DX1rVvRgjX59F',
            title: '90s Rock Anthems',
            subtitle: 'Nirvana, Pearl Jam, Red Hot Chili Peppers.',
            image: 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6',
          },
        ],
      },
    ],
  },
  'cat-dance': {
    shelves: [
      {
        title: 'Dance y Electrónica',
        cards: [
          {
            id: '37i9dQZF1DX4dyzvuaRJ0n',
            title: 'electronic circus',
            subtitle: 'Los mejores beats para tus sesiones.',
            image: 'https://i.scdn.co/image/ab67706f000000023f350ef9446d3eb81cfc67a4',
          },
          {
            id: '37i9dQZF1DXa8NOEUWPn9W',
            title: 'Housewerk',
            subtitle: 'Deep house y grooves irresistibles.',
            image: 'https://i.scdn.co/image/ab67706f00000002474a477debc822a3a45c5acb',
          },
        ],
      },
    ],
  },
};

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
    imgSrc: 'https://i.scdn.co/image/ab67fb8200005caf474a477debc822a3a45c5acb',
  },
  {
    id: 'cat-eventos',
    title: 'Eventos en directo',
    bgColor: 'rgb(115, 88, 255)',
    imgSrc: 'https://i.scdn.co/image/ab67fb8200005caf7934c8c678ccafee89869a55',
  },
  {
    id: 'cat-para-ti',
    title: 'Especialmente para ti',
    bgColor: 'rgb(30, 50, 100)',
    imgSrc: 'https://i.scdn.co/image/ab67fb8200005caf271f9d9d50ba505b47848de0',
  },
  {
    id: 'cat-novedades',
    title: 'Novedades',
    bgColor: 'rgb(45, 70, 185)',
    imgSrc: 'https://i.scdn.co/image/ab67fb8200005caf7934c8c678ccafee89869a55',
  },
  {
    id: 'cat-latina',
    title: 'Latina',
    bgColor: 'rgb(13, 115, 236)',
    imgSrc: 'https://i.scdn.co/image/ab67fb8200005caf3a44e7ae3d808c220898185c',
  },
  {
    id: 'cat-pop',
    title: 'Pop',
    bgColor: 'rgb(20, 138, 8)',
    imgSrc: 'https://i.scdn.co/image/ab67fb8200005caf1cc5fdd288daf767c8d17643',
  },
  {
    id: 'cat-rock',
    title: 'Rock',
    bgColor: 'rgb(188, 89, 0)',
    imgSrc: 'https://i.scdn.co/image/ab67fb8200005cafda4c849095796a9e5d2c4ddb',
  },
  {
    id: 'cat-futbol',
    title: 'Fútbol',
    bgColor: 'rgb(13, 115, 236)',
    imgSrc: 'https://i.scdn.co/image/ab67fb8200005caf009087c53d043b2365287e0b',
  },
  {
    id: 'cat-listas',
    title: 'Listas de éxitos',
    bgColor: 'rgb(141, 103, 171)',
    imgSrc: 'https://i.scdn.co/image/ab67fb8200005cafa207f2a24ec282057d23d838',
  },
  {
    id: 'cat-urbano',
    title: 'Urbano latino',
    bgColor: 'rgb(188, 89, 0)',
    imgSrc: 'https://i.scdn.co/image/ab67fb8200005caf3a44e7ae3d808c220898185c',
  },
  {
    id: 'cat-indie',
    title: 'Indie',
    bgColor: 'rgb(96, 129, 8)',
    imgSrc: 'https://i.scdn.co/image/ab67fb8200005cafa312daef93e0b23dd3d41f71',
  },
  {
    id: 'cat-dance',
    title: 'Dance / Electrónica',
    bgColor: 'rgb(220, 20, 140)',
    imgSrc: 'https://i.scdn.co/image/ab67fb8200005caf3f350ef9446d3eb81cfc67a4',
  },
  {
    id: 'cat-descubrir',
    title: 'Descubrir',
    bgColor: 'rgb(141, 103, 171)',
    imgSrc: 'https://i.scdn.co/image/ab67fb8200005caf2a106f2d24d2629b168697ee',
  },
];

interface FullSearchResults {
  tracks: any[];
  artists: any[];
  albums: any[];
  playlists: any[];
}

interface DesktopSearchViewProps {
  onSelectPlaylistById?: (id: string, customName?: string, customImage?: string) => void;
}

export const DesktopSearchView: React.FC<DesktopSearchViewProps> = ({ onSelectPlaylistById }) => {
  const { searchQuery } = useUIStore();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayerStore();
  const [selectedCategory, setSelectedCategory] = useState<typeof officialCategories[0] | null>(null);
  const [searchResults, setSearchResults] = useState<FullSearchResults>({
    tracks: [],
    artists: [],
    albums: [],
    playlists: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (searchQuery.trim() && selectedCategory) {
      setSelectedCategory(null);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ tracks: [], artists: [], albums: [], playlists: [] });
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
            artists: data?.artists?.items || [],
            albums: data?.albums?.items || [],
            playlists: data?.playlists?.items || [],
          });
          setHasSearched(true);
        }
      } catch {
        if (active) {
          setSearchResults({ tracks: [], artists: [], albums: [], playlists: [] });
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
    if (currentTrack?.id === track.id) {
      togglePlay();
    } else {
      playTrack(track, searchResults.tracks);
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
              {(CATEGORY_HUBS[selectedCategory.id]?.shelves || CATEGORY_HUBS['cat-musica'].shelves).map(
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
        <div className="space-y-10">
          <h2 className="text-2xl font-bold text-white font-['SpotifyMixUITitle']">
            Resultados para «{searchQuery}»
          </h2>

          {searchResults.tracks.length > 0 ? (
            <div className="space-y-10">
              {/* Top Result + Canciones */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Top Result */}
                <div
                  onClick={() => handleTrackClick(searchResults.tracks[0])}
                  className="lg:col-span-5 bg-[#181818] hover:bg-[#282828] p-5 rounded-lg cursor-pointer transition-colors group relative flex flex-col justify-between"
                >
                  <div>
                    <img
                      src={searchResults.tracks[0].album?.images[0]?.url}
                      alt={searchResults.tracks[0].name}
                      className="w-24 h-24 rounded-lg object-cover shadow-xl mb-4"
                    />
                    <h3 className={`text-3xl font-black leading-tight font-['SpotifyMixUITitle'] ${
                      currentTrack?.id === searchResults.tracks[0].id ? 'text-[#1ed760]' : 'text-white'
                    }`}>
                      {searchResults.tracks[0].name}
                    </h3>
                    <p className="text-sm text-[#b3b3b3] mt-1">
                      Canción • {searchResults.tracks[0].artists?.map((a: any) => a.name).join(', ')}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTrackClick(searchResults.tracks[0]);
                    }}
                    className={`absolute bottom-5 right-5 w-12 h-12 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 shadow-lg flex items-center justify-center transition-all ${
                      isPlaying && currentTrack?.id === searchResults.tracks[0].id
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'
                    }`}
                    title={isPlaying && currentTrack?.id === searchResults.tracks[0].id ? "Pausar" : "Reproducir"}
                  >
                    {isPlaying && currentTrack?.id === searchResults.tracks[0].id ? (
                      <PauseNativeIcon size={20} className="text-black" />
                    ) : (
                      <PlayNativeIcon size={20} className="text-black ml-0.5" />
                    )}
                  </button>
                </div>

                {/* Matching Songs List */}
                <div className="lg:col-span-7 space-y-1">
                  <h3 className="text-lg font-bold text-white mb-2 font-['SpotifyMixUITitle']">
                    Canciones
                  </h3>
                  {searchResults.tracks.slice(0, 5).map((track: any) => {
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
                            <span className="text-xs text-[#b3b3b3] truncate">
                              {track.artists?.map((a: any) => a.name).join(', ')}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-[#b3b3b3] font-mono pr-4">
                          {formatDuration(track.duration_ms)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Artistas Row (Circular avatars) */}
              {searchResults.artists.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-white mb-4 font-['SpotifyMixUITitle']">
                    Artistas
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {searchResults.artists.slice(0, 6).map((artist: any) => {
                      const avatar = artist.images?.[0]?.url || 'https://i.scdn.co/image/ab6761610000e5eb4e015d3113dd88ee0cb71658';
                      return (
                        <div
                          key={artist.id}
                          onClick={() => {
                            if (onSelectPlaylistById) {
                              onSelectPlaylistById(artist.id, artist.name, avatar);
                            }
                          }}
                          className="p-4 rounded-lg bg-[#181818] hover:bg-[#282828] transition-all cursor-pointer group flex flex-col items-center text-center shadow-md hover:shadow-xl relative"
                        >
                          <div className="w-28 h-28 rounded-full overflow-hidden mb-3 relative shadow-lg bg-[#242424]">
                            <img
                              src={avatar}
                              alt={artist.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onSelectPlaylistById) {
                                  onSelectPlaylistById(artist.id, artist.name, avatar);
                                }
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
                    })}
                  </div>
                </div>
              )}

              {/* 3. Álbumes Row */}
              {searchResults.albums.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-white mb-4 font-['SpotifyMixUITitle']">
                    Álbumes
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {searchResults.albums.slice(0, 6).map((album: any) => {
                      const cover = album.images?.[0]?.url;
                      return (
                        <div
                          key={album.id}
                          onClick={() => {
                            if (onSelectPlaylistById) {
                              onSelectPlaylistById(album.id, album.name, cover);
                            }
                          }}
                          className="p-3.5 rounded-lg bg-[#181818] hover:bg-[#282828] transition-all cursor-pointer group flex flex-col shadow-md hover:shadow-xl relative"
                        >
                          <div className="relative aspect-square w-full rounded-md overflow-hidden mb-3 bg-[#242424] shadow-md">
                            {cover && (
                              <img
                                src={cover}
                                alt={album.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onSelectPlaylistById) {
                                  onSelectPlaylistById(album.id, album.name, cover);
                                }
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
                    })}
                  </div>
                </div>
              )}

              {/* 4. Playlists Row */}
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
                          onClick={() => {
                            if (onSelectPlaylistById) {
                              onSelectPlaylistById(pl.id, pl.name, cover);
                            }
                          }}
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
