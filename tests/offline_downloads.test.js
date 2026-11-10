import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z0-9]+$/i.test(specifier) && context.parentURL) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (fs.existsSync(fileURLToPath(candidate))) {
        return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.json')) {
      return nextLoad(url, {
        ...context,
        importAttributes: { ...context.importAttributes, type: 'json' },
      });
    }
    return nextLoad(url, context);
  },
});

function makeFakeM4aBytes(len, seedByte = 0x42) {
  const buf = new Uint8Array(len);
  // MP4 'ftypM4A ' header at offset 0..11
  buf[0] = 0x00; buf[1] = 0x00; buf[2] = 0x00; buf[3] = 0x18;
  buf[4] = 0x66; buf[5] = 0x74; buf[6] = 0x79; buf[7] = 0x70; // 'ftyp'
  buf[8] = 0x4d; buf[9] = 0x34; buf[10] = 0x41; buf[11] = 0x20; // 'M4A '
  for (let i = 16; i < len; i += 257) buf[i] = seedByte;
  return buf;
}

class MemoryStorage {
  constructor() { this.map = new Map(); }
  get length() { return this.map.size; }
  key(i) { return Array.from(this.map.keys())[i] ?? null; }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

class MemoryCache {
  constructor() { this.entries = new Map(); }
  async put(req, res) {
    const key = typeof req === 'string' ? req : req.url;
    this.entries.set(key, res);
  }
  async match(req) {
    const key = typeof req === 'string' ? req : req.url;
    const hit = this.entries.get(key);
    return hit ? hit.clone() : null;
  }
  async delete(req) {
    const key = typeof req === 'string' ? req : req.url;
    return this.entries.delete(key);
  }
  async keys() {
    return Array.from(this.entries.keys()).map((url) => ({ url }));
  }
}

class MemoryCaches {
  constructor() { this.stores = new Map(); }
  async open(name) {
    if (!this.stores.has(name)) this.stores.set(name, new MemoryCache());
    return this.stores.get(name);
  }
  async delete(name) { return this.stores.delete(name); }
}

const memStorage = new MemoryStorage();
const memCaches = new MemoryCaches();
let onlineFlag = true;
const createdObjectUrls = new Map();
let urlCounter = 0;

globalThis.caches = memCaches;
globalThis.window = {
  localStorage: memStorage,
  caches: memCaches,
  location: { origin: 'https://spotifreeweb.vercel.app' },
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init) { this.type = type; this.detail = init?.detail; }
};
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    get onLine() { return onlineFlag; },
    storage: { persist: async () => true },
  },
});
globalThis.URL.createObjectURL = (blob) => {
  const u = `blob:spotifree/${++urlCounter}`;
  createdObjectUrls.set(u, blob);
  return u;
};
globalThis.URL.revokeObjectURL = (u) => createdObjectUrls.delete(u);

let O;
before(async () => {
  O = await import('../src/utils/offlineStorage.ts');
});

beforeEach(async () => {
  memStorage.clear();
  memCaches.stores.clear();
  createdObjectUrls.clear();
  onlineFlag = true;
});

describe('Offline Downloads & Airplane Mode Persistence', () => {
  it('sniffAudioFormat accepts M4A, MP3, WebM, Ogg and rejects HTML/JSON/short garbage', () => {
    const m4a = makeFakeM4aBytes(64);
    assert.deepEqual(O.sniffAudioFormat(m4a), { valid: true, mime: 'audio/mp4', ext: 'm4a' });

    const mp3 = new Uint8Array(64);
    mp3[0] = 0x49; mp3[1] = 0x44; mp3[2] = 0x33; // ID3
    assert.deepEqual(O.sniffAudioFormat(mp3), { valid: true, mime: 'audio/mpeg', ext: 'mp3' });

    const webm = new Uint8Array(64);
    webm[0] = 0x1a; webm[1] = 0x45; webm[2] = 0xdf; webm[3] = 0xa3;
    assert.deepEqual(O.sniffAudioFormat(webm), { valid: true, mime: 'audio/webm', ext: 'webm' });

    const flac = new Uint8Array(64);
    flac[0] = 0x66; flac[1] = 0x4c; flac[2] = 0x61; flac[3] = 0x43; // 'fLaC'
    assert.deepEqual(O.sniffAudioFormat(flac), { valid: true, mime: 'audio/flac', ext: 'flac' });

    const html = new TextEncoder().encode('<!doctype html><html>error</html>');
    assert.equal(O.sniffAudioFormat(html).valid, false);

    const json = new TextEncoder().encode('{"error":"not found"}');
    assert.equal(O.sniffAudioFormat(json).valid, false);
  });

  it('downloadTrackAudio assembles chunked multi-MB Range responses and plays in airplane mode', async () => {
    const fullBytes = makeFakeM4aBytes(3_200_000, 0x55); // > 2 MB chunk threshold
    let fetchCalls = 0;

    globalThis.fetch = async (url, init) => {
      fetchCalls++;
      const rangeHeader = init?.headers?.Range || init?.headers?.range || '';
      const m = rangeHeader.match(/bytes=(\d+)-(\d+)/);
      const start = m ? Number(m[1]) : 0;
      const end = m ? Math.min(fullBytes.length - 1, Number(m[2])) : fullBytes.length - 1;
      const slice = fullBytes.subarray(start, end + 1);
      return new Response(slice, {
        status: 206,
        headers: {
          'Content-Type': 'audio/mp4',
          'Content-Range': `bytes ${start}-${end}/${fullBytes.length}`,
          'X-Total-Length': String(fullBytes.length),
          'X-Video-Id': 'J-7knuczw2E',
          'X-Audio-Source': 'full',
          'X-Audio-Ext': 'm4a',
          'X-Audio-Mime': 'audio/mp4',
        },
      });
    };

    const track = {
      id: 'trk-monaco',
      name: 'MONACO',
      duration_ms: 267000,
      artists: [{ name: 'Bad Bunny' }],
      album: { name: 'nadie sabe', images: [] },
    };

    const ok = await O.downloadTrackAudio(track);
    assert.equal(ok, true);
    assert.equal(fetchCalls, 2); // Chunks 0..2097151 and 2097152..3199999
    assert.equal(await O.isTrackDownloaded('trk-monaco'), true);

    // Switch phone into Airplane Mode: network fails cleanly
    onlineFlag = false;
    globalThis.fetch = async () => { throw new Error('net::ERR_INTERNET_DISCONNECTED'); };

    const blobUrl = await O.getDownloadedTrackBlobUrl('trk-monaco');
    assert.ok(blobUrl && blobUrl.startsWith('blob:'));
    const storedBlob = createdObjectUrls.get(blobUrl);
    assert.equal(storedBlob.size, fullBytes.length);
  });

  it('rejects 30-second preview responses so they are never saved as offline downloads', async () => {
    const previewBytes = makeFakeM4aBytes(480_000);
    globalThis.fetch = async () =>
      new Response(previewBytes, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'X-Audio-Source': 'preview',
        },
      });

    const track = {
      id: 'trk-preview',
      name: 'Song Without Full Audio',
      duration_ms: 210000,
      artists: [{ name: 'Artist' }],
    };

    const ok = await O.downloadTrackAudio(track);
    assert.equal(ok, false);
    assert.equal(await O.isTrackDownloaded('trk-preview'), false);
  });

  it('downloadPlaylist keeps isPlaylistDownloaded=false when offline or 0 tracks succeed', async () => {
    onlineFlag = false;
    const pl = { id: 'pl-1', name: 'Mi Playlist', images: [], owner: { display_name: 'Yo' }, tracks: { total: 1, items: [] } };
    const trk = { id: 't1', name: 'Cancion 1', artists: [{ name: 'A1' }], duration_ms: 190000 };

    const res = await O.downloadPlaylist(pl, [trk]);
    assert.equal(res.offline, true);
    assert.equal(res.downloaded, 0);
    assert.equal(O.isPlaylistDownloaded('pl-1'), false);
  });

  it('getAllDownloadedTrackIds cleans orphaned localStorage entries lacking binary audio', async () => {
    memStorage.setItem('spotifree_offline_track_ghost1', JSON.stringify({ id: 'ghost1', name: 'Ghost' }));
    const ids = await O.getAllDownloadedTrackIds();
    assert.equal(ids.has('ghost1'), false);
    assert.equal(memStorage.getItem('spotifree_offline_track_ghost1'), null);
  });

  it('purgeCorruptedPreviewAudio preserves valid short songs under 400KB and removes explicit previews', async () => {
    const cache = await memCaches.open('musica-spotifree');
    const shortReal = makeFakeM4aBytes(220_000);
    await cache.put(
      '/musica-spotifree/tracks/shortreal.mp3',
      new Response(shortReal, {
        status: 200,
        headers: { 'Content-Type': 'audio/mp4', 'X-Audio-Source': 'full' },
      })
    );
    await cache.put(
      '/musica-spotifree/tracks/badpreview.mp3',
      new Response(makeFakeM4aBytes(480_000), {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg', 'X-Audio-Source': 'preview' },
      })
    );

    const purged = await O.purgeCorruptedPreviewAudio();
    assert.equal(purged, 1);
    assert.ok(await cache.match('/musica-spotifree/tracks/shortreal.mp3'));
    assert.equal(await cache.match('/musica-spotifree/tracks/badpreview.mp3'), null);
  });

  it('uses X-Direct-Audio-Url CDN fast-path for FLAC chunks and scores candidates strictly', async () => {
    const flacBytes = new Uint8Array(3_200_000);
    flacBytes[0] = 0x66; flacBytes[1] = 0x4c; flacBytes[2] = 0x61; flacBytes[3] = 0x43; // 'fLaC'
    for (let i = 16; i < flacBytes.length; i += 311) flacBytes[i] = 0x55;

    const urlsCalled = [];
    globalThis.fetch = async (url, init) => {
      urlsCalled.push(String(url));
      const range = init?.headers?.Range || '';
      const m = range.match(/bytes=(\d+)-(\d+)/);
      const start = m ? parseInt(m[1], 10) : 0;
      const end = m ? Math.min(flacBytes.length - 1, parseInt(m[2], 10)) : flacBytes.length - 1;
      const slice = flacBytes.slice(start, end + 1);
      return new Response(slice, {
        status: 206,
        headers: {
          'Content-Type': 'audio/flac',
          'Content-Range': `bytes ${start}-${end}/${flacBytes.length}`,
          'X-Total-Length': String(flacBytes.length),
          'X-Video-Id': 'mono:152962978843463680',
          'X-Audio-Source': 'monochrome-flac',
          'X-Audio-Ext': 'flac',
          'X-Audio-Mime': 'audio/flac',
          'X-Direct-Audio-Url': 'https://tracks.monochrome.st/track/152962978843463680',
        },
      });
    };

    const ok = await O.downloadTrackAudio({
      id: 'trk-mono-fast',
      name: 'MONACO',
      duration_ms: 267000,
      artists: [{ name: 'Bad Bunny' }],
    });
    assert.equal(ok, true);
    assert.equal(urlsCalled.length, 2);
    assert.ok(urlsCalled[1].startsWith('https://tracks.monochrome.st/track/'));

    const { scoreMusicCandidate } = await import('../api/_lib/musicFallback.js');
    assert.equal(
      scoreMusicCandidate(
        { candTitle: 'Vas A Quedarte', candArtist: 'Aitana', candDurationSec: 226 },
        { title: 'Vas a quedarte', artist: 'Aitana', expectedDurationSec: 226 }
      ).matched,
      true
    );
    assert.equal(
      scoreMusicCandidate(
        { candTitle: 'Vas A Quedarte (Reggaeton Remix)', candArtist: 'Alex Villa', candDurationSec: 183 },
        { title: 'Vas a quedarte', artist: 'Aitana', expectedDurationSec: 226 }
      ).matched,
      false
    );
    assert.equal(
      scoreMusicCandidate(
        { candTitle: 'Counting Stars (Karaoke Version)', candArtist: 'ZZang', candDurationSec: 257 },
        { title: 'Counting Stars', artist: 'OneRepublic', expectedDurationSec: 257 }
      ).matched,
      false
    );
  });
});
