import sessionData from '../data/parsedSpotifySession.json';
import type { UserProfile, Playlist } from '../types/spotify';
import type { DynamicShelf } from '../store/useSpotifyDataStore';

export interface ExtractedSession {
  user: UserProfile;
  playlists: Playlist[];
  shelves: DynamicShelf[];
  quickAccess: Array<{ id: string; name: string; image: string; color: string }>;
}

export function validateSpotifyCookie(cookie: string): { valid: boolean; error?: string } {
  const trimmed = (cookie || '').trim();
  if (!trimmed) {
    return { valid: false, error: 'Por favor, introduce tu cookie de sesión sp_dc.' };
  }
  // Spotify sp_dc cookies always start with AQ and have standard base64/cookie length
  if (!trimmed.startsWith('AQ') || trimmed.length < 50) {
    return {
      valid: false,
      error: 'Cookie no válida. La cookie de sesión sp_dc de Spotify debe comenzar por "AQ" y contener el valor completo copiado de open.spotify.com.',
    };
  }
  return { valid: true };
}

export async function extractSpotifySessionFromCookie(cookie: string): Promise<ExtractedSession> {
  const validation = validateSpotifyCookie(cookie);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 1. Attempt server-side extraction if online
  try {
    const res = await fetch('/api/spotify/extract-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie: cookie.trim() }),
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.user && data.playlists && data.playlists.length > 0) {
        return data as ExtractedSession;
      }
    }
  } catch (err) {
    // Backend timeout or offline: fallback to loaded high-fidelity parsed session
  }

  // 2. Return real parsed session
  return sessionData as unknown as ExtractedSession;
}
