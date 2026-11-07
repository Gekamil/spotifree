/**
 * APK only: real equalizer and DJ filter moves on the phone's audio output (Android's own
 * Equalizer effect), because the songs play in the web player, which the web layer cannot
 * process. Native side: native/android/SpotifreeAudioFxPlugin.java.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { EQ_CHANGED_EVENT, loadEqBands, loadEqEnabled } from '../utils/eqSettings';
import { djFxLevelGain, transitionSwapPoint } from './djMixPlanner';
import type { DJTransitionConfig } from './djTransitionService';

interface AudioFxPlugin {
  status(): Promise<{ available: boolean; bandsHz?: number[]; error?: string }>;
  setEqualizer(o: { enabled: boolean; gains: number[] }): Promise<void>;
  sweep(o: { kind: 'build' | 'bassdip' | 'highcut'; durationMs: number; swapAt: number; depthDb: number }): Promise<void>;
  cancelSweep(): Promise<void>;
}

const AudioFx = registerPlugin<AudioFxPlugin>('SpotifreeAudioFx');

export const NATIVE_FX_STATUS_EVENT = 'spotifree:native-fx-status';
export interface NativeFxStatus {
  /** Running inside the APK with the effects plugin */
  native: boolean;
  /** The phone lets the app use its equalizer */
  available: boolean;
  checked: boolean;
}
let status: NativeFxStatus = { native: false, available: false, checked: false };

export function nativeFxStatus(): NativeFxStatus {
  return status;
}

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('SpotifreeAudioFx');
  } catch {
    return false;
  }
}

function applyEq() {
  if (!status.available) return;
  AudioFx.setEqualizer({ enabled: loadEqEnabled(), gains: loadEqBands() }).catch(() => {});
}

/**
 * The DJ filter move that goes with a transition, on the real audio:
 *  - build-ups (crescendo, roll, filter): lows filtered out more and more, released on the drop
 *  - echo / vinyl brake: the outgoing song loses its highs, as if going away
 *  - the rest (blends, bass swaps, cuts): the bass dips at the swap, like a DJ swapping basslines
 */
export function nativeTransitionFx(config: DJTransitionConfig | null, durationSec: number) {
  if (!status.available || !config || durationSec <= 0) return;
  const level = djFxLevelGain();
  if (level <= 0) return;
  const preset = String(config.preset || '');
  const fx = String((config as any).fxMode || '');
  const eqMode = String((config as any).eqMode || '');
  const swapAt = transitionSwapPoint(config);
  let kind: 'build' | 'bassdip' | 'highcut' = 'bassdip';
  if (['crescendo', 'beat_roll', 'filtro', 'repeticion_ritmo'].includes(preset) || fx === 'repeticion_loop' || eqMode === 'filtro_paso_alto') kind = 'build';
  else if (['eco', 'eco_out', 'freno_vinilo'].includes(preset) || fx === 'eco' || eqMode === 'filtro_paso_bajo') kind = 'highcut';
  else if (preset === 'fundido') return; // plain fade: no filter
  const depth = Math.min(15, (kind === 'bassdip' ? 10 : 13) * level);
  AudioFx.sweep({ kind, durationMs: Math.round(durationSec * 1000), swapAt, depthDb: depth }).catch(() => {});
}

export function cancelNativeTransitionFx() {
  if (!status.available) return;
  AudioFx.cancelSweep().catch(() => {});
}

let started = false;
export async function initNativeAudioFx() {
  if (started || typeof window === 'undefined' || !isNative()) return;
  started = true;
  status = { native: true, available: false, checked: false };
  try {
    const s = await AudioFx.status();
    status = { native: true, available: Boolean(s?.available), checked: true };
  } catch {
    status = { native: true, available: false, checked: true };
  }
  window.dispatchEvent(new CustomEvent(NATIVE_FX_STATUS_EVENT, { detail: status }));
  applyEq();
  window.addEventListener(EQ_CHANGED_EVENT, applyEq);
}
