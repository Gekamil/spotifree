import { create } from 'zustand';
import type { Track } from '../types/spotify';

interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  volume: number;
  previousVolume: number;
  isMuted: boolean;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  queue: Track[];
  history: Track[];
  likedTrackIds: string[];

  // Actions
  playTrack: (track: Track, newQueue?: Track[]) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  previousTrack: () => void;
  setProgress: (ms: number) => void;
  setDuration: (ms: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleLike: (trackId: string) => void;
  addToQueue: (tracks: Track | Track[]) => void;
}

const DEFAULT_LIKED_TRACK_IDS = [
  '1EljzqiV1RDtXj1QUbx3db', '7gwG5KyFAaLDV73ND47Q0w', '2eQFYGegTZaObk2kuBz83Z',
  '2lTm559tuIvatlT1u0JYG2', '6bI00brFpeprqCDqKouEJS', '1WbXIpiGBJkCiv3hn40iPB',
  '7tXHU3EeMfHioXLSCRdDO9', '5BopknbHSxEm9Ohcs4IbGu', '7fBv7CLKzipRk6EC6TWHOB',
  '0WtDGnWL2KrMCk0mI1Gpwz', '5bi0gh89wRuH2OgjdAKFsb', '16flcJEZHzqoSRv7Ku5gjJ',
  '0RD94y2DlYTzEePb4WuVbU', '62k8iliO7KTiYp7LWGPa5p', '1zsPaEkglFvxjAhrM8yhpr',
  '69bgIOHgaRFz9xyvs3Sj2I', '32xmmzPgQEygeYZyv4eWY8', '4GNMcZiHw1D65tLATm09rK',
  '2gam98EZKrF9XuOkU13ApN', '5VfvCrEYlOASsqhBvceeba', '5BHmWjQP5u8zOTT2qsdkJr',
  '4f5Bw7pvjyCW5mEeyyoKve', '6PyRfJN2K5Sm1vfOuF4Z9z',
  'liked-1', 'liked-2', 'liked-3', 'liked-4', 'liked-5', 'liked-6', 'liked-7',
  'liked-8', 'liked-9', 'liked-10', 'liked-11', 'liked-12', 'liked-13', 'liked-14',
  'liked-15', 'liked-16', 'liked-17', 'liked-18', 'liked-19', 'liked-20', 'liked-21',
  'liked-22', 'liked-23'
];

const store = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  progressMs: 0,
  durationMs: 0,
  volume: 0.7,
  previousVolume: 0.7,
  isMuted: false,
  isShuffle: false,
  repeatMode: 'off',
  queue: [],
  history: [],
  likedTrackIds: DEFAULT_LIKED_TRACK_IDS,

  addToQueue: (tracks: Track | Track[]) => {
    const list = Array.isArray(tracks) ? tracks : [tracks];
    set((s) => ({ queue: [...s.queue, ...list] }));
  },

  playTrack: (track: Track, newQueue?: Track[]) => {
    const state = get();
    const updatedHistory = state.currentTrack ? [state.currentTrack, ...state.history] : state.history;
    set({
      currentTrack: track,
      isPlaying: true,
      progressMs: 0,
      durationMs: track.duration_ms,
      queue: newQueue ?? state.queue,
      history: updatedHistory,
    });
  },

  togglePlay: () => {
    const nextState = !get().isPlaying;
    set({ isPlaying: nextState });
    if (typeof window !== 'undefined' && (window as any).__audioEngine) {
      if (nextState) {
        (window as any).__audioEngine.resume();
      } else {
        (window as any).__audioEngine.pause();
      }
    }
  },

  nextTrack: () => {
    const { queue, currentTrack, history, isShuffle, repeatMode } = get();
    if (queue.length === 0) return;

    if (repeatMode === 'one' && currentTrack) {
      set({
        isPlaying: true,
        progressMs: 0,
      });
      if (typeof window !== 'undefined' && (window as any).__audioEngine) {
        (window as any).__audioEngine.seek(0);
      }
      return;
    }

    const currentIndex = currentTrack ? queue.findIndex((t) => t.id === currentTrack.id) : -1;
    let nextIndex = 0;

    if (isShuffle && queue.length > 1) {
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
      } while (nextIndex === currentIndex);
    } else {
      if (currentIndex === queue.length - 1 && repeatMode === 'off') {
        set({ isPlaying: false, progressMs: 0 });
        return;
      }
      nextIndex = (currentIndex + 1) % queue.length;
    }

    const next = queue[nextIndex];
    if (next) {
      set({
        currentTrack: next,
        isPlaying: true,
        progressMs: 0,
        durationMs: next.duration_ms,
        history: currentTrack ? [currentTrack, ...history] : history,
      });
    }
  },

  previousTrack: () => {
    const { queue, currentTrack, progressMs } = get();
    if (progressMs > 3000) {
      set({ progressMs: 0 });
      return;
    }
    if (queue.length === 0) return;
    const currentIndex = currentTrack ? queue.findIndex((t) => t.id === currentTrack.id) : 0;
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    const prev = queue[prevIndex];
    if (prev) {
      set({
        currentTrack: prev,
        isPlaying: true,
        progressMs: 0,
        durationMs: prev.duration_ms,
      });
    }
  },

  setProgress: (ms: number) => {
    set({ progressMs: ms });
  },

  setDuration: (ms: number) => {
    set({ durationMs: ms });
  },

  setVolume: (volume: number) => {
    set({ volume, isMuted: volume === 0 });
  },

  toggleMute: () => {
    const { isMuted, volume, previousVolume } = get();
    if (isMuted) {
      set({ isMuted: false, volume: previousVolume > 0 ? previousVolume : 0.5 });
    } else {
      set({ isMuted: true, previousVolume: volume, volume: 0 });
    }
  },

  toggleShuffle: () => {
    set((state) => ({ isShuffle: !state.isShuffle }));
  },

  toggleRepeat: () => {
    set((state) => {
      const nextMode = state.repeatMode === 'off' ? 'all' : state.repeatMode === 'all' ? 'one' : 'off';
      return { repeatMode: nextMode };
    });
  },

  toggleLike: (trackId: string) => {
    set((state) => {
      const exists = state.likedTrackIds.includes(trackId);
      return {
        likedTrackIds: exists
          ? state.likedTrackIds.filter((id) => id !== trackId)
          : [...state.likedTrackIds, trackId],
      };
    });
  },
}));

export const usePlayerStore =
  typeof window !== 'undefined' && (window as any).__usePlayerStore
    ? ((window as any).__usePlayerStore as typeof store)
    : store;

if (typeof window !== 'undefined') {
  (window as any).__usePlayerStore = usePlayerStore;
}

