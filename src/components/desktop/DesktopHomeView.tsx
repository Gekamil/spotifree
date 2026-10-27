import React, { useState, useMemo } from 'react';
import { PlayNativeIcon, PauseNativeIcon } from '../icons/SpotifyNativeIcons';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSpotifyDataStore, buildDynamicShelves } from '../../store/useSpotifyDataStore';
import { DesktopShelfCarousel } from './DesktopShelfCarousel';
import { DesktopShimmerFeed } from './DesktopShimmerFeed';


interface DesktopHomeViewProps {
  onSelectPlaylistById: (id: string) => void;
}

export const DesktopHomeView: React.FC<DesktopHomeViewProps> = ({ onSelectPlaylistById }) => {
  const [activeTab, setActiveTab] = useState<'todo' | 'musica' | 'siguiendo'>('todo');
  const [hoveredColor, setHoveredColor] = useState<string | null>(null);

  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore();
  const {
    isAuthenticated,
    user,
    playlists,
    dynamicShelves,
    quickAccessCards: storeQuickAccess,
    featuredMessage,
    authWarning,
  } = useSpotifyDataStore();

  const currentShortcuts = storeQuickAccess && storeQuickAccess.length > 0
    ? storeQuickAccess
    : [
        { id: '37i9dQZF1DWZdsS73T1ogG', name: 'el nuevo urbano', image: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426', color: '#1a4b4c' },
        { id: '7b3MrCWtettvBKlfBSdorn', name: 'J+L(2026)', image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c804d43e5cc7f6a6d0ac65ffc', color: '#8a654e' },
        { id: '37i9dQZF1DX2EiUAL7Wdfc', name: 'míticas', image: 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6', color: '#9c3426' },
        { id: '4f0YTBqSbvM1iJpuY9r3yQ', name: 'ZIZI', image: 'https://i.scdn.co/image/ab67616d0000b273eb31ebdbca6acd99c23b4d31', color: '#2d4b68' },
      ];

  const currentShelves = useMemo(() => {
    if (activeTab === 'siguiendo') {
      const userArtists: Array<{ id: string; title: string; subtitle: string; image: string }> = [];
      const seen = new Set<string>();

      playlists.forEach((p) => {
        if (/mix de|radio de/i.test(p.name)) {
          const name = p.name.replace(/^(mix de|radio de)\s+/i, '').trim();
          if (name && !seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            userArtists.push({
              id: `art-${name.toLowerCase().replace(/\s+/g, '-')}`,
              title: name,
              subtitle: 'Artista',
              image: p.images?.[0]?.url || 'https://i.scdn.co/image/ab6761610000e5eb4e015d3113dd88ee0cb71658',
            });
          }
        }
      });

      const defaultArtists = [
        { name: 'Romeo Santos', img: 'https://i.scdn.co/image/ab6761610000e5eb56e6d183815f9bca1b4a9296' },
        { name: 'Prince Royce', img: 'https://i.scdn.co/image/ab6761610000e5eb7dcab764f69fc39bb2f97a5b' },
        { name: 'Bad Bunny', img: 'https://i.scdn.co/image/ab6761610000e5eb9ad3eb759082ef7ef688b56d' },
        { name: 'Álvaro Díaz', img: 'https://i.scdn.co/image/ab6761610000e5ebfa055a1532ba706d8a3952ba' },
        { name: 'Feid', img: 'https://i.scdn.co/image/ab6761610000e5eb604da57c9a62256c702ae07d' },
      ];

      defaultArtists.forEach((a) => {
        if (!seen.has(a.name.toLowerCase())) {
          seen.add(a.name.toLowerCase());
          userArtists.push({
            id: `art-${a.name.toLowerCase().replace(/\s+/g, '-')}`,
            title: a.name,
            subtitle: 'Artista',
            image: a.img,
          });
        }
      });

      return [
        {
          id: 'shelf-siguiendo-artists',
          prefix: 'Tus favoritos',
          title: 'Artistas que sigues',
          subtitle: 'Acceso directo a la discografía de tus artistas',
          cards: userArtists.slice(0, 8),
          hasSeeAll: false,
        },
        {
          id: 'shelf-siguiendo-releases',
          prefix: 'Novedades de',
          title: 'Tus artistas seguidos',
          subtitle: 'Nuevos álbumes y sencillos recomendados para ti',
          cards: playlists
            .filter((p) => !p.id.includes('collection') && !p.name.includes('Canciones que'))
            .slice(0, 8)
            .map((p) => ({
              id: p.id,
              title: p.name,
              subtitle: p.description || 'Lanzamiento recomendado',
              image: p.images?.[0]?.url || '',
            })),
          hasSeeAll: true,
        },
      ];
    }
    const base = dynamicShelves && dynamicShelves.length > 0
      ? dynamicShelves
      : buildDynamicShelves(user, playlists, featuredMessage);
    return base.filter((s) => !s.title.toLowerCase().includes('pódcast') && !s.title.toLowerCase().includes('audiolibro'));
  }, [activeTab, dynamicShelves, user, playlists, featuredMessage]);

  const activeBg = hoveredColor || currentShortcuts[0]?.color || '#5038a0';

  if (!isAuthenticated) {
    return <DesktopShimmerFeed />;
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
        {/* Informative notice for Spotify Developer Premium restriction */}
        {authWarning && (
          <div className="bg-[#181818] border border-[#f59e0b]/40 rounded-lg p-4 flex items-start gap-3 shadow-lg">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" className="text-[#f59e0b] shrink-0 mt-0.5">
              <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8z" />
              <path d="M7.25 4.75a.75.75 0 1 1 1.5 0 .75.75 0 0 1-1.5 0zM7.25 7h1.5v4.5h-1.5V7z" />
            </svg>
            <div className="text-sm space-y-1">
              <p className="font-bold text-white font-['SpotifyMixUITitle']">Sesión de Spotify conectada</p>
              <p className="text-[#b3b3b3] text-xs leading-relaxed">
                Spotify Web API requiere una suscripción Premium en la cuenta de desarrollador para descargar listas privadas (Spotify Cloud: <em>"Active premium subscription required for the owner of the app"</em>).
                Puedes buscar y reproducir cualquier canción gratis con el reproductor, o vincular tu propio Client ID de Spotify en <strong>Configuración</strong>.
              </p>
            </div>
          </div>
        )}

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
