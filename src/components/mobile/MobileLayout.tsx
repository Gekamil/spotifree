import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSpotifyDataStore, buildDynamicShelves, SPOTIFY_DJ_COVER_IMAGE, getDeletedPlaylistIds } from '../../store/useSpotifyDataStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '../../store/useUIStore';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileSheet, SheetHeader, SheetItem, SheetList } from './MobileSheet';
import { LocalFilesCover, LocalFilesView } from '../common/LocalFilesView';
import { LOCAL_FILES_EVENT, LOCAL_FILES_PLAYLIST_ID, listLocalTracks } from '../../utils/localFiles';
import { deviceTracks, scanDeviceMusic } from '../../utils/nativeLocalMusic';
import { dedupeHomeShelves, useSpotifreeMixes, withSpotifreeShelves } from '../../services/spotifreeMixes';
import { resolveArtistName } from '../../services/artistService';
import { MobileMiniPlayer } from './MobileMiniPlayer';
import { MobileNowPlayingModal } from './MobileNowPlayingModal';
import { MobileHeader } from './MobileHeader';
import { MobileProfileDrawer } from './MobileProfileDrawer';
import { useSharedSessionStore } from '../../services/sharedSessionService';
import { MobilePlaylistView } from './MobilePlaylistView';
import { MobileSearchView } from './MobileSearchView';
import { MobileCreateSheet } from './MobileCreateSheet';
import { MobileProfileView } from './MobileProfileView';
import { MobileSettingsView } from './MobileSettingsView';
import { MobileRecentsView } from './MobileRecentsView';
import { MobileStatsView } from './MobileStatsView';
import { MobileAddLibraryItemsModal, type LibraryCandidateItem } from './MobileAddLibraryItemsModal';
import { MessagesNotificationsModal } from '../modals/MessagesNotificationsModal';
import { LoginModal } from '../desktop/LoginModal';
import { AIDJView } from '../dj/AIDJView';
import { SpotifyDJVisualizer } from '../dj/SpotifyDJVisualizer';
import { InteractiveMusicWaves } from '../dj/InteractiveMusicWaves';
import { useAIDJStore } from '../../services/aiDJService';
import type { Playlist } from '../../types/spotify';
import { resolveVibrantColor, extractDominantColorFromImage } from '../../utils/spotifyColor';
import {
  isPlaylistDownloaded,
  getDownloadedPlaylists,
  getAllDownloadedTrackIds,
  onDownloadsChanged,
  downloadPlaylist,
  deleteDownloadedPlaylist,
} from '../../utils/offlineStorage';
import { getCustomLikedSongs } from '../../utils/userStorage';
import {
  ShareNativeIcon,
  EditNativeIcon,
  DownloadCircleNativeIcon,
  DownloadActiveCircleNativeIcon,
  QueueNativeIcon,
} from '../icons/SpotifyNativeIcons';
import { handleImageError } from '../../utils/imageFallback';
import { getPlaylistCover, onPlaylistCoverError, useAutoCovers } from '../../utils/playlistCover';
import { stripHtml } from '../../utils/formatters';
import { RotatingDJBannerText } from '../../utils/djMessages';

export const MobileLayout: React.FC = () => {
  const [mobileTab, setMobileTab] = useState<'home' | 'search' | 'library' | 'playlist' | 'profile' | 'settings' | 'dj' | 'local' | 'recents' | 'stats'>('home');
  const [localCount, setLocalCount] = useState(0);
  useEffect(() => {
    const load = () =>
      Promise.all([listLocalTracks(), getAllDownloadedTrackIds()]).then(([t, dlIds]) => {
        const dev = deviceTracks();
        const combined = new Set<string>();
        dev.forEach((x) => combined.add(x.id));
        t.forEach((x) => combined.add(x.id));
        dlIds.forEach((id) => combined.add(id));
        setLocalCount(combined.size);
      });
    load();
    // APK: the phone's music (only if the permission was already given; it is asked in Archivos locales)
    void scanDeviceMusic(false);
    window.addEventListener(LOCAL_FILES_EVENT, load);
    const unsubDownloads = onDownloadsChanged(load);
    return () => {
      window.removeEventListener(LOCAL_FILES_EVENT, load);
      unsubDownloads();
    };
  }, []);
  const [homeFilter, setHomeFilter] = useState<'todo' | 'musica'>('todo');
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'playlists' | 'artists' | 'downloaded'>('all');
  const [isLibrarySearching, setIsLibrarySearching] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);

  useEffect(() => {
    const handleOpenFull = () => setIsFullPlayerOpen(true);
    window.addEventListener('spotifree_open_full_player', handleOpenFull);
    return () => window.removeEventListener('spotifree_open_full_player', handleOpenFull);
  }, []);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAddLibraryModalOpen, setIsAddLibraryModalOpen] = useState(false);
  const [lastVibrantColor, setLastVibrantColor] = useState('#452a6d');

  // Long-press playlist deletion & options state
  const [longPressedPlaylistId, setLongPressedPlaylistId] = useState<string | null>(null);
  const [playlistMenuTarget, setPlaylistMenuTarget] = useState<Playlist | null>(null);
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [editTargetName, setEditTargetName] = useState('');
  const [editTargetCover, setEditTargetCover] = useState('');
  const [editTargetDesc, setEditTargetDesc] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const longPressTimeoutRef = useRef<any>(null);

  // Android Hardware Back & Gesture Navigation Handler
  useEffect(() => {
    const handleAndroidBack = (e: any) => {
      // 1. Full Player Modal
      if (isFullPlayerOpen) {
        setIsFullPlayerOpen(false);
        if (e.detail && typeof e.detail.setHandled === 'function') e.detail.setHandled();
        return;
      }
      // 2. Overlays & Sheets
      if (isNotificationsOpen) {
        setIsNotificationsOpen(false);
        if (e.detail && typeof e.detail.setHandled === 'function') e.detail.setHandled();
        return;
      }
      if (isCreateOpen) {
        setIsCreateOpen(false);
        if (e.detail && typeof e.detail.setHandled === 'function') e.detail.setHandled();
        return;
      }
      if (isAddLibraryModalOpen) {
        setIsAddLibraryModalOpen(false);
        if (e.detail && typeof e.detail.setHandled === 'function') e.detail.setHandled();
        return;
      }
      if (playlistMenuTarget || isEditingTarget) {
        setPlaylistMenuTarget(null);
        setIsEditingTarget(false);
        if (e.detail && typeof e.detail.setHandled === 'function') e.detail.setHandled();
        return;
      }
      if (longPressedPlaylistId) {
        setLongPressedPlaylistId(null);
        if (e.detail && typeof e.detail.setHandled === 'function') e.detail.setHandled();
        return;
      }
      // 3. Playlist detail view
      if (selectedPlaylist) {
        setSelectedPlaylist(null);
        setMobileTab('home');
        if (e.detail && typeof e.detail.setHandled === 'function') e.detail.setHandled();
        return;
      }
      // 4. Sub-tabs (Search, Library, DJ, Profile, Settings)
      if (mobileTab !== 'home') {
        setMobileTab('home');
        if (e.detail && typeof e.detail.setHandled === 'function') e.detail.setHandled();
        return;
      }
    };

    window.addEventListener('spotifree_android_back', handleAndroidBack);
    return () => window.removeEventListener('spotifree_android_back', handleAndroidBack);
  }, [
    isFullPlayerOpen,
    isNotificationsOpen,
    isCreateOpen,
    isAddLibraryModalOpen,
    playlistMenuTarget,
    isEditingTarget,
    longPressedPlaylistId,
    selectedPlaylist,
    mobileTab,
  ]);

  useEffect(() => {
    const handleOpen = (e: any) => {
      if (e.detail) {
        setSelectedPlaylist(e.detail);
        setMobileTab('playlist');
      }
    };
    window.addEventListener('spotifree_open_playlist', handleOpen);
    (window as any).__mobileSelectPlaylist = (pl: Playlist) => {
      setSelectedPlaylist(pl);
      setMobileTab('playlist');
    };
    return () => {
      window.removeEventListener('spotifree_open_playlist', handleOpen);
      delete (window as any).__mobileSelectPlaylist;
    };
  }, []);

  const startLongPress = (pl: Playlist) => {
    longPressTimeoutRef.current = setTimeout(() => {
      try {
        if (navigator && typeof navigator.vibrate === 'function') {
          navigator.vibrate(40);
        }
      } catch {}
      setLongPressedPlaylistId(pl.id);
    }, 450);
  };

  const cancelLongPress = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const openPlaylistOptions = (pl: Playlist) => {
    setPlaylistMenuTarget(pl);
    setLongPressedPlaylistId(null);
    setIsEditingTarget(false);
    setEditTargetName(pl.name || '');
    setEditTargetCover(pl.images?.[0]?.url || '');
    setEditTargetDesc(pl.description || '');
  };

  const handleDeletePlaylist = (id: string) => {
    useSpotifyDataStore.getState().deletePlaylist(id);
    setPlaylistMenuTarget(null);
    setLongPressedPlaylistId(null);
    setToastMessage('Se ha eliminado de tu biblioteca');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSavePlaylistEdit = () => {
    if (!playlistMenuTarget) return;
    const cleanId = playlistMenuTarget.id;
    const newName = editTargetName.trim() || playlistMenuTarget.name;
    const newDesc = editTargetDesc.trim();
    const newCover = editTargetCover.trim();

    useSpotifyDataStore.getState().updatePlaylist(cleanId, {
      name: newName,
      description: newDesc,
      images: newCover ? [{ url: newCover }] : playlistMenuTarget.images,
    });

    setToastMessage('Playlist actualizada');
    setIsEditingTarget(false);
    setPlaylistMenuTarget(null);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSharePlaylistTarget = async () => {
    if (!playlistMenuTarget) return;
    const shareUrl = `${window.location.origin}/?playlist=${encodeURIComponent(playlistMenuTarget.id)}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: playlistMenuTarget.name,
          text: `Escucha ${playlistMenuTarget.name} en Spotifree`,
          url: shareUrl,
        });
        setPlaylistMenuTarget(null);
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setToastMessage('¡Enlace copiado al portapapeles!');
    } catch {
      setToastMessage('Enlace listo');
    }
    setPlaylistMenuTarget(null);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleAddToQueueTarget = () => {
    if (!playlistMenuTarget) return;
    const cached = (useSpotifyDataStore.getState().playlistDetailsCache as any)[playlistMenuTarget.id];
    const tracks = cached?.tracks?.items || playlistMenuTarget.tracks?.items || [];
    if (tracks.length > 0) {
      tracks.forEach((t: any) => usePlayerStore.getState().addToQueue(t));
      setToastMessage(`Añadidas ${tracks.length} canciones a la cola`);
    } else {
      setToastMessage('Playlist añadida a la cola');
    }
    setPlaylistMenuTarget(null);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleToggleDownloadTarget = async () => {
    if (!playlistMenuTarget) return;
    const isDownloaded = isPlaylistDownloaded(playlistMenuTarget.id);
    if (isDownloaded) {
      await deleteDownloadedPlaylist(playlistMenuTarget.id);
      setToastMessage('Descarga eliminada');
    } else {
      const target = playlistMenuTarget;
      setPlaylistMenuTarget(null);
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setToastMessage('Modo avión: conéctate a internet para descargar playlists');
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
      const cleanPid = target.id.replace(/^spotify:(playlist|album):/, '').split('?')[0];
      const cached =
        (useSpotifyDataStore.getState().playlistDetailsCache as any)[target.id] ||
        (useSpotifyDataStore.getState().playlistDetailsCache as any)[cleanPid];
      let tracks = cached?.tracks?.items || target.tracks?.items || [];
      if (tracks.length === 0 && typeof window !== 'undefined') {
        try {
          const savedRaw = window.localStorage.getItem(`spotifree_playlist_tracks_${cleanPid}`);
          if (savedRaw) tracks = JSON.parse(savedRaw);
        } catch {}
      }
      if (tracks.length === 0 && cleanPid) {
        setToastMessage('Cargando canciones de la playlist…');
        try {
          const resPl = await fetch(`/api/spotify/playlist/${encodeURIComponent(cleanPid)}`);
          if (resPl.ok) {
            const dataPl = await resPl.json();
            if (Array.isArray(dataPl?.tracks?.items) && dataPl.tracks.items.length > 0) {
              tracks = dataPl.tracks.items;
            }
          }
        } catch {}
      }
      setToastMessage(`Descargando ${tracks.length} canciones…`);
      const res = await downloadPlaylist(target, tracks, (done, total) => setToastMessage(`Descargando canciones (${done}/${total})…`));
      setToastMessage(
        res.offline
          ? 'Modo avión: conéctate para descargar'
          : res.downloaded > 0
          ? `${res.downloaded} de ${res.total} canciones guardadas para modo avión`
          : 'No se pudo descargar ninguna canción. Inténtalo de nuevo.'
      );
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }
    setPlaylistMenuTarget(null);
    setTimeout(() => setToastMessage(null), 2500);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__setMobileTab = setMobileTab;
    }
  }, []);

  const { currentTrack, isPlaying, currentContextId, likedTrackIds } = usePlayerStore(
    useShallow((s) => ({ currentTrack: s.currentTrack, isPlaying: s.isPlaying, currentContextId: s.currentContextId, likedTrackIds: s.likedTrackIds }))
  );
  const djThemeColor = useAIDJStore((s) => s.djThemeColor);

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
      p.id.startsWith('art-') ||
      p.id.startsWith('artist-')
    );
  };

  const { isAuthenticated, user, playlists, dynamicShelves, quickAccessCards, featuredMessage } = useSpotifyDataStore();
  const sfMixes = useSpotifreeMixes((s) => s.mixes);
  const sfArtists = useSpotifreeMixes((s) => s.suggestedArtists);
  const autoCoverVersion = useAutoCovers((s) => s.version); // playlist collages ready → repaint
  // "Mostrar todo" of a Home section (a grid page; closes when leaving Home)
  const [seeAllShelf, setSeeAllShelf] = useState<{ title: string; prefix?: string; cards: Array<{ id: string; title: string; subtitle: string; image: string }> } | null>(null);
  useEffect(() => {
    if (mobileTab !== 'home') setSeeAllShelf(null);
  }, [mobileTab]);
  const { openLoginModal, sortOrder, setSortOrder, viewMode, setViewMode } = useUIStore();
  const [isMobileSortSheetOpen, setIsMobileSortSheetOpen] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);

  const getSortLabel = () => {
    switch (sortOrder) {
      case 'recientes':
        return 'Recientes';
      case 'anadidos':
        return 'Añadidos recientemente';
      case 'alfabetico':
        return 'Alfabético';
      case 'creador':
        return 'Creador';
      default:
        return 'Recientes';
    }
  };

  const handleCreatePlaylist = (name: string) => {
    // Same path as desktop: saved in every storage layer + cloud account, marked as the user's own
    const newPlaylist = useSpotifyDataStore.getState().createPlaylist(name);
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
    const shortcutIds = new Set(shortcuts.map((s: any) => s.id));
    const withoutShortcuts = <T extends { cards: Array<{ id: string }> }>(l: T[]): T[] =>
      l.map((s) => ({ ...s, cards: s.cards.filter((c) => !shortcutIds.has(c.id)) })).filter((s) => s.cards.length > 0);
    const list: Array<{
      id: string;
      title: string;
      prefix?: string;
      cards: Array<{ id: string; title: string; subtitle: string; image: string }>;
    }> = [];

    const deletedIds = getDeletedPlaylistIds();

    // 1. User's Playlists from current session ("nuestra sesión")
    const userLists = playlists.filter(
      (p) =>
        !deletedIds.has(p.id) &&
        !p.id.includes('collection:tracks') &&
        p.type !== 'folder' &&
        // An empty "Canciones que te gustan" is not worth a card on Home
        (p.id !== 'liked-songs' || (p.tracks?.items?.length || 0) > 0)
    );
    if (userLists.length > 0) {
      list.push({
        id: 'shelf-tus-playlists',
        title: 'Tus playlists',
        cards: userLists.map((p) => ({
          id: p.id,
          title: p.name,
          subtitle: stripHtml(p.description) || `De ${p.owner?.display_name || user?.display_name || 'ti'}`,
          image: getPlaylistCover(p),
        })),
      });
    }

    // 2. Base dynamic shelves (Emisoras recomendadas, Tus mixes más escuchados, etc.) + Spotifree's own
    const base = withSpotifreeShelves(
      dynamicShelves && dynamicShelves.length > 0 ? dynamicShelves : buildDynamicShelves(user, playlists, featuredMessage),
      sfMixes,
      user?.display_name,
      sfArtists
    );

    base
      // "Tus listas creadas" repeats what "Tus playlists" already shows on mobile
      .filter((s) => !(s.id === 'shelf-user-created' && userLists.length > 0))
      .filter((s) => !s.title.toLowerCase().includes('pódcast') && !s.title.toLowerCase().includes('audiolibro'))
      .forEach((s) => {
        const filteredCards = s.cards.filter((c) => !deletedIds.has(c.id));
        if (filteredCards.length > 0) {
          list.push({
            id: s.id,
            title: s.title,
            prefix: s.prefix,
            cards: filteredCards.map((c) => ({
              id: c.id,
              title: c.title,
              subtitle: stripHtml(c.subtitle),
              image: c.image,
            })),
          });
        }
      });

    if (homeFilter === 'musica') {
      return withoutShortcuts(dedupeHomeShelves(list.filter((s) => !s.title.toLowerCase().includes('noticias') && !s.title.toLowerCase().includes('podcast')) as any) as typeof list);
    }

    // No playlist twice on Home ("Tus playlists" + every section + the shortcuts at the top)
    return withoutShortcuts(dedupeHomeShelves(list as any) as typeof list);
  }, [playlists, dynamicShelves, user, featuredMessage, homeFilter, sfMixes, sfArtists, shortcuts, autoCoverVersion]);

  const handleSelectPlaylistById = (id: string, customName?: string, customImage?: string) => {
    const cleanId = id.replace(/^spotify:(playlist|album):/, '').split('?')[0];
    if (cleanId === 'spotify-dj' || cleanId === 'dj' || customName?.toLowerCase().trim() === 'dj') {
      setMobileTab('dj');
      return;
    }
    if (cleanId === LOCAL_FILES_PLAYLIST_ID) {
      setMobileTab('local');
      return;
    }
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

    const sfMix = useSpotifreeMixes.getState().mixes.find((m) => m.id === cleanId || m.id === id);
    if (sfMix) {
      setSelectedPlaylist(sfMix);
      setMobileTab('playlist');
      return;
    }

    const found = playlists.find((p) => p.id === cleanId || p.id === id);
    if (found) {
      setSelectedPlaylist(found);
      setMobileTab('playlist');
      return;
    }

    const isArtist = cleanId.startsWith('art-') || cleanId.startsWith('artist-');
    const resolvedName = customName || (isArtist ? resolveArtistName(cleanId) : cleanId === 'liked-songs' ? 'Canciones que te gustan' : 'Playlist');

    const placeholder: Playlist = {
      id: cleanId,
      name: resolvedName,
      description: isArtist ? 'Artista' : '',
      type: isArtist ? 'artist' : cleanId.startsWith('alb-') ? 'album' : 'playlist',
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
    <div
      className="h-screen w-screen flex flex-col bg-[#121212] text-white overflow-hidden font-['SpotifyMixUI'] select-none relative"
      // Nothing under the clock / battery: the whole app starts below the status bar
      style={{ paddingTop: 'var(--sat)' }}
    >
      {/* Scrollable Center Content */}
      <div data-mobile-scroll className={`flex-1 overflow-y-auto overflow-x-hidden ${mobileTab === 'dj' ? 'pb-0' : 'pb-32'}`}>
        {/* HOME → "Mostrar todo" of a section: the whole section in a grid */}
        {mobileTab === 'home' && seeAllShelf && (
          <div className="min-h-full spf-page-push pb-6">
            <div className="sticky top-0 z-20 px-2 pt-2 pb-2 bg-[#121212]/95 backdrop-blur-md flex items-center gap-2">
              <button
                onClick={() => setSeeAllShelf(null)}
                className="w-10 h-10 flex items-center justify-center rounded-full active:bg-white/10 cursor-pointer"
                aria-label="Volver"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.957 2.793a1 1 0 0 1 0 1.414L8.164 12l7.793 7.793a1 1 0 1 1-1.414 1.414L5.336 12l9.207-9.207a1 1 0 0 1 1.414 0z" />
                </svg>
              </button>
              <div className="min-w-0">
                {seeAllShelf.prefix && <p className="text-[11px] font-semibold text-[#a7a7a7] leading-none">{seeAllShelf.prefix}</p>}
                <h2 className="text-lg font-black tracking-tight font-['SpotifyMixUITitle'] truncate">{seeAllShelf.title}</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 px-4 pt-3 spf-stagger">
              {seeAllShelf.cards.map((card) => {
                const round = card.id.startsWith('art-') || /^artista$/i.test(stripHtml(card.subtitle));
                return (
                  <button
                    key={card.id}
                    onClick={() => handleSelectPlaylistById(card.id, card.title, card.image)}
                    className="text-left active:scale-[0.97] transition-transform cursor-pointer"
                  >
                    <div className={`aspect-square w-full overflow-hidden bg-[#242424] shadow-lg ${round ? 'rounded-full' : 'rounded-md'}`}>
                      <img src={card.image} alt={card.title} onError={handleImageError} referrerPolicy="no-referrer" loading="lazy" className="w-full h-full object-cover" />
                    </div>
                    <p className={`mt-2 text-[13px] font-bold text-white line-clamp-1 ${round ? 'text-center' : ''}`}>{card.title}</p>
                    <p className={`text-xs text-[#a7a7a7] line-clamp-2 leading-snug ${round ? 'text-center' : ''}`}>{stripHtml(card.subtitle)}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 1: HOME */}
        {mobileTab === 'home' && !seeAllShelf && (
          <div
            className="min-h-full transition-colors duration-500 spf-page-enter"
            style={{
              background: `linear-gradient(180deg, ${lastVibrantColor}cc 0%, rgba(18, 18, 18, 0.98) 320px, #121212 100%)`,
            }}
          >
            <MobileHeader
              activeTab={homeFilter}
              onTabChange={setHomeFilter}
              onOpenDrawer={() => setIsProfileDrawerOpen(true)}
              onOpenProfile={() => setIsProfileDrawerOpen(true)}
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

                {/* Quick Access 2-Column Grid matching Spotify Mobile */}
                {shortcuts && shortcuts.length > 0 && (
                  <div className="px-4 mb-5">
                    <div className="grid grid-cols-2 gap-1.5">
                      {shortcuts.map((card) => {
                        const isPlayingThis = isCardPlaying(card.id, card.name);
                        return (
                          <div
                            key={card.id}
                            onClick={() => handleSelectPlaylistById(card.id, card.name, card.image)}
                            className="h-12 bg-[#282828] hover:bg-[#323232] active:bg-[#383838] rounded-[4px] overflow-hidden flex items-center justify-between cursor-pointer shadow-sm active:scale-[0.98] transition-all pr-2"
                          >
                            <div className="flex items-center min-w-0 flex-1 mr-1">
                              <img
                                src={card.image}
                                alt={card.name}
                                onError={handleImageError}
                                referrerPolicy="no-referrer"
                                className="w-12 h-12 object-cover shrink-0 rounded-l-[4px]"
                              />
                              <span
                                className={`font-bold text-[12px] leading-[15px] line-clamp-2 px-2 ${
                                  isPlayingThis ? 'text-[#1ed760]' : 'text-white'
                                }`}
                              >
                                {card.name}
                              </span>
                            </div>

                            {isPlayingThis && (
                              <div className="flex items-end gap-[2px] h-3.5 px-0.5 shrink-0" title="Reproduciendo">
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

                {/* YOUR OWN PERSONAL DJ CARD (Photo 3) */}
                <div className="px-4 mb-6">
                  <h2 className="text-xl font-black text-white font-['SpotifyMixUITitle'] mb-2.5">
                    Tu DJ personal
                  </h2>
                  <div
                    onClick={() => handleSelectPlaylistById('spotify-dj')}
                    className="relative w-full rounded-2xl p-5 overflow-hidden cursor-pointer shadow-lg active:scale-[0.98] transition-all flex flex-col justify-between min-h-[210px]"
                    style={{
                      backgroundColor: djThemeColor || '#0a52cc',
                      backgroundImage: `linear-gradient(145deg, ${djThemeColor || '#0a52cc'} 0%, rgba(5, 11, 24, 0.94) 100%)`,
                      boxShadow: `0 8px 32px ${djThemeColor || '#0a52cc'}55`,
                      transition: 'background-color 0.8s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.8s ease',
                    }}
                  >
                    {/* Audio Waves covering the ENTIRE widget background with clear, visible lines */}
                    <div className="absolute inset-0 pointer-events-none opacity-80 overflow-hidden z-0">
                      <InteractiveMusicWaves
                        isPlaying={isPlaying}
                        isSpeaking={false}
                        voiceLevel={0.25}
                        themeColor={djThemeColor || '#1ed760'}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Center Visualizer: Large Orb centered in the middle, fading smoothly to transparent in the lower half (Photo 7) */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 top-4 pointer-events-none flex items-center justify-center w-[220px] h-[220px] z-10"
                      style={{
                        WebkitMaskImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 1) 40%, rgba(0, 0, 0, 0) 75%, rgba(0, 0, 0, 0) 100%)',
                        maskImage: 'linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 1) 40%, rgba(0, 0, 0, 0) 75%, rgba(0, 0, 0, 0) 100%)',
                      }}
                    >
                      <div
                        className="w-full h-full flex items-center justify-center animate-spin-slow opacity-95 transition-all duration-700"
                        // Round fade: no translucent square from the canvas corners while it spins
                        style={{
                          WebkitMaskImage: 'radial-gradient(circle at center, #000 58%, transparent 70%)',
                          maskImage: 'radial-gradient(circle at center, #000 58%, transparent 70%)',
                        }}
                      >
                        <SpotifyDJVisualizer size={210} state={isPlaying ? 'playing' : 'idle'} voiceLevel={isPlaying ? 0.25 : 0.12} themeColor={djThemeColor} />
                      </div>
                    </div>

                    {/* Bottom Row: Text on left, White circular arrow on right */}
                    <div className="flex items-end justify-between relative z-20 mt-auto pt-4 w-full">
                      <div className="flex-1 min-w-0 pr-3 max-w-[calc(100%-56px)]">
                        <RotatingDJBannerText className="text-lg font-black text-white font-['SpotifyMixUITitle'] leading-snug min-h-[50px] flex items-end break-words whitespace-normal tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]" />
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectPlaylistById('spotify-dj');
                        }}
                        className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-xl active:scale-90 transition-all shrink-0 cursor-pointer ml-2 z-20"
                        title="Abrir DJ"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                          <polyline points="12 5 19 12 12 19"></polyline>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Shelves: Horizontal Carousels or Full-width Release Spotlight for single items (DJ card excluded as requested) */}
                <div className="space-y-6 px-4">
                  {shelves
                    .map((shelf) => ({
                      ...shelf,
                      cards: shelf.cards.filter((c: any) => {
                        const id = c.id || '';
                        const title = (c.title || '').toLowerCase().trim();
                        return (
                          id !== 'spotify-dj' &&
                          id !== 'dj' &&
                          id !== 'ai-dj' &&
                          title !== 'dj' &&
                          !title.includes('spotify dj') &&
                          title !== 'tu dj' &&
                          !title.includes('personal dj')
                        );
                      }),
                    }))
                    .filter((shelf) => shelf.cards.length > 0)
                    .map((shelf) => {
                    const isSingleCard = shelf.cards.length === 1;
                    const single = shelf.cards[0];

                    return (
                      <div key={shelf.id} className="space-y-2.5">
                        <div className="flex items-end justify-between gap-3">
                          <div className="min-w-0">
                            {shelf.prefix && (
                              <span className="text-[11px] font-bold text-[#b3b3b3] uppercase tracking-wider block mb-0.5">
                                {shelf.prefix}
                              </span>
                            )}
                            <h3 className="text-xl font-black text-white font-['SpotifyMixUITitle'] tracking-tight">
                              {shelf.title}
                            </h3>
                          </div>
                          {shelf.cards.length > 6 && (
                            <button
                              onClick={() => {
                                setSeeAllShelf({ title: shelf.title, prefix: shelf.prefix, cards: shelf.cards });
                                try {
                                  document.querySelector('[data-mobile-scroll]')?.scrollTo({ top: 0 });
                                } catch {}
                              }}
                              className="text-[13px] font-bold text-[#b3b3b3] active:text-white shrink-0 pb-0.5 cursor-pointer"
                            >
                              Mostrar todo
                            </button>
                          )}
                        </div>

                        {isSingleCard ? (
                          /* Real Spotify Full-width Release Spotlight (avoids blank right gaps) */
                          <div
                            onClick={() => handleSelectPlaylistById(single.id, single.title, single.image)}
                            className="w-full rounded-xl bg-gradient-to-r from-white/[0.08] via-white/[0.04] to-transparent p-3.5 flex items-center justify-between border border-white/5 active:scale-[0.98] transition-transform cursor-pointer shadow-md"
                          >
                            <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-3">
                              <div className="w-20 h-20 rounded-lg overflow-hidden bg-[#242424] shadow-lg shrink-0 relative">
                                <img
                                  src={single.image}
                                  alt={single.title}
                                  onError={handleImageError}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[10px] font-bold text-[#1ed760] uppercase tracking-wider mb-0.5">
                                  {playlists.some((p) => p.id === single.id) ? 'Playlist' : 'Destacado'}
                                </span>
                                <h4 className="font-bold text-white text-sm line-clamp-1">
                                  {single.title}
                                </h4>
                                <p className="text-xs text-[#b3b3b3] line-clamp-2 mt-0.5 leading-snug">
                                  {stripHtml(single.subtitle)}
                                </p>
                              </div>
                            </div>

                            <div className="w-10 h-10 rounded-full bg-[#1ed760] text-black flex items-center justify-center shrink-0 shadow-lg hover:scale-105 transition-transform">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l11-6.86a1 1 0 0 0 0-1.68l-11-6.86A1 1 0 0 0 8 5.14z" />
                              </svg>
                            </div>
                          </div>
                        ) : (
                          /* Multi-Card Horizontal Carousel */
                          <div className="flex gap-3.5 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
                            {shelf.cards.slice(0, 20).map((card) => (
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
                                    className={`w-full h-full object-cover ${
                                      card.image?.includes('/img/radio/') || card.id?.startsWith('rad-')
                                        ? 'scale-[1.10] origin-bottom'
                                        : ''
                                    }`}
                                  />
                                </div>
                                <div className="space-y-0.5">
                                  <h4 className="font-bold text-white text-xs line-clamp-1">
                                    {card.title}
                                  </h4>
                                  <p className="text-[11px] text-[#b3b3b3] line-clamp-2 leading-tight">
                                    {stripHtml(card.subtitle)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: SEARCH */}
        {mobileTab === 'search' && (
          <div className="p-4 space-y-4 spf-page-enter">
            <MobileSearchView onSelectPlaylistById={handleSelectPlaylistById} />
          </div>
        )}

        {/* TAB 3: LIBRARY */}
        {mobileTab === 'library' && (
          <div className="p-4 space-y-4 spf-page-enter">
            {/* Header */}
            <div className="flex items-center justify-between pt-1 gap-2 flex-nowrap">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <button
                  onClick={() => setIsProfileDrawerOpen(true)}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#242424] overflow-hidden flex items-center justify-center text-[#b3b3b3] hover:text-white cursor-pointer active:scale-95 transition-transform shrink-0"
                >
                  {user?.images?.[0]?.url ? (
                    <img src={user.images[0].url} alt={user.display_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-bold text-xs text-white">
                      {(user?.display_name || 'J').charAt(0).toUpperCase()}
                    </span>
                  )}
                </button>
                <h1 className="text-xl sm:text-2xl font-black text-white font-['SpotifyMixUITitle'] truncate">
                  Tu biblioteca
                </h1>
              </div>

              {/* Real Spotify Mobile Library Header Controls: Search Lupa + Create Button */}
              <div className="flex items-center gap-1 shrink-0">
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

            {/* Filter Chips (Fits cleanly on mobile with zero scroll) */}
            <div className="grid grid-cols-3 gap-2 w-full pb-1">
              {[
                { id: 'playlists', label: 'Playlists' },
                { id: 'artists', label: 'Artistas' },
                { id: 'downloaded', label: 'Descargas' },
              ].map((chip) => {
                const isSelected = libraryFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    onClick={() => setLibraryFilter(isSelected ? 'all' : (chip.id as any))}
                    className={`h-8 px-2 rounded-full text-xs font-bold transition-all text-center flex items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'bg-[#1ed760] text-black font-black shadow-sm'
                        : 'bg-white/10 text-white hover:bg-white/15'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* Subheader Toolbar: Sort (< | > rotated 90deg / Up-Down arrows) & View Mode (4-squares) */}
            {isAuthenticated && (
              <div className="flex items-center justify-between pt-2 pb-1.5 px-1 select-none">
                {/* Left: Sort Button with Spotify's official Up/Down arrows icon */}
                <button
                  type="button"
                  onClick={() => setIsMobileSortSheetOpen(true)}
                  className="flex items-center gap-2 text-white/90 hover:text-white active:scale-95 transition-all text-xs font-bold cursor-pointer group"
                  aria-label="Ordenar biblioteca"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-white/80 group-hover:text-white shrink-0">
                    <path d="M11 1.75a.75.75 0 0 1 .75.75v8.69l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l1.72 1.72V2.5a.75.75 0 0 1 .75-.75m-6 12.5a.75.75 0 0 1-.75-.75V4.81L2.53 6.53a.75.75 0 0 1-1.06-1.06l3-3a.75.75 0 0 1 1.06 0l3 3a.75.75 0 0 1-1.06 1.06L5.75 4.81v8.69a.75.75 0 0 1-.75.75" />
                  </svg>
                  <span className="truncate">{getSortLabel()}</span>
                </button>

                {/* Right: Direct View Mode Toggle Button (Cycles lista -> cuadricula -> compacta -> lista) */}
                <button
                  type="button"
                  onClick={() => {
                    if (viewMode === 'lista') {
                      setViewMode('cuadricula');
                    } else if (viewMode === 'cuadricula' || viewMode === 'cuadricula-compacta') {
                      setViewMode('compacta');
                    } else {
                      setViewMode('lista');
                    }
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white/80 hover:text-white active:scale-90 transition-all cursor-pointer"
                  aria-label="Cambiar vista de biblioteca"
                  title="Cambiar vista"
                >
                  {viewMode === 'cuadricula' || viewMode === 'cuadricula-compacta' ? (
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M1 1h6v6H1zm1.5 1.5v3h3v-3zM1 9h6v6H1zm1.5 1.5v3h3v-3zM9 1h6v6H9zm1.5 1.5v3h3v-3zM9 9h6v6H9zm1.5 1.5v3h3v-3z" />
                    </svg>
                  ) : viewMode === 'compacta' ? (
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M15.5 13.5H.5V12h15zm0-4.75H.5v-1.5h15zm0-4.75H.5V2.5h15z" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M15 14.5H5V13h10zm0-5.75H5v-1.5h10zM15 3H5V1.5h10zM3 3H1V1.5h2zm0 11.5H1V13h2zm0-5.75H1v-1.5h2z" />
                    </svg>
                  )}
                </button>
              </div>
            )}

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

                {/* Archivos locales also accessible when signed out */}
                <div
                  onClick={() => setMobileTab('local')}
                  className="w-full flex items-center gap-3 p-3 mt-6 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 cursor-pointer transition-colors text-left"
                >
                  <LocalFilesCover size={48} className="rounded-[4px] shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-white text-sm truncate">Archivos locales</span>
                    <span className="text-xs text-[#b3b3b3] mt-0.5 flex items-center gap-1">
                      <DownloadActiveCircleNativeIcon size={12} className="text-[#1ed760]" />
                      Playlist • {localCount} {localCount === 1 ? 'canción' : 'canciones'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (() => {
              const isGrid = viewMode === 'cuadricula' || viewMode === 'cuadricula-compacta';
              const isCompact = viewMode === 'compacta';
              const deletedIds = getDeletedPlaylistIds();
              let list = playlists.filter((p) => !deletedIds.has(p.id));
              if (libraryFilter === 'downloaded') {
                const downloaded = getDownloadedPlaylists();
                const existingIds = new Set(list.map((p) => p.id));
                const extra = downloaded.filter((d) => !existingIds.has(d.id));
                list = [...list, ...extra];
              }
              list = list
                .filter(
                  (p) =>
                    !deletedIds.has(p.id) &&
                    !p.id.includes('collection:tracks') &&
                    !p.id.includes('collection-tracks') &&
                    p.id !== 'liked-songs' &&
                    p.id !== 'user-liked-songs' &&
                    p.id !== 'tracks' &&
                    !/^(canciones que te gustan|canciones que me gustan|tus me gusta|liked songs|liked tracks|favoritas|favorites)$/i.test((p.name || '').trim()) &&
                    p.id !== 'spotify-dj' &&
                    p.id !== 'dj' &&
                    p.name?.toLowerCase().trim() !== 'dj'
                )
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

              if (sortOrder === 'alfabetico') {
                list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
              } else if (sortOrder === 'creador') {
                list.sort((a, b) =>
                  (a.owner?.display_name || '').localeCompare(b.owner?.display_name || '')
                );
              } else if (sortOrder === 'anadidos') {
                list.reverse();
              }

              if (isGrid) {
                return (
                  <div className="grid grid-cols-2 gap-3 pt-2 pb-6">
                    {/* Liked songs card */}
                    {(libraryFilter === 'all' || libraryFilter === 'playlists' || (libraryFilter === 'downloaded' && isPlaylistDownloaded('liked-songs'))) && (
                      <div
                        onClick={() =>
                          handleSelectPlaylistById(
                            'liked-songs',
                            'Canciones que te gustan',
                            'https://misc.scdn.co/liked-songs/liked-songs-640.jpg'
                          )
                        }
                        className="p-2 rounded-lg hover:bg-white/10 active:bg-white/15 cursor-pointer flex flex-col transition-colors group select-none"
                      >
                        <img
                          src="https://misc.scdn.co/liked-songs/liked-songs-640.jpg"
                          alt="Canciones que te gustan"
                          onError={handleImageError}
                          className="w-full aspect-square rounded-[6px] object-cover shadow-md shrink-0"
                        />
                        <span className="font-bold text-white text-sm truncate mt-2">
                          Canciones que te gustan
                        </span>
                        <span className="text-xs text-[#b3b3b3] mt-0.5 truncate">
                          Playlist • {playlists.find((p) => p.id === 'liked-songs')?.tracks?.total || getCustomLikedSongs().length || 0} canciones
                        </span>
                      </div>
                    )}

                    {/* Spotify Official DJ Playlist Card */}
                    {(libraryFilter === 'all' || libraryFilter === 'playlists') && (
                      <div
                        onClick={() => setMobileTab('dj')}
                        className="p-2 rounded-lg hover:bg-white/10 active:bg-white/15 cursor-pointer flex flex-col transition-colors group select-none"
                      >
                        <img
                          src={SPOTIFY_DJ_COVER_IMAGE}
                          alt="DJ"
                          onError={handleImageError}
                          className="w-full aspect-square rounded-[6px] object-cover shadow-md shrink-0"
                        />
                        <span className="font-bold text-white text-sm truncate mt-2 flex items-center gap-1.5">
                          <span>DJ</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760] animate-pulse" />
                        </span>
                        <span className="text-xs text-[#b3b3b3] mt-0.5 truncate">
                          Playlist • Hecho para ti
                        </span>
                      </div>
                    )}

                    {/* Playlists and Artists in Grid */}
                    {list.map((pl) => {
                      const isArt = checkIsMobileArtist(pl);
                      const isLongPressed = longPressedPlaylistId === pl.id;

                      return (
                        <div
                          key={pl.id}
                          onTouchStart={() => startLongPress(pl)}
                          onTouchEnd={cancelLongPress}
                          onTouchMove={cancelLongPress}
                          onMouseDown={() => startLongPress(pl)}
                          onMouseUp={cancelLongPress}
                          onMouseLeave={cancelLongPress}
                          onClick={() => {
                            if (longPressedPlaylistId) {
                              setLongPressedPlaylistId(null);
                              return;
                            }
                            cancelLongPress();
                            handleSelectPlaylistById(pl.id, pl.name, pl.images?.[0]?.url);
                          }}
                          className={`p-2 rounded-lg hover:bg-white/10 active:bg-white/15 cursor-pointer flex flex-col transition-colors relative group select-none ${
                            isLongPressed ? 'bg-white/15 z-30' : ''
                          }`}
                        >
                          <img
                            src={getPlaylistCover(pl)}
                            alt={pl.name}
                            onError={onPlaylistCoverError(pl)}
                            className={`w-full aspect-square object-cover bg-[#242424] shadow-md shrink-0 ${
                              isArt ? 'rounded-full' : 'rounded-[6px]'
                            }`}
                          />
                          <div className="flex items-center justify-between mt-2 min-w-0">
                            <span className="font-bold text-white text-sm truncate">
                              {pl.name}
                            </span>
                            {isLongPressed && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPlaylistOptions(pl);
                                }}
                                className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white shrink-0 ml-1"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                  <circle cx="5" cy="12" r="2" />
                                  <circle cx="12" cy="12" r="2" />
                                  <circle cx="19" cy="12" r="2" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <span className="text-xs text-[#b3b3b3] mt-0.5 truncate">
                            {isArt ? 'Artista' : `Playlist • ${pl.owner?.display_name || user?.display_name || 'Spotify'}`}
                          </span>
                        </div>
                      );
                    })}

                    {/* Archivos locales in Grid */}
                    {(libraryFilter === 'all' || libraryFilter === 'playlists' || libraryFilter === 'downloaded') && (
                      <div
                        onClick={() => setMobileTab('local')}
                        className="p-2 rounded-lg hover:bg-white/10 active:bg-white/15 cursor-pointer flex flex-col transition-colors select-none"
                      >
                        <div
                          className="w-full aspect-square rounded-[6px] flex items-center justify-center shadow-md overflow-hidden"
                          style={{ background: 'linear-gradient(135deg, #1e3264 0%, #1ed760 100%)' }}
                        >
                          <svg width="40%" height="40%" viewBox="0 0 24 24" fill="white">
                            <path d="M3 5a2 2 0 0 1 2-2h4.6l2 2H19a2 2 0 0 1 2 2v1H3zm-0 4h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm11 2v4.27A2 2 0 1 0 15 17v-4h2v-2z" />
                          </svg>
                        </div>
                        <span className="font-bold text-white text-sm truncate mt-2">Archivos locales</span>
                        <span className="text-xs text-[#b3b3b3] mt-0.5 flex items-center gap-1">
                          <DownloadActiveCircleNativeIcon size={12} className="text-[#1ed760]" />
                          <span>Playlist • {localCount} {localCount === 1 ? 'canción' : 'canciones'}</span>
                        </span>
                      </div>
                    )}

                    {/* Spotify Native "Añadir a tu biblioteca" Card in Grid */}
                    <div
                      onClick={() => setIsAddLibraryModalOpen(true)}
                      className="p-2 rounded-lg hover:bg-white/5 active:bg-white/10 cursor-pointer flex flex-col items-center justify-center text-center aspect-square rounded-[6px] border border-dashed border-white/20 select-none transition-colors"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#242424] flex items-center justify-center text-white/80 mb-2 shadow-sm">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M11 4.5a1 1 0 0 1 2 0v6.5H19.5a1 1 0 0 1 0 2H13V19.5a1 1 0 0 1-2 0V13H4.5a1 1 0 0 1 0-2H11V4.5z" />
                        </svg>
                      </div>
                      <span className="text-xs font-bold text-white/80">Añadir más</span>
                    </div>
                  </div>
                );
              }

              // List / Compact rendering
              return (
                <div className={`pt-1 ${isCompact ? 'space-y-0.5' : 'space-y-1.5'}`}>
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
                      className={`flex items-center gap-3 rounded-lg hover:bg-white/10 active:bg-white/15 cursor-pointer transition-colors ${
                        isCompact ? 'p-1.5' : 'p-2'
                      }`}
                    >
                      <img
                        src="https://misc.scdn.co/liked-songs/liked-songs-640.jpg"
                        alt="Canciones que te gustan"
                        onError={handleImageError}
                        className={`${isCompact ? 'w-10 h-10' : 'w-14 h-14'} rounded-[4px] object-cover shadow shrink-0`}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-white text-sm truncate">
                          Canciones que te gustan
                        </span>
                        <span className="text-xs text-[#b3b3b3] mt-0.5">
                          Playlist • {playlists.find((p) => p.id === 'liked-songs')?.tracks?.total || getCustomLikedSongs().length || 0} canciones
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Spotify Official DJ Playlist Card */}
                  {(libraryFilter === 'all' || libraryFilter === 'playlists') && (
                    <div
                      onClick={() => setMobileTab('dj')}
                      className={`flex items-center gap-3 rounded-lg hover:bg-white/10 active:bg-white/15 cursor-pointer transition-colors ${
                        isCompact ? 'p-1.5' : 'p-2'
                      }`}
                    >
                      <img
                        src={SPOTIFY_DJ_COVER_IMAGE}
                        alt="DJ"
                        onError={handleImageError}
                        className={`${isCompact ? 'w-10 h-10' : 'w-14 h-14'} rounded-[4px] object-cover shadow shrink-0`}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-white text-sm truncate flex items-center gap-1.5">
                          <span>DJ</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760] animate-pulse" />
                        </span>
                        <span className="text-xs text-[#b3b3b3] mt-0.5">
                          Playlist • Hecho para ti
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Outside Dismiss Backdrop when any item is long-pressed */}
                  {longPressedPlaylistId && (
                    <div
                      className="fixed inset-0 z-20 bg-transparent"
                      onClick={() => setLongPressedPlaylistId(null)}
                    />
                  )}

                  {/* Playlists and Artists in List */}
                  {list.map((pl) => {
                    const isArt = checkIsMobileArtist(pl);
                    const isLongPressed = longPressedPlaylistId === pl.id;

                    return (
                      <div
                        key={pl.id}
                        onTouchStart={() => startLongPress(pl)}
                        onTouchEnd={cancelLongPress}
                        onTouchMove={cancelLongPress}
                        onMouseDown={() => startLongPress(pl)}
                        onMouseUp={cancelLongPress}
                        onMouseLeave={cancelLongPress}
                        onClick={() => {
                          if (longPressedPlaylistId) {
                            setLongPressedPlaylistId(null);
                            return;
                          }
                          cancelLongPress();
                          handleSelectPlaylistById(pl.id, pl.name, pl.images?.[0]?.url);
                        }}
                        className={`flex items-center justify-between rounded-lg hover:bg-white/10 active:bg-white/15 cursor-pointer transition-colors relative group select-none ${
                          isCompact ? 'p-1.5' : 'p-2'
                        } ${isLongPressed ? 'bg-white/15 z-30' : ''}`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                          <img
                            src={getPlaylistCover(pl)}
                            alt={pl.name}
                            onError={onPlaylistCoverError(pl)}
                            className={`${isCompact ? 'w-10 h-10' : 'w-14 h-14'} object-cover bg-[#242424] shadow shrink-0 ${
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

                        {/* Animated 3-Dots on Long Press */}
                        {isLongPressed && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPlaylistOptions(pl);
                            }}
                            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 active:scale-90 flex items-center justify-center text-white shrink-0 animate-in zoom-in-75 duration-200 transition-all cursor-pointer shadow-lg"
                            title="Opciones de la lista"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="5" cy="12" r="2" />
                              <circle cx="12" cy="12" r="2" />
                              <circle cx="19" cy="12" r="2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Archivos locales in List */}
                  {(libraryFilter === 'all' || libraryFilter === 'playlists' || libraryFilter === 'downloaded') && (
                    <div
                      onClick={() => setMobileTab('local')}
                      className={`flex items-center gap-3 rounded-lg hover:bg-white/10 active:bg-white/15 cursor-pointer transition-colors ${
                        isCompact ? 'p-1.5' : 'p-2'
                      }`}
                    >
                      <LocalFilesCover size={isCompact ? 40 : 56} className="rounded-[4px] shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-white text-sm truncate">Archivos locales</span>
                        <span className="text-xs text-[#b3b3b3] mt-0.5 flex items-center gap-1">
                          <DownloadActiveCircleNativeIcon size={12} className="text-[#1ed760]" />
                          Playlist • {localCount} {localCount === 1 ? 'canción' : 'canciones'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Spotify Native "Añadir a tu biblioteca" Row in List */}
                  <div
                    onClick={() => setIsAddLibraryModalOpen(true)}
                    className="mt-3 p-2.5 rounded-xl flex items-center gap-3.5 hover:bg-white/5 active:bg-white/10 cursor-pointer transition-all active:scale-[0.99] group bg-white/[0.02]"
                  >
                    <div className={`${isCompact ? 'w-10 h-10' : 'w-14 h-14'} rounded-full bg-[#242424] group-hover:bg-[#2e2e2e] flex items-center justify-center text-white/80 group-hover:text-white transition-colors shrink-0 shadow-sm border border-white/5`}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
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
              );
            })()}
          </div>
        )}

        {/* TAB 4: PLAYLIST VIEW */}
        {mobileTab === 'playlist' && selectedPlaylist && (
          <div key={selectedPlaylist.id} className="spf-page-push min-h-full">
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
          <div className="spf-page-push min-h-full">
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
          <div className="spf-page-push min-h-full">
            <MobileSettingsView
              onBack={() => setMobileTab('home')}
              onOpenProfile={() => setMobileTab('profile')}
            />
          </div>
        )}

        {/* RECENTES VIEW */}
        {mobileTab === 'recents' && (
          <div className="spf-page-push min-h-full">
            <MobileRecentsView
              onBack={() => setMobileTab('home')}
              onSelectPlaylist={(pl) => {
                setSelectedPlaylist(pl);
                setMobileTab('playlist');
              }}
              onSelectPlaylistById={handleSelectPlaylistById}
            />
          </div>
        )}

        {/* ESTADÍSTICAS VIEW */}
        {mobileTab === 'stats' && (
          <div className="spf-page-push min-h-full">
            <MobileStatsView
              onBack={() => setMobileTab('home')}
              onSelectArtist={(artistName) => {
                handleSelectPlaylistById(`art-${artistName.toLowerCase().replace(/\s+/g, '-')}`, artistName);
              }}
            />
          </div>
        )}

        {mobileTab === 'local' && (
          <div className="spf-page-push min-h-full">
            <LocalFilesView isMobile onBack={() => setMobileTab('library')} />
          </div>
        )}

        {/* TAB 7: DEDICATED SPOTIFY AI DJ VIEW */}
        {mobileTab === 'dj' && (
          <div className="h-full w-full overflow-hidden flex flex-col">
            <AIDJView
              isMobile
              onBack={() => setMobileTab('home')}
              onOpenPlayer={() => setIsFullPlayerOpen(true)}
            />
          </div>
        )}
      </div>

      {/* Docked Mini Player right above Bottom Navigation (hidden during full DJ mode) */}
      {mobileTab !== 'dj' && (
        <MobileMiniPlayer
          onOpenFullPlayer={() => {
            setIsFullPlayerOpen(true);
          }}
        />
      )}

      {/* Full-screen Now Playing Modal */}
      {isFullPlayerOpen && (
        <MobileNowPlayingModal
          isOpen={isFullPlayerOpen}
          onClose={() => setIsFullPlayerOpen(false)}
          onSelectPlaylistById={handleSelectPlaylistById}
        />
      )}

      {/* Exact Spotify Mobile 4-Tab Bottom Navigation Bar (hidden during full DJ mode) */}
      {mobileTab !== 'dj' && (
        <MobileBottomNav
          activeTab={
            mobileTab === 'search'
              ? 'search'
              : mobileTab === 'library' || mobileTab === 'local'
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
      )}

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

      {/* Mobile Playlist Long-Press Actions Bottom Sheet */}
      <MobileSheet
        open={!!playlistMenuTarget}
        onClose={() => {
          setIsEditingTarget(false);
          setPlaylistMenuTarget(null);
        }}
      >
        {playlistMenuTarget && (
          <>
            <SheetHeader
              image={editTargetCover || getPlaylistCover(playlistMenuTarget)}
              title={playlistMenuTarget.name}
              subtitle={playlistMenuTarget.owner?.display_name || user?.display_name || 'Spotify'}
            />

            {isEditingTarget ? (
              /* Inline Edit Mode */
              <div className="space-y-3.5 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-[#b3b3b3] uppercase tracking-wider block mb-1">
                    URL de la carátula
                  </label>
                  <input
                    type="text"
                    value={editTargetCover}
                    onChange={(e) => setEditTargetCover(e.target.value)}
                    placeholder="https://..."
                    className="w-full h-10 px-3 bg-[#181818] text-white text-xs rounded-xl outline-none border border-white/15 focus:border-[#1ed760]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#b3b3b3] uppercase tracking-wider block mb-1">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={editTargetName}
                    onChange={(e) => setEditTargetName(e.target.value)}
                    placeholder="Nombre de la playlist..."
                    className="w-full h-10 px-3 bg-[#181818] text-white text-sm font-bold rounded-xl outline-none border border-white/15 focus:border-[#1ed760]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#b3b3b3] uppercase tracking-wider block mb-1">
                    Descripción (opcional)
                  </label>
                  <textarea
                    value={editTargetDesc}
                    onChange={(e) => setEditTargetDesc(e.target.value)}
                    rows={2}
                    placeholder="Añade una descripción..."
                    className="w-full p-2.5 bg-[#181818] text-white text-xs rounded-xl outline-none border border-white/15 focus:border-[#1ed760] resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setIsEditingTarget(false)}
                    className="flex-1 py-2.5 rounded-full bg-white/10 text-white font-bold text-xs hover:bg-white/15 active:scale-95 transition-all"
                  >
                    Volver
                  </button>
                  <button
                    onClick={handleSavePlaylistEdit}
                    className="flex-1 py-2.5 rounded-full bg-[#1ed760] text-black font-black text-xs hover:scale-102 active:scale-95 shadow transition-all"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <SheetList>
                <SheetItem icon={<QueueNativeIcon size={20} className="text-white" />} label="Añadir a la cola" onClick={handleAddToQueueTarget} />

                <SheetItem
                  icon={
                    isPlaylistDownloaded(playlistMenuTarget.id) ? (
                      <DownloadActiveCircleNativeIcon size={22} className="text-[#1ed760]" />
                    ) : (
                      <DownloadCircleNativeIcon size={22} className="text-white" />
                    )
                  }
                  label={isPlaylistDownloaded(playlistMenuTarget.id) ? 'Eliminar descarga' : 'Descargar'}
                  onClick={handleToggleDownloadTarget}
                />

                {playlistMenuTarget.id !== 'liked-songs' && !playlistMenuTarget.id.includes('collection:tracks') && (
                  <SheetItem icon={<EditNativeIcon size={20} className="text-white" />} label="Editar detalles" onClick={() => setIsEditingTarget(true)} />
                )}

                <SheetItem icon={<ShareNativeIcon size={20} className="text-white" />} label="Compartir playlist" onClick={handleSharePlaylistTarget} />

                <SheetItem
                  danger
                  icon={
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
                  }
                  label="Eliminar de tu biblioteca"
                  onClick={() => handleDeletePlaylist(playlistMenuTarget.id)}
                />
              </SheetList>
            )}
          </>
        )}
      </MobileSheet>

      {/* Mobile Sort Bottom Sheet (Spotify Official "Ordenar por") */}
      <MobileSheet open={isMobileSortSheetOpen} onClose={() => setIsMobileSortSheetOpen(false)}>
        {/* Spotify's sheet: plain rows, the chosen one green with a check; then "Ver como" */}
        <div className="font-['SpotifyMixUI']">
          <h3 className="px-1 pb-2 text-[17px] font-bold text-white font-['SpotifyMixUITitle']">Ordenar por</h3>
          <div role="radiogroup" aria-label="Ordenar por">
            {[
              { id: 'recientes', label: 'Recientes' },
              { id: 'anadidos', label: 'Añadidos recientemente' },
              { id: 'alfabetico', label: 'Alfabético' },
              { id: 'creador', label: 'Creador' },
            ].map((item) => {
              const isSelected = sortOrder === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    setSortOrder(item.id as any);
                    setTimeout(() => setIsMobileSortSheetOpen(false), 120);
                  }}
                  className="w-full flex items-center justify-between -mx-2 px-3 py-3.5 rounded-lg text-left active:bg-white/[0.06] transition-colors cursor-pointer" style={{ width: 'calc(100% + 16px)' }}
                >
                  <span className={`text-[16px] transition-colors ${isSelected ? 'text-[#1ed760] font-bold' : 'text-white'}`}>{item.label}</span>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    className={`text-[#1ed760] shrink-0 transition-all duration-200 ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
                  >
                    <path d="M15.53 2.47a.75.75 0 0 1 0 1.06L4.907 14.153.47 9.716a.75.75 0 0 1 1.06-1.06l3.377 3.376L14.47 2.47a.75.75 0 0 1 1.06 0" />
                  </svg>
                </button>
              );
            })}
          </div>
          <div className="my-2 h-px bg-white/10" />
          <div className="px-1 pt-1 flex items-center justify-between">
            <span className="text-[16px] text-white">Ver como</span>
            <div className="flex items-center gap-1 bg-[#2a2a2a] rounded-full p-1">
              {(
                [
                  { id: 'lista', label: 'Lista', d: 'M15 14.5H5V13h10zm0-5.75H5v-1.5h10zM15 3H5V1.5h10zM3 3H1V1.5h2zm0 11.5H1V13h2zm0-5.75H1v-1.5h2z' },
                  { id: 'cuadricula', label: 'Cuadrícula', d: 'M1 1h6v6H1zm1.5 1.5v3h3v-3zM1 9h6v6H1zm1.5 1.5v3h3v-3zM9 1h6v6H9zm1.5 1.5v3h3v-3zM9 9h6v6H9zm1.5 1.5v3h3v-3z' },
                ] as const
              ).map((v) => {
                const on = viewMode === v.id || (v.id === 'lista' && viewMode !== 'cuadricula' && viewMode !== 'cuadricula-compacta');
                return (
                  <button
                    key={v.id}
                    type="button"
                    aria-label={v.label}
                    aria-pressed={on}
                    onClick={() => setViewMode(v.id as any)}
                    className={`w-9 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                      on ? 'bg-white text-black' : 'text-[#b3b3b3] active:text-white'
                    }`}
                  >
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                      <path d={v.d} />
                    </svg>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </MobileSheet>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#282828] text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-2xl border border-white/10 animate-in fade-in zoom-in-95 duration-200">
          {toastMessage}
        </div>
      )}

      {/* Spotify Profile Side Drawer (Slides in from the left) */}
      <MobileProfileDrawer
        isOpen={isProfileDrawerOpen}
        onClose={() => setIsProfileDrawerOpen(false)}
        onNavigate={(tab) => {
          setIsProfileDrawerOpen(false);
          setMobileTab(tab);
        }}
        onOpenSharedSession={() => {
          setIsProfileDrawerOpen(false);
          useSharedSessionStore.getState().setModalOpen(true);
        }}
        onOpenNotifications={() => {
          setIsProfileDrawerOpen(false);
          setIsNotificationsOpen(true);
        }}
        onOpenLogin={() => {
          setIsProfileDrawerOpen(false);
          openLoginModal();
        }}
      />

      {/* Global Login / Cookie modal */}
      <LoginModal />
    </div>
  );
};
