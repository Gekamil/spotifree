import type { Track } from '../types/spotify';

/**
 * Deduplicates an array of tracks strictly by ID and (normalized title + primary artist).
 * Guarantees that neither shuffle, DJ Automix, nor playlist loading ever generates duplicate rows.
 */
export function deduplicateTracks(tracks: Track[]): Track[] {
  if (!tracks || !Array.isArray(tracks) || tracks.length === 0) return [];

  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  const result: Track[] = [];

  for (const track of tracks) {
    if (!track) continue;

    const rawId = track.id ? String(track.id).trim() : '';
    const cleanId = rawId.replace(/^spotify:track:/i, '').split('?')[0].trim();

    const cleanTitle = (track.name || '')
      .toLowerCase()
      .replace(/\s*\(.*?\)/g, '')
      .replace(/\s*\[.*?\]/g, '')
      .replace(/\s*-\s*(remaster|remix|version|radio|edit|live).*$/i, '')
      .replace(/[^\p{L}\p{N}]/gu, '')
      .trim();

    const rawArtist = track.artists?.[0]?.name || '';
    const cleanArtist = rawArtist
      .toLowerCase()
      .split(/[,&]/)[0]
      .replace(/\s*(feat\.|ft\.).*$/i, '')
      .replace(/[^\p{L}\p{N}]/gu, '')
      .trim();

    const normKey = cleanTitle && cleanArtist ? `${cleanTitle}:::${cleanArtist}` : null;

    if (cleanId && seenIds.has(cleanId)) continue;
    if (normKey && seenKeys.has(normKey)) continue;

    if (cleanId) seenIds.add(cleanId);
    if (normKey) seenKeys.add(normKey);

    result.push(track);
  }

  return result;
}
