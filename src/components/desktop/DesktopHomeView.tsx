import React, { useState, useMemo, useEffect } from 'react';
import { PlayNativeIcon, PauseNativeIcon } from '../icons/SpotifyNativeIcons';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSpotifyDataStore, buildDynamicShelves, getDeletedPlaylistIds } from '../../store/useSpotifyDataStore';
import { useUIStore } from '../../store/useUIStore';
import { DesktopShelfCarousel } from './DesktopShelfCarousel';
import { SpotifyDJVisualizer } from '../dj/SpotifyDJVisualizer';
import { InteractiveMusicWaves } from '../dj/InteractiveMusicWaves';
import { resolveVibrantColor, extractDominantColorFromImage } from '../../utils/spotifyColor';
import { handleImageError } from '../../utils/imageFallback';
import { stripHtml, toHDImage } from '../../utils/formatters';
import { RotatingDJBannerText } from '../../utils/djMessages';
import { useAIDJStore } from '../../services/aiDJService';

const DEFAULT_SHORTCUTS = [
  { id: 'liked-songs', name: 'Canciones que te gustan', image: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg', color: '#5018F0' },
  { id: 'mix-diario-1', name: 'Mix diario 1', image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/1/ab6761610000e5ebba3ed5da785f99ce7ea6fb0b/es', color: '#C45028' },
  { id: 'romeo-prince', name: 'Romeo & Prince', image: 'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000bebbfd28fd6f3ec5b7002c5649d7', color: '#C45028' },
  { id: 'my-top-tracks-playlist', name: 'My top tracks playlist', image: 'https://mosaic.scdn.co/640/ab67616d00001e0274d62f9a88da68519fa864f4ab67616d00001e027c7a7bfadfaa801d3285455bab67616d00001e02c019056033dfa6c6987f25ceab67616d00001e02d01f410ddd5776121c42bf59', color: '#5E3D82' },
  { id: '7b3MrCWtettvBKlfBSdorn', name: 'J+L(2026)', image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000bebb804d43e5cc7f6a6d0ac65ffc', color: '#8A654E' },
  { id: 'radio-prince-royce', name: 'Prince Royce Radio', image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/radio/artist/3MHaV05u0io8fQbZ2XPtlC/es', color: '#EAB308' },
  { id: 'tus-canciones-mas-escuchadas-2025', name: 'Your Top Songs 2025', image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/wrapped25/yts/en', color: '#E05A36' },
  { id: 'random', name: 'Random', image: 'https://mosaic.scdn.co/640/ab67616d00001e0274d62f9a88da68519fa864f4ab67616d00001e027c7a7bfadfaa801d3285455bab67616d00001e0281df105a4f0b2f6b07468179ab67616d00001e02c019056033dfa6c6987f25ce', color: '#2D6852' },
  { id: 'spidey', name: 'Spidey', image: 'https://i.scdn.co/image/ab67616d000011ebe2e352d89826aef6dbd5ff8f', color: '#D11B24' },
];

interface DesktopHomeViewProps {
  onSelectPlaylistById: (id: string) => void;
}

export const DesktopHomeView: React.FC<DesktopHomeViewProps> = ({ onSelectPlaylistById }) => {
  const djThemeColor = useAIDJStore((s) => s.djThemeColor);
  const [activeTab, setActiveTab] = useState<'todo' | 'musica' | 'siguiendo'>('todo');
  const [expandedShelf, setExpandedShelf] = useState<{
    id: string;
    prefix?: string;
    title: string;
    subtitle?: string;
    cards: Array<{ id: string; title: string; subtitle: string; image: string }>;
  } | null>(null);

  // Reset expanded shelf on global navigate home or back events
  useEffect(() => {
    const handleHomeNav = () => setExpandedShelf(null);
    window.addEventListener('spotifree_navigate_home', handleHomeNav);
    window.addEventListener('spotifree_navigate_back', handleHomeNav);
    window.addEventListener('popstate', handleHomeNav);
    return () => {
      window.removeEventListener('spotifree_navigate_home', handleHomeNav);
      window.removeEventListener('spotifree_navigate_back', handleHomeNav);
      window.removeEventListener('popstate', handleHomeNav);
    };
  }, []);

  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore();
  const {
    isAuthenticated,
    user,
    playlists,
    dynamicShelves,
    quickAccessCards: storeQuickAccess,
    featuredMessage,
  } = useSpotifyDataStore();

  const currentShortcuts = useMemo(() => {
    if (!isAuthenticated) return [];
    const raw = storeQuickAccess && storeQuickAccess.length > 0 ? storeQuickAccess : DEFAULT_SHORTCUTS;
    return raw.map((item) => ({
      ...item,
      color: resolveVibrantColor(item.id, item.name, item.color),
    }));
  }, [storeQuickAccess, isAuthenticated]);

  // Keep background on the last hovered color smoothly
  const [extractedColors, setExtractedColors] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    currentShortcuts.forEach((item) => {
      if (item.image) {
        extractDominantColorFromImage(item.image).then((hex) => {
          if (!cancelled && hex) {
            setExtractedColors((prev) => ({ ...prev, [item.id]: hex }));
          }
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currentShortcuts]);

  const [activeBg, setActiveBg] = useState<string>(() => {
    return currentShortcuts[0]?.color || '#5018F0';
  });

  // If shortcuts update and activeBg is still initial, sync gently
  useEffect(() => {
    const firstColor = extractedColors[currentShortcuts[0]?.id] || currentShortcuts[0]?.color;
    if (firstColor && activeBg === '#5018F0') {
      setActiveBg(firstColor);
    }
  }, [currentShortcuts, extractedColors]);

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
              subtitle: stripHtml(p.description) || 'Lanzamiento recomendado',
              image: p.images?.[0]?.url || '',
            })),
          hasSeeAll: true,
        },
      ];
    }
    const deletedIds = getDeletedPlaylistIds();
    const base = dynamicShelves && dynamicShelves.length > 0
      ? dynamicShelves
      : buildDynamicShelves(user, playlists, featuredMessage);
    const isDJCard = (c: { id: string; title?: string }) =>
      c.id === 'spotify-dj' ||
      c.id === 'dj' ||
      c.id === 'ai-dj' ||
      (c.title || '').toLowerCase().trim() === 'dj' ||
      (c.title || '').toLowerCase().includes('spotify dj') ||
      (c.title || '').toLowerCase() === 'tu dj' ||
      (c.title || '').toLowerCase().includes('personal dj');

    return base
      .filter((s) => !s.title.toLowerCase().includes('pódcast') && !s.title.toLowerCase().includes('audiolibro'))
      .map((shelf) => ({
        ...shelf,
        cards: shelf.cards.filter((c) => !deletedIds.has(c.id) && !isDJCard(c)),
      }));
  }, [activeTab, dynamicShelves, user, playlists, featuredMessage]);

  const handleQuickPlay = async (
    e: React.MouseEvent | undefined,
    card: { id: string; name: string; image: string }
  ) => {
    if (e && e.stopPropagation) e.stopPropagation();

    if (card.id === 'spotify-dj' || card.name.toLowerCase().trim() === 'dj') {
      useUIStore.getState().setActiveMainTab('dj');
      return;
    }

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
      const userCookie = typeof window !== 'undefined' ? window.localStorage.getItem('user_spotify_cookie') || '' : '';
      const accessToken = typeof window !== 'undefined' ? window.localStorage.getItem('spotify_access_token') || '' : '';
      const headers: Record<string, string> = {};
      if (userCookie) headers['x-spotify-cookie'] = userCookie;
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const res = await fetch(`/api/spotify/playlist/${encodeURIComponent(card.id)}`, { headers });
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

    // Navigate to playlist so it loads directly with search & items instead of a corrupt dummy song
    onSelectPlaylistById(card.id);
  };

  if (!isAuthenticated) {
    return (
      <div className="relative min-h-full pb-32 flex flex-col items-center justify-center text-center px-8 pt-20 animate-in fade-in duration-300">
        <div className="max-w-md space-y-5">
          <div className="w-16 h-16 rounded-full bg-[#1ed760] text-black flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 5.524 4.477 10 10 10s10-4.476 10-10c0-5.523-4.477-10-10-10zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.435-5.308-1.76-8.793-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.808-.87 7.076-.496 9.722 1.115.294.18.386.563.207.855zm1.226-2.72c-.226.367-.706.482-1.072.257-2.687-1.652-6.785-2.131-9.965-1.166-.413.127-.848-.106-.973-.518-.125-.413.108-.848.52-.973 3.632-1.102 8.147-.568 11.233 1.328.366.226.481.707.257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.494.15-1.018-.13-1.168-.624-.15-.494.13-1.018.624-1.168 3.532-1.073 9.404-.866 13.115 1.337.445.264.59.838.327 1.282-.264.443-.838.59-1.28.327z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-white font-['SpotifyMixUITitle'] tracking-tight">
            Escucha sin límites
          </h1>
          <p className="text-sm text-[#b3b3b3] leading-relaxed">
            Inicia sesión con tu cuenta de Spotify para acceder a tu biblioteca, playlists y recomendaciones personalizadas.
          </p>
          <div className="pt-2">
            <button
              onClick={() => useUIStore.getState().openLoginModal()}
              className="px-8 py-3.5 rounded-full bg-[#1ed760] hover:bg-[#1fdf64] hover:scale-105 active:scale-95 text-black font-bold text-sm tracking-tight transition-all cursor-pointer shadow-xl inline-flex items-center gap-2"
            >
              <span>Conectar cuenta de Spotify</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (expandedShelf) {
    const shelfAmbientColor = resolveVibrantColor(expandedShelf.id, expandedShelf.title);
    return (
      <div
        className="select-none min-h-full pb-20 relative bg-[#121212] p-8 space-y-6 animate-in fade-in duration-200"
        style={{
          backgroundColor: shelfAmbientColor,
          backgroundImage: 'linear-gradient(180deg, rgba(0, 0, 0, 0.52) 0%, rgba(18, 18, 18, 0.88) 240px, #121212 380px)',
          transition: 'background-color 1.2s cubic-bezier(0.2, 0, 0, 1)',
        }}
      >

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
                      src={toHDImage(card.image)}
                      alt={card.title}
                      onError={handleImageError}
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
                  {stripHtml(card.subtitle)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className="select-none min-h-full pb-20 relative bg-[#121212]"
      style={{
        backgroundColor: activeBg,
        backgroundImage: 'linear-gradient(180deg, rgba(0, 0, 0, 0.52) 0%, rgba(18, 18, 18, 0.88) 240px, #121212 380px)',
        transition: 'background-color 1.2s cubic-bezier(0.2, 0, 0, 1)',
      }}
    >
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
      <div key={activeTab} className="px-6 space-y-8 mt-2 animate-cascade-down">
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
                  onMouseEnter={() => setActiveBg(extractedColors[item.id] || item.color)}
                  className="group h-[56px] flex items-center bg-white/[0.08] hover:bg-white/[0.2] rounded-[4px] overflow-hidden cursor-pointer transition-all duration-200 relative pr-3 shadow-sm"
                >
                  <div className="w-[56px] h-[56px] shrink-0 bg-[#282828] shadow">
                    <img
                      src={toHDImage(item.image)}
                      alt={item.name}
                      onError={handleImageError}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <span className={`text-[14px] font-bold px-3 truncate flex-1 font-['SpotifyMixUI'] ${isPlayingThis ? 'text-[#1ed760]' : 'text-white'}`}>
                    {item.name}
                  </span>

                  {isPlayingThis && (
                    <div className="flex items-end gap-[2px] h-3.5 px-2 shrink-0 group-hover:hidden" title="Reproduciendo">
                      <span className="w-[2.5px] bg-[#1ed760] rounded-full animate-spotify-eq-1" />
                      <span className="w-[2.5px] bg-[#1ed760] rounded-full animate-spotify-eq-2" />
                      <span className="w-[2.5px] bg-[#1ed760] rounded-full animate-spotify-eq-3" />
                    </div>
                  )}

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

        {/* Your Own Personal DJ Banner Card (Photo 3) */}
        {activeTab === 'todo' && (
          <section className="space-y-3 pt-2">
            <h2 className="text-2xl font-black text-white font-['SpotifyMixUITitle']">
              Your own personal DJ
            </h2>
            <div
              onClick={() => onSelectPlaylistById('spotify-dj')}
              className="relative w-full rounded-2xl p-5 md:p-6 overflow-hidden cursor-pointer shadow-xl hover:shadow-2xl transition-all duration-300 group active:scale-[0.99] flex flex-col justify-between min-h-[145px] md:min-h-[155px]"
              style={{
                backgroundColor: djThemeColor || '#0a52cc',
                backgroundImage: `linear-gradient(135deg, ${djThemeColor || '#0a52cc'} 0%, #062b70 100%)`,
                boxShadow: `0 12px 36px ${djThemeColor || '#0a52cc'}44`,
                transition: 'background-color 0.8s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.8s ease',
              }}
            >
              {/* Background Glow */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30 pointer-events-none z-0" />

              {/* Audio Waves covering the ENTIRE widget background with clear visibility */}
              <div className="absolute inset-0 pointer-events-none opacity-80 overflow-hidden z-0">
                <InteractiveMusicWaves
                  isPlaying={isPlaying}
                  isSpeaking={false}
                  voiceLevel={0.25}
                  themeColor={djThemeColor || '#1ed760'}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Top Bar: Beta Badge on left, Three Dots Menu on right (matching Spotify Photo 6) */}
              <div className="flex items-center justify-between relative z-20 w-full mb-1">
                <span className="bg-black/40 backdrop-blur-md text-[11px] font-bold text-white px-2.5 py-0.5 rounded-full border border-white/10 uppercase tracking-wider">
                  Beta
                </span>
                <div className="text-white/80 p-1 hover:text-white transition-colors cursor-pointer">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="5" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="12" cy="19" r="2" />
                  </svg>
                </div>
              </div>

              {/* DJ Visualizer: Centered in the card, with smooth bottom half transparency fade */}
              <div
                className="absolute left-1/2 -translate-x-1/2 -top-4 pointer-events-none flex items-center justify-center w-[220px] h-[220px] md:w-[250px] md:h-[250px] z-10"
                style={{
                  WebkitMaskImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 1) 40%, rgba(0, 0, 0, 0) 80%, rgba(0, 0, 0, 0) 100%)',
                  maskImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 1) 40%, rgba(0, 0, 0, 0) 80%, rgba(0, 0, 0, 0) 100%)',
                }}
              >
                <div className="w-full h-full flex items-center justify-center animate-spin-slow opacity-95 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700">
                  <SpotifyDJVisualizer
                    size={220}
                    state={isPlaying ? 'playing' : 'idle'}
                    voiceLevel={isPlaying ? 0.25 : 0.12}
                    themeColor={djThemeColor}
                  />
                </div>
              </div>

              {/* Bottom Row: Text on left, White circular Arrow Button on right */}
              <div className="flex items-end justify-between relative z-20 w-full">
                <div className="flex-1 min-w-0 pr-4 max-w-[calc(100%-190px)]">
                  <RotatingDJBannerText className="text-xl md:text-2xl font-black text-white font-['SpotifyMixUITitle'] leading-snug min-h-[48px] break-words whitespace-normal tracking-tight" />
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPlaylistById('spotify-dj');
                  }}
                  className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl group-hover:scale-105 active:scale-95 transition-all shrink-0 ml-3 cursor-pointer z-20"
                  title="Abrir DJ"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Dynamic Section Shelves for Current Active Tab */}
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
