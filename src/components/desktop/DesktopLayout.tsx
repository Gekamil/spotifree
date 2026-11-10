import React, { useRef, useEffect } from 'react';
import { DesktopTopNav } from './DesktopTopNav';
import { DesktopSidebar } from './DesktopSidebar';
import { DesktopPlayer } from './DesktopPlayer';
import { DesktopHomeView } from './DesktopHomeView';
import { DesktopSearchView } from './DesktopSearchView';
import { DesktopPlaylistView } from './DesktopPlaylistView';
import { DesktopRightSidebar } from './DesktopRightSidebar';
import { ContextMenu } from './ContextMenu';
import { EditPlaylistModal } from './EditPlaylistModal';
import { LoginModal } from './LoginModal';
import { ImportLibraryModal } from '../modals/ImportLibraryModal';
import { DesktopSettingsView } from './DesktopSettingsView';
import { DesktopGuideView } from './DesktopGuideView';
import { DesktopProfileView } from './DesktopProfileView';
import { LocalFilesView } from '../common/LocalFilesView';
import { LOCAL_FILES_PLAYLIST_ID } from '../../utils/localFiles';
import { AIDJView } from '../dj/AIDJView';
import type { Playlist } from '../../types/spotify';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';
import { useSpotifreeMixes } from '../../services/spotifreeMixes';

export const DesktopLayout: React.FC = () => {
  const { activeMainTab, setActiveMainTab, activeRightSidebar, toggleRightSidebar } = useUIStore();
  const playlists = useSpotifyDataStore((s) => s.playlists);
  const [selectedPlaylist, setSelectedPlaylist] = React.useState<Playlist | null>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);

  const activePlaylist = (selectedPlaylist ? playlists.find((p) => p.id === selectedPlaylist.id) || selectedPlaylist : playlists[0]) || null;

  const handleSelectPlaylist = (playlist: Playlist) => {
    if (
      playlist.id === 'spotify-dj' ||
      playlist.id === 'dj' ||
      playlist.name?.toLowerCase().trim() === 'dj' ||
      (playlist as any).is_dj
    ) {
      setActiveMainTab('dj');
      return;
    }
    setSelectedPlaylist(playlist);
    setActiveMainTab('playlist');
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  };

  const handleSelectPlaylistById = (id: string, customName?: string, customImage?: string) => {
    const cleanId = id
      .replace(/^spotify:playlist:/, '')
      .replace(/^spotify:album:/, '')
      .replace(/^spotify:collection:/, '')
      .split('?')[0];

    if (
      cleanId === 'spotify-dj' ||
      cleanId === 'dj' ||
      customName?.toLowerCase().trim() === 'dj'
    ) {
      setActiveMainTab('dj');
      return;
    }
    if (cleanId === LOCAL_FILES_PLAYLIST_ID) {
      setActiveMainTab('local');
      return;
    }

    // If artist or album id is passed, load directly with formatted name
    if (cleanId.startsWith('art-') || cleanId.startsWith('artist-') || cleanId.startsWith('alb-')) {
      const isArtist = cleanId.startsWith('art-') || cleanId.startsWith('artist-');
      const formattedName =
        customName ||
        cleanId
          .replace(/^(art-|artist-|alb-)/i, '')
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());

      handleSelectPlaylist({
        id: cleanId,
        name: formattedName,
        description: isArtist ? 'Artista' : 'Álbum',
        type: isArtist ? 'artist' : 'album',
        images: customImage ? [{ url: customImage }] : [],
        owner: { display_name: 'Spotify', id: 'spotify' },
        tracks: { total: 0, items: [] },
      } as any);
      return;
    }

    // 0. Check playlistDetailsCache first for instant loading
    const cached = useSpotifyDataStore.getState().playlistDetailsCache[cleanId] ||
                   useSpotifyDataStore.getState().playlistDetailsCache[id];
    if (cached) {
      handleSelectPlaylist(cached);
      return;
    }

    // 0b. Check Spotifree personalized mixes
    const sfMix = useSpotifreeMixes.getState().mixes.find((m) => m.id === cleanId || m.id === id);
    if (sfMix) {
      handleSelectPlaylist(sfMix);
      return;
    }

    // 1. Direct match by id or uri in user playlists
    const found = playlists.find(
      (p) =>
        p.id === id ||
        p.id === cleanId ||
        (p as any).uri === id ||
        (p as any).uri === `spotify:playlist:${cleanId}` ||
        (p as any).uri === `spotify:album:${cleanId}`
    );
    if (found) {
      handleSelectPlaylist(found);
      return;
    }

    // 2. Check quickAccessCards in store
    const quickAccess = useSpotifyDataStore.getState().quickAccessCards || [];
    const foundQuick = quickAccess.find(
      (q) => q.id === id || q.id === cleanId || (q as any).uri === id
    );

    // 3. Check dynamic shelves for card info
    const shelves = useSpotifyDataStore.getState().dynamicShelves || [];
    let foundCard: any = null;
    for (const s of shelves) {
      const c = s.cards.find((card) => card.id === id || card.id === cleanId);
      if (c) {
        foundCard = c;
        break;
      }
    }

    // Determine appropriate title and image based on real IDs
    let title = foundQuick?.name || foundCard?.title;
    let image = foundQuick?.image || foundCard?.image;
    let desc = foundCard?.subtitle || '';
    let ownerName = 'Spotify';

    const currentUserDisplayName = useSpotifyDataStore.getState().user?.display_name || 'Spotify';

    if (cleanId === '37i9dQZF1DWZdsS73T1ogG' || cleanId === 'el-nuevo-urbano') {
      title = title || 'el nuevo urbano';
      image = image || 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426';
      desc = desc || 'El nuevo urbano \'Made in Spain\' que se pega en todo el mundo.';
    } else if (cleanId === '37i9dQZF1DX2EiUAL7Wdfc' || cleanId === 'miticas') {
      title = title || 'míticas';
      image = image || 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6';
      desc = desc || 'la música de ayer y hoy que se queda contigo';
    } else if (cleanId === '37i9dQZF1DXcBWIGoYBM5M') {
      title = title || 'Éxitos España';
      image = image || 'https://i.scdn.co/image/ab67706f00000002e8ccdd567fff6a597b87586b';
      desc = desc || 'Los éxitos más escuchados en España.';
    } else if (cleanId === '37i9dQZF1DX10zKzsJ2jva') {
      title = title || 'Viva Latino';
      image = image || 'https://i.scdn.co/image/ab67706f00000002964880811c74069be12f02b5';
      desc = desc || 'Los éxitos de la música latina.';
    } else if (cleanId === 'liked-songs' || cleanId === 'tracks' || cleanId === 'collection-tracks') {
      title = 'Canciones que te gustan';
      image = 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';
      ownerName = currentUserDisplayName;
    } else if (cleanId === 'nueva-carpeta') {
      title = title || 'Nueva carpeta';
      ownerName = currentUserDisplayName;
      desc = 'Carpetas';
    }

    const isArtist = (foundCard as any)?.type === 'artist' || desc?.toLowerCase() === 'artista' || cleanId.startsWith('art-') || cleanId.startsWith('artist-');
    const isAlbum = (foundCard as any)?.type === 'album' || cleanId.startsWith('alb-') || cleanId.startsWith('album-');
    const isUser = ownerName === currentUserDisplayName && !isArtist && !isAlbum && cleanId !== 'nueva-carpeta';

    const placeholder: Playlist = {
      id: cleanId,
      name: customName || title || 'Lista de Spotify',
      description: desc,
      type: isArtist ? 'artist' : isAlbum ? 'album' : 'playlist',
      images: customImage ? [{ url: customImage }] : (image ? [{ url: image }] : []),
      owner: { display_name: ownerName, id: isUser ? 'user' : 'spotify' },
      tracks: { total: 0, items: [] },
    } as any;

    handleSelectPlaylist(placeholder);
  };

  const handleNavigateHome = () => {
    setActiveMainTab('home');
    useSpotifyDataStore.getState().initialize();
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  };

  useEffect(() => {
    const handleOpen = (e: any) => {
      if (e.detail) {
        handleSelectPlaylist(e.detail);
      }
    };
    window.addEventListener('spotifree_open_playlist', handleOpen);
    (window as any).__desktopSelectPlaylist = handleSelectPlaylist;
    return () => {
      window.removeEventListener('spotifree_open_playlist', handleOpen);
      delete (window as any).__desktopSelectPlaylist;
    };
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-black overflow-hidden font-sans select-none relative">
      {/* 1. Global Top Navigation Bar (Full Width) */}
      <DesktopTopNav onNavigateHome={handleNavigateHome} />

      {/* 2. Middle Body: Left Sidebar + Center Main View + Optional Right Sidebar */}
      <div className="flex-1 flex gap-2 px-2 min-h-0 overflow-hidden relative">
        {/* Left Sidebar ("Tu biblioteca") */}
        <DesktopSidebar
          playlists={playlists}
          selectedPlaylistId={selectedPlaylist?.id || null}
          onSelectPlaylist={handleSelectPlaylist}
        />

        {/* Center Main Panel */}
        <main className="flex-1 bg-spotify-base rounded-lg flex flex-col overflow-hidden relative">
          <div
            ref={mainScrollRef}
            className="flex-1 overflow-y-auto overflow-x-hidden relative"
          >
            {activeMainTab === 'home' && (
              <div key="home" className="spf-page-enter min-h-full">
                <DesktopHomeView onSelectPlaylistById={handleSelectPlaylistById} />
              </div>
            )}

            {activeMainTab === 'search' && (
              <div key="search" className="spf-page-enter min-h-full">
                <DesktopSearchView onSelectPlaylistById={handleSelectPlaylistById} />
              </div>
            )}

            {activeMainTab === 'playlist' && activePlaylist && (
              <div key={`pl-${activePlaylist.id}`} className="spf-page-push min-h-full">
                <DesktopPlaylistView
                  key={activePlaylist.id}
                  playlist={activePlaylist}
                  onSelectPlaylistById={handleSelectPlaylistById}
                />
              </div>
            )}

            {activeMainTab === 'local' && (
              <div key="local" className="spf-page-push min-h-full">
                <LocalFilesView />
              </div>
            )}

            {activeMainTab === 'settings' && (
              <div key="settings" className="spf-page-enter min-h-full">
                <DesktopSettingsView />
              </div>
            )}

            {activeMainTab === 'guide' && (
              <div key="guide" className="spf-page-enter min-h-full">
                <DesktopGuideView />
              </div>
            )}

            {activeMainTab === 'profile' && (
              <div key="profile" className="spf-page-enter min-h-full">
                <DesktopProfileView onSelectPlaylist={handleSelectPlaylist} />
              </div>
            )}

            {activeMainTab === 'dj' && (
              <AIDJView
                onBack={() => setActiveMainTab('home')}
                onOpenPlayer={() => toggleRightSidebar('now-playing')}
              />
            )}
          </div>

          {/* Expand Right Sidebar Toggle Handle ("<") matching image 4 */}
          {activeRightSidebar === 'none' && (
            <button
              onClick={() => toggleRightSidebar('now-playing')}
              aria-label="Mostrar la vista Sonando"
              title="Mostrar la vista Sonando"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-30 w-7 h-7 rounded-full bg-[#121212]/95 hover:bg-[#282828] text-[#b3b3b3] hover:text-white flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95 border border-white/10"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M11.03.47a.75.75 0 0 1 0 1.06L4.56 8l6.47 6.47a.75.75 0 1 1-1.06 1.06L2.44 8 9.97.47a.75.75 0 0 1 1.06 0" />
              </svg>
            </button>
          )}
        </main>

        {/* Right Sidebar (Queue / Lyrics / Friends / Now Playing) */}
        <DesktopRightSidebar onSelectPlaylistById={handleSelectPlaylistById} />
      </div>

      {/* 3. Bottom Player Bar (72px, Full Width) */}
      <DesktopPlayer onSelectPlaylistById={handleSelectPlaylistById} />

      {/* Global Context Menu */}
      <ContextMenu onSelectPlaylistById={handleSelectPlaylistById} />

      {/* Edit Playlist Modal (1:1 Spotify Fidelity) */}
      <EditPlaylistModal />

      {/* Spotify Multi-Account Login & Cookie Extractor Modal */}
      <LoginModal />

      {/* Import Library Modal */}
      <ImportLibraryModal />
    </div>
  );
};
