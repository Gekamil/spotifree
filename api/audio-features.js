import { getWebPlayerAuth } from './extract-session.js';

const AUDIO_FEATURES_CACHE = new Map();

/**
 * Deterministic hash-based fallback for audio features
 * Ensures all tracks (including local, YouTube, or unindexed Spotify tracks) have consistent BPM & musical key
 */
function getDeterministicFeatures(trackId) {
  let hash = 0;
  for (let i = 0; i < trackId.length; i++) {
    hash = (hash * 31 + trackId.charCodeAt(i)) & 0xffffffff;
  }
  const absHash = Math.abs(hash);

  // Common tempos in latin, pop, urban, and dance: 90 to 134 BPM
  const tempoChoices = [95, 100, 105, 110, 115, 120, 124, 126, 128, 130, 132, 135];
  const tempo = tempoChoices[absHash % tempoChoices.length];

  // Musical key (0 to 11)
  const key = absHash % 12;

  // Mode: 1 for Major, 0 for Minor
  const mode = (absHash >> 3) % 2;

  return {
    id: trackId,
    tempo,
    key,
    mode,
    time_signature: 4,
    fallback: true,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-spotify-cookie');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const idsParam = req.query?.ids || '';
  if (!idsParam) {
    return res.status(200).json({ audio_features: [] });
  }

  const rawIds = idsParam.split(',').map((id) => id.replace(/^spotify:track:/i, '').split('?')[0].trim()).filter(Boolean);
  if (rawIds.length === 0) {
    return res.status(200).json({ audio_features: [] });
  }

  const cookie = req.headers['x-spotify-cookie'] || req.query?.cookie || '';
  const result = [];
  const missingFromCache = [];

  for (const id of rawIds) {
    if (AUDIO_FEATURES_CACHE.has(id)) {
      result.push(AUDIO_FEATURES_CACHE.get(id));
    } else {
      missingFromCache.push(id);
    }
  }

  if (missingFromCache.length > 0) {
    // Only query Spotify for valid 22-char Spotify IDs
    const spotifyCandidateIds = missingFromCache.filter((id) => /^[a-zA-Z0-9]{22}$/.test(id));

    if (spotifyCandidateIds.length > 0) {
      try {
        const auth = await getWebPlayerAuth(cookie);
        if (auth?.accessToken) {
          // Spotify allows up to 100 IDs per request
          const batch = spotifyCandidateIds.slice(0, 100);
          const spRes = await fetch(`https://api.spotify.com/v1/audio-features?ids=${batch.join(',')}`, {
            headers: {
              Authorization: `Bearer ${auth.accessToken}`,
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            signal: AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
          });

          if (spRes.ok) {
            const data = await spRes.json();
            if (Array.isArray(data?.audio_features)) {
              for (const feat of data.audio_features) {
                if (feat && feat.id) {
                  const cleaned = {
                    id: feat.id,
                    tempo: Math.round(feat.tempo || 120),
                    key: typeof feat.key === 'number' ? feat.key : 0,
                    mode: typeof feat.mode === 'number' ? feat.mode : 1,
                    time_signature: feat.time_signature || 4,
                  };
                  AUDIO_FEATURES_CACHE.set(feat.id, cleaned);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('[AudioFeatures] Spotify API fetch failed, falling back:', err?.message);
      }
    }

    // For any remaining tracks not in cache, generate deterministic fallback
    for (const id of missingFromCache) {
      if (AUDIO_FEATURES_CACHE.has(id)) {
        result.push(AUDIO_FEATURES_CACHE.get(id));
      } else {
        const fallback = getDeterministicFeatures(id);
        AUDIO_FEATURES_CACHE.set(id, fallback);
        result.push(fallback);
      }
    }
  }

  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  return res.status(200).json({ audio_features: result });
}
