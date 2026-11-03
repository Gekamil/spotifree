/**
 * Spotifree Shared Session (Sesión Compartida / Jam Room)
 * Real-time synchronized co-listening, collaborative playlist & music queue,
 * live multiplayer cursor presence, and guest role protection.
 */

import { create } from 'zustand';
import { db, isFirebaseConfigured } from './firebase';
import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  deleteField,
  type Unsubscribe,
} from 'firebase/firestore';
import type { Track } from '../types/spotify';
import { usePlayerStore } from '../store/usePlayerStore';

export interface SessionParticipant {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  lastSeen: number;
  cursor?: {
    pctX: number;
    pctY: number;
    updatedAt: number;
  };
}

export interface SessionPlaybackState {
  track: Track | null;
  isPlaying: boolean;
  progressMs: number;
  updatedAt: number;
  actionOrigin: string;
  queue?: Track[];
}

export interface SharedSessionData {
  id: string;
  hostUid: string;
  hostName: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  playback: SessionPlaybackState;
  participants: Record<string, SessionParticipant>;
}

export interface SharedSessionStore {
  isInSession: boolean;
  isHost: boolean;
  sessionId: string | null;
  sessionLink: string | null;
  hostName: string;
  myParticipantId: string;
  participants: SessionParticipant[];
  isModalOpen: boolean;
  setModalOpen: (open: boolean) => void;
  createSession: (userName?: string) => Promise<string | null>;
  joinSession: (sessionId: string, userName?: string) => Promise<boolean>;
  leaveSession: () => Promise<void>;
  terminateSession: () => Promise<void>;
  broadcastPlayback: (track: Track | null, isPlaying: boolean, progressMs: number) => Promise<void>;
  broadcastCursor: (pctX: number, pctY: number) => void;
  _subscribeToSessionDoc: (sessionId: string) => void;
}

const PARTICIPANT_COLORS = [
  '#1ed760', // Spotify Green
  '#ff4081', // Neon Pink
  '#00e5ff', // Cyan
  '#ffea00', // Electric Yellow
  '#b388ff', // Soft Purple
  '#ff9100', // Amber Orange
  '#00e676', // Bright Emerald
];

function getRandomColor(): string {
  return PARTICIPANT_COLORS[Math.floor(Math.random() * PARTICIPANT_COLORS.length)];
}

function generateSessionCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

let sessionDocUnsubscribe: Unsubscribe | null = null;
let lastCursorBroadcast = 0;
let lastPlaybackOrigin = '';

export const useSharedSessionStore = create<SharedSessionStore>((set, get) => ({
  isInSession: false,
  isHost: false,
  sessionId: null,
  sessionLink: null,
  hostName: '',
  myParticipantId: typeof window !== 'undefined' ? (window.localStorage.getItem('spotifree_session_pid') || `p_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`) : 'p_default',
  participants: [],
  isModalOpen: false,

  setModalOpen: (open: boolean) => set({ isModalOpen: open }),

  createSession: async (userName = 'Anfitrión') => {
    const { myParticipantId } = get();
    const sessionId = generateSessionCode();
    const color = PARTICIPANT_COLORS[0];
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const sessionLink = `${origin}/?session=${sessionId}`;

    const hostParticipant: SessionParticipant = {
      id: myParticipantId,
      name: userName || 'Anfitrión',
      color,
      isHost: true,
      lastSeen: Date.now(),
    };

    const initialPlayback: SessionPlaybackState = {
      track: usePlayerStore.getState().currentTrack,
      isPlaying: usePlayerStore.getState().isPlaying,
      progressMs: usePlayerStore.getState().progressMs,
      updatedAt: Date.now(),
      actionOrigin: myParticipantId,
      queue: usePlayerStore.getState().queue.slice(0, 50),
    };

    const sessionData: SharedSessionData = {
      id: sessionId,
      hostUid: myParticipantId,
      hostName: userName || 'Anfitrión',
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      playback: initialPlayback,
      participants: {
        [myParticipantId]: hostParticipant,
      },
    };

    // ALWAYS enter active session immediately so the UI transitions smoothly and presents the invite link!
    set({
      isInSession: true,
      isHost: true,
      sessionId,
      sessionLink,
      hostName: userName || 'Anfitrión',
      participants: [hostParticipant],
      isModalOpen: true,
    });

    if (isFirebaseConfigured() && db) {
      try {
        const sessionRef = doc(db, 'shared_sessions', sessionId);
        await setDoc(sessionRef, sessionData);
        get()._subscribeToSessionDoc(sessionId);
      } catch (e) {
        console.warn('[SharedSession] Firestore sync warning (session active locally):', e);
      }
    }

    return sessionId;
  },

  joinSession: async (sessionId: string, userName = 'Invitado') => {
    if (!sessionId || !sessionId.trim()) return false;
    const cleanId = sessionId.trim().toUpperCase();
    const { myParticipantId } = get();
    const color = getRandomColor();
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const sessionLink = `${origin}/?session=${cleanId}`;

    const guestParticipant: SessionParticipant = {
      id: myParticipantId,
      name: userName || 'Invitado',
      color,
      isHost: false,
      lastSeen: Date.now(),
    };

    if (isFirebaseConfigured() && db) {
      try {
        const sessionRef = doc(db, 'shared_sessions', cleanId);
        const snap = await getDoc(sessionRef);

        if (snap.exists()) {
          const data = snap.data() as SharedSessionData;
          if (data.isActive) {
            await updateDoc(sessionRef, {
              [`participants.${myParticipantId}`]: guestParticipant,
              updatedAt: Date.now(),
            });

            set({
              isInSession: true,
              isHost: false,
              sessionId: cleanId,
              sessionLink,
              hostName: data.hostName || 'Anfitrión',
              isModalOpen: true,
            });

            if (data.playback && data.playback.track) {
              const player = usePlayerStore.getState();
              player.playTrack(data.playback.track, data.playback.queue);
              if (!data.playback.isPlaying) {
                usePlayerStore.setState({ isPlaying: false });
                if (typeof window !== 'undefined' && (window as any).__audioEngine) {
                  (window as any).__audioEngine.pause();
                }
              }
            }

            get()._subscribeToSessionDoc(cleanId);
            return true;
          }
        }
      } catch (e) {
        console.warn('[SharedSession] Error joining via Firestore, fallback to local room:', e);
      }
    }

    // Direct room join
    set({
      isInSession: true,
      isHost: false,
      sessionId: cleanId,
      sessionLink,
      hostName: 'Anfitrión',
      participants: [guestParticipant],
      isModalOpen: true,
    });
    return true;
  },

  leaveSession: async () => {
    const { sessionId, myParticipantId } = get();
    if (sessionDocUnsubscribe) {
      sessionDocUnsubscribe();
      sessionDocUnsubscribe = null;
    }

    if (sessionId && db && isFirebaseConfigured()) {
      try {
        const sessionRef = doc(db, 'shared_sessions', sessionId);
        await updateDoc(sessionRef, {
          [`participants.${myParticipantId}`]: deleteField(),
        });
      } catch {}
    }

    // Clean URL query param
    if (typeof window !== 'undefined' && window.history) {
      const url = new URL(window.location.href);
      url.searchParams.delete('session');
      window.history.replaceState({}, '', url.toString());
    }

    set({
      isInSession: false,
      isHost: false,
      sessionId: null,
      sessionLink: null,
      participants: [],
      isModalOpen: false,
    });
  },

  terminateSession: async () => {
    const { sessionId, isHost } = get();
    if (!isHost) return;

    if (sessionId && db && isFirebaseConfigured()) {
      try {
        const sessionRef = doc(db, 'shared_sessions', sessionId);
        await updateDoc(sessionRef, {
          isActive: false,
          updatedAt: Date.now(),
        });
      } catch {}
    }

    get().leaveSession();
  },

  broadcastPlayback: async (track: Track | null, isPlaying: boolean, progressMs: number) => {
    const { isInSession, sessionId, myParticipantId } = get();
    if (!isInSession || !sessionId || !db) return;

    lastPlaybackOrigin = myParticipantId;

    try {
      const sessionRef = doc(db, 'shared_sessions', sessionId);
      await updateDoc(sessionRef, {
        playback: {
          track,
          isPlaying,
          progressMs,
          updatedAt: Date.now(),
          actionOrigin: myParticipantId,
          queue: usePlayerStore.getState().queue.slice(0, 50),
        },
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.warn('[SharedSession] Broadcast playback warning:', e);
    }
  },

  broadcastCursor: (pctX: number, pctY: number) => {
    const { isInSession, sessionId, myParticipantId } = get();
    if (!isInSession || !sessionId || !db) return;

    const now = Date.now();
    if (now - lastCursorBroadcast < 50) return; // Throttled to ~20fps for smooth motion & low network bandwidth
    lastCursorBroadcast = now;

    try {
      const sessionRef = doc(db, 'shared_sessions', sessionId);
      updateDoc(sessionRef, {
        [`participants.${myParticipantId}.cursor`]: {
          pctX: Math.round(pctX * 1000) / 1000,
          pctY: Math.round(pctY * 1000) / 1000,
          updatedAt: now,
        },
        [`participants.${myParticipantId}.lastSeen`]: now,
      }).catch(() => {});
    } catch {}
  },

  _subscribeToSessionDoc: (sessionId: string) => {
    if (sessionDocUnsubscribe) {
      sessionDocUnsubscribe();
      sessionDocUnsubscribe = null;
    }

    if (!db) return;
    const sessionRef = doc(db, 'shared_sessions', sessionId);

    sessionDocUnsubscribe = onSnapshot(sessionRef, (snap) => {
      if (!snap.exists()) {
        get().leaveSession();
        return;
      }

      const data = snap.data() as SharedSessionData;

      // Host ended session
      if (!data.isActive) {
        alert('La sesión compartida ha sido finalizada por el anfitrión.');
        get().leaveSession();
        return;
      }

      const { myParticipantId } = get();
      const participantsList = Object.values(data.participants || {});
      set({
        participants: participantsList,
        hostName: data.hostName || 'Anfitrión',
      });

      // Synchronize Playback if action came from another participant
      const pb = data.playback;
      if (pb && pb.actionOrigin !== myParticipantId && pb.actionOrigin !== lastPlaybackOrigin) {
        const player = usePlayerStore.getState();
        const curTrack = player.currentTrack;

        // 1. Track changed
        if (pb.track && pb.track.id !== curTrack?.id) {
          player.playTrack(pb.track, pb.queue);
        }

        // 2. Play/Pause state
        if (pb.isPlaying !== player.isPlaying) {
          usePlayerStore.setState({ isPlaying: pb.isPlaying });
          const engine = typeof window !== 'undefined' ? (window as any).__audioEngine : null;
          if (engine) {
            if (pb.isPlaying) {
              engine.unlockAudio?.();
              engine.resume?.();
            } else {
              engine.pause?.();
            }
          }
        }

        // 3. Significant seek (>3s divergence)
        if (Math.abs(player.progressMs - pb.progressMs) > 3000) {
          player.setProgress(pb.progressMs);
          if (typeof window !== 'undefined' && (window as any).__audioEngine) {
            (window as any).__audioEngine.seek(pb.progressMs / 1000);
          }
        }
      }
    });
  },
}));
