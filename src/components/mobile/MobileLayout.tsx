import React, { useState, useMemo } from 'react';
import { useSpotifyDataStore, buildDynamicShelves } from '../../store/useSpotifyDataStore';
import { useUIStore } from '../../store/useUIStore';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileMiniPlayer } from './MobileMiniPlayer';
import { MobileNowPlayingModal } from './MobileNowPlayingModal';
import { MobileHeader } from './MobileHeader';
import { MobilePlaylistView } from './MobilePlaylistView';
import { MobileSearchView } from './MobileSearchView';
import { DesktopProfileView } from '../desktop/DesktopProfileView';
import { LoginModal } from '../desktop/LoginModal';
import type { Playlist } from '../../types/spotify';
import { resolveVibrantColor } from '../../utils/spotifyColor';

const DEFAULT_MOBILE_SHORTCUTS = [
  { id: 'liked-songs', name: 'Canciones que te gustan', image: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg', color: '#5018F0' },
  { id: '43GWp9FbN9nHihudedyVQM', name: 'Romeo Santos & Prince Royce', image: 'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000da84566f06a12b9d3161476b79c3', color: '#C45028' },
  { id: 'radio-prince-royce', name: 'Prince Royce Radio', image: 'https://seeded-session-images.scdn.co/v2/img/540/r/artist/3qvxsgvg4egzfuad38wocm/es', color: '#EAB308' },
  { id: 'spidey', name: 'Spidey y su superequipo', image: 'https://i.scdn.co/image/ab67616d00001e028b18861dfeb1c944111306bc', color: '#D11B24' },
  { id: '7b3MrCWtettvBKlfBSdorn', name: 'J+L(2026)', image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c804d43e5cc7f6a6d0ac65ffc', color: '#5A483A' },
  { id: '37i9dQZF1DWZdsS73T1ogG', name: 'el nuevo urbano', image: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426', color: '#704838' },
  { id: '4f0YTBqSbvM1iJpuY9r3yQ', name: 'ZIZI', image: 'https://i.scdn.co/image/ab67616d0000b273eb31ebdbca6acd99c23b4d31', color: '#2E4A52' },
  { id: '37i9dQZF1DX2EiUAL7Wdfc', name: 'míticas', image: 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6', color: '#8B3A1A' },
];

export const MobileLayout: React.FC = () => {
  const [mobileTab, setMobileTab] = useState<'home' | 'search' | 'library' | 'playlist' | 'profile'>('home');
  const [homeFilter, setHomeFilter] = useState<'todo' | 'musica'>('todo');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const [lastVibrantColor, setLastVibrantColor] = useState('#452a6d');

  const { user, playlists, dynamicShelves, quickAccessCards, featuredMessage } = useSpotifyDataStore();
  const { openLoginModal } = useUIStore();

  // Dynamic greeting based on current hour
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 13) return '¡Buenos días!';
    if (hour >= 13 && hour < 21) return '¡Buenas tardes!';
    return '¡Buenas noches!';
  }, []);

  // 8 Quick Access Shortcuts matching user's active session
  const shortcuts = useMemo(() => {
    if (quickAccessCards && quickAccessCards.length >= 6) {
      return quickAccessCards.slice(0, 8);
    }
    return DEFAULT_MOBILE_SHORTCUTS;
  }, [quickAccessCards]);

  // Comprehensive shelves: user's playlists from current session + recommended feeds
  const shelves = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      cards: Array<{ id: string; title: string; subtitle: string; image: string }>;
    }> = [];

    // 1. User's Playlists from current session ("nuestra sesión")
    const userLists = playlists.filter(
      (p) => !p.id.includes('collection:tracks') && p.type !== 'folder'
    );
    if (userLists.length > 0) {
      list.push({
        id: 'shelf-tus-playlists',
        title: 'Tus playlists',
        cards: userLists.map((p) => ({
          id: p.id,
          title: p.name,
          subtitle: p.description || `De ${p.owner?.display_name || user?.display_name || 'ti'}`,
          image: p.images?.[0]?.url || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg',
        })),
      });
    }

    // 2. Base dynamic shelves (Emisoras recomendadas, Tus mixes más escuchados, etc.)
    const base = dynamicShelves && dynamicShelves.length > 0
      ? dynamicShelves
      : buildDynamicShelves(user, playlists, featuredMessage);

    base
      .filter((s) => !s.title.toLowerCase().includes('pódcast') && !s.title.toLowerCase().includes('audiolibro'))
      .forEach((s) => {
        list.push({
          id: s.id,
          title: s.title,
          cards: s.cards.map((c) => ({
            id: c.id,
            title: c.title,
            subtitle: c.subtitle,
            image: c.image,
          })),
        });
      });

    if (homeFilter === 'musica') {
      return list.filter((s) => !s.title.toLowerCase().includes('noticias'));
    }

    return list;
  }, [playlists, dynamicShelves, user, featuredMessage, homeFilter]);

  const handleSelectPlaylistById = (id: string, customName?: string, customImage?: string) => {
    const cleanId = id.replace(/^spotify:(playlist|album):/, '').split('?')[0];
    const color = resolveVibrantColor(cleanId, customName || cleanId);
    setLastVibrantColor(color);

    const cached = useSpotifyDataStore.getState().playlistDetailsCache[cleanId];
    if (cached) {
      setSelectedPlaylist(cached);
      setMobileTab('playlist');
      return;
    }

    const found = playlists.find((p) => p.id === cleanId || p.id === id);
    if (found) {
      setSelectedPlaylist(found);
      setMobileTab('playlist');
      return;
    }

    const placeholder: Playlist = {
      id: cleanId,
      name: customName || (cleanId === 'liked-songs' ? 'Canciones que te gustan' : 'Playlist'),
      description: '',
      type: cleanId.startsWith('art-') ? 'artist' : cleanId.startsWith('alb-') ? 'album' : 'playlist',
      images: customImage ? [{ url: customImage }] : [],
      owner: { display_name: 'Spotify', id: 'spotify' },
      tracks: { total: 0, items: [] },
    } as any;

    setSelectedPlaylist(placeholder);
    setMobileTab('playlist');
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#121212] text-white overflow-hidden font-['SpotifyMixUI'] select-none relative">
      {/* Scrollable Center Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-32">
        {/* TAB 1: HOME */}
        {mobileTab === 'home' && (
          <div
            className="min-h-full transition-colors duration-500"
            style={{
              background: `linear-gradient(180deg, ${lastVibrantColor}cc 0%, rgba(18, 18, 18, 0.98) 320px, #121212 100%)`,
            }}
          >
            <MobileHeader
              activeTab={homeFilter}
              onTabChange={setHomeFilter}
              onOpenProfile={() => setMobileTab('profile')}
            />

            {/* Greeting Header matching Spotify Mobile */}
            <h1 className="text-2xl font-black text-white font-['SpotifyMixUITitle'] px-4 pt-1 pb-3">
              {greeting}
            </h1>

            {/* Quick Access 2-Column Grid matching Spotify Mobile 01_mobile_home.png */}
            <div className="px-4 mb-6">
              <div className="grid grid-cols-2 gap-2">
                {shortcuts.map((card) => (
                  <div
                    key={card.id}
                    onClick={() => handleSelectPlaylistById(card.id, card.name, card.image)}
                    className="h-14 bg-white/[0.08] hover:bg-white/[0.14] active:bg-white/[0.22] rounded-[4px] overflow-hidden flex items-center gap-2.5 cursor-pointer shadow-sm active:scale-98 transition-all"
                  >
                    <img
                      src={card.image}
                      alt={card.name}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 object-cover shrink-0"
                    />
                    <span className="font-bold text-white text-xs leading-snug line-clamp-2 pr-2.5">
                      {card.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Shelves Horizontal Carousels */}
            <div className="space-y-7 px-4">
              {shelves.map((shelf) => (
                <div key={shelf.id} className="space-y-3">
                  <h3 className="text-xl font-black text-white font-['SpotifyMixUITitle'] tracking-tight">
                    {shelf.title}
                  </h3>
                  <div className="flex gap-3.5 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
                    {shelf.cards.map((card) => (
                      <div
                        key={card.id}
                        onClick={() => handleSelectPlaylistById(card.id, card.title, card.image)}
                        className="w-[140px] shrink-0 flex flex-col cursor-pointer active:scale-96 transition-transform"
                      >
                        <div className="w-[140px] h-[140px] rounded-md overflow-hidden bg-[#242424] shadow-lg mb-2 relative">
                          <img
                            src={card.image}
                            alt={card.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="font-bold text-white text-xs truncate">
                          {card.title}
                        </span>
                        <span className="text-[11px] text-[#b3b3b3] line-clamp-2 leading-tight mt-0.5">
                          {card.subtitle}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: SEARCH */}
        {mobileTab === 'search' && (
          <div className="p-4 space-y-4">
            <MobileSearchView onSelectPlaylistById={handleSelectPlaylistById} />
          </div>
        )}

        {/* TAB 3: LIBRARY */}
        {mobileTab === 'library' && (
          <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileTab('profile')}
                  className="w-8 h-8 rounded-full bg-[#242424] overflow-hidden flex items-center justify-center font-bold text-xs"
                >
                  {(user?.display_name || 'J').charAt(0).toUpperCase()}
                </button>
                <h1 className="text-2xl font-black text-white font-['SpotifyMixUITitle']">
                  Tu biblioteca
                </h1>
              </div>
              <button
                onClick={openLoginModal}
                className="text-xs bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-1.5 rounded-full"
              >
                + Añadir cuenta
              </button>
            </div>

            {/* Filter Chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {['Playlists', 'Artistas', 'Álbumes', 'Descargado'].map((chip, idx) => (
                <button
                  key={chip}
                  className={`h-8 px-4 rounded-full text-xs font-bold shrink-0 transition-colors ${
                    idx === 0
                      ? 'bg-white/20 text-white'
                      : 'bg-white/10 text-white hover:bg-white/15'
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Library Items List */}
            <div className="space-y-1.5 pt-2">
              {/* Liked songs item */}
              <div
                onClick={() =>
                  handleSelectPlaylistById(
                    'liked-songs',
                    'Canciones que te gustan',
                    'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'
                  )
                }
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 active:bg-white/15 cursor-pointer transition-colors"
              >
                <img
                  src="https://misc.scdn.co/liked-songs/liked-songs-640.jpg"
                  alt="Canciones que te gustan"
                  className="w-16 h-16 rounded-[4px] object-cover shadow shrink-0"
                />
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-white text-sm truncate">
                    Canciones que te gustan
                  </span>
                  <span className="text-xs text-[#b3b3b3] mt-0.5">
                    Playlist • 23 canciones
                  </span>
                </div>
              </div>

              {/* All user playlists from current session */}
              {playlists
                .filter((p) => !p.id.includes('collection:tracks') && p.id !== 'liked-songs')
                .map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() =>
                      handleSelectPlaylistById(pl.id, pl.name, pl.images?.[0]?.url)
                    }
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 active:bg-white/15 cursor-pointer transition-colors"
                  >
                    <img
                      src={pl.images?.[0]?.url || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'}
                      alt={pl.name}
                      className="w-16 h-16 rounded-[4px] object-cover bg-[#242424] shadow shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-white text-sm truncate">
                        {pl.name}
                      </span>
                      <span className="text-xs text-[#b3b3b3] mt-0.5 truncate">
                        Playlist • {pl.owner?.display_name || user?.display_name || 'Spotify'}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* TAB 4: PLAYLIST VIEW */}
        {mobileTab === 'playlist' && selectedPlaylist && (
          <MobilePlaylistView
            playlist={selectedPlaylist}
            onBack={() => setMobileTab('home')}
            onSelectPlaylistById={handleSelectPlaylistById}
          />
        )}

        {/* TAB 5: PROFILE VIEW */}
        {mobileTab === 'profile' && (
          <div className="p-4">
            <button
              onClick={() => setMobileTab('home')}
              className="mb-4 text-xs font-bold text-white bg-white/10 px-3 py-1.5 rounded-full flex items-center gap-1.5"
            >
              ← Volver
            </button>
            <DesktopProfileView />
          </div>
        )}
      </div>

      {/* Docked Mini Player right above Bottom Navigation */}
      <MobileMiniPlayer onOpenFullPlayer={() => setIsFullPlayerOpen(true)} />

      {/* Full-screen Now Playing Modal */}
      {isFullPlayerOpen && (
        <MobileNowPlayingModal
          isOpen={isFullPlayerOpen}
          onClose={() => setIsFullPlayerOpen(false)}
        />
      )}

      {/* Exact Spotify Mobile 3-Tab Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={
          mobileTab === 'search'
            ? 'search'
            : mobileTab === 'library'
            ? 'library'
            : 'home'
        }
        onTabChange={(tab) => {
          setSelectedPlaylist(null);
          setMobileTab(tab);
        }}
      />

      {/* Global Login / Cookie modal */}
      <LoginModal />
    </div>
  );
};
