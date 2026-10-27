import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../store/useUIStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { PlayNativeIcon, PauseNativeIcon } from '../icons/SpotifyNativeIcons';
import { formatDuration } from '../../utils/formatters';
import { searchSpotify } from '../../services/spotifyApi';

const officialCategories = [
  {
    id: 'cat-musica',
    title: 'Música',
    bgColor: 'rgb(220, 20, 140)',
    imgSrc: 'https://i.scdn.co/image/ab67fb8200005caf474a477debc822a3a45c5acb',
  },
  {
    id: 'cat-podcasts',
    title: 'Pódcasts',
    bgColor: 'rgb(0, 100, 80)',
    imgSrc: 'https://i.scdn.co/image/ab6765630000ba8a81f07e1ead0317ee3c285bfa',
  },
  {
    id: 'cat-audiolibros',
    title: 'Audiolibros',
    bgColor: 'rgb(40, 62, 163)',
    imgSrc: 'https://i.scdn.co/image/ab67fb8200005cafd7d76fc8a9096042a317ddb7',
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
    id: 'cat-exitos-podcasts',
    title: 'Éxitos en pódcasts',
    bgColor: 'rgb(40, 62, 163)',
    imgSrc: 'https://i.scdn.co/image/ab6765630000ba8a81f07e1ead0317ee3c285bfa',
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

interface DesktopSearchViewProps {
  onSelectPlaylistById?: (id: string, customName?: string, customImage?: string) => void;
}

export const DesktopSearchView: React.FC<DesktopSearchViewProps> = ({ onSelectPlaylistById }) => {
  const { searchQuery, setSearchQuery } = useUIStore();
  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayerStore();
  const [liveResults, setLiveResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setLiveResults([]);
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
          setLiveResults(data?.tracks?.items || []);
          setHasSearched(true);
        }
      } catch {
        if (active) {
          setLiveResults([]);
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
      playTrack(track, liveResults);
    }
  };

  return (
    <div className="p-6 pb-16 space-y-6 select-none bg-[#121212] min-h-full">
      {!searchQuery.trim() ? (
        <>
          <h2 className="text-2xl font-black text-white tracking-tight font-['SpotifyMixUITitle']">
            Explorar todo
          </h2>

          {/* Real 4-column responsive grid with rotated 25deg cards matching Spotify exactly */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-6">
            {officialCategories.map((cat) => (
              <div
                key={cat.id}
                onClick={() => {
                  setSearchQuery(cat.title);
                  if (onSelectPlaylistById && cat.id.startsWith('cat-artist')) {
                    onSelectPlaylistById(cat.id, cat.title, cat.imgSrc);
                  }
                }}
                style={{ backgroundColor: cat.bgColor }}
                className="relative h-[180px] rounded-lg p-4 overflow-hidden cursor-pointer select-none shadow-md group hover:brightness-105 active:scale-98 transition-all"
              >
                <h3 className="text-2xl font-black text-white leading-tight break-words max-w-[65%] z-10 relative font-['SpotifyMixUITitle'] tracking-tight">
                  {cat.title}
                </h3>
                {/* Image rotated 25 degrees into bottom-right corner with shadow */}
                <img
                  src={cat.imgSrc}
                  alt={cat.title}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                  className="absolute -bottom-2 -right-4 w-[100px] h-[100px] rounded-[4px] shadow-[-2px_4px_12px_rgba(0,0,0,0.4)] transform rotate-[25deg] translate-x-2 translate-y-1 group-hover:scale-105 group-hover:rotate-[28deg] transition-transform duration-200 object-cover"
                />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-white">Resultados para "{searchQuery}"</h2>

          {liveResults.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Top Result */}
              <div
                onClick={() => handleTrackClick(liveResults[0])}
                className="lg:col-span-5 bg-[#181818] hover:bg-[#282828] p-5 rounded-lg cursor-pointer transition-colors group relative flex flex-col justify-between"
              >
                <div>
                  <img
                    src={liveResults[0].album?.images[0]?.url}
                    alt={liveResults[0].name}
                    className="w-24 h-24 rounded-lg object-cover shadow-xl mb-4"
                  />
                  <h3 className={`text-3xl font-black leading-tight font-['SpotifyMixUITitle'] ${
                    currentTrack?.id === liveResults[0].id ? 'text-[#1ed760]' : 'text-white'
                  }`}>
                    {liveResults[0].name}
                  </h3>
                  <p className="text-sm text-[#b3b3b3] mt-1">
                    Canción • {liveResults[0].artists?.map((a: any) => a.name).join(', ')}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTrackClick(liveResults[0]);
                  }}
                  className={`absolute bottom-5 right-5 w-12 h-12 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 shadow-lg flex items-center justify-center transition-all ${
                    isPlaying && currentTrack?.id === liveResults[0].id
                      ? 'opacity-100 scale-100'
                      : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'
                  }`}
                  title={isPlaying && currentTrack?.id === liveResults[0].id ? "Pausar" : "Reproducir"}
                >
                  {isPlaying && currentTrack?.id === liveResults[0].id ? (
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
                {liveResults.slice(0, 5).map((track: any) => {
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
