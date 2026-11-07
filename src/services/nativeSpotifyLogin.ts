/**
 * APK only: sign in to Spotify inside the app (official accounts.spotify.com page in a native
 * WebView) and pick up the session cookie automatically, instead of pasting sp_dc by hand.
 * Native side: native/android/SpotifreeLoginPlugin.java.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { extractSpotifySessionFromCookie, validateSpotifyCookie } from './spotifyCookieService';
import { cleanSpDc } from '../utils/userAccounts';
import { getSavedSpotifreeAccount, syncSpotifreeAccount } from './spotifreeAuth';
import { useSpotifyDataStore } from '../store/useSpotifyDataStore';

interface SpotifreeLoginPlugin {
  login(options?: { language?: string }): Promise<{ cookie: string }>;
  logout(): Promise<void>;
}

const SpotifreeLogin = registerPlugin<SpotifreeLoginPlugin>('SpotifreeLogin');

export function isNativeSpotifyLoginAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('SpotifreeLogin');
  } catch {
    return false;
  }
}

/** Opens the Spotify login, then loads the account like a saved cookie (merging, never resetting). */
export async function loginWithSpotifyNative(language: 'es' | 'en' = 'es'): Promise<{ name: string }> {
  const res = await SpotifreeLogin.login({ language });
  const cookie = cleanSpDc(res?.cookie || '');
  const v = validateSpotifyCookie(cookie);
  if (!v.valid) throw new Error(v.error || 'No se recibió la sesión de Spotify.');
  const session = await extractSpotifySessionFromCookie(cookie);
  const cloudAcc = getSavedSpotifreeAccount();
  if (cloudAcc) {
    try {
      await syncSpotifreeAccount({ email: cloudAcc.email, uid: cloudAcc.uid, spotifyCookie: cookie });
    } catch {}
  }
  useSpotifyDataStore.getState().applyCookieSession(session, cookie);
  return { name: session.user?.display_name || '' };
}

export async function logoutSpotifyNative() {
  if (!isNativeSpotifyLoginAvailable()) return;
  try {
    await SpotifreeLogin.logout();
  } catch {}
}
