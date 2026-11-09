import { create } from 'zustand';
import type { Playlist, Track } from '../types/spotify';

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  trackId: string | null;
  playlistId: string | null;
}

interface UIState {
  isProfileOpen: boolean;
  isCreateMenuOpen: boolean;
  isSortMenuOpen: boolean;
  isEditPlaylistModalOpen: boolean;
  editingPlaylist: Playlist | null;
  isSettingsModalOpen: boolean;
  isLoginModalOpen: boolean;
  isImportModalOpen: boolean;
  isTasteOnboardingOpen: boolean;
  isAddToPlaylistModalOpen: boolean;
  trackForAddToPlaylist: Track | null;
  contextMenu: ContextMenuState;
  activeRightSidebar: 'none' | 'queue' | 'lyrics' | 'now-playing' | 'friends';
  sortOrder: 'recientes' | 'anadidos' | 'alfabetico' | 'creador';
  viewMode: 'compacta' | 'lista' | 'cuadricula-compacta' | 'cuadricula';
  searchQuery: string;
  activeMainTab: 'home' | 'search' | 'playlist' | 'settings' | 'guide' | 'profile' | 'dj' | 'local';
  theme: 'standard' | 'oled' | 'platinum';
  convertPhotosToBanners: boolean;

  // Actions
  setTheme: (theme: 'standard' | 'oled' | 'platinum') => void;
  setConvertPhotosToBanners: (val: boolean) => void;
  toggleProfile: () => void;
  closeProfile: () => void;
  toggleCreateMenu: () => void;
  closeCreateMenu: () => void;
  toggleSortMenu: () => void;
  closeSortMenu: () => void;
  openContextMenu: (x: number, y: number, trackId?: string, playlistId?: string) => void;
  closeContextMenu: () => void;
  openEditPlaylistModal: (playlist: Playlist) => void;
  closeEditPlaylistModal: () => void;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  openImportModal: () => void;
  closeImportModal: () => void;
  openTasteOnboarding: () => void;
  closeTasteOnboarding: () => void;
  openAddToPlaylistModal: (track: Track) => void;
  closeAddToPlaylistModal: () => void;
  toggleRightSidebar: (sidebar: 'queue' | 'lyrics' | 'now-playing' | 'friends') => void;
  closeRightSidebar: () => void;
  setSortOrder: (order: 'recientes' | 'anadidos' | 'alfabetico' | 'creador') => void;
  setViewMode: (mode: 'compacta' | 'lista' | 'cuadricula-compacta' | 'cuadricula') => void;
  setSearchQuery: (query: string) => void;
  setActiveMainTab: (tab: 'home' | 'search' | 'playlist' | 'settings' | 'guide' | 'profile' | 'dj' | 'local') => void;
  closeAllModals: () => void;
}

const store = create<UIState>((set) => ({
  isProfileOpen: false,
  isCreateMenuOpen: false,
  isSortMenuOpen: false,
  isEditPlaylistModalOpen: false,
  editingPlaylist: null,
  isSettingsModalOpen: false,
  isLoginModalOpen: false,
  isImportModalOpen: false,
  isTasteOnboardingOpen: false,
  isAddToPlaylistModalOpen: false,
  trackForAddToPlaylist: null,
  contextMenu: { isOpen: false, x: 0, y: 0, trackId: null, playlistId: null },
  activeRightSidebar: 'none',
  sortOrder: 'recientes',
  viewMode: 'lista',
  searchQuery: '',
  activeMainTab: 'home',
  theme: (typeof window !== 'undefined' ? (window.localStorage.getItem('spotifree_theme') as any) : 'standard') || 'standard',
  convertPhotosToBanners: typeof window !== 'undefined' ? window.localStorage.getItem('spotifree_convert_photos_to_banners') === 'true' : false,

  setConvertPhotosToBanners: (val: boolean) => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('spotifree_convert_photos_to_banners', String(val));
      } catch {}
    }
    set({ convertPhotosToBanners: val });
  },

  setTheme: (theme: 'standard' | 'oled' | 'platinum') => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('spotifree_theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
      } catch {}
    }
    set({ theme });
  },

  toggleProfile: () => set((s) => ({ isProfileOpen: !s.isProfileOpen, isCreateMenuOpen: false, isSortMenuOpen: false })),
  closeProfile: () => set({ isProfileOpen: false }),

  toggleCreateMenu: () => set((s) => ({ isCreateMenuOpen: !s.isCreateMenuOpen, isProfileOpen: false, isSortMenuOpen: false })),
  closeCreateMenu: () => set({ isCreateMenuOpen: false }),

  toggleSortMenu: () => set((s) => ({ isSortMenuOpen: !s.isSortMenuOpen, isProfileOpen: false, isCreateMenuOpen: false })),
  closeSortMenu: () => set({ isSortMenuOpen: false }),

  openContextMenu: (x: number, y: number, trackId = undefined, playlistId = undefined) =>
    set({
      contextMenu: { isOpen: true, x, y, trackId: trackId ?? null, playlistId: playlistId ?? null },
      isProfileOpen: false,
      isCreateMenuOpen: false,
      isSortMenuOpen: false,
    }),
  closeContextMenu: () => set({ contextMenu: { isOpen: false, x: 0, y: 0, trackId: null, playlistId: null } }),

  openEditPlaylistModal: (playlist: Playlist) => {
    const isLiked =
      playlist.id === 'liked-songs' ||
      playlist.id === 'tracks' ||
      playlist.id.includes('collection:tracks') ||
      playlist.id.includes('collection-tracks') ||
      /^(canciones que te gustan|canciones que me gustan|tus me gusta|liked songs|liked tracks|saved songs|saved tracks|favoritas|favorites|my favorites|favorite songs)$/i.test(
        (playlist.name || '').trim()
      );
    const isEditorialOrAlbum =
      playlist.id.startsWith('37i9dQ') ||
      playlist.id === 'nueva-carpeta' ||
      playlist.description?.toLowerCase() === 'artista' ||
      (playlist as any).type === 'artist' ||
      (playlist as any).type === 'album' ||
      playlist.id.startsWith('art-') ||
      playlist.id.startsWith('artist-') ||
      playlist.id.startsWith('alb-') ||
      playlist.id.startsWith('album-') ||
      playlist.owner?.id === 'spotify' ||
      playlist.owner?.display_name?.toLowerCase() === 'spotify';

    if (isLiked || isEditorialOrAlbum) {
      return;
    }
    set({
      isEditPlaylistModalOpen: true,
      editingPlaylist: playlist,
      contextMenu: { isOpen: false, x: 0, y: 0, trackId: null, playlistId: null },
    });
  },
  closeEditPlaylistModal: () => set({ isEditPlaylistModalOpen: false, editingPlaylist: null }),

  openSettingsModal: () =>
    set({
      isSettingsModalOpen: true,
      isProfileOpen: false,
      contextMenu: { isOpen: false, x: 0, y: 0, trackId: null, playlistId: null },
    }),
  closeSettingsModal: () => set({ isSettingsModalOpen: false }),

  openLoginModal: () => set({ isLoginModalOpen: true, isProfileOpen: false }),
  closeLoginModal: () => set({ isLoginModalOpen: false }),

  openImportModal: () => set({ isImportModalOpen: true, isProfileOpen: false }),
  closeImportModal: () => set({ isImportModalOpen: false }),
  openTasteOnboarding: () =>
    set({
      isTasteOnboardingOpen: true,
      isProfileOpen: false,
      isSettingsModalOpen: false,
      contextMenu: { isOpen: false, x: 0, y: 0, trackId: null, playlistId: null },
    }),
  closeTasteOnboarding: () => set({ isTasteOnboardingOpen: false }),
  openAddToPlaylistModal: (track: Track) => set({ isAddToPlaylistModalOpen: true, trackForAddToPlaylist: track }),
  closeAddToPlaylistModal: () => set({ isAddToPlaylistModalOpen: false, trackForAddToPlaylist: null }),

  toggleRightSidebar: (sidebar) =>
    set((s) => ({
      activeRightSidebar: s.activeRightSidebar === sidebar ? 'none' : sidebar,
    })),
  closeRightSidebar: () => set({ activeRightSidebar: 'none' }),

  setSortOrder: (order) => set({ sortOrder: order, isSortMenuOpen: false }),
  setViewMode: (mode) => set({ viewMode: mode, isSortMenuOpen: false }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setActiveMainTab: (tab) => set({ activeMainTab: tab }),

  closeAllModals: () =>
    set({
      isProfileOpen: false,
      isCreateMenuOpen: false,
      isSortMenuOpen: false,
      isEditPlaylistModalOpen: false,
      isSettingsModalOpen: false,
      isLoginModalOpen: false,
      isImportModalOpen: false,
      isTasteOnboardingOpen: false,
      isAddToPlaylistModalOpen: false,
      trackForAddToPlaylist: null,
      contextMenu: { isOpen: false, x: 0, y: 0, trackId: null, playlistId: null },
    }),
}));

export const useUIStore =
  typeof window !== 'undefined' && (window as any).__useUIStore
    ? ((window as any).__useUIStore as typeof store)
    : store;

if (typeof window !== 'undefined') {
  (window as any).__useUIStore = useUIStore;
  try {
    const savedTheme = window.localStorage.getItem('spotifree_theme') || 'standard';
    document.documentElement.setAttribute('data-theme', savedTheme);
  } catch {}
}
