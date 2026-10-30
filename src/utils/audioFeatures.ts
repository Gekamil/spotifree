export interface AudioFeature {
  id: string;
  tempo: number; // BPM rounded to integer
  key: number; // 0-11
  mode: number; // 0 = Minor, 1 = Major
  camelot: string; // e.g. "9A", "11A", "7B"
  color: string; // Background color for badge chip
  textColor: string; // Foreground text color
  time_signature?: number;
}

// Spotify Pitch Class (0=C, 1=C#, 2=D, 3=D#, 4=E, 5=F, 6=F#, 7=G, 8=G#, 9=A, 10=A#, 11=B)
// Major (mode=1) -> B
const MAJOR_CAMELOT: Record<number, string> = {
  0: '8B',
  1: '3B',
  2: '10B',
  3: '5B',
  4: '12B',
  5: '7B',
  6: '2B',
  7: '9B',
  8: '4B',
  9: '11B',
  10: '6B',
  11: '1B',
};

// Minor (mode=0) -> A
const MINOR_CAMELOT: Record<number, string> = {
  0: '5A',
  1: '12A',
  2: '7A',
  3: '2A',
  4: '9A',
  5: '4A',
  6: '11A',
  7: '6A',
  8: '1A',
  9: '8A',
  10: '3A',
  11: '10A',
};

// Authentic Camelot color wheel matching Spotify DJ mode
const CAMELOT_COLORS: Record<string, { bg: string; text: string }> = {
  '1A': { bg: '#00cba9', text: '#000000' },
  '1B': { bg: '#00cba9', text: '#000000' },
  '2A': { bg: '#00bca4', text: '#000000' },
  '2B': { bg: '#00bca4', text: '#000000' },
  '3A': { bg: '#00b4d8', text: '#000000' },
  '3B': { bg: '#00b4d8', text: '#000000' },
  '4A': { bg: '#3a86ff', text: '#ffffff' },
  '4B': { bg: '#3a86ff', text: '#ffffff' },
  '5A': { bg: '#5e60ce', text: '#ffffff' },
  '5B': { bg: '#5e60ce', text: '#ffffff' },
  '6A': { bg: '#7b2cbf', text: '#ffffff' },
  '6B': { bg: '#7b2cbf', text: '#ffffff' },
  '7A': { bg: '#ee5283', text: '#ffffff' },
  '7B': { bg: '#ee5283', text: '#ffffff' }, // Magenta / Rose (Prince Royce "7B")
  '8A': { bg: '#f94144', text: '#ffffff' },
  '8B': { bg: '#f94144', text: '#ffffff' },
  '9A': { bg: '#9d78db', text: '#ffffff' }, // Lavender / Plum (Prince Royce "9A")
  '9B': { bg: '#9d78db', text: '#ffffff' },
  '10A': { bg: '#f3722c', text: '#000000' },
  '10B': { bg: '#f3722c', text: '#000000' },
  '11A': { bg: '#54d2e8', text: '#000000' }, // Vibrant Teal / Cyan (Xtreme "11A")
  '11B': { bg: '#54d2e8', text: '#000000' },
  '12A': { bg: '#10b981', text: '#000000' },
  '12B': { bg: '#10b981', text: '#000000' },
};

export function getCamelotKey(key: number, mode: number): string {
  const safeKey = ((key % 12) + 12) % 12;
  if (mode === 1) {
    return MAJOR_CAMELOT[safeKey] || '8B';
  }
  return MINOR_CAMELOT[safeKey] || '9A';
}

export function getCamelotVisuals(camelot: string): { bg: string; text: string } {
  return CAMELOT_COLORS[camelot] || { bg: '#9d78db', text: '#ffffff' };
}

// In-memory local cache
const FEATURE_CACHE = new Map<string, AudioFeature>();

/**
 * Deterministic fallback for when Spotify API is unreachable or track is custom/iTunes
 */
export function generateDeterministicFeature(trackId: string, trackName?: string): AudioFeature {
  const seed = `${trackId}-${trackName || ''}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  }
  const abs = Math.abs(hash);

  // Common tempos in latin/pop/urban/electronic: 90 to 135 BPM (common 128-132)
  const tempoChoices = [100, 108, 115, 120, 124, 125, 128, 130, 130, 132, 135];
  const tempo = tempoChoices[abs % tempoChoices.length];
  const key = abs % 12;
  const mode = (abs >> 2) % 2;
  const camelot = getCamelotKey(key, mode);
  const visuals = getCamelotVisuals(camelot);

  return {
    id: trackId,
    tempo,
    key,
    mode,
    camelot,
    color: visuals.bg,
    textColor: visuals.text,
    time_signature: 4,
  };
}

/**
 * Batch fetch audio features (BPM, Key, Mode, Camelot) for an array of track IDs
 */
export async function fetchAudioFeaturesBatch(
  tracks: Array<{ id: string; name?: string }>
): Promise<Record<string, AudioFeature>> {
  const result: Record<string, AudioFeature> = {};
  if (!tracks || tracks.length === 0) return result;

  const toFetch: string[] = [];

  for (const t of tracks) {
    const cleanId = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
    if (!cleanId) continue;

    if (FEATURE_CACHE.has(cleanId)) {
      result[cleanId] = FEATURE_CACHE.get(cleanId)!;
    } else {
      toFetch.push(cleanId);
    }
  }

  if (toFetch.length === 0) {
    return result;
  }

  try {
    const cookie =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('user_spotify_cookie') || ''
        : '';
    const headers: Record<string, string> = {};
    if (cookie) headers['x-spotify-cookie'] = cookie;

    // Fetch batch (up to 100 at a time)
    const chunks: string[][] = [];
    for (let i = 0; i < toFetch.length; i += 80) {
      chunks.push(toFetch.slice(i, i + 80));
    }

    await Promise.all(
      chunks.map(async (chunk) => {
        try {
          const res = await fetch(`/api/audio-features?ids=${chunk.join(',')}`, {
            headers,
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data?.audio_features)) {
              for (const feat of data.audio_features) {
                if (feat && feat.id) {
                  const tempo = Math.round(feat.tempo || 120);
                  const key = typeof feat.key === 'number' ? feat.key : 0;
                  const mode = typeof feat.mode === 'number' ? feat.mode : 1;
                  const camelot = getCamelotKey(key, mode);
                  const visuals = getCamelotVisuals(camelot);

                  const full: AudioFeature = {
                    id: feat.id,
                    tempo,
                    key,
                    mode,
                    camelot,
                    color: visuals.bg,
                    textColor: visuals.text,
                    time_signature: feat.time_signature || 4,
                  };
                  FEATURE_CACHE.set(feat.id, full);
                  result[feat.id] = full;
                }
              }
            }
          }
        } catch (e) {
          console.warn('[AudioFeatures] Chunk fetch error:', e);
        }
      })
    );
  } catch (err) {
    console.warn('[AudioFeatures] Batch fetch failed:', err);
  }

  // Fallback for any tracks still missing
  for (const t of tracks) {
    const cleanId = (t.id || '').replace(/^spotify:track:/i, '').split('?')[0].trim();
    if (!cleanId) continue;

    if (!result[cleanId]) {
      const fallback = generateDeterministicFeature(cleanId, t.name);
      FEATURE_CACHE.set(cleanId, fallback);
      result[cleanId] = fallback;
    }
  }

  return result;
}
