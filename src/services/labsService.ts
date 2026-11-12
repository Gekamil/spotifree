import { create } from 'zustand';
import type { Track } from '../types/spotify';

const KEYS = {
  labs: 'spotifree_labs_enabled',
  speedEnabled: 'spotifree_labs_speed_enabled',
  speed: 'spotifree_playback_speed',
  preservesPitch: 'spotifree_preserves_pitch',
  mono: 'spotifree_audio_mono',
  spatialEnabled: 'spotifree_spatial_enabled',
  spatialX: 'spotifree_spatial_x',
  spatialY: 'spotifree_spatial_y',
  tasteEnabled: 'spotifree_taste_rating_enabled',
  tasteLikes: 'spotifree_taste_likes',
  tasteDislikes: 'spotifree_taste_dislikes',
} as const;

export const SPEED_SHEET_EVENT = 'spotifree:open-speed-sheet';

export function openSpeedControlSheet(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SPEED_SHEET_EVENT));
  }
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    if (typeof window === 'undefined') return fallback;
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === 'true';
  } catch {
    return fallback;
  }
}

function readNum(key: string, fallback: number, min: number, max: number): number {
  try {
    if (typeof window === 'undefined') return fallback;
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  } catch {
    return fallback;
  }
}

function readStringArray(key: string): string[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];
  } catch {
    return [];
  }
}

function writeStorage(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
  } catch {}
}

function normalizeText(s?: string | null): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function cleanTrackId(id?: string | null): string {
  return (id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
}

/** Canonical signature keys for a track (ID + normalized name/primary artist) */
export function getTrackTasteSignatures(track?: Track | null): string[] {
  if (!track) return [];
  const sigs: string[] = [];
  const cid = cleanTrackId(track.id);
  if (cid) sigs.push(`id:${cid}`);
  const title = normalizeText(track.name);
  const artist = normalizeText(track.artists?.[0]?.name || '');
  if (title) {
    sigs.push(artist ? `na:${title}::${artist}` : `na:${title}`);
  }
  return sigs;
}

export interface LabsState {
  labsEnabled: boolean;
  speedControlEnabled: boolean;
  playbackSpeed: number;
  preservesPitch: boolean;
  audioMono: boolean;
  spatialEnabled: boolean;
  spatialX: number; // -1 (Izquierda) .. +1 (Derecha)
  spatialY: number; // -1 (Detrás) .. +1 (Delante)
  tasteRatingEnabled: boolean;
  likedTasteKeys: string[];
  dislikedTasteKeys: string[];

  setLabsEnabled: (enabled: boolean) => void;
  setSpeedControlEnabled: (enabled: boolean) => void;
  setPlaybackSpeed: (rate: number) => void;
  setPreservesPitch: (preserve: boolean) => void;
  resetPlaybackSpeed: () => void;
  setAudioMono: (mono: boolean) => void;
  setSpatialEnabled: (enabled: boolean) => void;
  setSpatialPosition: (x: number, y: number) => void;
  resetSpatialPosition: () => void;
  setTasteRatingEnabled: (enabled: boolean) => void;
  toggleTasteLike: (track: Track) => 'like' | null;
  markTasteDislike: (track: Track) => 'dislike' | null;
  clearAllDislikes: () => void;
}

function syncAudioEngineSnapshot(st: {
  labsEnabled: boolean;
  speedControlEnabled: boolean;
  playbackSpeed: number;
  preservesPitch: boolean;
  audioMono: boolean;
  spatialEnabled: boolean;
  spatialX: number;
  spatialY: number;
}): void {
  try {
    const engine = (typeof window !== 'undefined' ? (window as any).__audioEngine : null);
    if (!engine) return;
    const useSpeed = st.labsEnabled && st.speedControlEnabled;
    engine.setPlaybackSpeedAndPitch?.(useSpeed ? st.playbackSpeed : 1, useSpeed ? st.preservesPitch : true);
    engine.setSpatialAndMono?.({
      mono: st.audioMono,
      spatialEnabled: st.labsEnabled && st.spatialEnabled && !st.audioMono,
      x: st.spatialX,
      y: st.spatialY,
    });
  } catch {}
}

export const useLabsStore = create<LabsState>((set, get) => ({
  labsEnabled: readBool(KEYS.labs, false),
  speedControlEnabled: readBool(KEYS.speedEnabled, true),
  playbackSpeed: readNum(KEYS.speed, 1.0, 0.5, 2.0),
  preservesPitch: readBool(KEYS.preservesPitch, true),
  audioMono: readBool(KEYS.mono, false),
  spatialEnabled: readBool(KEYS.spatialEnabled, false),
  spatialX: readNum(KEYS.spatialX, 0, -1, 1),
  spatialY: readNum(KEYS.spatialY, 0, -1, 1),
  tasteRatingEnabled: readBool(KEYS.tasteEnabled, false),
  likedTasteKeys: readStringArray(KEYS.tasteLikes),
  dislikedTasteKeys: readStringArray(KEYS.tasteDislikes),

  setLabsEnabled: (enabled) => {
    writeStorage(KEYS.labs, String(enabled));
    set({ labsEnabled: enabled });
    syncAudioEngineSnapshot(get());
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spotifree:labs-changed', { detail: { labsEnabled: enabled } }));
    }
  },

  setSpeedControlEnabled: (enabled) => {
    writeStorage(KEYS.speedEnabled, String(enabled));
    set({ speedControlEnabled: enabled });
    syncAudioEngineSnapshot(get());
  },

  setPlaybackSpeed: (rate) => {
    const clamped = Math.round(Math.min(2.0, Math.max(0.5, rate)) * 100) / 100;
    writeStorage(KEYS.speed, String(clamped));
    set({ playbackSpeed: clamped });
    syncAudioEngineSnapshot(get());
  },

  setPreservesPitch: (preserve) => {
    writeStorage(KEYS.preservesPitch, String(preserve));
    set({ preservesPitch: preserve });
    syncAudioEngineSnapshot(get());
  },

  resetPlaybackSpeed: () => {
    writeStorage(KEYS.speed, '1');
    writeStorage(KEYS.preservesPitch, 'true');
    set({ playbackSpeed: 1.0, preservesPitch: true });
    syncAudioEngineSnapshot(get());
  },

  setAudioMono: (mono) => {
    writeStorage(KEYS.mono, String(mono));
    set({ audioMono: mono });
    syncAudioEngineSnapshot(get());
  },

  setSpatialEnabled: (enabled) => {
    writeStorage(KEYS.spatialEnabled, String(enabled));
    set((s) => ({
      spatialEnabled: enabled,
      audioMono: enabled ? false : s.audioMono,
    }));
    if (enabled) writeStorage(KEYS.mono, 'false');
    syncAudioEngineSnapshot(get());
  },

  setSpatialPosition: (x, y) => {
    const cx = Math.round(Math.min(1, Math.max(-1, x)) * 100) / 100;
    const cy = Math.round(Math.min(1, Math.max(-1, y)) * 100) / 100;
    writeStorage(KEYS.spatialX, String(cx));
    writeStorage(KEYS.spatialY, String(cy));
    set({ spatialX: cx, spatialY: cy });
    syncAudioEngineSnapshot(get());
  },

  resetSpatialPosition: () => {
    writeStorage(KEYS.spatialX, '0');
    writeStorage(KEYS.spatialY, '0');
    set({ spatialX: 0, spatialY: 0 });
    syncAudioEngineSnapshot(get());
  },

  setTasteRatingEnabled: (enabled) => {
    writeStorage(KEYS.tasteEnabled, String(enabled));
    set({ tasteRatingEnabled: enabled });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spotifree:taste-rating-changed', { detail: { enabled } }));
    }
  },

  toggleTasteLike: (track) => {
    const sigs = getTrackTasteSignatures(track);
    if (sigs.length === 0) return null;
    const state = get();
    const isCurrentlyLiked = sigs.some((s) => state.likedTasteKeys.includes(s));

    // Always clear any dislike when interacting with Like
    const nextDislikes = state.dislikedTasteKeys.filter((s) => !sigs.includes(s));
    let nextLikes: string[];
    let result: 'like' | null;

    if (isCurrentlyLiked) {
      nextLikes = state.likedTasteKeys.filter((s) => !sigs.includes(s));
      result = null;
    } else {
      nextLikes = Array.from(new Set([...state.likedTasteKeys, ...sigs]));
      result = 'like';
    }

    writeStorage(KEYS.tasteLikes, JSON.stringify(nextLikes));
    writeStorage(KEYS.tasteDislikes, JSON.stringify(nextDislikes));
    set({ likedTasteKeys: nextLikes, dislikedTasteKeys: nextDislikes });
    return result;
  },

  markTasteDislike: (track) => {
    const sigs = getTrackTasteSignatures(track);
    if (sigs.length === 0) return null;
    const state = get();
    const nextLikes = state.likedTasteKeys.filter((s) => !sigs.includes(s));
    const nextDislikes = Array.from(new Set([...state.dislikedTasteKeys, ...sigs]));

    writeStorage(KEYS.tasteLikes, JSON.stringify(nextLikes));
    writeStorage(KEYS.tasteDislikes, JSON.stringify(nextDislikes));
    set({ likedTasteKeys: nextLikes, dislikedTasteKeys: nextDislikes });
    return 'dislike';
  },

  clearAllDislikes: () => {
    writeStorage(KEYS.tasteDislikes, '[]');
    set({ dislikedTasteKeys: [] });
  },
}));

export function isTasteRatingActive(): boolean {
  return useLabsStore.getState().tasteRatingEnabled;
}

export function isTrackLikedTaste(track?: Track | null): boolean {
  const st = useLabsStore.getState();
  if (!st.tasteRatingEnabled || !track) return false;
  const sigs = getTrackTasteSignatures(track);
  return sigs.some((s) => st.likedTasteKeys.includes(s));
}

export function isTrackDisliked(track?: Track | null): boolean {
  const st = useLabsStore.getState();
  if (!st.tasteRatingEnabled || !track) return false;
  const sigs = getTrackTasteSignatures(track);
  return sigs.some((s) => st.dislikedTasteKeys.includes(s));
}

export function getEffectiveSpeedSettings(): { active: boolean; rate: number; preservesPitch: boolean } {
  const st = useLabsStore.getState();
  if (!st.labsEnabled || !st.speedControlEnabled) {
    return { active: false, rate: 1, preservesPitch: true };
  }
  return { active: true, rate: st.playbackSpeed, preservesPitch: st.preservesPitch };
}

export function getEffectiveSpatialSettings(): { mono: boolean; spatialEnabled: boolean; x: number; y: number } {
  const st = useLabsStore.getState();
  return {
    mono: st.audioMono,
    spatialEnabled: st.labsEnabled && st.spatialEnabled && !st.audioMono,
    x: st.spatialX,
    y: st.spatialY,
  };
}
