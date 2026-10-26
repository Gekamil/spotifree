import { create } from 'zustand';
import type { Playlist } from '../types/spotify';

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
  contextMenu: ContextMenuState;
  activeRightSidebar: 'none' | 'queue' | 'lyrics' | 'now-playing' | 'friends';
  sortOrder: 'recientes' | 'anadidos' | 'alfabetico' | 'creador';
  viewMode: 'compacta' | 'lista' | 'cuadricula-compacta' | 'cuadricula';
  searchQuery: string;
  activeMainTab: 'home' | 'search' | 'playlist' | 'settings';

  // Actions
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
  toggleRightSidebar: (sidebar: 'queue' | 'lyrics' | 'now-playing' | 'friends') => void;
  closeRightSidebar: () => void;
  setSortOrder: (order: 'recientes' | 'anadidos' | 'alfabetico' | 'creador') => void;
  setViewMode: (mode: 'compacta' | 'lista' | 'cuadricula-compacta' | 'cuadricula') => void;
  setSearchQuery: (query: string) => void;
  setActiveMainTab: (tab: 'home' | 'search' | 'playlist' | 'settings') => void;
  closeAllModals: () => void;
}

const store = create<UIState>((set) => ({
  isProfileOpen: false,
  isCreateMenuOpen: false,
  isSortMenuOpen: false,
  isEditPlaylistModalOpen: false,
  editingPlaylist: null,
  isSettingsModalOpen: false,
  contextMenu: { isOpen: false, x: 0, y: 0, trackId: null, playlistId: null },
  activeRightSidebar: 'none',
  sortOrder: 'recientes',
  viewMode: 'lista',
  searchQuery: '',
  activeMainTab: 'home',

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
      playlist.id.includes('collection:tracks') ||
      playlist.name?.toLowerCase().trim() === 'canciones que te gustan';
    const isEditorialOrAlbum =
      playlist.id.startsWith('37i9dQ') ||
      playlist.id === '37i9dQZF1DWZdsS73T1ogG' ||
      playlist.id === '37i9dQZF1DX2EiUAL7Wdfc' ||
      playlist.id === '4f0YTBqSbvM1iJpuY9r3yQ' ||
      playlist.id === 'zizi' ||
      playlist.id === '3x7gz85amxEplGx7LQxE7Z' ||
      playlist.id === 'romeo-santos' ||
      playlist.id === 'el-nuevo-urbano' ||
      playlist.id === 'miticas' ||
      playlist.id === 'nueva-carpeta' ||
      playlist.description?.toLowerCase() === 'artista' ||
      (playlist as any).type === 'artist' ||
      (playlist as any).type === 'album' ||
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
      contextMenu: { isOpen: false, x: 0, y: 0, trackId: null, playlistId: null },
    }),
}));

export const useUIStore =
  typeof window !== 'undefined' && (window as any).__useUIStore
    ? ((window as any).__useUIStore as typeof store)
    : store;

if (typeof window !== 'undefined') {
  (window as any).__useUIStore = useUIStore;
}
