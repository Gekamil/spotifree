import React, { useState } from 'react';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { useUIStore } from '../../store/useUIStore';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileMiniPlayer } from './MobileMiniPlayer';
import { MobileNowPlayingModal } from './MobileNowPlayingModal';
import { MobileHeader } from './MobileHeader';
import { DesktopPlaylistView } from '../desktop/DesktopPlaylistView';
import { DesktopSearchView } from '../desktop/DesktopSearchView';
import { DesktopProfileView } from '../desktop/DesktopProfileView';
import { LoginModal } from '../desktop/LoginModal';
import type { Playlist } from '../../types/spotify';

export const MobileLayout: React.FC = () => {
  const [mobileTab, setMobileTab] = useState<'home' | 'search' | 'library' | 'playlist' | 'profile'>('home');
  const [homeFilter, setHomeFilter] = useState<'todo' | 'musica'>('todo');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);

  const { playlists, dynamicShelves, quickAccessCards } = useSpotifyDataStore();
  const { openLoginModal } = useUIStore();

  const shortcuts = quickAccessCards?.length > 0 ? quickAccessCards.slice(0, 6) : [
    { id: 'liked-songs', name: 'Canciones que te gustan', image: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' },
    { id: '7b3MrCWtettvBKlfBSdorn', name: 'J+L(2026)', image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c804d43e5cc7f6a6d0ac65ffc' },
    { id: '37i9dQZF1DWZdsS73T1ogG', name: 'el nuevo urbano', image: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426' },
    { id: '4f0YTBqSbvM1iJpuY9r3yQ', name: 'ZIZI', image: 'https://i.scdn.co/image/ab67616d0000b273eb31ebdbca6acd99c23b4d31' },
    { id: '37i9dQZF1DX2EiUAL7Wdfc', name: 'míticas', image: 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6' },
  ];

  const handleSelectPlaylistById = (id: string, customName?: string, customImage?: string) => {
    const cleanId = id.replace(/^spotify:(playlist|album):/, '').split('?')[0];
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
    <div className="h-screen w-screen flex flex-col bg-black text-white overflow-hidden font-['SpotifyMixUI'] select-none relative">
      {/* Scrollable Center Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-32">
        {/* TAB: HOME */}
        {mobileTab === 'home' && (
          <div className="space-y-6">
            <MobileHeader
              activeTab={homeFilter}
              onTabChange={setHomeFilter}
              onOpenProfile={() => setMobileTab('profile')}
            />

            {/* Quick Access 2-Column Grid (Spotify Mobile screenshot 1) */}
            <div className="px-4">
              <div className="grid grid-cols-2 gap-2">
                {shortcuts.map((card) => (
                  <div
                    key={card.id}
                    onClick={() => handleSelectPlaylistById(card.id, card.name, card.image)}
                    className="h-14 bg-[#282828] hover:bg-[#323232] rounded-md overflow-hidden flex items-center gap-2.5 cursor-pointer shadow-md active:scale-98 transition-all"
                  >
                    <img
                      src={card.image}
                      alt={card.name}
                      className="w-14 h-14 object-cover shrink-0"
                    />
                    <span className="font-bold text-white text-xs leading-tight line-clamp-2 pr-2">
                      {card.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Shelves Horizontal Carousels */}
            <div className="space-y-6 px-4">
              {dynamicShelves.map((shelf) => (
                <div key={shelf.id} className="space-y-3">
                  <h3 className="text-xl font-black text-white font-['SpotifyMixUITitle']">
                    {shelf.title}
                  </h3>
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
                    {shelf.cards.map((card) => (
                      <div
                        key={card.id}
                        onClick={() => handleSelectPlaylistById(card.id, card.title, card.image)}
                        className="w-36 shrink-0 flex flex-col space-y-2 cursor-pointer active:scale-98 transition-transform"
                      >
                        <div className="w-36 h-36 rounded-lg overflow-hidden bg-[#242424] shadow-md relative">
                          <img
                            src={card.image}
                            alt={card.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="font-bold text-white text-xs truncate">
                          {card.title}
                        </span>
                        <span className="text-[11px] text-[#b3b3b3] line-clamp-2 leading-tight">
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

        {/* TAB: SEARCH */}
        {mobileTab === 'search' && (
          <div className="p-4 space-y-4">
            <DesktopSearchView onSelectPlaylistById={handleSelectPlaylistById} />
          </div>
        )}

        {/* TAB: LIBRARY */}
        {mobileTab === 'library' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between pt-2">
              <h1 className="text-2xl font-black text-white font-['SpotifyMixUITitle']">
                Tu biblioteca
              </h1>
              <button
                onClick={openLoginModal}
                className="text-xs bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-1.5 rounded-full"
              >
                + Añadir cuenta
              </button>
            </div>

            <div className="space-y-2 pt-2">
              {/* Liked songs item */}
              <div
                onClick={() => handleSelectPlaylistById('liked-songs', 'Canciones que te gustan', 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg')}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 cursor-pointer active:scale-98 transition-transform"
              >
                <img
                  src="https://misc.scdn.co/liked-songs/liked-songs-640.jpg"
                  alt="Canciones que te gustan"
                  className="w-14 h-14 rounded-md object-cover shadow"
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

              {/* All playlists */}
              {playlists
                .filter((p) => !p.id.includes('collection:tracks') && p.id !== 'liked-songs')
                .map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => {
                      setSelectedPlaylist(pl);
                      setMobileTab('playlist');
                    }}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/10 cursor-pointer active:scale-98 transition-transform"
                  >
                    <img
                      src={pl.images?.[0]?.url || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'}
                      alt={pl.name}
                      className="w-14 h-14 rounded-md object-cover shadow"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-white text-sm truncate">
                        {pl.name}
                      </span>
                      <span className="text-xs text-[#b3b3b3] mt-0.5">
                        Playlist • {pl.owner?.display_name || 'Spotify'}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* TAB: PLAYLIST / ALBUM VIEW */}
        {mobileTab === 'playlist' && selectedPlaylist && (
          <div className="relative">
            {/* Back button */}
            <div className="sticky top-0 z-40 bg-black/60 backdrop-blur-md px-4 py-3 flex items-center gap-3">
              <button
                onClick={() => setMobileTab('home')}
                className="w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                title="Atrás"
              >
                <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11.03.47a.75.75 0 0 1 0 1.06L4.81 7.75l6.22 6.22a.75.75 0 1 1-1.06 1.06l-6.75-6.75a.75.75 0 0 1 1.06 0z" />
                </svg>
              </button>
              <span className="font-bold text-sm text-white truncate">
                {selectedPlaylist.name}
              </span>
            </div>

            <DesktopPlaylistView
              playlist={selectedPlaylist}
              onSelectPlaylistById={handleSelectPlaylistById}
            />
          </div>
        )}

        {/* TAB: PROFILE */}
        {mobileTab === 'profile' && (
          <div className="relative">
            <div className="sticky top-0 z-40 bg-black/60 backdrop-blur-md px-4 py-3 flex items-center gap-3">
              <button
                onClick={() => setMobileTab('home')}
                className="w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
                title="Atrás"
              >
                <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M11.03.47a.75.75 0 0 1 1.06L4.81 7.75l6.22 6.22a.75.75 0 1 1-1.06 1.06l-6.75-6.75a.75.75 0 0 1 1.06 0z" />
                </svg>
              </button>
              <span className="font-bold text-sm text-white">Perfil</span>
            </div>
            <DesktopProfileView
              onSelectPlaylist={(pl) => {
                setSelectedPlaylist(pl);
                setMobileTab('playlist');
              }}
            />
          </div>
        )}
      </div>

      {/* Floating Mini Player Docked Above Nav */}
      <MobileMiniPlayer onOpenFullPlayer={() => setIsFullPlayerOpen(true)} />

      {/* Bottom Navigation */}
      <MobileBottomNav
        activeTab={
          mobileTab === 'home' || mobileTab === 'playlist' || mobileTab === 'profile'
            ? 'home'
            : mobileTab
        }
        onTabChange={(tab) => setMobileTab(tab)}
      />

      {/* Full Screen Player Modal */}
      <MobileNowPlayingModal
        isOpen={isFullPlayerOpen}
        onClose={() => setIsFullPlayerOpen(false)}
      />

      {/* Modals */}
      <LoginModal />
    </div>
  );
};
