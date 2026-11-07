/**
 * Real track analysis: downloads the first ~3 MB of a song's audio (same-origin
 * /api/audio/chunk), decodes it in the browser and measures BPM, beat grid, key and
 * structure in a Web Worker. Results are cached per track (localStorage) and picked up
 * automatically by resolveClientSideRealFeature, the DJ planner, the badges and the editor.
 *
 * When audio is not reachable, the real BPM from Deezer (via /api/audio-features) is used.
 */
import { API_BASE } from '../config';
import type { Track } from '../types/spotify';
import { analyzeAudio, toAnalysisSignal, type AudioAnalysisResult } from '../utils/audioAnalysis';
import {
  cleanTrackId,
  fetchAudioFeaturesBatch,
  getCamelotKey,
  getTrackAnalysis,
  setTrackAnalysis,
  type TrackAnalysisData,
} from '../utils/audioFeatures';

type AnalyzableTrack = Pick<Track, 'id' | 'name' | 'artists' | 'duration_ms'>;

const inflight = new Map<string, Promise<TrackAnalysisData | null>>();
const failedAt = new Map<string, number>();
const RETRY_AFTER_MS = 20 * 60 * 1000;
let chain: Promise<unknown> = Promise.resolve();

// --- Worker plumbing --------------------------------------------------------
let worker: Worker | null = null;
let workerBroken = false;
let reqCounter = 0;
const pending = new Map<number, { resolve: (r: AudioAnalysisResult) => void; reject: (e: unknown) => void }>();

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('../workers/audioAnalysis.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ reqId: number; result?: AudioAnalysisResult; error?: string }>) => {
      const p = pending.get(e.data.reqId);
      if (!p) return;
      pending.delete(e.data.reqId);
      if (e.data.result) p.resolve(e.data.result);
      else p.reject(new Error(e.data.error || 'analysis failed'));
    };
    worker.onerror = () => {
      workerBroken = true;
      for (const p of pending.values()) p.reject(new Error('worker error'));
      pending.clear();
      worker = null;
    };
    return worker;
  } catch {
    workerBroken = true;
    return null;
  }
}

function runAnalysis(channels: Float32Array[], sampleRate: number): Promise<AudioAnalysisResult> {
  // Mono ~11 kHz first (cheap): ~8x less data to move, and we keep it for a main-thread fallback
  const { signal, sr } = toAnalysisSignal(channels, sampleRate);
  const w = getWorker();
  if (!w) return Promise.resolve(analyzeAudio([signal], sr));
  return (new Promise<AudioAnalysisResult>((resolve, reject) => {
    const reqId = ++reqCounter;
    pending.set(reqId, { resolve, reject });
    const copy = signal.slice();
    w.postMessage({ reqId, channels: [copy], sampleRate: sr }, [copy.buffer]);
    setTimeout(() => {
      if (pending.has(reqId)) {
        pending.delete(reqId);
        reject(new Error('worker timeout'));
      }
    }, 20000);
  })).catch(() => analyzeAudio([signal], sr));
}

// --- Public API -------------------------------------------------------------
export function hasMeasuredAudio(trackId: string): boolean {
  return getTrackAnalysis(trackId)?.tempoSource === 'analysis';
}

/**
 * Measures a track from its real audio. Serialised (one download at a time) and cached.
 * Pass `videoId` when known to skip the search on the server.
 */
export function analyzeTrackAudio(track: AnalyzableTrack, opts: { videoId?: string | null } = {}): Promise<TrackAnalysisData | null> {
  const id = cleanTrackId(track?.id);
  if (!id) return Promise.resolve(null);
  const existing = getTrackAnalysis(id);
  if (existing?.tempoSource === 'analysis') return Promise.resolve(existing);
  const failed = failedAt.get(id);
  if (failed && Date.now() - failed < RETRY_AFTER_MS) return Promise.resolve(existing);
  const running = inflight.get(id);
  if (running) return running;

  const job = (chain = chain.then(() => doAnalyze(track, id, opts.videoId), () => doAnalyze(track, id, opts.videoId))) as Promise<TrackAnalysisData | null>;
  const p = job
    .catch((err) => {
      failedAt.set(id, Date.now());
      console.info('[TrackAnalysis] Real audio not available for', track?.name, '-', err?.message || err);
      return getTrackAnalysis(id);
    })
    .finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
}

async function doAnalyze(track: AnalyzableTrack, id: string, videoId?: string | null): Promise<TrackAnalysisData | null> {
  if (typeof window === 'undefined') return null;
  const already = getTrackAnalysis(id);
  if (already?.tempoSource === 'analysis') return already;

  const q = `${track.name || ''} ${track.artists?.[0]?.name || ''}`.trim();
  const params = new URLSearchParams({ q, title: track.name || '', artist: track.artists?.[0]?.name || '' });
  if (videoId && /^[\w-]{11}$/.test(videoId)) params.set('id', videoId);
  const url = `${API_BASE}/api/audio/chunk?${params.toString()}`;

  // YouTube's media servers fail intermittently (403/5xx): retry once after a short pause.
  // The server falls back to the song's official 30 s preview when the full audio is blocked.
  let buf: ArrayBuffer | null = null;
  let isPreview = false;
  let lastErr = '';
  for (let attempt = 0; attempt < 2 && !buf; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2500));
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout ? AbortSignal.timeout(30000) : undefined });
      if (!res.ok) {
        lastErr = `chunk ${res.status}`;
        if (res.status === 404) break;
        continue;
      }
      const b = await res.arrayBuffer();
      if (b.byteLength < 60000) {
        lastErr = 'chunk too small';
        continue;
      }
      isPreview = res.headers.get('X-Audio-Source') === 'preview';
      buf = b;
    } catch (e: any) {
      lastErr = e?.message || 'network';
    }
  }
  if (!buf) throw new Error(lastErr || 'chunk failed');

  const Ctx: typeof OfflineAudioContext | undefined = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (!Ctx) throw new Error('no OfflineAudioContext');
  const ctx = new Ctx(1, 44100, 44100);
  const audio = await ctx.decodeAudioData(buf);
  const channels: Float32Array[] = [];
  for (let c = 0; c < Math.min(2, audio.numberOfChannels); c++) channels.push(audio.getChannelData(c));

  const r = await runAnalysis(channels, audio.sampleRate);
  const trackDur = track.duration_ms ? track.duration_ms / 1000 : 0;
  // The chunk may not reach the end of long songs: only keep outro info if it does
  const coversEnd = !isPreview && (!trackDur || r.durationSec >= trackDur - 4);
  const prev = getTrackAnalysis(id);
  const tempoOk = r.tempoConfidence >= 0.12 || !prev;
  let tempo = tempoOk ? r.tempo : prev!.tempo;
  let gridUnreliable = false;
  let tempoRelErr: number | undefined;
  // Fuse with Deezer's BPM when it exists: if our estimate is a metrical multiple of it
  // (x2, /2, 3:2, 2:3), take the multiple that agrees with Deezer.
  if (prev?.tempoSource === 'deezer' && prev.tempo > 40) {
    let best = tempo;
    let bestRatio = 1;
    let bestErr = Math.abs(tempo - prev.tempo) / prev.tempo;
    for (const ratio of [2, 0.5, 2 / 3, 1.5, 4 / 3, 0.75]) {
      const cand = tempo * ratio;
      const err = Math.abs(cand - prev.tempo) / prev.tempo;
      if (err < bestErr) {
        bestErr = err;
        best = cand;
        bestRatio = ratio;
      }
    }
    if (bestErr <= 0.04) {
      tempo = Math.round(best * 10) / 10;
      tempoRelErr = bestErr;
      // A 3:2-type correction means our beat grid was on the wrong pulse: don't use it
      if (bestRatio !== 1 && bestRatio !== 2 && bestRatio !== 0.5) gridUnreliable = true;
      // Same pulse but >1.5% apart: Deezer measured the whole song, ours only a chunk. Use
      // Deezer's tempo, and drop our grid (it was built on the wrong tempo and would drift).
      if (bestErr > 0.015) {
        tempo = Math.round(prev.tempo * 10) / 10;
        gridUnreliable = true;
      }
    }
  }
  if (r.tempoConfidence < 0.2) gridUnreliable = true;
  // A 30 s preview is cut from the middle of the song: its times are not song times
  if (isPreview) gridUnreliable = true;

  const data: TrackAnalysisData = {
    tempo,
    tempoSource: 'analysis',
    tempoConfidence: r.tempoConfidence,
    energy: r.energy,
    beatOffsetSec: gridUnreliable ? undefined : r.beatOffsetSec,
    downbeatOffsetSec: gridUnreliable ? undefined : r.downbeatOffsetSec,
    audioStartSec: isPreview ? undefined : r.audioStartSec,
    introEndSec: isPreview ? undefined : r.introEndSec,
    audioSource: isPreview ? 'preview' : 'full',
    outroStartSec: coversEnd ? r.outroStartSec : undefined,
    musicEndSec: coversEnd ? r.musicEndSec : undefined,
    durationSec: r.durationSec,
    tempoRelErr,
    analyzedAt: Date.now(),
  };
  // Only trust the detected key when it is clear; otherwise the planner treats it as unknown
  // instead of inventing harmonic matches.
  if (r.keyConfidence >= 0.5) {
    data.key = r.key;
    data.mode = r.mode;
    data.camelot = getCamelotKey(r.key, r.mode);
    data.keySource = 'analysis';
    data.keyConfidence = r.keyConfidence;
  }
  setTrackAnalysis(id, data);
  return data;
}

/**
 * Prepares a DJ set: real BPM from Deezer for every track (fast, one request), then deep
 * audio analysis in the background for the first `deep` tracks.
 */
export async function prepareDJAnalyses(tracks: AnalyzableTrack[], deep = 3): Promise<void> {
  if (!tracks || tracks.length === 0) return;
  try {
    await fetchAudioFeaturesBatch(tracks);
  } catch {}
  for (const t of tracks.slice(0, deep)) {
    void analyzeTrackAudio(t);
  }
}
