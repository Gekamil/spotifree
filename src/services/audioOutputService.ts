/**
 * Unified Audio Output Device Picker Service for Desktop Web, Mobile Web, and Android APK.
 * Mirrors Spotify's "Conectar a un dispositivo" ("Dispositivo actual" + "Salida de audio" + "Escuchar juntos").
 * Native APK support connects to native/android/SpotifreeAudioOutputPlugin.java.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { create } from 'zustand';
import { audioEngine } from './audioEngine';
import { showGlobalToast } from '../utils/globalToast';

export const AUDIO_SINK_KEY = 'spotifree_audio_output';

export type AudioOutputKind = 'default' | 'speaker' | 'bluetooth' | 'wired' | 'usb' | 'tv' | 'unknown';

export interface AudioOutputDevice {
  id: string;
  label: string;
  kind: AudioOutputKind;
  active?: boolean;
  isDefault?: boolean;
  hasRealLabel?: boolean;
}

interface NativeAudioSnapshot {
  devices: Array<{ id: string; label: string; kind: AudioOutputKind; active?: boolean }>;
  activeDevice?: { id: string; label: string; kind: AudioOutputKind };
  isApk?: boolean;
  supportsSystemMediaOutput?: boolean;
  switched?: boolean;
  needsSystemPicker?: boolean;
}

interface SpotifreeAudioOutputPlugin {
  getOutputDevices(): Promise<NativeAudioSnapshot>;
  setOutputDevice(opts: { deviceId: string }): Promise<NativeAudioSnapshot>;
  openSystemMediaOutput(): Promise<{ opened: boolean }>;
  addListener(eventName: 'devicesChanged', listenerFunc: (data: NativeAudioSnapshot) => void): Promise<PluginListenerHandle>;
}

const NativeAudioOutput = registerPlugin<SpotifreeAudioOutputPlugin>('SpotifreeAudioOutput');

export function isNativeApk(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function isNativeAudioOutputAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('SpotifreeAudioOutput');
  } catch {
    return false;
  }
}

export function canChooseWebOutput(): boolean {
  if (typeof window === 'undefined') return false;
  const hasCtxSink =
    typeof (window as any).AudioContext !== 'undefined' &&
    'setSinkId' in (window as any).AudioContext.prototype;
  const hasElSink =
    typeof HTMLMediaElement !== 'undefined' &&
    'setSinkId' in HTMLMediaElement.prototype;
  return hasCtxSink || hasElSink;
}

export function inferWebDeviceKind(label: string, id: string): AudioOutputKind {
  if (id === 'default') return 'default';
  const low = (label || '').toLowerCase();
  if (/bluetooth|airpods|buds|wf-|wh-|bose|jbl|beats|hands-free|a2dp|headset|auricular/i.test(low)) return 'bluetooth';
  if (/hdmi|displayport|tv|lg|samsung tv|bravia/i.test(low)) return 'tv';
  if (/usb|dac/i.test(low)) return 'usb';
  if (/headphone|wired|jack|3\.5/i.test(low)) return 'wired';
  if (/speaker|altavoz|realtek|built-in/i.test(low)) return 'speaker';
  return 'unknown';
}

export async function applyOutput(deviceId: string): Promise<boolean> {
  try {
    const sink = deviceId === 'default' ? '' : deviceId;
    const ctx: any = (audioEngine as any).audioContext;
    let applied = false;
    if (ctx?.setSinkId) {
      await ctx.setSinkId(sink);
      applied = true;
    }
    for (const a of ((audioEngine as any).audios || []) as any[]) {
      if (a?.setSinkId) {
        await a.setSinkId(sink).catch(() => {});
        applied = true;
      }
    }
    if (!applied && !canChooseWebOutput()) return false;
    try {
      localStorage.setItem(AUDIO_SINK_KEY, deviceId);
    } catch {}
    return true;
  } catch {
    return false;
  }
}

export function restoreAudioOutput(): void {
  try {
    const id = localStorage.getItem(AUDIO_SINK_KEY);
    if (id && id !== 'default' && canChooseWebOutput()) {
      void applyOutput(id);
    }
  } catch {}
}

function getSavedSink(): string {
  try {
    return localStorage.getItem(AUDIO_SINK_KEY) || 'default';
  } catch {
    return 'default';
  }
}

interface AudioOutputState {
  isSheetOpen: boolean;
  devices: AudioOutputDevice[];
  currentId: string;
  activeLabel: string;
  activeKind: AudioOutputKind;
  isApk: boolean;
  isNativePluginReady: boolean;
  supportsWebSink: boolean;
  supportsSystemPicker: boolean;
  hasHiddenLabels: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  refreshDevices: () => Promise<void>;
  selectOutput: (device: AudioOutputDevice) => Promise<void>;
  openSystemOutputSwitcher: () => Promise<boolean>;
}

let listenersAttached = false;

export const useAudioOutputStore = create<AudioOutputState>((set, get) => ({
  isSheetOpen: false,
  devices: [],
  currentId: getSavedSink(),
  activeLabel: 'Salida predeterminada',
  activeKind: 'default',
  isApk: isNativeApk(),
  isNativePluginReady: isNativeAudioOutputAvailable(),
  supportsWebSink: canChooseWebOutput(),
  supportsSystemPicker: isNativeAudioOutputAvailable(),
  hasHiddenLabels: false,

  openSheet: () => {
    set({ isSheetOpen: true });
    void get().refreshDevices();
  },

  closeSheet: () => set({ isSheetOpen: false }),

  refreshDevices: async () => {
    const isApk = isNativeApk();
    const nativeReady = isNativeAudioOutputAvailable();
    const webSink = canChooseWebOutput();

    if (nativeReady) {
      try {
        const snap = await NativeAudioOutput.getOutputDevices();
        const nativeDevs: AudioOutputDevice[] = (snap?.devices || []).map((d) => ({
          id: d.id,
          label: d.label,
          kind: d.kind || 'speaker',
          active: Boolean(d.active),
          hasRealLabel: true,
        }));
        const active = nativeDevs.find((d) => d.active) || snap?.activeDevice;
        set({
          devices: [
            { id: 'default', label: 'Predeterminada del sistema', kind: 'default', isDefault: true, hasRealLabel: true },
            ...nativeDevs,
          ],
          currentId: active?.id || 'default',
          activeLabel: active?.label || 'Altavoz del teléfono',
          activeKind: active?.kind || 'speaker',
          isApk,
          isNativePluginReady: true,
          supportsWebSink: webSink,
          supportsSystemPicker: Boolean(snap?.supportsSystemMediaOutput ?? true),
          hasHiddenLabels: false,
        });
        return;
      } catch {}
    }

    try {
      const list = (await navigator.mediaDevices?.enumerateDevices?.()) || [];
      const audioOuts = list.filter((d) => d.kind === 'audiooutput' && d.deviceId !== 'communications');
      const others = audioOuts.filter((d) => d.deviceId !== 'default');
      const saved = getSavedSink();
      const mapped: AudioOutputDevice[] = [
        { id: 'default', label: 'Predeterminada del sistema', kind: 'default', isDefault: true, hasRealLabel: true },
        ...others.map((d, i) => {
          const hasRealLabel = Boolean(d.label && d.label.trim());
          const label = d.label || `Salida de audio ${i + 1}`;
          return {
            id: d.deviceId,
            label,
            kind: inferWebDeviceKind(label, d.deviceId),
            hasRealLabel,
          };
        }),
      ];
      const activeMatch = mapped.find((d) => d.id === saved) || mapped[0];
      set({
        devices: mapped,
        currentId: activeMatch?.id || 'default',
        activeLabel: activeMatch?.id === 'default' ? 'Salida predeterminada' : activeMatch?.label || 'Salida predeterminada',
        activeKind: activeMatch?.kind || 'default',
        isApk,
        isNativePluginReady: nativeReady,
        supportsWebSink: webSink,
        supportsSystemPicker: false,
        hasHiddenLabels: others.length > 0 && !others.some((d) => Boolean(d.label)),
      });
    } catch {
      set({
        devices: [{ id: 'default', label: 'Predeterminada del sistema', kind: 'default', isDefault: true, hasRealLabel: true }],
        currentId: 'default',
        activeLabel: 'Salida predeterminada',
        activeKind: 'default',
        isApk,
        isNativePluginReady: nativeReady,
        supportsWebSink: webSink,
        supportsSystemPicker: false,
        hasHiddenLabels: false,
      });
    }
  },

  selectOutput: async (device: AudioOutputDevice) => {
    const nativeReady = isNativeAudioOutputAvailable();
    if (nativeReady) {
      try {
        const res = await NativeAudioOutput.setOutputDevice({ deviceId: device.id });
        if (device.id !== 'default' && canChooseWebOutput()) {
          void applyOutput(device.id);
        }
        if (res?.needsSystemPicker) {
          // Android 11+ delegates switching between active A2DP / Phone Speaker media sinks to the OS panel
          const opened = await get().openSystemOutputSwitcher();
          if (opened) return;
        }
        await get().refreshDevices();
        showGlobalToast(`Sonando en: ${device.id === 'default' ? 'salida predeterminada' : device.label}`);
        return;
      } catch {}
    }

    if (await applyOutput(device.id)) {
      set({
        currentId: device.id,
        activeLabel: device.id === 'default' ? 'Salida predeterminada' : device.label,
        activeKind: device.kind,
      });
      showGlobalToast(`Sonando en: ${device.id === 'default' ? 'salida predeterminada' : device.label}`);
    } else {
      showGlobalToast('Este navegador no deja cambiar la salida de audio');
    }
  },

  openSystemOutputSwitcher: async () => {
    if (!isNativeAudioOutputAvailable()) return false;
    try {
      const res = await NativeAudioOutput.openSystemMediaOutput();
      return Boolean(res?.opened);
    } catch {
      return false;
    }
  },
}));

export function initAudioOutputListeners(): void {
  if (listenersAttached || typeof window === 'undefined') return;
  listenersAttached = true;

  if (isNativeAudioOutputAvailable()) {
    NativeAudioOutput.addListener('devicesChanged', () => {
      void useAudioOutputStore.getState().refreshDevices();
    }).catch(() => {});
  }

  try {
    navigator.mediaDevices?.addEventListener?.('devicechange', () => {
      void useAudioOutputStore.getState().refreshDevices();
    });
  } catch {}

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && (isNativeAudioOutputAvailable() || useAudioOutputStore.getState().isSheetOpen)) {
      void useAudioOutputStore.getState().refreshDevices();
    }
  });

  // Populate initial active device state cleanly when starting on APK
  if (isNativeAudioOutputAvailable()) {
    void useAudioOutputStore.getState().refreshDevices();
  }
}

export function openDevicePickerSheet(): void {
  initAudioOutputListeners();
  useAudioOutputStore.getState().openSheet();
}
