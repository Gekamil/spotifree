/**
 * Equalizer settings shared by the desktop and mobile Settings (and read by the audio engine).
 * Same 6 bands and presets as Spotify's equalizer.
 */
export const EQ_BANDS = [
  { freq: 60, label: '60Hz' },
  { freq: 150, label: '150Hz' },
  { freq: 400, label: '400Hz' },
  { freq: 1000, label: '1kHz' },
  { freq: 2400, label: '2.4kHz' },
  { freq: 15000, label: '15kHz' },
] as const;

export const EQ_MIN = -12;
export const EQ_MAX = 12;

export interface EQPreset {
  id: string;
  es: string;
  en: string;
  values: number[];
}

export const EQ_PRESETS: EQPreset[] = [
  { id: 'flat', es: 'Plano', en: 'Flat', values: [0, 0, 0, 0, 0, 0] },
  { id: 'acoustic', es: 'Acústico', en: 'Acoustic', values: [4, 3.5, 1.5, 1, 2.5, 3] },
  { id: 'bassBoost', es: 'Potenciador de graves', en: 'Bass Booster', values: [6, 4.5, 2, 0, 0, 0] },
  { id: 'bassReduce', es: 'Reductor de graves', en: 'Bass Reducer', values: [-6, -4.5, -2, 0, 0, 0] },
  { id: 'classical', es: 'Clásica', en: 'Classical', values: [4, 3, -1, -1, 2, 4] },
  { id: 'dance', es: 'Dance', en: 'Dance', values: [5, 6.5, 1.5, 0, 3, 4] },
  { id: 'deep', es: 'Profundo', en: 'Deep', values: [5, 3, 1.5, -1.5, -3.5, -5] },
  { id: 'electronic', es: 'Electrónica', en: 'Electronic', values: [4.5, 3.5, 0, -1.5, 2, 4.5] },
  { id: 'hiphop', es: 'Hip-Hop', en: 'Hip-Hop', values: [5, 4, 1, 2, -1, 2.5] },
  { id: 'jazz', es: 'Jazz', en: 'Jazz', values: [4, 2.5, -1.5, -1.5, 2, 4] },
  { id: 'latin', es: 'Latina', en: 'Latin', values: [4, 2, -1, -1, 2, 4.5] },
  { id: 'loudness', es: 'Sonoridad', en: 'Loudness', values: [6, 3.5, 0, -1.5, 2, 5.5] },
  { id: 'lounge', es: 'Lounge', en: 'Lounge', values: [-3, -1.5, 1.5, 3.5, 1, -1] },
  { id: 'piano', es: 'Piano', en: 'Piano', values: [3, 2, 0, 2.5, 3.5, 2.5] },
  { id: 'pop', es: 'Pop', en: 'Pop', values: [-1.5, -1, 1, 3.5, 2.5, -1] },
  { id: 'rnb', es: 'R&B', en: 'R&B', values: [6.5, 5, 1.5, -1.5, 2.5, 3] },
  { id: 'rock', es: 'Rock', en: 'Rock', values: [5, 3.5, -1, -0.5, 2.5, 4.5] },
  { id: 'smallSpeakers', es: 'Altavoces pequeños', en: 'Small Speakers', values: [5.5, 4, 1.5, 0, -1.5, -3] },
  { id: 'spoken', es: 'Voz hablada', en: 'Spoken Word', values: [-3, 0, 3, 4, 3, -1] },
  { id: 'trebleBoost', es: 'Potenciador de agudos', en: 'Treble Booster', values: [0, 0, 0, 1.5, 4, 6] },
  { id: 'trebleReduce', es: 'Reductor de agudos', en: 'Treble Reducer', values: [0, 0, 0, -1.5, -4, -6] },
  { id: 'vocal', es: 'Potenciador de voz', en: 'Vocal Booster', values: [-2, -1, 2.5, 4, 3, 0.5] },
];

const BANDS_KEY = 'spotifree_eq_bands';
const ENABLED_KEY = 'spotifree_eq_enabled';
const PRESET_KEY = 'spotifree_eq_preset';

export function clampDb(v: number): number {
  return Math.max(EQ_MIN, Math.min(EQ_MAX, Math.round(v * 2) / 2));
}

export function loadEqBands(): number[] {
  try {
    const raw = window.localStorage.getItem(BANDS_KEY);
    if (raw) {
      const v = JSON.parse(raw);
      if (Array.isArray(v)) return EQ_BANDS.map((_, i) => clampDb(Number(v[i]) || 0));
    }
  } catch {}
  return EQ_BANDS.map(() => 0);
}

export function loadEqEnabled(): boolean {
  try {
    return window.localStorage.getItem(ENABLED_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function loadEqPreset(): string {
  try {
    return window.localStorage.getItem(PRESET_KEY) || detectPreset(loadEqBands());
  } catch {
    return 'flat';
  }
}

/** Fired when the equalizer changes (here, or synced from another device) */
export const EQ_CHANGED_EVENT = 'spotifree:eq-changed';

export function saveEq(values: number[], enabled: boolean, preset: string) {
  try {
    window.localStorage.setItem(BANDS_KEY, JSON.stringify(values));
    window.localStorage.setItem(ENABLED_KEY, String(enabled));
    window.localStorage.setItem(PRESET_KEY, preset);
  } catch {}
  try {
    window.dispatchEvent(new Event(EQ_CHANGED_EVENT));
  } catch {}
}

export function detectPreset(values: number[]): string {
  const hit = EQ_PRESETS.find((p) => p.values.every((v, i) => Math.abs(v - (values[i] ?? 0)) < 0.01));
  return hit ? hit.id : 'custom';
}

/** Gains the audio engine should apply right now (flat when the EQ is off). */
export function effectiveEqGains(): number[] {
  return loadEqEnabled() ? loadEqBands() : EQ_BANDS.map(() => 0);
}
