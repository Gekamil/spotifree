import type { UserProfile, Playlist } from '../types/spotify';
import type { DynamicShelf } from '../store/useSpotifyDataStore';

export interface ExtractedSession {
  user: UserProfile;
  playlists: Playlist[];
  shelves: DynamicShelf[];
  quickAccess: Array<{ id: string; name: string; image: string; color: string }>;
  accessToken?: string;
}

export function validateSpotifyCookie(cookie: string): { valid: boolean; error?: string } {
  const trimmed = (cookie || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Por favor, introduce tu cookie de sesión sp_dc.' };
  }
  // Spotify sp_dc cookies always start with AQ and have standard length >= 50
  if (!trimmed.startsWith('AQ') || trimmed.length < 50) {
    return {
      valid: false,
      error: 'Cookie no válida. La cookie de sesión sp_dc de Spotify debe comenzar por "AQ" y contener el valor completo copiado de open.spotify.com.',
    };
  }
  return { valid: true };
}

/**
 * Dynamically extracts real Spotify user data from any provided sp_dc cookie.
 * Calls the backend extractor which authenticates directly with Spotify's Web Player API.
 */
export async function extractSpotifySessionFromCookie(cookie: string): Promise<ExtractedSession> {
  const validation = validateSpotifyCookie(cookie);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const trimmedCookie = cookie.trim();

  // Try extraction endpoint
  let res: Response;
  try {
    res = await fetch('/api/spotify/extract-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie: trimmedCookie }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (err: any) {
    // Retry with /api/extract-session directly if network failed or proxy route was bypassed
    try {
      res = await fetch('/api/extract-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: trimmedCookie }),
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new Error('Tiempo de espera agotado al conectar con los servidores de Spotify. Por favor, inténtalo de nuevo.');
    }
  }

  if (!res.ok) {
    let errorMsg = 'Error al verificar la cookie con Spotify.';
    try {
      const errData = await res.json();
      if (errData?.error) errorMsg = errData.error;
    } catch {}
    throw new Error(errorMsg);
  }

  const data = await res.json();
  if (!data || !data.user || !data.playlists) {
    throw new Error('La respuesta de Spotify no contiene datos de usuario válidos. Comprueba que tu sesión siga activa.');
  }

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem('user_spotify_cookie', trimmedCookie);
      if (data.user?.id) {
        window.localStorage.setItem('spotifree_active_user_id', data.user.id);
      }
      if (data.accessToken) {
        window.localStorage.setItem('spotify_access_token', data.accessToken);
      }
    } catch {}
  }

  return data as ExtractedSession;
}
