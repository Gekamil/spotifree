import React, { useState, useMemo, useEffect } from 'react';
import { PlayNativeIcon, PauseNativeIcon } from '../icons/SpotifyNativeIcons';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSpotifyDataStore, buildDynamicShelves } from '../../store/useSpotifyDataStore';
import { DesktopShelfCarousel } from './DesktopShelfCarousel';
import { DesktopShimmerFeed } from './DesktopShimmerFeed';
import { getColorFromTitle, isInvalidGrey } from '../../utils/colorExtractor';

interface DesktopHomeViewProps {
  onSelectPlaylistById: (id: string) => void;
}

export const DesktopHomeView: React.FC<DesktopHomeViewProps> = ({ onSelectPlaylistById }) => {
  const [activeTab, setActiveTab] = useState<'todo' | 'musica' | 'siguiendo'>('todo');
  const [expandedShelf, setExpandedShelf] = useState<{
    id: string;
    prefix?: string;
    title: string;
    subtitle?: string;
    cards: Array<{ id: string; title: string; subtitle: string; image: string }>;
  } | null>(null);

  // Retain the last chosen ambient color permanently so it never flashes back to blue
  const [ambientColor, setAmbientColor] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('spotifree_last_ambient_color');
      if (saved && !isInvalidGrey(saved)) return saved;
    }
    return '#8a654e';
  });

  // Dual-buffered crossfade states for slow, gradual gradient transitions ("poco a poco")
  const [colorA, setColorA] = useState<string>(ambientColor);
  const [colorB, setColorB] = useState<string>(ambientColor);
  const [isLayerB, setIsLayerB] = useState<boolean>(false);

  useEffect(() => {
    if (!ambientColor) return;
    if (isLayerB) {
      setColorA(ambientColor);
      setIsLayerB(false);
    } else {
      setColorB(ambientColor);
      setIsLayerB(true);
    }
  }, [ambientColor]);

  const handleCardHover = (color?: string, name?: string, id?: string) => {
    const candidate = color && !isInvalidGrey(color) ? color : getColorFromTitle(name || '', id || '');
    if (candidate && !isInvalidGrey(candidate)) {
      setAmbientColor(candidate);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('spotifree_last_ambient_color', candidate);
      }
    }
  };

  // Reset expanded shelf on global navigate home event
  useEffect(() => {
    const handleHomeNav = () => setExpandedShelf(null);
    window.addEventListener('spotifree_navigate_home', handleHomeNav);
    return () => window.removeEventListener('spotifree_navigate_home', handleHomeNav);
  }, []);

  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore();
  const {
    isAuthenticated,
    user,
    playlists,
    dynamicShelves,
    featuredMessage,
  } = useSpotifyDataStore();

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

  if (expandedShelf) {
    const shelfAmbientColor = getColorFromTitle(expandedShelf.title, expandedShelf.id);
    return (
      <div
        className="select-none min-h-full pb-20 relative bg-[#121212] p-8 space-y-6 animate-in fade-in duration-200"
        style={{
          background: `linear-gradient(180deg, ${shelfAmbientColor}B3 0%, rgba(18, 18, 18, 0.7) 240px, #121212 420px)`,
        }}
      >
        {/* Soft Bloom Ambient Glow */}
        <div
          className="absolute top-0 left-0 right-0 h-[380px] pointer-events-none"
          style={{
            background: `linear-gradient(180deg, ${shelfAmbientColor}66 0%, transparent 100%)`,
          }}
        />

        {/* Shelf Header - Authentic Spotify layout without redundant in-page back button */}
        <div className="pt-2 pb-2 relative z-10">
          {expandedShelf.prefix && (
            <span className="text-xs uppercase font-bold text-[#b3b3b3] tracking-wider block mb-1">
              {expandedShelf.prefix}
            </span>
          )}
          <h1 className="text-3xl lg:text-4xl font-black text-white font-['SpotifyMixUITitle']">
            {expandedShelf.title}
          </h1>
          {expandedShelf.subtitle && (
            <p className="text-sm text-[#b3b3b3] mt-1">{expandedShelf.subtitle}</p>
          )}
        </div>

        {/* Full Responsive Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 pt-2 relative z-10">
          {expandedShelf.cards.map((card) => {
            const isPlayingThis = isPlaying && currentTrack?.id === card.id;
            return (
              <div
                key={card.id}
                onClick={() => onSelectPlaylistById(card.id)}
                className="p-3.5 rounded-lg bg-[#181818] hover:bg-[#282828] transition-all cursor-pointer group flex flex-col shadow-md hover:shadow-2xl relative"
              >
                <div className="relative aspect-square w-full rounded-md overflow-hidden mb-3 bg-[#242424] shadow-md">
                  {card.image ? (
                    <img
                      src={card.image}
                      alt={card.title}
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
                      handleQuickPlay(undefined, {
                        id: card.id,
                        name: card.title,
                        image: card.image,
                      });
                    }}
                    className={`absolute bottom-2 right-2 w-11 h-11 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-106 active:scale-95 shadow-xl flex items-center justify-center transition-all duration-200 ${
                      isPlayingThis ? 'opacity-100 scale-100' : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'
                    }`}
                    title={isPlayingThis ? 'Pausar' : `Reproducir ${card.title}`}
                  >
                    {isPlayingThis ? (
                      <PauseNativeIcon size={18} className="text-black" />
                    ) : (
                      <PlayNativeIcon size={18} className="text-black ml-0.5" />
                    )}
                  </button>
                </div>

                <span className="font-bold text-white text-sm truncate font-['SpotifyMixUI']">
                  {card.title}
                </span>
                <span className="text-xs text-[#b3b3b3] line-clamp-2 mt-1 leading-snug">
                  {card.subtitle}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="select-none min-h-full pb-20 relative bg-[#121212] overflow-hidden">
      {/* Dual-buffer Crossfade Gradient Layer A (base) */}
      <div
        className="absolute top-0 left-0 right-0 h-[500px] pointer-events-none transition-opacity duration-1000 ease-in-out z-0"
        style={{
          background: `linear-gradient(180deg, ${colorA}B3 0%, rgba(18, 18, 18, 0.7) 260px, #121212 480px)`,
          opacity: isLayerB ? 0 : 1,
        }}
      />

      {/* Dual-buffer Crossfade Gradient Layer B (active crossfader) */}
      <div
        className="absolute top-0 left-0 right-0 h-[500px] pointer-events-none transition-opacity duration-1000 ease-in-out z-0"
        style={{
          background: `linear-gradient(180deg, ${colorB}B3 0%, rgba(18, 18, 18, 0.7) 260px, #121212 480px)`,
          opacity: isLayerB ? 1 : 0,
        }}
      />

      {/* Atmospheric Soft Aura with native 1.2s color transition */}
      <div
        className="absolute -top-32 -left-32 w-[650px] h-[650px] rounded-full pointer-events-none blur-[120px] opacity-40 transition-colors duration-1000 ease-out z-0"
        style={{ backgroundColor: ambientColor }}
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
        {/* Dynamic Section Shelves for Current Active Tab - Authentic Spotify Feed */}
        {currentShelves.map((shelf) => (
          <DesktopShelfCarousel
            key={shelf.id}
            prefix={shelf.prefix}
            title={shelf.title}
            subtitle={shelf.subtitle}
            items={shelf.cards}
            onShowAll={shelf.hasSeeAll ? () => setExpandedShelf(shelf) : undefined}
            onCardClick={(card) => {
              onSelectPlaylistById(card.id);
            }}
            onCardHover={(card) => {
              handleCardHover(undefined, card.title, card.id);
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
