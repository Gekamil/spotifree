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
import { DesktopSettingsView } from '../desktop/DesktopSettingsView';
import { LoginModal } from '../desktop/LoginModal';
import type { Playlist } from '../../types/spotify';
import { resolveVibrantColor } from '../../utils/spotifyColor';
import { handleImageError } from '../../utils/imageFallback';

export const MobileLayout: React.FC = () => {
  const [mobileTab, setMobileTab] = useState<'home' | 'search' | 'library' | 'playlist' | 'profile' | 'settings'>('home');
  const [homeFilter, setHomeFilter] = useState<'todo' | 'musica'>('todo');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const [lastVibrantColor, setLastVibrantColor] = useState('#452a6d');

  const { isAuthenticated, user, playlists, dynamicShelves, quickAccessCards, featuredMessage } = useSpotifyDataStore();
  const { openLoginModal } = useUIStore();

  // Dynamic greeting based on current hour
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 13) return '¡Buenos días!';
    if (hour >= 13 && hour < 21) return '¡Buenas tardes!';
    return '¡Buenas noches!';
  }, []);

  // Quick Access Shortcuts matching user's active session
  const shortcuts = useMemo(() => {
    if (!isAuthenticated) return [];
    if (quickAccessCards && quickAccessCards.length >= 6) {
      return quickAccessCards.slice(0, 8);
    }
    return [];
  }, [quickAccessCards, isAuthenticated]);

  // Comprehensive shelves: user's playlists from current session + recommended feeds
  const shelves = useMemo(() => {
    if (!isAuthenticated) return [];
    const list: Array<{
      id: string;
      title: string;
      prefix?: string;
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
          prefix: s.prefix,
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
              onOpenSettings={() => setMobileTab('settings')}
            />

            {!isAuthenticated ? (
              <div className="px-6 py-16 text-center flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-300">
                <div className="w-16 h-16 rounded-full bg-[#1ed760] text-black flex items-center justify-center shadow-xl mb-2">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.477 2 12c0 5.524 4.477 10 10 10s10-4.476 10-10c0-5.523-4.477-10-10-10zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.435-5.308-1.76-8.793-.963-.335.077-.67-.133-.746-.468-.077-.334.132-.67.467-.746 3.808-.87 7.076-.496 9.722 1.115.294.18.386.563.207.855zm1.226-2.72c-.226.367-.706.482-1.072.257-2.687-1.652-6.785-2.131-9.965-1.166-.413.127-.848-.106-.973-.518-.125-.413.108-.848.52-.973 3.632-1.102 8.147-.568 11.233 1.328.366.226.481.707.257 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71c-.494.15-1.018-.13-1.168-.624-.15-.494.13-1.018.624-1.168 3.532-1.073 9.404-.866 13.115 1.337.445.264.59.838.327 1.282-.264.443-.838.59-1.28.327z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-black text-white font-['SpotifyMixUITitle']">
                  Música para todos
                </h2>
                <p className="text-xs text-[#b3b3b3] leading-relaxed max-w-xs">
                  Inicia sesión con tu cuenta de Spotify para acceder a tu biblioteca, tus playlists y tus recomendaciones personalizadas.
                </p>
                <button
                  onClick={openLoginModal}
                  className="px-8 py-3.5 rounded-full bg-[#1ed760] text-black font-bold text-xs uppercase tracking-wider active:scale-95 shadow-xl mt-2 cursor-pointer"
                >
                  Conectar cuenta
                </button>
              </div>
            ) : (
              <>
                {/* Greeting Header matching Spotify Mobile */}
                <h1 className="text-2xl font-black text-white font-['SpotifyMixUITitle'] px-4 pt-1 pb-3">
                  {greeting}
                </h1>

                {/* Quick Access 2-Column Grid matching Spotify Mobile 01_mobile_home.png */}
                {shortcuts && shortcuts.length > 0 && (
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
                            onError={handleImageError}
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
                )}

                {/* Shelves Horizontal Carousels */}
                <div className="space-y-7 px-4">
                  {shelves.map((shelf) => (
                    <div key={shelf.id} className="space-y-3">
                      <div>
                        {shelf.prefix && (
                          <span className="text-[11px] font-bold text-[#b3b3b3] uppercase tracking-wider block mb-0.5">
                            {shelf.prefix}
                          </span>
                        )}
                        <h3 className="text-xl font-black text-white font-['SpotifyMixUITitle'] tracking-tight">
                          {shelf.title}
                        </h3>
                      </div>
                      <div className="flex gap-3.5 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
                        {shelf.cards.map((card) => (
                          <div
                            key={card.id}
                            onClick={() => handleSelectPlaylistById(card.id, card.title, card.image)}
                            className="w-36 shrink-0 space-y-2 cursor-pointer active:scale-95 transition-transform"
                          >
                            <div className="w-36 h-36 rounded-md overflow-hidden bg-[#242424] shadow-md relative">
                              <img
                                src={card.image}
                                alt={card.title}
                                onError={handleImageError}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="space-y-0.5">
                              <h4 className="font-bold text-white text-xs line-clamp-1">
                                {card.title}
                              </h4>
                              <p className="text-[11px] text-[#b3b3b3] line-clamp-2 leading-tight">
                                {card.subtitle}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
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
                  onClick={isAuthenticated ? () => setMobileTab('profile') : openLoginModal}
                  className="w-8 h-8 rounded-full bg-[#242424] overflow-hidden flex items-center justify-center text-[#b3b3b3] hover:text-white"
                >
                  {isAuthenticated ? (
                    <span className="font-bold text-xs text-white">
                      {(user?.display_name || 'U').charAt(0).toUpperCase()}
                    </span>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4zm-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10c-2.29 0-3.516.68-4.168 1.332-.678.678-.83 1.418-.832 1.664h10z" />
                    </svg>
                  )}
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
            {!isAuthenticated ? (
              <div className="py-14 text-center flex flex-col items-center justify-center space-y-3">
                <p className="text-sm font-bold text-white">Disfruta de Tu biblioteca</p>
                <p className="text-xs text-[#b3b3b3] max-w-xs">
                  Inicia sesión para ver tus canciones que te gustan, artistas y playlists guardadas.
                </p>
                <button
                  onClick={openLoginModal}
                  className="px-6 py-2.5 rounded-full bg-white text-black font-bold text-xs uppercase tracking-wider active:scale-95 shadow mt-2 cursor-pointer"
                >
                  Iniciar sesión
                </button>
              </div>
            ) : (
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
                    onError={handleImageError}
                    className="w-16 h-16 rounded-[4px] object-cover shadow shrink-0"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-white text-sm truncate">
                      Canciones que te gustan
                    </span>
                    <span className="text-xs text-[#b3b3b3] mt-0.5">
                      Playlist
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
                        onError={handleImageError}
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
            )}
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

        {/* TAB 6: SETTINGS VIEW */}
        {mobileTab === 'settings' && (
          <div className="p-4">
            <button
              onClick={() => setMobileTab('home')}
              className="mb-4 text-xs font-bold text-white bg-white/10 px-3 py-1.5 rounded-full flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              ← Volver al inicio
            </button>
            <DesktopSettingsView />
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
