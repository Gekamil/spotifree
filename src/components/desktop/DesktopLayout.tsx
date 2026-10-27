import React, { useRef } from 'react';
import { DesktopTopNav } from './DesktopTopNav';
import { DesktopSidebar } from './DesktopSidebar';
import { DesktopPlayer } from './DesktopPlayer';
import { DesktopHomeView } from './DesktopHomeView';
import { DesktopSearchView } from './DesktopSearchView';
import { DesktopPlaylistView } from './DesktopPlaylistView';
import { DesktopRightSidebar } from './DesktopRightSidebar';
import { ContextMenu } from './ContextMenu';
import { EditPlaylistModal } from './EditPlaylistModal';
import { DesktopSettingsView } from './DesktopSettingsView';
import { DesktopGuideView } from './DesktopGuideView';
import type { Playlist } from '../../types/spotify';
import { useUIStore } from '../../store/useUIStore';
import { useSpotifyDataStore } from '../../store/useSpotifyDataStore';

export const DesktopLayout: React.FC = () => {
  const { activeMainTab, setActiveMainTab, activeRightSidebar, toggleRightSidebar } = useUIStore();
  const playlists = useSpotifyDataStore((s) => s.playlists);
  const [selectedPlaylist, setSelectedPlaylist] = React.useState<Playlist | null>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);

  const activePlaylist = selectedPlaylist || playlists[0] || null;

  const handleSelectPlaylist = (playlist: Playlist) => {
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

    // If customName is provided for an artist or album, load directly
    if (customName && (cleanId.startsWith('art-') || cleanId.startsWith('artist-') || cleanId.startsWith('alb-'))) {
      const isArtist = cleanId.startsWith('art-') || cleanId.startsWith('artist-');
      handleSelectPlaylist({
        id: cleanId,
        name: customName,
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

    if (cleanId === '7b3MrCWtettvBKlfBSdorn' || cleanId === 'jl-2026' || cleanId === 'j-l-2026' || cleanId === 'j-l-2026-') {
      title = title || 'J+L(2026)';
      image = image || 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c804d43e5cc7f6a6d0ac65ffc';
      desc = desc || `De ${currentUserDisplayName}`;
      ownerName = currentUserDisplayName;
    } else if (cleanId === '37i9dQZF1DWZdsS73T1ogG' || cleanId === 'el-nuevo-urbano') {
      title = title || 'el nuevo urbano';
      image = image || 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426';
      desc = desc || 'El nuevo urbano \'Made in Spain\' que se pega en todo el mundo.';
    } else if (cleanId === '4f0YTBqSbvM1iJpuY9r3yQ' || cleanId === 'zizi') {
      title = title || 'ZIZI';
      image = image || 'https://i.scdn.co/image/ab67616d0000b273eb31ebdbca6acd99c23b4d31';
      desc = desc || 'Ozuna, Omar Courtz';
    } else if (cleanId === '37i9dQZF1DX2EiUAL7Wdfc' || cleanId === 'miticas') {
      title = title || 'míticas';
      image = image || 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6';
      desc = desc || 'la música de ayer y hoy que se queda contigo';
    } else if (cleanId === '37i9dQZF1E35QYVMBRlDph' || cleanId === 'mix-diario-1' || cleanId === 'daily-mix-1') {
      title = title || 'Mix diario 1';
      image = image || 'https://dailymix-images.scdn.co/v2/img/ab6761610000e5ebc8be3c6e5a824360d1bffc03/1/es/default';
      desc = desc || 'Romeo Santos, Prince Royce, Aventura y más';
      ownerName = `Hecha para ${currentUserDisplayName}`;
    } else if (cleanId === 'liked-songs' || cleanId === 'tracks' || cleanId === 'collection-tracks') {
      title = 'Canciones que te gustan';
      image = 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';
      ownerName = currentUserDisplayName;
    } else if (cleanId === '43GWp9FbN9nHihudedyVQM' || cleanId === 'romeo-prince' || cleanId === 'romeo---prince') {
      title = title || 'Romeo & Prince';
      ownerName = currentUserDisplayName;
    } else if (cleanId === '4Jf0fa5p0ajOnSriA9cYGS' || cleanId === 'my-top-tracks-playlist') {
      title = title || 'My top tracks playlist';
      ownerName = currentUserDisplayName;
      image = image || 'https://mosaic.scdn.co/640/ab67616d00001e0274d62f9a88da68519fa864f4ab67616d00001e027c7a7bfadfaa801d3285455bab67616d00001e02c019056033dfa6c6987f25ceab67616d00001e02d01f410ddd5776121c42bf59';
    } else if (cleanId === '7HsL4sBaR3dJMa0UJ5e4zG' || cleanId === 'nuestro-amor' || cleanId === '--nuestro-amor----2024-25-') {
      title = title || '♡ nuestro amor ♡ (2024-25)';
      ownerName = 'Spotify';
    } else if (cleanId === 'tus-canciones-mas-escuchadas-2025' || cleanId === 'tus-canciones-m-s-escuchadas-en-2025') {
      title = title || 'Tus canciones más escuchadas en 2025';
      ownerName = `Hecha para ${currentUserDisplayName}`;
    } else if (cleanId === '3x7gz85amxEplGx7LQxE7Z' || cleanId === 'romeo-santos') {
      title = title || 'Romeo Santos';
      ownerName = 'Spotify';
      desc = 'Artista';
    } else if (cleanId === 'nueva-carpeta') {
      title = title || 'Nueva carpeta';
      ownerName = currentUserDisplayName;
      desc = '7 listas';
    }

    const isArtist = cleanId === '3x7gz85amxEplGx7LQxE7Z' || cleanId === '5lwmRuXgjX8xIwlnauTZIP' || cleanId === 'romeo-santos' || desc?.toLowerCase() === 'artista' || cleanId.startsWith('art-');
    const isAlbum = cleanId === '4f0YTBqSbvM1iJpuY9r3yQ' || cleanId === 'zizi' || cleanId.startsWith('alb-');
    const isUser = (cleanId === '7b3MrCWtettvBKlfBSdorn' || cleanId === '7HsL4sBaR3dJMa0UJ5e4zG' || ownerName === currentUserDisplayName) && !isArtist && !isAlbum && cleanId !== 'nueva-carpeta';

    const placeholder: Playlist = {
      id: cleanId,
      name: title || 'Lista de Spotify',
      description: desc,
      type: isArtist ? 'artist' : isAlbum ? 'album' : 'playlist',
      images: image ? [{ url: image }] : [],
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
              <DesktopHomeView onSelectPlaylistById={handleSelectPlaylistById} />
            )}

            {activeMainTab === 'search' && <DesktopSearchView />}

            {activeMainTab === 'playlist' && activePlaylist && (
              <DesktopPlaylistView playlist={activePlaylist} />
            )}

            {activeMainTab === 'settings' && <DesktopSettingsView />}

            {activeMainTab === 'guide' && <DesktopGuideView />}
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
      <ContextMenu />

      {/* Edit Playlist Modal (1:1 Spotify Fidelity) */}
      <EditPlaylistModal />
    </div>
  );
};
