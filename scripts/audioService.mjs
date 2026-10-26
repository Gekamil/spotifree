import { spawn } from 'node:child_process';
import readline from 'node:readline';
import https from 'node:https';
import path from 'node:path';

const CACHE = new Map(); // target -> { id, url, duration, title, timestamp }
const pendingRequests = new Map();
let reqCounter = 0;
let pythonProcess = null;
let rl = null;
let isReady = false;

function ensureWorker() {
  if (pythonProcess && !pythonProcess.killed) return;

  const scriptPath = path.resolve('scripts/audio_resolver.py');
  const pythonCmd = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
  pythonProcess = spawn(pythonCmd, [scriptPath], {
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

  ensureWorker();

  const req_id = String(++reqCounter);

  const promise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(req_id);
      reject(new Error(`Timeout resolving audio for "${cleanTarget}"`));
    }, 20000);

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

  pythonProcess.stdin.write(JSON.stringify({ req_id, target: cleanTarget }) + '\n');
  return promise;
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
