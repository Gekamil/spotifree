import React, { useState, useMemo } from 'react';
import { useSpotifyDataStore, buildDynamicShelves } from '../../store/useSpotifyDataStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useUIStore } from '../../store/useUIStore';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileMiniPlayer } from './MobileMiniPlayer';
import { MobileNowPlayingModal } from './MobileNowPlayingModal';
import { MobileHeader } from './MobileHeader';
import { MobilePlaylistView } from './MobilePlaylistView';
import { MobileSearchView } from './MobileSearchView';
import { MobileCreateSheet } from './MobileCreateSheet';
import { MobileProfileView } from './MobileProfileView';
import { MobileSettingsView } from './MobileSettingsView';
import { MobileAddLibraryItemsModal, type LibraryCandidateItem } from './MobileAddLibraryItemsModal';
import { MessagesNotificationsModal } from '../modals/MessagesNotificationsModal';
import { LoginModal } from '../desktop/LoginModal';
import type { Playlist } from '../../types/spotify';
import { resolveVibrantColor, extractDominantColorFromImage } from '../../utils/spotifyColor';
import { isPlaylistDownloaded, getDownloadedPlaylists } from '../../utils/offlineStorage';
import { handleImageError } from '../../utils/imageFallback';

export const MobileLayout: React.FC = () => {
  const [mobileTab, setMobileTab] = useState<'home' | 'search' | 'library' | 'playlist' | 'profile' | 'settings'>('home');
  const [homeFilter, setHomeFilter] = useState<'todo' | 'musica'>('todo');
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'playlists' | 'artists' | 'albums' | 'downloaded'>('all');
  const [isLibrarySearching, setIsLibrarySearching] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAddLibraryModalOpen, setIsAddLibraryModalOpen] = useState(false);
  const [lastVibrantColor, setLastVibrantColor] = useState('#452a6d');

  const { currentTrack, isPlaying, currentContextId, likedTrackIds, isCarMode, setCarMode } = usePlayerStore();

  const isCardPlaying = (cardId: string, cardName: string) => {
    if (!isPlaying) return false;
    if (currentContextId && (currentContextId === cardId || currentContextId.includes(cardId) || cardId.includes(currentContextId))) return true;
    if (cardId === 'liked-songs' && currentTrack && likedTrackIds.includes(currentTrack.id)) return true;
    if (currentTrack) {
      if (currentTrack.album?.id === cardId) return true;
      if (currentTrack.album?.name && cardName && currentTrack.album.name.toLowerCase() === cardName.toLowerCase()) return true;
      if ((currentTrack as any).playlistId === cardId) return true;
    }
    return false;
  };

  const checkIsMobileArtist = (p: any): boolean => {
    if (p.id === 'liked-songs' || p.id.includes('collection:tracks') || p.type === 'playlist' || p.type === 'album') {
      return false;
    }
    return (
      p.type === 'artist' ||
      p.is_artist === true ||
      p.description?.toLowerCase()?.trim() === 'artista' ||
      p.id === '3x7gz85amxEplGx7LQxE7Z' ||
      p.id === '5lwmRuXgjX8xIwlnauTZIP' ||
      p.id.startsWith('art-') ||
      p.id.startsWith('artist-')
    );
  };

  const { isAuthenticated, user, playlists, dynamicShelves, quickAccessCards, featuredMessage } = useSpotifyDataStore();
  const { openLoginModal } = useUIStore();

  const handleCreatePlaylist = (name: string) => {
    const newId = `user-playlist-${Date.now()}`;
    const newPlaylist: Playlist = {
      id: newId,
      name,
      description: `Creada por ${user?.display_name || 'ti'}`,
      type: 'playlist',
      images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
      owner: { display_name: user?.display_name || 'Tú', id: user?.id || 'me' },
      tracks: { total: 0, items: [] },
    } as any;

    const currentLists = useSpotifyDataStore.getState().playlists;
    const updated = [newPlaylist, ...currentLists];
    useSpotifyDataStore.setState({ playlists: updated });
    useSpotifyDataStore.getState().cachePlaylistDetails(newPlaylist);

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('user_imported_playlists', JSON.stringify(updated));
      } catch {}
    }

    setSelectedPlaylist(newPlaylist);
    setMobileTab('playlist');
  };

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

    if (customImage) {
      extractDominantColorFromImage(customImage).then((hex) => {
        if (hex) setLastVibrantColor(hex);
      });
    }

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

  const handleAddLibraryItems = (items: LibraryCandidateItem[]) => {
    const currentPlaylists = useSpotifyDataStore.getState().playlists;
    let savedList: string[] = [];
    try {
      const raw = window.localStorage.getItem('spotifree_saved_library_playlists');
      if (raw) savedList = JSON.parse(raw);
    } catch {}

    items.forEach((item) => {
      if (!savedList.includes(item.id)) {
        savedList.push(item.id);
      }
      if (!currentPlaylists.some((p) => p.id === item.id)) {
        const isArt = item.type === 'artist';
        const newPl: Playlist = {
          id: item.id,
          name: item.name,
          description: isArt ? 'Artista oficial' : 'Playlist añadida a tu biblioteca',
          images: [{ url: item.image, height: 300, width: 300 }],
          owner: {
            id: isArt ? item.id : 'spotify',
            display_name: isArt ? 'Artista' : 'Spotify',
          },
          tracks: { href: '', total: 20, items: [] },
          type: (isArt ? 'artist' : 'playlist') as any,
          uri: `spotify:${isArt ? 'artist' : 'playlist'}:${item.id}`,
        } as any;
        useSpotifyDataStore.getState().addCustomPlaylist(newPl);
      }
    });

    try {
      window.localStorage.setItem('spotifree_saved_library_playlists', JSON.stringify(savedList));
    } catch {}
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#121212] text-white overflow-hidden font-['SpotifyMixUI'] select-none relative">
      {/* Scrollable Center Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-32">
        {/* TAB 1: HOME */}
        {mobileTab === 'home' && (
          <div
            className="min-h-full transition-colors duration-500 animate-cascade-down"
            style={{
              background: `linear-gradient(180deg, ${lastVibrantColor}cc 0%, rgba(18, 18, 18, 0.98) 320px, #121212 100%)`,
            }}
          >
            <MobileHeader
              activeTab={homeFilter}
              onTabChange={setHomeFilter}
              onOpenProfile={() => setMobileTab('profile')}
              onOpenSettings={() => setMobileTab('settings')}
              onOpenNotifications={() => setIsNotificationsOpen(true)}
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
                      {shortcuts.map((card) => {
                        const isPlayingThis = isCardPlaying(card.id, card.name);
                        return (
                          <div
                            key={card.id}
                            onClick={() => handleSelectPlaylistById(card.id, card.name, card.image)}
                            className="h-14 bg-white/[0.08] hover:bg-white/[0.14] active:bg-white/[0.22] rounded-[4px] overflow-hidden flex items-center justify-between cursor-pointer shadow-sm active:scale-98 transition-all pr-2.5"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-1">
                              <img
                                src={card.image}
                                alt={card.name}
                                onError={handleImageError}
                                referrerPolicy="no-referrer"
                                className="w-14 h-14 object-cover shrink-0"
                              />
                              <span
                                className={`font-bold text-xs leading-snug line-clamp-2 ${
                                  isPlayingThis ? 'text-[#1ed760]' : 'text-white'
                                }`}
                              >
                                {card.name}
                              </span>
                            </div>

                            {isPlayingThis && (
                              <div className="flex items-end gap-[2px] h-3.5 px-1 shrink-0" title="Reproduciendo">
                                <span className="w-[2.5px] bg-[#1ed760] rounded-full animate-spotify-eq-1" />
                                <span className="w-[2.5px] bg-[#1ed760] rounded-full animate-spotify-eq-2" />
                                <span className="w-[2.5px] bg-[#1ed760] rounded-full animate-spotify-eq-3" />
                              </div>
                            )}
                          </div>
                        );
                      })}
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
          <div className="p-4 space-y-4 animate-cascade-down">
            <MobileSearchView onSelectPlaylistById={handleSelectPlaylistById} />
          </div>
        )}

        {/* TAB 3: LIBRARY */}
        {mobileTab === 'library' && (
          <div className="p-4 space-y-4 animate-cascade-down">
            {/* Header */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-3">
                <button
                  onClick={isAuthenticated ? () => setMobileTab('profile') : openLoginModal}
                  className="w-8 h-8 rounded-full bg-[#242424] overflow-hidden flex items-center justify-center text-[#b3b3b3] hover:text-white cursor-pointer active:scale-95 transition-transform"
                >
                  {user?.images?.[0]?.url ? (
                    <img src={user.images[0].url} alt={user.display_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-xs text-white">
                      {(user?.display_name || 'J').charAt(0).toUpperCase()}
                    </span>
                  )}
                </button>
                <h1 className="text-2xl font-black text-white font-['SpotifyMixUITitle']">
                  Tu biblioteca
                </h1>
              </div>

              {/* Real Spotify Mobile Library Header Controls: Search Lupa + Create Button */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsLibrarySearching(!isLibrarySearching)}
                  className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
                    isLibrarySearching ? 'text-[#1ed760] bg-white/10' : 'text-white/80 hover:text-white'
                  }`}
                  title="Buscar en tu biblioteca"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10.533 1.27893C5.35215 1.27893 1.12598 5.41887 1.12598 10.5579C1.12598 15.697 5.35215 19.8369 10.533 19.8369C12.767 19.8369 14.8235 19.0671 16.4402 17.7794L20.7929 22.132C21.1834 22.5226 21.8166 22.5226 22.2071 22.132C22.5976 21.7415 22.5976 21.1083 22.2071 20.7178L17.8634 16.3741C19.1616 14.7849 19.94 12.7634 19.94 10.5579C19.94 5.41887 15.7138 1.27893 10.533 1.27893ZM3.12598 10.5579C3.12598 6.55226 6.42768 3.27893 10.533 3.27893C14.6383 3.27893 17.94 6.55226 17.94 10.5579C17.94 14.5636 14.6383 17.8369 10.533 17.8369C6.42768 17.8369 3.12598 14.5636 3.12598 10.5579Z" />
                  </svg>
                </button>

                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="w-9 h-9 flex items-center justify-center rounded-full text-white/80 hover:text-white cursor-pointer active:scale-90 transition-transform"
                  title="Crear"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11 4.5a1 1 0 0 1 2 0v6.5H19.5a1 1 0 0 1 0 2H13V19.5a1 1 0 0 1-2 0V13H4.5a1 1 0 0 1 0-2H11V4.5z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* In-library search bar when toggled */}
            {isLibrarySearching && (
              <div className="relative w-full pt-1">
                <input
                  type="text"
                  autoFocus
                  value={librarySearchQuery}
                  onChange={(e) => setLibrarySearchQuery(e.target.value)}
                  placeholder="Buscar en tu biblioteca..."
                  className="w-full h-9 pl-9 pr-8 bg-[#242424] text-white text-xs rounded-full outline-none placeholder:text-[#a7a7a7] border border-white/10 focus:border-white/30"
                />
                <div className="absolute left-3 top-3.5 text-[#b3b3b3]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10.533 1.27893C5.35215 1.27893 1.12598 5.41887 1.12598 10.5579C1.12598 15.697 5.35215 19.8369 10.533 19.8369C12.767 19.8369 14.8235 19.0671 16.4402 17.7794L20.7929 22.132C21.1834 22.5226 21.8166 22.5226 22.2071 22.132C22.5976 21.7415 22.5976 21.1083 22.2071 20.7178L17.8634 16.3741C19.1616 14.7849 19.94 12.7634 19.94 10.5579C19.94 5.41887 15.7138 1.27893 10.533 1.27893ZM3.12598 10.5579C3.12598 6.55226 6.42768 3.27893 10.533 3.27893C14.6383 3.27893 17.94 6.55226 17.94 10.5579C17.94 14.5636 14.6383 17.8369 10.533 17.8369C6.42768 17.8369 3.12598 14.5636 3.12598 10.5579Z" />
                  </svg>
                </div>
                {librarySearchQuery && (
                  <button
                    onClick={() => setLibrarySearchQuery('')}
                    className="absolute right-3 top-2.5 text-[#b3b3b3] hover:text-white text-xs p-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Filter Chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'playlists', label: 'Playlists' },
                { id: 'artists', label: 'Artistas' },
                { id: 'albums', label: 'Álbumes' },
                { id: 'downloaded', label: 'Descargado' },
              ].map((chip) => {
                const isSelected = libraryFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    onClick={() => setLibraryFilter(isSelected ? 'all' : (chip.id as any))}
                    className={`h-8 px-4 rounded-full text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#1ed760] text-black font-black'
                        : 'bg-white/10 text-white hover:bg-white/15'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
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
                {(libraryFilter === 'all' || libraryFilter === 'playlists' || (libraryFilter === 'downloaded' && isPlaylistDownloaded('liked-songs'))) && (
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
                        Playlist • {playlists.find((p) => p.id === 'liked-songs')?.tracks?.total || 0} canciones
                      </span>
                    </div>
                  </div>
                )}

                {/* All user playlists and artists strictly filtered */}
                {(() => {
                  let list = playlists;
                  if (libraryFilter === 'downloaded') {
                    const downloaded = getDownloadedPlaylists();
                    const existingIds = new Set(list.map((p) => p.id));
                    const extra = downloaded.filter((d) => !existingIds.has(d.id));
                    list = [...list, ...extra];
                  }
                  return list
                    .filter((p) => !p.id.includes('collection:tracks') && p.id !== 'liked-songs')
                    .filter((p) => {
                      if (librarySearchQuery && !p.name.toLowerCase().includes(librarySearchQuery.toLowerCase())) {
                        return false;
                      }
                      const isArt = checkIsMobileArtist(p);
                      if (libraryFilter === 'artists') return isArt;
                      if (libraryFilter === 'playlists') return !isArt;
                      if (libraryFilter === 'downloaded') return isPlaylistDownloaded(p.id);
                      return true;
                    });
                })()
                  .map((pl) => {
                    const isArt = checkIsMobileArtist(pl);
                    return (
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
                          className={`w-16 h-16 object-cover bg-[#242424] shadow shrink-0 ${
                            isArt ? 'rounded-full' : 'rounded-[4px]'
                          }`}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-white text-sm truncate">
                            {pl.name}
                          </span>
                          <span className="text-xs text-[#b3b3b3] mt-0.5 truncate">
                            {isArt ? 'Artista' : `Playlist • ${pl.owner?.display_name || user?.display_name || 'Spotify'}`}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                {/* Spotify Native "Añadir a tu biblioteca" Row */}
                <div
                  onClick={() => setIsAddLibraryModalOpen(true)}
                  className="mt-3 p-2.5 rounded-xl flex items-center gap-3.5 hover:bg-white/5 active:bg-white/10 cursor-pointer transition-all active:scale-[0.99] group bg-white/[0.02]"
                >
                  <div className="w-14 h-14 rounded-full bg-[#242424] group-hover:bg-[#2e2e2e] flex items-center justify-center text-white/80 group-hover:text-white transition-colors shrink-0 shadow-sm border border-white/5">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11 4.5a1 1 0 0 1 2 0v6.5H19.5a1 1 0 0 1 0 2H13V19.5a1 1 0 0 1-2 0V13H4.5a1 1 0 0 1 0-2H11V4.5z" />
                    </svg>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-white text-sm font-['SpotifyMixUITitle'] truncate">
                      Añadir artistas o playlists
                    </span>
                    <span className="text-xs text-[#b3b3b3] truncate mt-0.5">
                      Busca y añade música a tu biblioteca
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PLAYLIST VIEW */}
        {mobileTab === 'playlist' && selectedPlaylist && (
          <div className="animate-cascade-down min-h-full">
            <MobilePlaylistView
              key={selectedPlaylist.id}
              playlist={selectedPlaylist}
              onBack={() => setMobileTab('home')}
              onSelectPlaylistById={handleSelectPlaylistById}
            />
          </div>
        )}

        {/* TAB 5: DEDICATED SPOTIFY MOBILE PROFILE VIEW */}
        {mobileTab === 'profile' && (
          <div className="animate-cascade-down min-h-full">
            <MobileProfileView
              onBack={() => setMobileTab('home')}
              onOpenSettings={() => setMobileTab('settings')}
              onSelectPlaylist={(pl) => {
                setSelectedPlaylist(pl);
                setMobileTab('playlist');
              }}
            />
          </div>
        )}

        {/* TAB 6: DEDICATED SPOTIFY MOBILE SETTINGS VIEW */}
        {mobileTab === 'settings' && (
          <div className="animate-cascade-down min-h-full">
            <MobileSettingsView
              onBack={() => setMobileTab('home')}
              onOpenProfile={() => setMobileTab('profile')}
            />
          </div>
        )}
      </div>

      {/* Docked Mini Player right above Bottom Navigation */}
      <MobileMiniPlayer onOpenFullPlayer={() => setIsFullPlayerOpen(true)} />

      {/* Full-screen Now Playing Modal or Car View */}
      {(isFullPlayerOpen || isCarMode) && (
        <MobileNowPlayingModal
          isOpen={isFullPlayerOpen || isCarMode}
          onClose={() => {
            setIsFullPlayerOpen(false);
            setCarMode(false);
          }}
          onSelectPlaylistById={handleSelectPlaylistById}
        />
      )}

      {/* Exact Spotify Mobile 4-Tab Bottom Navigation Bar */}
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
        onOpenCreate={() => setIsCreateOpen((prev) => !prev)}
        isCreateOpen={isCreateOpen}
      />

      {/* Spotify Mobile Add Items to Library Modal */}
      <MobileAddLibraryItemsModal
        isOpen={isAddLibraryModalOpen}
        onClose={() => setIsAddLibraryModalOpen(false)}
        onAddItems={handleAddLibraryItems}
        existingIds={playlists.map((p) => p.id)}
      />

      {/* Spotify Mobile Creation Bottom Sheet */}
      <MobileCreateSheet
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreatePlaylist={handleCreatePlaylist}
        onImportPlaylist={(pl) => {
          useSpotifyDataStore.getState().addCustomPlaylist(pl);
          setSelectedPlaylist(pl);
          setMobileTab('playlist');
        }}
        defaultPlaylistNumber={playlists.length + 1}
      />

      {/* Messages / Notifications Modal */}
      <MessagesNotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
      />

      {/* Global Login / Cookie modal */}
      <LoginModal />
    </div>
  );
};
