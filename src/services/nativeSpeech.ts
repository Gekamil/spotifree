/**
 * APK only: the DJ's microphone through Android's speech recognition (the WebView has no
 * SpeechRecognition). Native side: native/android/SpotifreeSpeechPlugin.java
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

interface SpotifreeSpeechPlugin {
  available(): Promise<{ available: boolean }>;
  start(o: { lang: string }): Promise<void>;
  stop(): Promise<void>;
  cancel(): Promise<void>;
  addListener(event: 'partial' | 'final', cb: (e: { text: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'level', cb: (e: { level: number }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'error', cb: (e: { code: number }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'end', cb: () => void): Promise<PluginListenerHandle>;
}

const SpotifreeSpeech = registerPlugin<SpotifreeSpeechPlugin>('SpotifreeSpeech');

export function isNativeSpeechAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('SpotifreeSpeech');
  } catch {
    return false;
  }
}

export interface NativeListenHandlers {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onLevel?: (level: number) => void;
  /** Always called once at the end (also after an error); error: 'permission' | 'no-match' | 'failed' */
  onEnd: (error?: string) => void;
}

let handles: PluginListenerHandle[] = [];
async function clearListeners() {
  const old = handles;
  handles = [];
  for (const h of old) {
    try {
      await h.remove();
    } catch {}
  }
}

/** Listens once (like SpeechRecognition with continuous = false) */
export async function nativeListen(lang: string, h: NativeListenHandlers): Promise<void> {
  await clearListeners();
  let ended = false;
  let gotFinal = false;
  const end = (err?: string) => {
    if (ended) return;
    ended = true;
    void clearListeners();
    h.onEnd(err);
  };
  handles = await Promise.all([
    SpotifreeSpeech.addListener('partial', (e) => h.onPartial(e.text || '')),
    SpotifreeSpeech.addListener('final', (e) => {
      gotFinal = true;
      h.onFinal(e.text || '');
    }),
    SpotifreeSpeech.addListener('level', (e) => h.onLevel?.(e.level || 0)),
    // 6 = speech timeout, 7 = no match: nothing was understood
    SpotifreeSpeech.addListener('error', (e) => end(e.code === 6 || e.code === 7 ? 'no-match' : 'failed')),
    SpotifreeSpeech.addListener('end', () => end(gotFinal ? undefined : 'no-match')),
  ]);
  try {
    await SpotifreeSpeech.start({ lang });
  } catch (e: any) {
    end(String(e?.code || e?.message || '').includes('permission') ? 'permission' : 'failed');
  }
}

export function nativeStopListening() {
  SpotifreeSpeech.cancel().catch(() => {});
  void clearListeners();
}
