import React, { useState, useEffect } from 'react';
import { searchSpotify } from '../../services/spotifyApi';
import { usePlayerStore } from '../../store/usePlayerStore';
import { formatDuration } from '../../utils/formatters';

interface MobileSearchViewProps {
  onSelectPlaylistById: (id: string, name?: string, image?: string) => void;
}

const MOBILE_CATEGORIES = [
  {
    id: 'cat-musica',
    title: 'Música',
    bgColor: 'rgb(220, 20, 140)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/fe/4c/99/fe4c99b8-c55b-6cab-4799-520953a9e74d/artwork.jpg/600x600bb.jpg',
    playlistId: '37i9dQZF1DXcBWIGoYBM5M',
  },
  {
    id: 'cat-eventos',
    title: 'Eventos en directo',
    bgColor: 'rgb(115, 88, 255)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/3d/ac/6a/3dac6a5f-d4be-32c6-6e4a-c7a79fe5bfd9/715187754720.png/600x600bb.jpg',
    playlistId: '37i9dQZF1DWXRqgorJj26U',
  },
  {
    id: 'cat-para-ti',
    title: 'Especialmente para ti',
    bgColor: 'rgb(30, 50, 100)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/4a/b8/51/4ab851d0-7c24-2406-6647-d6622f99d39b/199066743287.jpg/600x600bb.jpg',
    playlistId: '37i9dQZEVXcQ9NknPpJyRU',
  },
  {
    id: 'cat-novedades',
    title: 'Novedades',
    bgColor: 'rgb(45, 70, 185)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/b8/02/bd/b802bd1d-c601-74a9-c194-b2fea8d5ed1b/5026854930541.jpg/600x600bb.jpg',
    playlistId: '37i9dQZF1DWY1Pf31eEcxL',
  },
  {
    id: 'cat-latina',
    title: 'Latina',
    bgColor: 'rgb(13, 115, 236)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b1/e2/3f/b1e23f6e-29ba-c816-cd4a-2f995c19a25d/886447345481.jpg/600x600bb.jpg',
    playlistId: '37i9dQZF1DX10zKzsJ2jva',
  },
  {
    id: 'cat-pop',
    title: 'Pop',
    bgColor: 'rgb(20, 138, 8)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/33/87/c8/3387c827-adaa-681d-bd10-ce7d8e888b9c/22UMGIM21054.rgb.jpg/600x600bb.jpg',
    playlistId: '37i9dQZF1EQncLwOalG3K7',
  },
  {
    id: 'cat-rock',
    title: 'Rock',
    bgColor: 'rgb(188, 89, 0)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/3d/ac/6a/3dac6a5f-d4be-32c6-6e4a-c7a79fe5bfd9/715187754720.png/600x600bb.jpg',
    playlistId: '37i9dQZF1DWXRqgorJj26U',
  },
  {
    id: 'cat-futbol',
    title: 'Fútbol',
    bgColor: 'rgb(13, 115, 236)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/a5/7e/97/a57e978e-6c3c-7ff5-d683-9976e754faac/8445888314351.png/600x600bb.jpg',
    playlistId: '37i9dQZF1DX748dD4y06Xh',
  },
  {
    id: 'cat-listas',
    title: 'Listas de éxitos',
    bgColor: 'rgb(141, 103, 171)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/f1/74/df/f174df13-f2f9-51ad-0801-5a0168f0a1c5/cover.jpg/600x600bb.jpg',
    playlistId: '37i9dQZEVXbNFJfN1Vw8d9',
  },
  {
    id: 'cat-urbano',
    title: 'Urbano latino',
    bgColor: 'rgb(188, 89, 0)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/49/f1/6949f1a9-db34-b9cb-4e58-6321d007c79b/artwork.jpg/600x600bb.jpg',
    playlistId: '37i9dQZF1DWZdsS73T1ogG',
  },
  {
    id: 'cat-indie',
    title: 'Indie',
    bgColor: 'rgb(96, 129, 8)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/9c/ae/7a/9cae7a72-29ed-08aa-1b42-913776bbb6ec/886443855571.jpg/600x600bb.jpg',
    playlistId: '37i9dQZF1DX2Nc3B70tvx0',
  },
  {
    id: 'cat-dance',
    title: 'Dance / Electrónica',
    bgColor: 'rgb(220, 20, 140)',
    imgSrc: 'https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6c/c5/c2/6cc5c243-7151-05b8-6942-b98168cefa01/21UMGIM47963.rgb.jpg/600x600bb.jpg',
    playlistId: '37i9dQZF1DX4dyzvuaRJ0n',
  },
];

export const MobileSearchView: React.FC<MobileSearchViewProps> = ({ onSelectPlaylistById }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ tracks: any[]; artists: any[]; playlists: any[] }>({
    tracks: [],
    artists: [],
    playlists: [],
  });
  const [filter, setFilter] = useState<'todo' | 'canciones' | 'artistas' | 'playlists'>('todo');
  const [isSearching, setIsSearching] = useState(false);

  const { playTrack, currentTrack, isPlaying, togglePlay } = usePlayerStore();

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
            placeholder="¿Qué te apetece escuchar?"
            className="w-full h-full bg-transparent text-black text-sm font-semibold outline-none placeholder:text-[#535353]"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-[#535353] hover:text-black p-1 shrink-0"
            >
              ✕
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
                          {trk.artists?.map((a: any) => a.name).join(', ')}
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
                  onClick={() =>
                    onSelectPlaylistById(`art-${art.name.toLowerCase().replace(/\s+/g, '-')}`, art.name, art.images?.[0]?.url)
                  }
                  className="flex items-center gap-3 p-2 rounded-lg active:bg-white/10 cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-[#242424] shrink-0 shadow">
                    {art.images?.[0]?.url ? (
                      <img
                        src={art.images[0].url}
                        alt={art.name}
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
                  onClick={() => onSelectPlaylistById(pl.id, pl.name, pl.images?.[0]?.url)}
                  className="flex items-center gap-3 p-2 rounded-lg active:bg-white/10 cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-md overflow-hidden bg-[#242424] shrink-0 shadow">
                    {pl.images?.[0]?.url && (
                      <img
                        src={pl.images[0].url}
                        alt={pl.name}
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
        /* Empty Query: 2-Column "Explorar todo" Genre Cards Grid matching Spotify Mobile 02_mobile_search.png */
        <div className="space-y-3">
          <h2 className="text-base font-bold text-white font-['SpotifyMixUITitle']">
            Explorar todo
          </h2>

          <div className="grid grid-cols-2 gap-3">
            {MOBILE_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                onClick={() => onSelectPlaylistById(cat.playlistId, cat.title, cat.imgSrc)}
                style={{ backgroundColor: cat.bgColor }}
                className="relative h-24 rounded-lg p-3 overflow-hidden cursor-pointer active:scale-98 transition-transform shadow-md"
              >
                <h3 className="text-base font-black text-white leading-tight break-words max-w-[65%] z-10 relative font-['SpotifyMixUITitle']">
                  {cat.title}
                </h3>
                <img
                  src={cat.imgSrc}
                  alt={cat.title}
                  className="absolute -bottom-2 -right-3 w-16 h-16 rounded shadow-lg transform rotate-[25deg] object-cover pointer-events-none"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
