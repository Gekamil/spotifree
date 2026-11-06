/**
 * Real musical analysis of decoded audio (pure functions, no Web Audio dependency).
 *
 * Techniques (adapted from well-known open-source MIR tools):
 *  - Tempo: spectral-flux onset envelope + autocorrelation with a log-normal tempo prior
 *    centred on 120 BPM (as in librosa.beat.tempo) and comb-filter beat phase search
 *    (as in web-audio-beat-detector / Ellis 2007 dynamic-programming beat tracker).
 *  - Downbeat: the beat phase (of 4) whose low-frequency (kick) onsets are strongest.
 *  - Key: chromagram from log-frequency FFT bins correlated against the Krumhansl–Kessler
 *    major/minor key profiles (24 keys), as in Essentia's KeyExtractor / libKeyFinder.
 *  - Structure: RMS profile → first audible sample, end of intro, start of outro, energy.
 */

export interface AudioAnalysisResult {
  tempo: number; // BPM (60-200)
  tempoConfidence: number; // 0-1
  beatOffsetSec: number; // time of the first beat
  downbeatOffsetSec: number; // time of the first downbeat (bar start)
  key: number; // 0 = C ... 11 = B
  mode: 0 | 1; // 0 minor, 1 major
  keyConfidence: number; // 0-1
  energy: number; // 0-1 overall intensity
  audioStartSec: number; // first audible audio (skips leading silence)
  introEndSec: number; // first sustained full-energy section
  outroStartSec: number; // last sustained full-energy moment
  musicEndSec: number; // last audible audio
  durationSec: number;
}

const TARGET_SR = 11025;

// ---------------------------------------------------------------------------
// FFT (iterative radix-2, in place)
// ---------------------------------------------------------------------------
const twiddleCache = new Map<number, { cos: Float32Array; sin: Float32Array; rev: Uint32Array }>();

function getTwiddles(n: number) {
  let t = twiddleCache.get(n);
  if (t) return t;
  const cos = new Float32Array(n / 2);
  const sin = new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((-2 * Math.PI * i) / n);
    sin[i] = Math.sin((-2 * Math.PI * i) / n);
  }
  const bits = Math.log2(n);
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r = (r << 1) | ((i >> b) & 1);
    rev[i] = r;
  }
  t = { cos, sin, rev };
  twiddleCache.set(n, t);
  return t;
}

/** Magnitude spectrum (n/2 bins) of a real frame of length n (power of two). */
export function magnitudeSpectrum(frame: Float32Array, out?: Float32Array): Float32Array {
  const n = frame.length;
  const { cos, sin, rev } = getTwiddles(n);
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 0; i < n; i++) re[rev[i]] = frame[i];
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const tw = k * step;
        const a = start + k;
        const b = a + half;
        const tre = re[b] * cos[tw] - im[b] * sin[tw];
        const tim = re[b] * sin[tw] + im[b] * cos[tw];
        re[b] = re[a] - tre;
        im[b] = im[a] - tim;
        re[a] += tre;
        im[a] += tim;
      }
    }
  }
  const mag = out && out.length === n / 2 ? out : new Float32Array(n / 2);
  for (let i = 0; i < n / 2; i++) mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
  return mag;
}

const hannCache = new Map<number, Float32Array>();
function hann(n: number) {
  let w = hannCache.get(n);
  if (!w) {
    w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    hannCache.set(n, w);
  }
  return w;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Mixes channels to mono and resamples (box filter + decimation) to ~11 kHz. */
export function toAnalysisSignal(channels: Float32Array[], sampleRate: number): { signal: Float32Array; sr: number } {
  const len = channels[0]?.length || 0;
  const factor = Math.max(1, Math.round(sampleRate / TARGET_SR));
  const outLen = Math.floor(len / factor);
  const out = new Float32Array(outLen);
  const nCh = channels.length;
  for (let i = 0; i < outLen; i++) {
    let s = 0;
    const base = i * factor;
    for (let k = 0; k < factor; k++) {
      for (let c = 0; c < nCh; c++) s += channels[c][base + k];
    }
    out[i] = s / (factor * nCh);
  }
  return { signal: out, sr: sampleRate / factor };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

// ---------------------------------------------------------------------------
// Onset envelope (spectral flux), full-band and low-band (kick)
// ---------------------------------------------------------------------------
interface OnsetEnvelope {
  full: Float32Array;
  low: Float32Array;
  fps: number; // frames per second
  latencySec: number; // onset peaks appear this much before the real transient
}

export function onsetEnvelope(signal: Float32Array, sr: number, maxSec = 150): OnsetEnvelope {
  const N = 1024;
  const hop = 256;
  const limit = Math.min(signal.length, Math.floor(maxSec * sr));
  const frames = Math.max(0, Math.floor((limit - N) / hop));
  const full = new Float32Array(frames);
  const low = new Float32Array(frames);
  const w = hann(N);
  const frame = new Float32Array(N);
  let prev = new Float32Array(N / 2);
  let cur = new Float32Array(N / 2);
  const binHz = sr / N;
  const lowMax = Math.max(2, Math.round(150 / binHz));
  for (let f = 0; f < frames; f++) {
    const off = f * hop;
    for (let i = 0; i < N; i++) frame[i] = signal[off + i] * w[i];
    magnitudeSpectrum(frame, cur);
    let flux = 0;
    let lflux = 0;
    for (let b = 1; b < N / 2; b++) {
      const v = Math.log1p(100 * cur[b]);
      const p = Math.log1p(100 * prev[b]);
      const d = v - p;
      if (d > 0) {
        flux += d;
        if (b <= lowMax) lflux += d;
      }
    }
    full[f] = flux;
    low[f] = lflux;
    const t = prev;
    prev = cur;
    cur = t;
  }
  // Remove slow trends (local mean over ~0.5 s) and half-wave rectify
  const fps = sr / hop;
  const win = Math.max(1, Math.round(fps * 0.25));
  const detrend = (x: Float32Array) => {
    const y = new Float32Array(x.length);
    let acc = 0;
    const q: number[] = [];
    for (let i = 0; i < x.length + win; i++) {
      if (i < x.length) {
        acc += x[i];
        q.push(x[i]);
      }
      if (q.length > 2 * win + 1) acc -= q.shift()!;
      const c = i - win;
      if (c >= 0 && c < x.length) y[c] = Math.max(0, x[c] - acc / q.length);
    }
    return y;
  };
  return { full: detrend(full), low: detrend(low), fps, latencySec: (N / 2 + hop) / sr };
}

// ---------------------------------------------------------------------------
// Tempo + beat phase + downbeat
// ---------------------------------------------------------------------------
export function detectTempo(env: OnsetEnvelope): { tempo: number; confidence: number; beatOffsetSec: number; downbeatOffsetSec: number } {
  const { full, low, fps } = env;
  const n = full.length;
  const fallback = { tempo: 120, confidence: 0, beatOffsetSec: 0, downbeatOffsetSec: 0 };
  if (n < fps * 8) return fallback;

  const minLag = Math.floor((60 / 200) * fps);
  const maxLag = Math.ceil((60 / 60) * fps);
  const ac = new Float32Array(maxLag + 2);
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += full[i] * full[i + lag];
    ac[lag] = s / (n - lag);
  }

  // Log-normal prior around 120 BPM (std 1 octave), like librosa's tempo estimator
  let best = minLag;
  let bestScore = -Infinity;
  let sum = 0;
  let count = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (60 * fps) / lag;
    // Reinforce with the double period (a true beat period also correlates at 2x lag)
    const harmonic = lag * 2 <= maxLag + 1 ? 0.5 * ac[lag * 2] : 0;
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 1.0, 2));
    const score = (ac[lag] + harmonic) * prior;
    sum += ac[lag];
    count++;
    if (score > bestScore) {
      bestScore = score;
      best = lag;
    }
  }
  // Parabolic interpolation for sub-frame precision
  let refined = best;
  if (best > minLag && best < maxLag) {
    const a = ac[best - 1];
    const b = ac[best];
    const c = ac[best + 1];
    const denom = a - 2 * b + c;
    if (denom !== 0) refined = best + (0.5 * (a - c)) / denom;
  }
  // Metrical check (resolves 3:2 / 2:1 confusions, e.g. dancehall 3-3-2 or half-time):
  // the true beat makes the onset pattern repeat at 1, 2 and 4 beats (one bar).
  const acAt = (lagF: number) => {
    const lag = Math.round(lagF);
    if (lag <= 0 || lag >= n - 1) return 0;
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += full[i] * full[i + lag] + 2 * low[i] * low[i + lag];
    return s / (n - lag);
  };
  const metrical = (lagF: number) => acAt(lagF) + acAt(lagF * 2) + 1.5 * acAt(lagF * 4);
  let bestLag = refined;
  let bestMetric = -Infinity;
  for (const ratio of [1, 2 / 3, 3 / 2, 0.5, 2]) {
    const lag = refined * ratio;
    const bpm = (60 * fps) / lag;
    if (bpm < 60 || bpm > 200) continue;
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 115) / 0.9, 2));
    const m = metrical(lag) * (0.6 + 0.4 * prior);
    if (m > bestMetric * 1.03 || (ratio === 1 && m >= bestMetric)) {
      bestMetric = m;
      bestLag = lag;
    }
  }
  let tempo = (60 * fps) / bestLag;
  // Keep in the musically common 70-180 range by octave folding
  while (tempo < 70) tempo *= 2;
  while (tempo > 180) tempo /= 2;

  const mean = count > 0 ? sum / count : 0;
  const confidence = mean > 0 ? Math.max(0, Math.min(1, (ac[best] / mean - 1) / 3)) : 0;

  // Beat grid: joint fine search of tempo (±2%) and phase with a comb filter. A tiny tempo
  // error accumulates over a minute of music, so tempo and phase must be fitted together.
  // The kick (low band) defines the grid when it is clearly periodic; otherwise all onsets.
  const combScores = (sig: Float32Array, per: number) => {
    const steps = Math.max(1, Math.floor(per * 2));
    const scores = new Float32Array(steps);
    for (let s = 0; s < steps; s++) {
      const ph = s / 2;
      let acc = 0;
      for (let t = ph; t < n; t += per) acc += sig[Math.round(t)] || 0;
      scores[s] = acc;
    }
    return scores;
  };
  const contrast = (sc: Float32Array) => {
    let mx = 0;
    let mean = 0;
    for (const v of sc) {
      mx = Math.max(mx, v);
      mean += v;
    }
    mean /= sc.length || 1;
    return mean > 0 ? mx / mean : 0;
  };
  const baseLowContrast = contrast(combScores(low, (60 * fps) / tempo));
  const gridSig = baseLowContrast > 1.6 ? low : full;

  let period = (60 * fps) / tempo;
  let bestPhase = 0;
  let bestGrid = -Infinity;
  for (let bpm = tempo * 0.98; bpm <= tempo * 1.02; bpm += 0.05) {
    const per = (60 * fps) / bpm;
    const sc = combScores(gridSig, per);
    for (let s = 0; s < sc.length; s++) {
      // normalise by number of beats so slower tempos are not favoured
      const v = sc[s] / (n / per);
      if (v > bestGrid) {
        bestGrid = v;
        bestPhase = s / 2;
        period = per;
      }
    }
  }
  tempo = (60 * fps) / period;
  // Downbeat: which of the 4 beat positions carries the strongest kick onsets
  let bestBar = 0;
  let bestBarScore = -Infinity;
  for (let k = 0; k < 4; k++) {
    let s = 0;
    for (let t = bestPhase + k * period; t < n; t += period * 4) s += (low[Math.round(t)] || 0) * 2 + (full[Math.round(t)] || 0);
    if (s > bestBarScore) {
      bestBarScore = s;
      bestBar = k;
    }
  }
  const beatSec = period / fps;
  const barSec = beatSec * 4;
  const lat = env.latencySec || 0;
  const beatOffsetSec = (bestPhase / fps + lat) % beatSec;
  const downbeatOffsetSec = ((bestPhase + bestBar * period) / fps + lat) % barSec;
  return { tempo: Math.round(tempo * 10) / 10, confidence, beatOffsetSec, downbeatOffsetSec };
}

// ---------------------------------------------------------------------------
// Key (Krumhansl–Kessler)
// ---------------------------------------------------------------------------
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
// Temperley (2007, Kostka-Payne corpus) profiles: better on pop/rock harmony
const TP_MAJOR = [0.748, 0.06, 0.488, 0.082, 0.67, 0.46, 0.096, 0.715, 0.104, 0.366, 0.057, 0.4];
const TP_MINOR = [0.712, 0.084, 0.474, 0.618, 0.049, 0.46, 0.105, 0.747, 0.404, 0.067, 0.133, 0.33];

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}

export function chromagram(signal: Float32Array, sr: number, maxSec = 150): number[] {
  const N = 4096;
  const hop = 4096;
  const limit = Math.min(signal.length, Math.floor(maxSec * sr));
  const w = hann(N);
  const frame = new Float32Array(N);
  const mag = new Float32Array(N / 2);
  const chroma = new Array(12).fill(0);
  const binHz = sr / N;
  // Precompute pitch class of each bin between 55 Hz and 2000 Hz
  const pcOfBin = new Int8Array(N / 2).fill(-1);
  for (let b = 1; b < N / 2; b++) {
    const f = b * binHz;
    if (f < 55 || f > 2000) continue;
    const midi = 69 + 12 * Math.log2(f / 440);
    const nearest = Math.round(midi);
    if (Math.abs(midi - nearest) > 0.35) continue; // ignore bins between semitones
    pcOfBin[b] = ((nearest % 12) + 12) % 12;
  }
  for (let off = 0; off + N <= limit; off += hop) {
    let energy = 0;
    for (let i = 0; i < N; i++) {
      frame[i] = signal[off + i] * w[i];
      energy += frame[i] * frame[i];
    }
    if (energy < 1e-6) continue; // skip silence
    magnitudeSpectrum(frame, mag);
    const local = new Array(12).fill(0);
    let tot = 0;
    for (let b = 1; b < N / 2; b++) {
      const pc = pcOfBin[b];
      if (pc < 0) continue;
      const v = Math.sqrt(mag[b]);
      local[pc] += v;
      tot += v;
    }
    if (tot <= 0) continue;
    for (let i = 0; i < 12; i++) chroma[i] += local[i] / tot;
  }
  return chroma;
}

export function detectKey(chroma: number[]): { key: number; mode: 0 | 1; confidence: number } {
  const scores: Array<{ key: number; mode: 0 | 1; r: number }> = [];
  for (let tonic = 0; tonic < 12; tonic++) {
    const rot = (p: number[]) => p.map((_, i) => p[(i - tonic + 12) % 12]);
    // Average of two well-known key profile sets is more robust than either alone
    scores.push({ key: tonic, mode: 1, r: 0.5 * pearson(chroma, rot(KK_MAJOR)) + 0.5 * pearson(chroma, rot(TP_MAJOR)) });
    scores.push({ key: tonic, mode: 0, r: 0.5 * pearson(chroma, rot(KK_MINOR)) + 0.5 * pearson(chroma, rot(TP_MINOR)) });
  }
  scores.sort((a, b) => b.r - a.r);
  const top = scores[0];
  const second = scores[1];
  const confidence = Math.max(0, Math.min(1, top.r * 0.6 + (top.r - second.r) * 4));
  return { key: top.key, mode: top.mode, confidence };
}

// ---------------------------------------------------------------------------
// Structure & energy
// ---------------------------------------------------------------------------
export function structureProfile(signal: Float32Array, sr: number, onsetFull?: Float32Array, fps?: number) {
  const win = Math.floor(sr * 0.5);
  const rms: number[] = [];
  for (let off = 0; off + win <= signal.length; off += win) {
    let s = 0;
    for (let i = 0; i < win; i++) s += signal[off + i] * signal[off + i];
    rms.push(Math.sqrt(s / win));
  }
  const durationSec = signal.length / sr;
  if (rms.length < 4) {
    return { energy: 0.5, audioStartSec: 0, introEndSec: 0, outroStartSec: durationSec, musicEndSec: durationSec, durationSec };
  }
  const med = median(rms) || 1e-6;
  const silent = med * 0.08;
  const loud = med * 0.75;
  const toSec = (i: number) => i * 0.5;

  let audioStart = 0;
  while (audioStart < rms.length && rms[audioStart] < silent) audioStart++;
  let musicEnd = rms.length - 1;
  while (musicEnd > 0 && rms[musicEnd] < silent) musicEnd--;
  // Sustained = at least 3 consecutive loud windows (1.5 s)
  let introEnd = audioStart;
  for (let i = audioStart; i < rms.length - 3; i++) {
    if (rms[i] >= loud && rms[i + 1] >= loud && rms[i + 2] >= loud) {
      introEnd = i;
      break;
    }
  }
  let outroStart = musicEnd;
  for (let i = musicEnd; i > introEnd + 3; i--) {
    if (rms[i] >= loud && rms[i - 1] >= loud && rms[i - 2] >= loud) {
      outroStart = i;
      break;
    }
  }

  // Energy: loudness of the body (dBFS mapped -30..-8) blended with onset density
  const body = rms.slice(introEnd, Math.max(introEnd + 1, outroStart));
  const bodyRms = body.reduce((a, b) => a + b, 0) / body.length;
  const db = 20 * Math.log10(bodyRms + 1e-9);
  const loudness = Math.max(0, Math.min(1, (db + 30) / 22));
  let density = 0.5;
  if (onsetFull && fps && onsetFull.length > 0) {
    const m = median(Array.from(onsetFull));
    let peaks = 0;
    for (let i = 1; i < onsetFull.length - 1; i++) {
      if (onsetFull[i] > m * 3 && onsetFull[i] >= onsetFull[i - 1] && onsetFull[i] >= onsetFull[i + 1]) peaks++;
    }
    const perSec = peaks / (onsetFull.length / fps);
    density = Math.max(0, Math.min(1, perSec / 6));
  }
  const energy = Math.round((loudness * 0.55 + density * 0.45) * 100) / 100;

  return {
    energy,
    audioStartSec: toSec(audioStart),
    introEndSec: toSec(introEnd),
    outroStartSec: toSec(outroStart),
    musicEndSec: toSec(musicEnd + 1),
    durationSec,
  };
}

/** Full analysis from decoded PCM channels. */
export function analyzeAudio(channels: Float32Array[], sampleRate: number): AudioAnalysisResult {
  const { signal, sr } = toAnalysisSignal(channels, sampleRate);
  const env = onsetEnvelope(signal, sr);
  const t = detectTempo(env);
  const k = detectKey(chromagram(signal, sr));
  const s = structureProfile(signal, sr, env.full, env.fps);
  return {
    tempo: t.tempo,
    tempoConfidence: Math.round(t.confidence * 100) / 100,
    beatOffsetSec: Math.round(t.beatOffsetSec * 1000) / 1000,
    downbeatOffsetSec: Math.round(t.downbeatOffsetSec * 1000) / 1000,
    key: k.key,
    mode: k.mode,
    keyConfidence: Math.round(k.confidence * 100) / 100,
    ...s,
  };
}
