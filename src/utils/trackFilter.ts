import type { Track } from '../types/spotify';

/**
 * Regex identifying non-music noise, white noise, ambient sounds,
 * sleep sounds, nature loops, sound effects, binaural tones, etc.
 */
const NOISE_AND_NON_MUSIC_REGEX = new RegExp(
  '\\b(' +
    [
      // White / Pink / Brown / Green / Grey / Black Noise
      'ruido\\s+blanco',
      'white\\s+noise',
      'ruido\\s+rosa',
      'pink\\s+noise',
      'ruido\\s+marr[oó]n',
      'brown\\s+noise',
      'green\\s+noise',
      'grey\\s+noise',
      'gray\\s+noise',
      'red\\s+noise',
      'black\\s+noise',
      'pure\\s+noise',
      'static\\s+noise',
      'sonido\\s+est[aá]tico',
      'ambient\\s+noise',
      'ruido\\s+ambiental',

      // Rain, Storm, Water, Waves, Wind
      'sonido(s)?\\s+de\\s+lluvia',
      'rain\\s+sound(s)?',
      'heavy\\s+rain',
      'rain\\s+on\\s+(window|roof|tent)',
      'lluvia\\s+para\\s+dormir',
      'sonido(s)?\\s+de\\s+(tormenta|truenos)',
      'thunderstorm\\s+sound(s)?',
      'sonido(s)?\\s+de\\s+olas',
      'olas\\s+del\\s+mar',
      'ocean\\s+waves',
      'sea\\s+waves',
      'sonido(s)?\\s+de\\s+agua',
      'water\\s+sound(s)?',
      'waterfall\\s+sound(s)?',
      'river\\s+stream',
      'sonido(s)?\\s+de\\s+viento',
      'wind\\s+sound(s)?',

      // Household & Machine sounds
      'sonido(s)?\\s+de\\s+ventilador',
      'fan\\s+sound(s)?',
      'fan\\s+noise',
      'box\\s+fan',
      'ceiling\\s+fan',
      'secador\\s+de\\s+pelo',
      'hair\\s+dryer',
      'aspiradora',
      'vacuum\\s+cleaner',
      'washing\\s+machine\\s+sound',
      'airplane\\s+cabin',
      'cabin\\s+noise',

      // Binaural beats, Frequencies, Solfeggio, Isochronic
      'binaural\\s+beat(s)?',
      'ondas?\\s+(alfa|delta|theta|gamma|cerebrales)',
      'alpha\\s+waves?',
      'delta\\s+waves?',
      'theta\\s+waves?',
      'brainwaves?',
      'isochronic\\s+tones?',
      'solfeggio',
      'frecuencia(s)?\\s+\\d+\\s*hz',
      '\\b(174|285|396|417|432|528|639|741|852|963)\\s*hz\\b',
      'sine\\s+wave',
      'test\\s+tone',

      // Sleep & Baby calming
      'sonido(s)?\\s+para\\s+dormir',
      'sleep\\s+sound(s)?',
      'deep\\s+sleep\\s+(ambient|noise|sounds?)',
      'para\\s+dormir\\s+beb[eé]s?',
      'calmar\\s+beb[eé]s?',
      'baby\\s+sleep\\s+(sounds?|noise)',
      'colic\\s+baby',
      'sleep\\s+therapy',
      'sleeping\\s+aid',

      // Nature & Environmental Loops
      'sonido(s)?\\s+de\\s+la\\s+naturaleza',
      'nature\\s+sound(s)?',
      'forest\\s+sound(s)?',
      'jungle\\s+ambient',
      'crickets\\s+chirping',
      'birdsong\\s+ambient',

      // Effects, Ticking, ASMR non-music
      'sound\\s+effects?',
      'efectos?\\s+de\\s+sonido',
      'ticking\\s+clock',
      'sonido\\s+de\\s+reloj',
      'metr[oó]nomo',
      'asmr\\s+(whispering|tapping|no\\s+talking|mouth\\s+sounds)',
      'meditaci[oó]n\\s+guiada',
      'guided\\s+meditation',
    ].join('|') +
    ')\\b',
  'i'
);

const NOISE_ARTIST_REGEX = new RegExp(
  '\\b(' +
    [
      'white noise',
      'ruido blanco',
      'sleep sounds',
      'sound effects',
      'nature sounds',
      'rain sounds',
      'ambient noise',
      'binaural beats',
      'relaxing sounds',
      'calming sounds',
      'sound library',
      'sleep therapy',
      'noise generator',
      'baby sleep',
      'deep sleep',
      'fan sounds',
      'soothing sounds',
      'sleep aid',
      'white noise research',
      'brainwave',
    ].join('|') +
    ')\\b',
  'i'
);

/**
 * Checks whether a track is white noise, nature sounds, sleep loops, or non-musical junk.
 * Returns true if the track should be FILTERED OUT.
 */
export function isNonMusicOrNoise(
  track: Partial<Track> | { name?: string; title?: string; artists?: any[]; artist?: string; album?: any; duration_ms?: number }
): boolean {
  if (!track) return true;

  const title = (track.name || (track as any).title || '').toLowerCase().trim();
  const artistStr = (
    Array.isArray(track.artists)
      ? track.artists.map((a: any) => (typeof a === 'string' ? a : a?.name || '')).join(' ')
      : typeof (track as any).artist === 'string'
      ? (track as any).artist
      : ''
  ).toLowerCase().trim();

  const albumName = (
    typeof track.album === 'string'
      ? track.album
      : track.album?.name || ''
  ).toLowerCase().trim();

  // If empty title or artist
  if (!title || title.length < 2) return true;

  // 1. Direct noise & non-music regex check across title, artist and album
  const fullText = `${title} • ${artistStr} • ${albumName}`;
  if (NOISE_AND_NON_MUSIC_REGEX.test(fullText)) {
    return true;
  }

  // 2. Specific check on artist identity
  if (NOISE_ARTIST_REGEX.test(artistStr)) {
    return true;
  }

  // 3. Excessive duration filter (typical white noise tracks uploaded as 30m, 1h, 8h loops)
  if (track.duration_ms && track.duration_ms > 900000) {
    // > 15 minutes is almost guaranteed to be an ambient/noise sleep loop
    return true;
  }

  // 4. Ultra-short sound effect filter (< 25s without artist)
  if (track.duration_ms && track.duration_ms < 25000 && (!artistStr || artistStr === 'desconocido' || artistStr === 'various artists')) {
    return true;
  }

  return false;
}

/**
 * Helper to filter an array of tracks, stripping any white noise or non-music tracks.
 */
export function filterMusicTracksOnly<T extends Partial<Track> | { name?: string; title?: string }>(tracks: T[]): T[] {
  if (!Array.isArray(tracks)) return [];
  return tracks.filter((t) => !isNonMusicOrNoise(t));
}
