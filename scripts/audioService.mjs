import { spawn } from 'node:child_process';
import readline from 'node:readline';
import https from 'node:https';
import path from 'node:path';
import {
  extractViaMonochrome,
  extractViaSoundCloud,
  scoreInstrumentalCandidate,
  findInstrumentalOnMonochrome,
  findInstrumentalOnSoundCloud,
} from '../api/_lib/musicFallback.js';

const CACHE = new Map(); // target -> { id, url, duration, title, timestamp }
const pendingRequests = new Map();
let reqCounter = 0;
let pythonProcess = null;
let rl = null;
let isReady = false;

export async function resolveYouTubeVideoId(query) {
  const cleanQ = (query || '').trim();
  if (!cleanQ) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleanQ)) return cleanQ;

  const cached = CACHE.get(`yt_vid_${cleanQ}`);
  if (cached && Date.now() - cached.timestamp < 12 * 3600 * 1000) {
    return cached.id;
  }

  // 1. YouTube Music Innertube search
  try {
    const ytmRes = await fetch('https://music.youtube.com/youtubei/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB_REMIX',
            clientVersion: '1.20240318.01.00',
            hl: 'es',
            gl: 'ES',
          },
        },
        query: cleanQ,
      }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined,
    });
    if (ytmRes.ok) {
      const data = await ytmRes.json();
      const sections = data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents || [];
      for (const sec of sections) {
        const shelf = sec.musicShelfRenderer || sec.musicCardShelfRenderer;
        if (shelf) {
          for (const item of shelf.contents || []) {
            const itemRenderer = item.musicResponsiveListItemRenderer;
            // 1. Sanity check: discard teasers, snippets, previews, and shorts
            const titleRun = itemRenderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.title?.runs?.[0]?.text || '';
            const titleLower = titleRun.toLowerCase();
            if (
              titleLower.includes('teaser') ||
              titleLower.includes('snippet') ||
              titleLower.includes('preview') ||
              titleLower.includes('#shorts') ||
              titleLower.includes('30s') ||
              titleLower.includes('adelanto')
            ) {
              continue;
            }

            // 2. Check duration if present in columns (reject < 50s clips)
            let isShortDuration = false;
            const fixedCols = itemRenderer?.fixedColumns || [];
            for (const col of fixedCols) {
              const text = col?.musicResponsiveListItemFixedColumnRenderer?.title?.runs?.[0]?.text || '';
              if (/^0:[0-4][0-9]$/.test(text.trim())) {
                isShortDuration = true;
                break;
              }
            }
            if (isShortDuration) continue;

            const playNav = itemRenderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint;
            const videoId = playNav?.watchEndpoint?.videoId || itemRenderer?.navigationEndpoint?.watchEndpoint?.videoId;
            if (videoId) {
              CACHE.set(`yt_vid_${cleanQ}`, { id: videoId, timestamp: Date.now() });
              return videoId;
            }
          }
        }
      }
    }
  } catch {}

  // 2. Structured search via searchYouTubeTracks with title/artist scoring
  try {
    const candidates = await searchYouTubeTracks(cleanQ, 8);
    if (candidates && candidates.length > 0) {
      const qWords = cleanQ.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
      
      let bestCandidate = null;
      let highestScore = -999;

      for (const cand of candidates) {
        const cleanVidId = (cand.id || '').replace(/^yt-/, '').trim();
        if (!cleanVidId || cleanVidId.length !== 11) continue;

        const candTitle = (cand.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const candArtist = (cand.artists?.[0]?.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const combined = `${candTitle} ${candArtist}`;

        let score = 0;
        for (const w of qWords) {
          if (candTitle.includes(w)) score += 3;
          if (candArtist.includes(w)) score += 2;
        }

        // Duration sanity check: strictly eliminate shorts / teasers under 50 seconds
        const durSec = (cand.duration_ms || 0) / 1000;
        if (durSec > 0 && durSec < 50) {
          continue; // Discard previews, snippets, and shorts
        }

        if (durSec >= 60 && durSec <= 480) {
          score += 3; // Standard song duration bonus
        } else if (durSec > 600) {
          score -= 10; // Penalize 10-minute+ mixes, albums, podcasts
        }

        // Bonus for official / high quality matches
        if (combined.includes('official') || combined.includes('audio') || combined.includes('video') || combined.includes('visualizer')) {
          score += 2;
        }

        if (score > highestScore) {
          highestScore = score;
          bestCandidate = cleanVidId;
        }
      }

      const validCandidates = candidates.filter(c => !c.duration_ms || (c.duration_ms / 1000) >= 50);
      const winnerId = bestCandidate || (validCandidates[0]?.id || '').replace(/^yt-/, '');
      if (winnerId) {
        CACHE.set(`yt_vid_${cleanQ}`, { id: winnerId, timestamp: Date.now() });
        return winnerId;
      }
    }
  } catch {}

  return null;
}

function ensureWorker() {
  if (pythonProcess && !pythonProcess.killed) return;

  const scriptPath = path.resolve('scripts/audio_resolver.py');
  const pythonCmd = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
  pythonProcess = spawn(pythonCmd, ['-u', scriptPath], {
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  rl = readline.createInterface({ input: pythonProcess.stdout });

  rl.on('line', (line) => {
    try {
      const data = JSON.parse(line);
      if (data.status === 'ready') {
        isReady = true;
        return;
      }
      if (data.req_id && pendingRequests.has(data.req_id)) {
        const { resolve, reject } = pendingRequests.get(data.req_id);
        pendingRequests.delete(data.req_id);
        if (data.error) {
          reject(new Error(data.error));
        } else {
          resolve(data);
        }
      }
    } catch (e) {
      console.error('[audioWorker] Failed to parse output:', line, e);
    }
  });

  pythonProcess.on('exit', (code) => {
    console.log('[audioWorker] Python worker exited with code', code);
    pythonProcess = null;
    isReady = false;
    for (const [, { reject }] of pendingRequests) {
      reject(new Error('Worker process exited'));
    }
    pendingRequests.clear();
  });
}

// Ensure worker starts immediately
ensureWorker();

export async function resolveAudio(target) {
  if (!target) throw new Error('Missing audio target');
  const cleanTarget = target.trim();

  // Check cache (expire after 4 hours)
  const cached = CACHE.get(cleanTarget);
  if (cached && Date.now() - cached.timestamp < 4 * 3600 * 1000) {
    return cached;
  }

  // Pre-resolve search queries to YouTube Video IDs to prevent slow/blocked searches
  let finalTarget = cleanTarget;
  if (!cleanTarget.startsWith('http') && !/^[a-zA-Z0-9_-]{11}$/.test(cleanTarget)) {
    const videoId = await resolveYouTubeVideoId(cleanTarget);
    if (videoId) {
      finalTarget = `https://www.youtube.com/watch?v=${videoId}`;
    }
  }

  ensureWorker();

  const req_id = String(++reqCounter);

  const promise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(req_id);
      reject(new Error(`Timeout resolving audio for "${cleanTarget}"`));
    }, 45000);

    pendingRequests.set(req_id, {
      resolve: (data) => {
        clearTimeout(timeout);
        const item = { ...data, timestamp: Date.now() };
        CACHE.set(cleanTarget, item);
        if (item.id) CACHE.set(item.id, item);
        resolve(item);
      },
      reject: (err) => {
        clearTimeout(timeout);
        reject(err);
      },
    });
  });

  pythonProcess.stdin.write(JSON.stringify({ req_id, target: finalTarget }) + '\n');
  return promise;
}

let YT_VIS_PROMISE = null;
const DIRECT_STREAM_CACHE = new Map();

async function extractDirectYouTubeAudio(videoId) {
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;
  const cached = DIRECT_STREAM_CACHE.get(videoId);
  if (cached && Date.now() - cached.ts < 600_000) return cached;

  try {
    const { Innertube } = await import('youtubei.js');
    for (const ct of ['VISIONOS', 'IOS', 'ANDROID_VR']) {
      try {
        const yt =
          ct === 'VISIONOS'
            ? await (YT_VIS_PROMISE || (YT_VIS_PROMISE = Innertube.create({ client_type: 'VISIONOS', retrieve_player: false })))
            : await Innertube.create({ client_type: ct, retrieve_player: false });
        const info = await yt.getBasicInfo(videoId, { client: ct });
        const formats = [...(info.streaming_data?.adaptive_formats || []), ...(info.streaming_data?.formats || [])]
          .filter((f) => f.mime_type?.startsWith('audio/') && f.url);
        const chosen = formats.find((f) => String(f.itag) === '140') || formats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
        if (chosen?.url) {
          const entry = {
            url: chosen.url,
            mime: (chosen.mime_type || 'audio/mp4').split(';')[0].trim(),
            clen: parseInt(String(chosen.content_length || '0'), 10) || 0,
            ts: Date.now(),
          };
          DIRECT_STREAM_CACHE.set(videoId, entry);
          return entry;
        }
      } catch {
        if (ct === 'VISIONOS') YT_VIS_PROMISE = null;
      }
    }
  } catch {}
  return null;
}

export async function streamAudioDirect(target, req, res, startSeconds = 0, options = {}) {
  const rawQuery = (options.q || target || '').trim();
  let cleanTarget = (target || '').trim();
  const isMonoId = /^mono:\d{10,25}$/.test(cleanTarget);
  const isScId = /^sc[:\-]\d+$/.test(cleanTarget);
  let videoId = /^[a-zA-Z0-9_-]{11}$/.test(cleanTarget) ? cleanTarget : null;
  if (!videoId && !isMonoId && !isScId && !cleanTarget.startsWith('http')) {
    try {
      videoId = await resolveYouTubeVideoId(rawQuery || cleanTarget);
    } catch {}
  }

  // Fast direct extraction: Innertube VISIONOS/IOS -> Monochrome lossless -> SoundCloud MP3 / HLS fMP4
  if (startSeconds <= 0) {
    let direct = videoId ? await extractDirectYouTubeAudio(videoId) : null;
    if (!direct?.url && !direct?.streamBuffer) {
      const fbOpts = {
        q: rawQuery || cleanTarget,
        title: options.title || '',
        artist: options.artist || '',
        expectedDurationSec: options.expectedDurationSec || 0,
        explicitId: isMonoId || isScId ? cleanTarget : '',
      };
      direct = (await extractViaMonochrome(fbOpts)) || (await extractViaSoundCloud(fbOpts));
    }
    if (direct?.streamBuffer && Buffer.isBuffer(direct.streamBuffer)) {
      const resolvedId = direct.id || videoId || '';
      const fullBuf = direct.streamBuffer;
      try {
        if (options.transcodeMp3) {
          const { Readable } = await import('node:stream');
          res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Transfer-Encoding': 'chunked',
            'Access-Control-Allow-Origin': '*',
            'X-Audio-Source': direct.source || 'soundcloud-hls',
            'X-Video-Id': resolvedId,
            ...(options.headers || {}),
          });
          const ff = spawn('ffmpeg', ['-loglevel', 'error', '-i', 'pipe:0', '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', '-f', 'mp3', 'pipe:1']);
          Readable.from([fullBuf]).pipe(ff.stdin);
          ff.stdout.pipe(res);
          req.on('close', () => {
            try { ff.kill(); } catch {}
          });
          return;
        }
        const rangeMatch = String(req.headers.range || '').match(/bytes=(\d+)-(\d*)/i);
        const start = rangeMatch ? Math.max(0, parseInt(rangeMatch[1], 10)) : 0;
        const end = rangeMatch && rangeMatch[2] ? Math.min(fullBuf.length - 1, parseInt(rangeMatch[2], 10)) : fullBuf.length - 1;
        const slice = fullBuf.subarray(start, end + 1);
        const isPartial = Boolean(rangeMatch);
        res.writeHead(isPartial ? 206 : 200, {
          'Content-Type': direct.mime || 'audio/mp4',
          'Content-Length': String(slice.length),
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Disposition, X-Video-Id, X-Total-Length, X-Audio-Source, X-Audio-Mime, X-Audio-Ext, X-Direct-Audio-Url',
          'X-Audio-Source': direct.source || 'soundcloud-hls',
          'X-Audio-Mime': direct.mime || 'audio/mp4',
          'X-Audio-Ext': direct.ext || 'm4a',
          'X-Video-Id': resolvedId,
          'X-Total-Length': String(fullBuf.length),
          ...(isPartial ? { 'Content-Range': `bytes ${start}-${end}/${fullBuf.length}` } : {}),
          ...(options.headers || {}),
        });
        return res.end(slice);
      } catch {}
    }
    if (direct?.url) {
      const resolvedId = direct.id || videoId || '';
      try {
        if (options.transcodeMp3) {
          // Real FFmpeg transcode to genuine ID3/MPEG-1 Layer 3 MP3 stream
          const upstreamRes = await fetch(direct.url);
          if (upstreamRes.ok && upstreamRes.body) {
            const { Readable } = await import('node:stream');
            res.writeHead(200, {
              'Content-Type': 'audio/mpeg',
              'Transfer-Encoding': 'chunked',
              'Access-Control-Allow-Origin': '*',
              'X-Audio-Source': direct.source || 'full',
              'X-Video-Id': resolvedId,
              ...(options.headers || {}),
            });
            const ff = spawn('ffmpeg', ['-loglevel', 'error', '-i', 'pipe:0', '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', '-f', 'mp3', 'pipe:1']);
            Readable.fromWeb(upstreamRes.body).pipe(ff.stdin);
            ff.stdout.pipe(res);
            req.on('close', () => {
              try { ff.kill(); } catch {}
            });
            return;
          }
        } else {
          // Proxy exact Range or full stream straight through
          const reqHeaders = {};
          if (req.headers.range) reqHeaders.Range = req.headers.range;
          const up = await fetch(direct.url, { headers: reqHeaders });
          if (up.ok || up.status === 206) {
            const buf = Buffer.from(await up.arrayBuffer());
            if (buf.length > 0) {
              const outHeaders = {
                'Content-Type': direct.mime || 'audio/mp4',
                'Content-Length': String(buf.length),
                'Accept-Ranges': 'bytes',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Disposition, X-Video-Id, X-Total-Length, X-Audio-Source, X-Audio-Mime, X-Audio-Ext, X-Direct-Audio-Url',
                'X-Audio-Source': direct.source || 'full',
                'X-Audio-Mime': direct.mime || 'audio/mp4',
                'X-Audio-Ext': direct.ext || 'm4a',
                'X-Video-Id': resolvedId,
                'X-Total-Length': String(direct.clen || buf.length),
                ...(direct.directCors ? { 'X-Direct-Audio-Url': direct.url } : {}),
                ...(options.headers || {}),
              };
              if (up.headers.get('content-range')) outHeaders['Content-Range'] = up.headers.get('content-range');
              res.writeHead(up.status === 206 ? 206 : 200, outHeaders);
              return res.end(buf);
            }
          }
        }
      } catch {}
    }
  }

  if (videoId) {
    cleanTarget = `https://www.youtube.com/watch?v=${videoId}`;
  } else if (!cleanTarget.startsWith('http')) {
    cleanTarget = `ytsearch1:${cleanTarget}`;
  }

  const headers = {
    'Content-Type': options.contentType || 'audio/webm',
    'Transfer-Encoding': 'chunked',
    'Accept-Ranges': 'none',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache',
    ...(options.headers || {}),
  };

  res.writeHead(200, headers);

  const pythonCmd = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
  const args = [
    '-m', 'yt_dlp',
    '--extractor-args', 'youtube:player_client=visionos,ios,android_vr',
    '-f', options.format || 'ba[ext=m4a]/ba[ext=webm]/ba/b',
    '-o', '-',
    '--no-warnings',
    '-q',
  ];

  // Support seeking: start download from a specific second offset
  const startSec = Math.max(0, Math.floor(startSeconds || 0));
  if (startSec > 0) {
    args.push('--download-sections', `*${startSec}-inf`);
  }

  args.push(cleanTarget);

  const child = spawn(pythonCmd, args);

  child.stdout.pipe(res);

  child.on('error', (err) => {
    console.error('[streamAudioDirect error]:', err.message);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end('Direct stream error');
    }
  });

  req.on('close', () => {
    try { child.kill(); } catch {}
  });
}

export function streamAudioFromUrl(streamUrl, req, res) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  if (req.headers.range) {
    headers['range'] = req.headers.range;
  }

  const upstreamReq = https.get(streamUrl, { headers }, (upstreamRes) => {
    const statusCode = upstreamRes.statusCode || 200;

    res.writeHead(statusCode, {
      'Content-Type': upstreamRes.headers['content-type'] || 'audio/webm',
      'Content-Length': upstreamRes.headers['content-length'] || '',
      'Content-Range': upstreamRes.headers['content-range'] || '',
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges',
      'Cache-Control': 'public, max-age=3600',
    });

    upstreamRes.pipe(res);
  });

  upstreamReq.on('error', (err) => {
    console.error('[streamAudio] Upstream request error:', err);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end('Upstream stream error');
    }
  });

  req.on('close', () => {
    upstreamReq.destroy();
  });
}

export async function findBestInstrumentalNode({ title = '', artist = '', expectedDurationSec = 0 } = {}) {
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) return null;
  const baseQ = `${cleanTitle} ${artist}`.trim();
  const [ytInst, ytKaraoke, monoBest, scBest] = await Promise.all([
    searchYouTubeTracks(`${baseQ} instrumental`, 8).catch(() => []),
    searchYouTubeTracks(`${baseQ} karaoke sin voces`, 8).catch(() => []),
    findInstrumentalOnMonochrome({ title: cleanTitle, artist, expectedDurationSec }).catch(() => null),
    findInstrumentalOnSoundCloud({ title: cleanTitle, artist, expectedDurationSec }).catch(() => null),
  ]);

  const pool = [];
  if (monoBest) pool.push(monoBest);
  if (scBest) pool.push(scBest);

  const seenYt = new Set();
  for (const item of [...ytInst, ...ytKaraoke]) {
    const vid = String(item?.id || '').replace(/^yt-/, '');
    if (!/^[a-zA-Z0-9_-]{11}$/.test(vid) || seenYt.has(vid)) continue;
    seenYt.add(vid);
    const durSec = Math.round((Number(item.duration_ms) || 0) / 1000);
    const ev = scoreInstrumentalCandidate(
      { candTitle: item.name || '', candArtist: item.artists?.[0]?.name || '', candDurationSec: durSec },
      { title: cleanTitle, artist, expectedDurationSec }
    );
    if (ev.matched) {
      pool.push({
        sourceId: vid,
        title: item.name || '',
        artist: item.artists?.[0]?.name || artist,
        durationSec: durSec,
        score: ev.score,
        provider: 'youtube',
      });
    }
  }

  pool.sort((a, b) => b.score - a.score);
  return pool[0] ? { ...pool[0], label: 'Sin voces' } : null;
}

export async function searchYouTubeTracks(query, limit = 15) {
  const cleanQ = (query || '').replace(/[()[\]{}_-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleanQ) return [];

  try {
    const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(cleanQ);
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const startIdx = html.indexOf('var ytInitialData = ');
    if (startIdx === -1) return [];
    const jsonStr = html.slice(startIdx + 20, html.indexOf(';</script>', startIdx));
    const data = JSON.parse(jsonStr);
    const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
    const tracks = [];
    const seen = new Set();

    for (const c of contents) {
      const items = c.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const vr = item.videoRenderer;
        if (!vr) continue;
        const videoId = vr.videoId;
        if (!videoId || seen.has(videoId)) continue;
        seen.add(videoId);

        const title = vr.title?.runs?.[0]?.text;
        const artist = vr.ownerText?.runs?.[0]?.text || vr.shortBylineText?.runs?.[0]?.text || 'Artista';
        const thumb = vr.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        const durText = vr.lengthText?.simpleText;
        let durMs = 210000;
        if (durText) {
          const parts = durText.split(':').map(Number);
          durMs = parts.length === 2 ? (parts[0] * 60 + parts[1]) * 1000 : (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
        }

        if (title) {
          tracks.push({
            id: `yt-${videoId}`,
            name: title,
            duration_ms: durMs,
            preview_url: null,
            artists: [{ id: `art-${videoId}`, name: artist }],
            album: {
              id: `alb-${videoId}`,
              name: title,
              images: [{ url: thumb }],
            },
          });
        }
        if (tracks.length >= limit) break;
      }
      if (tracks.length >= limit) break;
    }
    return tracks;
  } catch (err) {
    console.error('[searchYouTubeTracks error]:', err.message);
    return [];
  }
}
