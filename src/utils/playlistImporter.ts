import type { Playlist, Track } from '../types/spotify';
import { saveSharedPlaylist } from './userStorage';
import { stripHtml } from './formatters';
import { searchSpotify } from '../services/spotifyApi';

export interface ImportResult {
  success: boolean;
  playlist?: Playlist;
  error?: string;
  /** Songs found in the catalog / songs read */
  matched?: number;
  total?: number;
}

/** Progress while each song is looked up: (done, total) */
export type ImportProgress = (done: number, total: number) => void;

interface ExternalSong {
  title: string;
  artist: string;
  durationSec?: number;
  videoId?: string;
}

const FALLBACK_COVER = 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';
const norm = (s: string) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const artistsOf = (s: string) =>
  String(s || '')
    .split(/\s*(?:,|&| y | and | x | feat\.?| ft\.?| con )\s*/i)
    .map(norm)
    .filter(Boolean);
const hasWord = (hay: string, needle: string) => (` ${hay} `).includes(` ${needle} `);

/** The catalog song that is really this song (same title, same performer), or null */
async function findInCatalog(song: ExternalSong): Promise<Track | null> {
  const wanted = artistsOf(song.artist);
  const q = `${song.title} ${wanted[0] || ''}`.trim();
  const search = async (): Promise<Track[]> => {
    let res: any = null;
    try {
      res = await Promise.race([searchSpotify(q), new Promise((r) => setTimeout(() => r(null), 8000))]);
    } catch {
      res = null;
    }
    return (Array.isArray(res?.tracks) ? res.tracks : res?.tracks?.items || []).filter((t: any) => t?.id && t?.name);
  };
  let list = await search();
  // Many searches in a row sometimes come back empty: try once more
  if (!list.length) {
    await new Promise((r) => setTimeout(r, 700));
    list = await search();
  }
  const title = norm(song.title);
  let best: Track | null = null;
  let bestScore = 0;
  for (const t of list.slice(0, 10)) {
    const tName = norm(t.name);
    const tArtists = (t.artists || []).map((a) => norm(a.name));
    let score = 0;
    if (tName === title) score += 5;
    else if (tName.startsWith(title) || title.startsWith(tName)) score += 3;
    else if (tName.includes(title) || title.includes(tName)) score += 2;
    else continue;
    if (wanted.some((w) => tArtists.some((a) => a === w || hasWord(a, w) || hasWord(w, a)))) score += 4;
    else if (wanted.length) score -= 2;
    if (song.durationSec && t.duration_ms && Math.abs(t.duration_ms / 1000 - song.durationSec) <= 8) score += 1;
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  return bestScore >= 5 ? best : null;
}

/** A song that is not in the catalog: still playable (the player finds it by name and artist) */
function looseTrack(song: ExternalSong, idx: number, cover: string): Track {
  return {
    id: `imported-${Date.now().toString(36)}-${idx}`,
    name: song.title,
    duration_ms: (song.durationSec || 210) * 1000,
    artists: artistsOf(song.artist).length
      ? song.artist.split(/\s*(?:,|&| y )\s*/).filter(Boolean).map((n, i) => ({ id: `imp-art-${idx}-${i}`, name: n.trim() }))
      : [{ id: `imp-art-${idx}`, name: song.artist || 'Desconocido' }],
    album: {
      id: `imp-alb-${idx}`,
      name: song.title,
      images: [{ url: song.videoId ? `https://i.ytimg.com/vi/${song.videoId}/hqdefault.jpg` : cover }],
    },
  } as Track;
}

async function matchAll(songs: ExternalSong[], cover: string, onProgress?: ImportProgress) {
  const out: (Track | null)[] = new Array(songs.length).fill(null);
  let done = 0;
  let matched = 0;
  let next = 0;
  onProgress?.(0, songs.length);
  const worker = async () => {
    while (next < songs.length) {
      const i = next++;
      const found = await findInCatalog(songs[i]);
      if (found) matched++;
      out[i] = found || looseTrack(songs[i], i, cover);
      done++;
      onProgress?.(done, songs.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  // The same song twice (it happens in YouTube playlists): keep the first
  const seen = new Set<string>();
  const tracks = (out.filter(Boolean) as Track[]).filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
  return { tracks, matched };
}

function finish(pl: Playlist, userId: string, userName: string): void {
  saveSharedPlaylist({
    id: pl.id,
    name: pl.name,
    description: stripHtml(pl.description),
    coverUrl: pl.images?.[0]?.url,
    ownerId: userId,
    ownerName: userName,
    tracks: pl.tracks.items || [],
    isCollaborative: true,
    updatedAt: Date.now(),
  });
}

const SOURCE_NAME: Record<string, string> = { ytmusic: 'YouTube Music', youtube: 'YouTube', apple: 'Apple Music', deezer: 'Deezer' };

export async function importExternalPlaylist(
  urlOrText: string,
  user?: { id?: string; display_name?: string },
  onProgress?: ImportProgress
): Promise<ImportResult> {
  const input = urlOrText.trim();
  if (!input) {
    return { success: false, error: 'Por favor, introduce un enlace o texto válido.' };
  }

  const userId = user?.id || 'me';
  const userName = user?.display_name || 'Tú';

  try {
    // 1. Spotify playlist URL: open.spotify.com/playlist/ID
    const spotifyMatch = input.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?playlist\/([a-zA-Z0-9]+)/i);
    if (spotifyMatch) {
      const playlistId = spotifyMatch[1];
      const res = await fetch(`/api/playlist?id=${encodeURIComponent(playlistId)}`);
      if (res.ok) {
        const data = await res.json();
        const pl: Playlist = {
          id: `imported-sp-${playlistId}`,
          name: data.name || 'Playlist de Spotify Importada',
          description: stripHtml(data.description) || `Importada desde Spotify por ${userName}`,
          images: data.images?.length > 0 ? data.images : [{ url: FALLBACK_COVER }],
          owner: { display_name: userName, id: userId },
          tracks: {
            total: data.tracks?.items?.length || 0,
            items: (data.tracks?.items || []).map((t: Track) => ({ ...t, added_by: userName, added_at: 'Hoy' })),
          },
        };
        finish(pl, userId, userName);
        return { success: true, playlist: pl, matched: pl.tracks.total, total: pl.tracks.total };
      }
      return { success: false, error: 'No se pudo leer esa playlist de Spotify. ¿Es pública?' };
    }

    // 2. YouTube Music, YouTube, Apple Music and Deezer: read the real songs, then find each one
    if (/youtube\.com|youtu\.be|music\.apple\.com|itunes\.apple\.com|deezer\.com|deezer\.page\.link|dzr\.page\.link|amazon\.|amzn\.to/i.test(input)) {
      const res = await fetch(`/api/import-playlist?url=${encodeURIComponent(input)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        return {
          success: false,
          error:
            data?.reason === 'amazon'
              ? 'Amazon Music no deja leer sus playlists desde fuera de su app. Copia los nombres de las canciones y pégalos aquí, una por línea («Canción - Artista»).'
              : data?.reason === 'unsupported'
                ? 'Ese enlace no es de una playlist o un álbum. Copia el enlace de la playlist (en YouTube, el que lleva "list=").'
                : 'No se pudo leer la playlist. Comprueba que es pública.',
        };
      }
      const songs: ExternalSong[] = (data.tracks || []).filter((t: ExternalSong) => t?.title);
      if (!songs.length) return { success: false, error: 'La playlist está vacía o es privada.' };
      const cover = data.image || FALLBACK_COVER;
      const { tracks, matched } = await matchAll(songs, cover, onProgress);
      const from = SOURCE_NAME[data.source] || 'otra app';
      const pl: Playlist = {
        id: `imported-${data.source}-${Date.now().toString(36)}`,
        name: data.name || `Playlist de ${from}`,
        description: `Importada desde ${from}`,
        images: [{ url: tracks.find((t) => t.album?.images?.[0]?.url && !String(t.id).startsWith('imported-'))?.album?.images?.[0]?.url || cover }],
        owner: { display_name: userName, id: userId },
        tracks: { total: tracks.length, items: tracks.map((t) => ({ ...t, added_by: userName, added_at: 'Hoy' })) },
      };
      finish(pl, userId, userName);
      return { success: true, playlist: pl, matched, total: songs.length };
    }

    if (/soundcloud\.com|tidal\.com/i.test(input)) {
      return {
        success: false,
        error: 'De momento se puede importar desde Spotify, YouTube, YouTube Music, Apple Music y Deezer. También puedes pegar las canciones, una por línea.',
      };
    }

    // 3. A list of songs, one per line: "Song - Artist"
    const lines = input.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0 && !/^https?:\/\//i.test(lines[0])) {
      const songs: ExternalSong[] = lines.map((line) => {
        const parts = line.split(/\s+[-–—]\s+|\s*[-–—]\s*/);
        return { title: (parts[0] || line).trim(), artist: (parts[1] || '').trim() };
      });
      const { tracks, matched } = await matchAll(songs, FALLBACK_COVER, onProgress);
      const pl: Playlist = {
        id: `imported-custom-${Date.now()}`,
        name: lines.length === 1 ? lines[0] : `Mix importado (${tracks.length} temas)`,
        description: `Importado por ${userName}`,
        images: [{ url: tracks[0]?.album?.images?.[0]?.url || FALLBACK_COVER }],
        owner: { display_name: userName, id: userId },
        tracks: { total: tracks.length, items: tracks.map((t) => ({ ...t, added_by: userName, added_at: 'Hoy' })) },
      };
      finish(pl, userId, userName);
      return { success: true, playlist: pl, matched, total: songs.length };
    }

    return { success: false, error: 'Formato no reconocido. Pega un enlace de Spotify, YouTube, YouTube Music o Apple Music, o una lista de canciones.' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al importar la playlist.' };
  }
}
