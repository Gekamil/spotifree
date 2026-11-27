import { create } from 'zustand';
import type { Track } from '../types/spotify';

export interface SharedPlaylistPreviewData {
  code?: string;
  kind: 'collab' | 'snapshot' | 'public';
  playlistId: string;
  name: string;
  description: string;
  image: string;
  ownerId: string;
  ownerName: string;
  memberCount: number;
  tracks: Track[];
  collaborative: boolean;
  alreadyInLibrary: boolean;
}

interface PlaylistInviteState {
  isOpen: boolean;
  isLoading: boolean;
  isAccepting: boolean;
  pendingAcceptAfterAuth: boolean;
  collabCode: string | null;
  playlistId: string | null;
  shareCode: string | null;
  preview: SharedPlaylistPreviewData | null;
  error: string | null;
  openInviteLoading: (params: { collabCode?: string | null; playlistId?: string | null; shareCode?: string | null }) => void;
  setInvitePreview: (preview: SharedPlaylistPreviewData) => void;
  setInviteError: (error: string) => void;
  setAccepting: (accepting: boolean) => void;
  setPendingAcceptAfterAuth: (pending: boolean) => void;
  closeInvite: () => void;
}

export const usePlaylistInviteStore = create<PlaylistInviteState>((set) => ({
  isOpen: false,
  isLoading: false,
  isAccepting: false,
  pendingAcceptAfterAuth: false,
  collabCode: null,
  playlistId: null,
  shareCode: null,
  preview: null,
  error: null,

  openInviteLoading: ({ collabCode = null, playlistId = null, shareCode = null }) =>
    set({
      isOpen: true,
      isLoading: true,
      isAccepting: false,
      pendingAcceptAfterAuth: false,
      collabCode,
      playlistId,
      shareCode,
      preview: null,
      error: null,
    }),

  setInvitePreview: (preview) =>
    set({
      isLoading: false,
      preview,
      error: null,
    }),

  setInviteError: (error) =>
    set({
      isLoading: false,
      isAccepting: false,
      pendingAcceptAfterAuth: false,
      error,
    }),

  setAccepting: (isAccepting) => set({ isAccepting }),

  setPendingAcceptAfterAuth: (pendingAcceptAfterAuth) => set({ pendingAcceptAfterAuth }),

  closeInvite: () =>
    set({
      isOpen: false,
      isLoading: false,
      isAccepting: false,
      pendingAcceptAfterAuth: false,
      collabCode: null,
      playlistId: null,
      shareCode: null,
      preview: null,
      error: null,
    }),
}));
