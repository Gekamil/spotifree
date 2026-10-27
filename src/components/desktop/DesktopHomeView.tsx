import React, { useState, useMemo } from 'react';
import { PlayNativeIcon, PauseNativeIcon } from '../icons/SpotifyNativeIcons';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSpotifyDataStore, buildDynamicShelves } from '../../store/useSpotifyDataStore';
import { DesktopShelfCarousel } from './DesktopShelfCarousel';
import { DesktopShimmerFeed } from './DesktopShimmerFeed';


interface DesktopHomeViewProps {
  onSelectPlaylistById: (id: string) => void;
}

const PODCAST_SHELVES = [
  {
    id: 'shelf-podcasts-top',
    prefix: '',
    title: 'Tus programas favoritos',
    subtitle: 'Episodios y novedades de tus suscripciones',
    hasSeeAll: true,
    cards: [
      {
        id: 'pod-wild-project',
        title: 'The Wild Project',
        subtitle: 'Jordi Wild • Actualidad, charlas y misterio',
        image: 'https://i.scdn.co/image/ab6765630000ba8a7e0eb1f1a5666f7f6f59dfad',
      },
      {
        id: 'pod-nadie-sabe-nada',
        title: 'Nadie Sabe Nada',
        subtitle: 'Cadena SER • Buenafuente y Berto Romero',
        image: 'https://i.scdn.co/image/ab6765630000ba8a74e50337c63b7ceea7536a28',
      },
      {
        id: 'pod-la-ruina',
        title: 'La Ruina',
        subtitle: 'Ignasi Taltavull y Tomàs Fuentes',
        image: 'https://i.scdn.co/image/ab6765630000ba8abcf41103c27e85288bf246b7',
      },
      {
        id: 'pod-birra',
        title: 'El Sentido De La Birra',
        subtitle: 'Ricardo Moya • Entrevistas en profundidad',
        image: 'https://i.scdn.co/image/ab6765630000ba8aeef55d9d9bb73a30ad8a4253',
      },
      {
        id: 'pod-chicle',
        title: 'Estirando el chicle',
        subtitle: 'Carolina Iglesias y Victoria Martín',
        image: 'https://i.scdn.co/image/ab6765630000ba8a38ec3ff7900b3e7ff0b0e350',
      },
    ],
  },
  {
    id: 'shelf-podcasts-episodes',
    prefix: '',
    title: 'Episodios más escuchados hoy',
    subtitle: 'Historias, humor y actualidad',
    hasSeeAll: false,
    cards: [
      {
        id: 'pod-ep-1',
        title: '#314 - Charla con especialistas',
        subtitle: 'The Wild Project • 3 h 12 min',
        image: 'https://i.scdn.co/image/ab6765630000ba8a7e0eb1f1a5666f7f6f59dfad',
      },
      {
        id: 'pod-ep-2',
        title: 'Samuráis de la improvisación',
        subtitle: 'Nadie Sabe Nada • 54 min',
        image: 'https://i.scdn.co/image/ab6765630000ba8a74e50337c63b7ceea7536a28',
      },
      {
        id: 'pod-ep-3',
        title: 'Anécdotas que salieron regular',
        subtitle: 'La Ruina • 1 h 02 min',
        image: 'https://i.scdn.co/image/ab6765630000ba8abcf41103c27e85288bf246b7',
      },
    ],
  },
];

const AUDIOLIBROS_SHELVES = [
  {
    id: 'shelf-audiolibros-popular',
    prefix: '',
    title: 'Audiolibros populares en España',
    subtitle: 'Grandes historias para escuchar en cualquier lugar',
    hasSeeAll: true,
    cards: [
      {
        id: 'book-habitos-atomicos',
        title: 'Hábitos Atómicos',
        subtitle: 'James Clear • Narrado por Jordi Varela',
        image: 'https://i.scdn.co/image/ab6765630000ba8a383416c11d51c35626a54f05',
      },
      {
        id: 'book-sapiens',
        title: 'Sapiens: De animales a dioses',
        subtitle: 'Yuval Noah Harari • Historia humana',
        image: 'https://i.scdn.co/image/ab6765630000ba8a24559b3989c93361400d3b64',
      },
      {
        id: 'book-psicologia-dinero',
        title: 'La psicología del dinero',
        subtitle: 'Morgan Housel • Finanzas y comportamiento',
        image: 'https://i.scdn.co/image/ab6765630000ba8ad4914c449c258d4a64e1eb30',
      },
      {
        id: 'book-principito',
        title: 'El Principito',
        subtitle: 'Antoine de Saint-Exupéry • Clásico universal',
        image: 'https://i.scdn.co/image/ab6765630000ba8a221f7e340c2626e2a220fc5c',
      },
    ],
  },
];

const SIGUIENDO_SHELVES = [
  {
    id: 'shelf-siguiendo-releases',
    prefix: 'Novedades de',
    title: 'Tus artistas seguidos',
    subtitle: 'Nuevos álbumes y sencillos recomendados para ti',
    hasSeeAll: true,
    cards: [
      {
        id: 'art-alvaro-diaz',
        title: 'SAYONARA FINAL',
        subtitle: 'Álvaro Díaz • Álbum',
        image: 'https://i.scdn.co/image/ab67616d0000b273292fe4fb67bb46dbdbd623aa',
      },
      {
        id: 'art-romeo-santos',
        title: 'Fórmula, Vol. 3',
        subtitle: 'Romeo Santos • Álbum',
        image: 'https://i.scdn.co/image/ab67616d0000b273434606ffc6b541300ceee24e',
      },
      {
        id: 'art-prince-royce',
        title: 'Llamada Perdida',
        subtitle: 'Prince Royce • Álbum',
        image: 'https://i.scdn.co/image/ab67616d0000b27389c97b830e3fe054368a5c37',
      },
      {
        id: 'art-rauw',
        title: 'Cosa Nuestra',
        subtitle: 'Rauw Alejandro • Álbum',
        image: 'https://i.scdn.co/image/ab67616d0000b273b4d455d3e098be9a9ba46d84',
      },
    ],
  },
];

export const DesktopHomeView: React.FC<DesktopHomeViewProps> = ({ onSelectPlaylistById }) => {
  const [activeTab, setActiveTab] = useState<'todo' | 'musica' | 'siguiendo' | 'podcasts' | 'audiolibros'>('todo');
  const [hoveredColor, setHoveredColor] = useState<string | null>(null);

  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore();
  const {
    isAuthenticated,
    user,
    playlists,
    dynamicShelves,
    quickAccessCards: storeQuickAccess,
    featuredMessage,
    login,
  } = useSpotifyDataStore();

  const defaultMusicShortcuts = storeQuickAccess && storeQuickAccess.length > 0
    ? storeQuickAccess
    : [
        { id: '37i9dQZF1DWZdsS73T1ogG', name: 'el nuevo urbano', image: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426', color: '#1a4b4c' },
        { id: '7b3MrCWtettvBKlfBSdorn', name: 'J+L(2026)', image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c804d43e5cc7f6a6d0ac65ffc', color: '#8a654e' },
        { id: '37i9dQZF1DX2EiUAL7Wdfc', name: 'míticas', image: 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6', color: '#9c3426' },
        { id: '4f0YTBqSbvM1iJpuY9r3yQ', name: 'ZIZI', image: 'https://i.scdn.co/image/ab67616d0000b273eb31ebdbca6acd99c23b4d31', color: '#2d4b68' },
      ];

  const podcastShortcuts = [
    { id: 'pod-wild-project', name: 'The Wild Project', image: 'https://i.scdn.co/image/ab6765630000ba8a7e0eb1f1a5666f7f6f59dfad', color: '#1e3240' },
    { id: 'pod-nadie-sabe-nada', name: 'Nadie Sabe Nada', image: 'https://i.scdn.co/image/ab6765630000ba8a74e50337c63b7ceea7536a28', color: '#382218' },
    { id: 'pod-la-ruina', name: 'La Ruina', image: 'https://i.scdn.co/image/ab6765630000ba8abcf41103c27e85288bf246b7', color: '#283820' },
    { id: 'pod-birra', name: 'El Sentido De La Birra', image: 'https://i.scdn.co/image/ab6765630000ba8aeef55d9d9bb73a30ad8a4253', color: '#44222a' },
  ];

  const audiobookShortcuts = [
    { id: 'book-habitos-atomicos', name: 'Hábitos Atómicos', image: 'https://i.scdn.co/image/ab6765630000ba8a383416c11d51c35626a54f05', color: '#403010' },
    { id: 'book-sapiens', name: 'Sapiens', image: 'https://i.scdn.co/image/ab6765630000ba8a24559b3989c93361400d3b64', color: '#153020' },
    { id: 'book-psicologia-dinero', name: 'La psicología del dinero', image: 'https://i.scdn.co/image/ab6765630000ba8ad4914c449c258d4a64e1eb30', color: '#252030' },
    { id: 'book-principito', name: 'El Principito', image: 'https://i.scdn.co/image/ab6765630000ba8a221f7e340c2626e2a220fc5c', color: '#102535' },
  ];

  const currentShortcuts = activeTab === 'podcasts'
    ? podcastShortcuts
    : activeTab === 'audiolibros'
    ? audiobookShortcuts
    : defaultMusicShortcuts;

  const currentShelves = useMemo(() => {
    if (activeTab === 'podcasts') return PODCAST_SHELVES;
    if (activeTab === 'audiolibros') return AUDIOLIBROS_SHELVES;
    if (activeTab === 'siguiendo') return SIGUIENDO_SHELVES;
    if (activeTab === 'musica') {
      const base = dynamicShelves && dynamicShelves.length > 0
        ? dynamicShelves
        : buildDynamicShelves(user, playlists, featuredMessage);
      return base.filter((s) => !s.title.toLowerCase().includes('pódcast'));
    }
    return dynamicShelves && dynamicShelves.length > 0
      ? dynamicShelves
      : buildDynamicShelves(user, playlists, featuredMessage);
  }, [activeTab, dynamicShelves, user, playlists, featuredMessage]);

  const activeBg = hoveredColor || currentShortcuts[0]?.color || '#5038a0';

  if (!isAuthenticated) {
    return <DesktopShimmerFeed onLogin={login} />;
  }

  const handleQuickPlay = async (
    e: React.MouseEvent | undefined,
    card: { id: string; name: string; image: string }
  ) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const isPlayingThisCard =
      isPlaying &&
      ((currentTrack as any)?.playlistId === card.id || currentTrack?.id === card.id);

    if (isPlayingThisCard) {
      togglePlay();
      return;
    }

    const cached = useSpotifyDataStore.getState().playlistDetailsCache[card.id];
    if (cached?.tracks?.items && cached.tracks.items.length > 0) {
      const items = cached.tracks.items.map((t: any) => ({ ...t, playlistId: card.id }));
      playTrack(items[0], items);
      return;
    }

    const cardPlaylist = playlists.find((p) => p.id === card.id);
    if (cardPlaylist?.tracks?.items && cardPlaylist.tracks.items.length > 0) {
      const firstTrack = cardPlaylist.tracks.items[0];
      playTrack(
        { ...firstTrack, playlistId: card.id } as any,
        cardPlaylist.tracks.items
      );
      return;
    }

    try {
      const res = await fetch(`/api/spotify/playlist/${encodeURIComponent(card.id)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.tracks?.items && data.tracks.items.length > 0) {
          const items = data.tracks.items.map((t: any) => ({ ...t, playlistId: card.id }));
          useSpotifyDataStore.getState().cachePlaylistDetails({
            id: card.id,
            name: card.name,
            description: '',
            images: [{ url: card.image }],
            owner: { display_name: 'Spotify', id: 'spotify' },
            tracks: data.tracks,
          } as any);
          playTrack(items[0], items);
          return;
        }
      }
    } catch (err) {}

    playTrack({
      id: `track-${card.id}`,
      name: card.name,
      duration_ms: 210000,
      artists: [{ id: 'artist-1', name: user?.display_name || 'Spotify' }],
      album: {
        id: `album-${card.id}`,
        name: card.name,
        images: [{ url: card.image }],
      },
      playlistId: card.id,
    } as any);
  };

  return (
    <div
      className="select-none min-h-full pb-20 relative bg-[#121212]"
      style={{
        '--ambient-color': activeBg,
        background: `linear-gradient(180deg, var(--ambient-color) 0%, rgba(18, 18, 18, 0.5) 200px, #121212 380px)`,
        transition: '--ambient-color 0.8s cubic-bezier(0.3, 0, 0.4, 1)',
      } as React.CSSProperties}
    >
      {/* GPU Ambient Soft Bloom Layer */}
      <div
        className="absolute top-0 left-0 right-0 h-[380px] pointer-events-none transition-all duration-700 ease-[cubic-bezier(0.3,0,0.4,1)]"
        style={{
          background: `linear-gradient(180deg, ${activeBg}99 0%, ${activeBg}33 160px, transparent 380px)`,
        }}
      />

      {/* Top Filter Pills (Matching Spotify 1:1 Pixel & Animation Fidelity) */}
      <div className="sticky top-0 z-30 px-6 pt-4 pb-3 flex items-center gap-2 backdrop-blur-md bg-[#121212]/75">
        {activeTab !== 'musica' && activeTab !== 'siguiendo' ? (
          <>
            <button
              onClick={() => setActiveTab('todo')}
              className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === 'todo'
                  ? 'bg-white text-black shadow-md'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Todo
            </button>

            <button
              onClick={() => setActiveTab('musica')}
              className="px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer bg-white/10 text-white hover:bg-white/20"
            >
              Música
            </button>

            <button
              onClick={() => setActiveTab('podcasts')}
              className="px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer bg-white/10 text-white hover:bg-white/20"
            >
              Pódcasts
            </button>

            <button
              onClick={() => setActiveTab('audiolibros')}
              className="px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer bg-white/10 text-white hover:bg-white/20"
            >
              Audiolibros
            </button>
          </>
        ) : (
          /* Filtered state: "Música" with clear button + attached "Siguiendo" sub-filter */
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
            {/* Active Música parent button with '✕' icon */}
            <button
              onClick={() => setActiveTab('todo')}
              className="h-8 px-3 rounded-full text-sm font-semibold flex items-center gap-1.5 bg-white text-black shadow-md hover:scale-104 active:scale-96 transition-all cursor-pointer"
              title="Borrar filtro Música"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1.47 1.47a.75.75 0 0 1 1.06 0L8 6.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L9.06 8l5.47 5.47a.75.75 0 1 1-1.06 1.06L8 9.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L6.94 8 1.47 2.53a.75.75 0 0 1 0-1.06" />
              </svg>
              <span>Música</span>
            </button>

            {/* Sub-category: "Siguiendo" */}
            <button
              onClick={() => setActiveTab(activeTab === 'siguiendo' ? 'musica' : 'siguiendo')}
              className={`h-8 px-3.5 rounded-full text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center ${
                activeTab === 'siguiendo'
                  ? 'bg-white text-black shadow-md'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Siguiendo
            </button>
          </div>
        )}
      </div>

      {/* Main Home Content with Smooth Transition */}
      <div key={activeTab} className="px-6 space-y-8 mt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* Quick Access Shortcuts Grid */}
        {currentShortcuts && currentShortcuts.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {currentShortcuts.map((item) => {
              const isPlayingThis =
                isPlaying &&
                ((currentTrack as any)?.playlistId === item.id || currentTrack?.id === item.id);

              return (
                <div
                  key={item.id}
                  onClick={() => onSelectPlaylistById(item.id)}
                  onMouseEnter={() => setHoveredColor(item.color)}
                  onMouseLeave={() => setHoveredColor(null)}
                  className="group h-[56px] flex items-center bg-white/[0.08] hover:bg-white/[0.2] rounded-[4px] overflow-hidden cursor-pointer transition-all duration-200 relative pr-3 shadow-sm"
                >
                  <div className="w-[56px] h-[56px] shrink-0 bg-[#282828] shadow">
                    <img
                      src={item.image}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <span className="text-[14px] font-bold text-white px-3 truncate flex-1 font-['SpotifyMixUI']">
                    {item.name}
                  </span>

                  <button
                    onClick={(e) => handleQuickPlay(e, item)}
                    className={`w-9 h-9 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-104 active:scale-95 shadow-lg flex items-center justify-center transition-all duration-200 ${
                      isPlayingThis
                        ? 'opacity-100 scale-100'
                        : 'opacity-0 group-hover:opacity-100 group-hover:scale-100 scale-90'
                    }`}
                    title={`Reproducir ${item.name}`}
                  >
                    {isPlayingThis ? (
                      <PauseNativeIcon size={16} className="text-black" />
                    ) : (
                      <PlayNativeIcon size={16} className="text-black ml-0.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Dynamic Section Shelves for Current Active Tab */}
        {currentShelves.map((shelf) => (
          <DesktopShelfCarousel
            key={shelf.id}
            prefix={shelf.prefix}
            title={shelf.title}
            subtitle={shelf.subtitle}
            items={shelf.cards}
            onShowAll={shelf.hasSeeAll ? () => {} : undefined}
            onCardClick={(card) => {
              onSelectPlaylistById(card.id);
            }}
            onPlayClick={(card) => {
              handleQuickPlay(undefined, {
                id: card.id,
                name: card.title,
                image: card.image,
              });
            }}
          />
        ))}
      </div>
    </div>
  );
};
