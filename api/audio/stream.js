/**
 * Spotifree Mobile Audio Stream API
 * Returns a full-length audio stream URL for mobile HTML5 <audio> playback.
 * Used instead of YT IFrame on mobile so MediaSession (lockscreen controls) works fully.
 *
 * Strategy:
 *  1. Resolve videoId via YouTube Music Innertube (same as resolve.js)
 *  2. Get streamable audio URL from Invidious public instances
 *  3. Redirect 302 to audio URL (browser plays it natively)
 */

const INVIDIOUS_INSTANCES = [
  'https://invidious.privacyredirect.com',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yt.drgnz.club',
];

function fetchWithTimeout(url, opts, ms = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

async function resolveVideoId(query) {
  try {
    const res = await fetchWithTimeout(
      'https://music.youtube.com/youtubei/v1/search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({
          context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20240318.01.00', hl: 'es', gl: 'ES' } },
          query,
          params: 'Eg-KAQwIARAAGAAgACgAMABqChAEEAMQCRAFEAo%3D',
        }),
      },
      5000
    );
    if (res.ok) {
      const text = await res.text();
      const matches = [...text.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map(m => m[1]);
      if (matches[0]) return matches[0];
    }
  } catch {}

  // Fallback: YouTube web search
  try {
    const res = await fetchWithTimeout(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' official audio')}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
      5000
    );
    if (res.ok) {
      const html = await res.text();
      const matches = [...html.matchAll(/\/watch\?v=([a-zA-Z0-9_-]{11})/g)].map(m => m[1]);
      if (matches[0]) return matches[0];
    }
  } catch {}

  return null;
}

async function getInvidiousAudioUrl(videoId) {
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const res = await fetchWithTimeout(`${base}/api/v1/videos/${videoId}?fields=adaptiveFormats`, {}, 5000);
      if (!res.ok) continue;
      const data = await res.json();
      const formats = data.adaptiveFormats || [];
      // Prefer opus/webm audio, fallback to mp4a
      const audio = formats
        .filter(f => f.type?.startsWith('audio/') && f.url)
        .sort((a, b) => (parseInt(b.bitrate) || 0) - (parseInt(a.bitrate) || 0));
      if (audio[0]?.url) return audio[0].url;
    } catch {}
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const q = (req.query?.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Missing query q' });

  try {
    const videoId = await resolveVideoId(q);
    if (!videoId) return res.status(404).json({ error: 'Video not found' });

    const audioUrl = await getInvidiousAudioUrl(videoId);
    if (!audioUrl) return res.status(404).json({ error: 'Audio stream not found' });

    // Redirect directly to the audio stream so HTML5 <audio> can play it natively
    return res.redirect(302, audioUrl);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
