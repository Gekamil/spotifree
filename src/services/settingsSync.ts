/**
 * Settings follow the Spotifree account across devices (web, APK, other browsers): equalizer,
 * DJ, crossfade, language, theme, audio sources chosen by hand... When a setting changes here
 * it is saved to the account; when the account brings newer settings, they are applied here.
 * Only with a Spotifree account (cloud); without one, settings stay on this device.
 */
import { getSavedSpotifreeAccount, syncSpotifreeAccount } from './spotifreeAuth';

export const SYNCED_SETTING_KEYS = [
  'spotifree_eq_bands',
  'spotifree_eq_enabled',
  'spotifree_eq_preset',
  'spotifree_dj_fx_level',
  'spotifree_dj_mode',
  'spotifree_dj_mode_desktop',
  'spotifree_crossfade_enabled',
  'spotifree_crossfade_sec',
  'spotifree_gapless',
  'spotifree_normalize_volume',
  'spotifree_autoplay',
  'spotifree_language',
  'spotifree_theme',
  'spotifree_car_lyrics',
  'spotifree_source_overrides',
  'spotifree_dj_voice_choice',
] as const;

export interface SyncedSettings {
  values: Record<string, string | null>;
  updatedAt: number;
}

const STAMP_KEY = 'spotifree_settings_updated_at';
export const SETTINGS_SYNCED_EVENT = 'spotifree:settings-synced';

function snapshot(): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const k of SYNCED_SETTING_KEYS) {
    try {
      out[k] = window.localStorage.getItem(k);
    } catch {
      out[k] = null;
    }
  }
  return out;
}

let lastSig = '';
let pushTimer: number | undefined;

/** Newer settings from the account (another device): write them here and tell the app. */
export function applyRemoteSettings(remote?: SyncedSettings | null) {
  if (typeof window === 'undefined' || !remote || !remote.values) return;
  const localStamp = Number(window.localStorage.getItem(STAMP_KEY) || 0);
  if (!(remote.updatedAt > localStamp)) return;
  for (const [k, v] of Object.entries(remote.values)) {
    if (!(SYNCED_SETTING_KEYS as readonly string[]).includes(k)) continue;
    // Only real values: a setting nobody changed (null) never erases this device's one
    if (v === null || v === undefined) continue;
    try {
      window.localStorage.setItem(k, v);
    } catch {}
  }
  try {
    window.localStorage.setItem(STAMP_KEY, String(remote.updatedAt));
  } catch {}
  lastSnap = snapshot();
  lastSig = JSON.stringify(lastSnap);
  window.dispatchEvent(new CustomEvent(SETTINGS_SYNCED_EVENT, { detail: remote.values }));
}

let lastSnap: Record<string, string | null> = {};
const changedKeys = new Set<string>();

function pushIfChanged() {
  const snap = snapshot();
  const sig = JSON.stringify(snap);
  if (sig === lastSig) return;
  for (const k of SYNCED_SETTING_KEYS) if (snap[k] !== lastSnap[k] && snap[k] !== null) changedKeys.add(k);
  lastSig = sig;
  lastSnap = snap;
  const acc = getSavedSpotifreeAccount();
  if (!acc?.email || changedKeys.size === 0) return;
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    const updatedAt = Date.now();
    try {
      window.localStorage.setItem(STAMP_KEY, String(updatedAt));
    } catch {}
    // Merge: what the account already has from other devices + only what changed here
    const current = getSavedSpotifreeAccount();
    const both = [current?.settings, (current as any)?.stats?.appSettings].filter((x) => x && x.values);
    const newest = both.sort((a: any, b: any) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    const cloud = newest?.values || {};
    const values: Record<string, string | null> = { ...cloud };
    for (const k of changedKeys) values[k] = lastSnap[k];
    changedKeys.clear();
    syncSpotifreeAccount({ settings: { values, updatedAt } }).catch(() => {});
  }, 2500);
}

let started = false;
export function startSettingsSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  lastSnap = snapshot();
  lastSig = JSON.stringify(lastSnap);
  // Settings are written from many screens: compare a snapshot every few seconds
  window.setInterval(pushIfChanged, 4000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pushIfChanged();
  });
}
