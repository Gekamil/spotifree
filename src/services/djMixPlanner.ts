/**
 * DJ Mix Planner
 *
 * Decides HOW to go from one song to the next (and in which order to play a set), using the
 * real measured BPM / key / energy when available, with variety so it never sounds the same:
 *
 *  - Same pulse + compatible keys  → long, musical blends (or an energy riser when B is hotter)
 *  - Same pulse, clashing keys     → short bass handoff, filter-style fade or a downbeat cut
 *  - Moderate tempo gap            → clean cut on the downbeat, echo-out or a beat roll
 *  - Big tempo gap                 → echo-out, cut, and now and then a vinyl power-down
 *
 * Variety rules: never the same effect twice in a row, a "wow" transition roughly every
 * 3–4 changes (never two in a row), and a per-session "flavour" picked at random each time
 * DJ mode is switched on. Everything is deterministic within a session (stable while the
 * engine re-evaluates the same pair every 100 ms) but different between sessions.
 *
 * `computeTransitionGains` is the single volume/effect renderer shared by the live mix and
 * the preview, so what you tweak in the editor is exactly what plays.
 */
import type { Track } from '../types/spotify';
import type { DJTransitionConfig, TransitionPreset, VolumeEnvelope, EQFilterMode, DJFXMode } from './djTransitionService.ts';
import {
  calculateHarmonicCompatibility,
  calculateOctaveDelta,
  cleanTrackId,
  getTrackAnalysis,
  resolveClientSideRealFeature,
  snapToBarGrid,
  type TrackAnalysisData,
} from '../utils/audioFeatures.ts';

export type MixIntensity = 'basic' | 'smooth' | 'wow';

export interface MixTrackInfo {
  id: string;
  name?: string;
  tempo: number;
  tempoReliable: boolean;
  camelot?: string;
  keyReliable: boolean;
  /** Key comes from our own audio measurement (less certain than catalog data) */
  keyMeasured?: boolean;
  energy?: number;
  analysis?: TrackAnalysisData | null;
  durationSec?: number;
}

export interface PlannedTransition extends DJTransitionConfig {
  intensity: MixIntensity;
  reason: string;
  mixInSec: number;
}

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Session state (seed changes every time DJ mode is switched on)
// ---------------------------------------------------------------------------
const SEED_KEY = 'spotifree_dj_session_seed';
let memorySeed = Math.floor(Math.random() * 2 ** 31);
const recentPresets: Array<{ preset: TransitionPreset; intensity: MixIntensity }> = [];
const planMemo = new Map<string, PlannedTransition>();

export function getDJSessionSeed(): number {
  try {
    if (typeof window !== 'undefined') {
      const v = Number(window.localStorage.getItem(SEED_KEY));
      if (Number.isFinite(v) && v > 0) return v;
    }
  } catch {}
  return memorySeed;
}

/** Starts a fresh DJ session: new order, new flavour, new transition choices. */
export function startNewDJSession(): number {
  const seed = 1 + Math.floor(Math.random() * (2 ** 31 - 2));
  memorySeed = seed;
  planMemo.clear();
  recentPresets.length = 0;
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(SEED_KEY, String(seed));
  } catch {}
  return seed;
}

export type SessionFlavour = 'fluida' | 'club' | 'radio';
export function getSessionFlavour(seed = getDJSessionSeed()): SessionFlavour {
  return (['fluida', 'club', 'radio'] as const)[seed % 3];
}

/** Called by the engine when a transition actually starts, to keep variety across the set. */
export function recordTransitionUsed(preset: TransitionPreset, intensity: MixIntensity) {
  recentPresets.push({ preset, intensity });
  if (recentPresets.length > 8) recentPresets.shift();
}

export function getRecentTransitions() {
  return [...recentPresets];
}

// ---------------------------------------------------------------------------
// Track info
// ---------------------------------------------------------------------------
export function getMixTrackInfo(track: Pick<Track, 'id' | 'name' | 'artists' | 'duration_ms'>): MixTrackInfo {
  const feat = resolveClientSideRealFeature(track.id, track.name, track.artists?.[0]?.name);
  const analysis = getTrackAnalysis(track.id);
  return {
    id: cleanTrackId(track.id),
    name: track.name,
    tempo: feat.tempo,
    tempoReliable: feat.source === 'analysis' || feat.source === 'deezer' || feat.source === 'catalog',
    camelot: feat.camelot,
    keyReliable: feat.source === 'analysis' || feat.source === 'catalog',
    keyMeasured: feat.source === 'analysis',
    energy: analysis?.energy,
    analysis,
    durationSec: track.duration_ms ? track.duration_ms / 1000 : analysis?.durationSec,
  };
}

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export type TempoRelation = 'same' | 'close' | 'moderate' | 'far';

export function tempoRelation(a: number, b: number): { relation: TempoRelation; delta: number; pct: number; octave: boolean } {
  const raw = Math.abs(a - b);
  const oct = calculateOctaveDelta(a, b);
  const octave = raw >= 18 && oct <= 4;
  const delta = octave ? oct : raw;
  const pct = (delta / Math.max(1, Math.min(a, b))) * 100;
  const relation: TempoRelation = pct <= 3 ? 'same' : pct <= 6 ? 'close' : pct <= 12 ? 'moderate' : 'far';
  return { relation, delta: Math.round(delta * 10) / 10, pct, octave };
}

export type KeyRelation = 'compatible' | 'boost' | 'clash' | 'unknown';

export function keyRelation(a: MixTrackInfo, b: MixTrackInfo): { relation: KeyRelation; label: string } {
  if (!a.keyReliable || !b.keyReliable || !a.camelot || !b.camelot) return { relation: 'unknown', label: 'tono sin medir' };
  const h = calculateHarmonicCompatibility(a.camelot, b.camelot);
  if (h.relation === 'exact' || h.relation === 'adjacent' || h.relation === 'relative') {
    return { relation: 'compatible', label: `${a.camelot} → ${b.camelot}, tonos compatibles` };
  }
  if (h.relation === 'energy_boost' || h.relation === 'diagonal') {
    return { relation: 'boost', label: `${a.camelot} → ${b.camelot}, subida de tono` };
  }
  return { relation: 'clash', label: `${a.camelot} → ${b.camelot}, tonos que chocan` };
}

// ---------------------------------------------------------------------------
// Candidate styles
// ---------------------------------------------------------------------------
interface Candidate {
  preset: TransitionPreset;
  compases: number;
  volumeEnvelope: VolumeEnvelope;
  eqMode: EQFilterMode;
  fxMode: DJFXMode;
  intensity: MixIntensity;
  title: string;
  what: string; // what it does, in plain words
  weight: number;
  enterAtDrop?: boolean; // B enters at its first full-energy section
}

const C = (
  preset: TransitionPreset,
  compases: number,
  volumeEnvelope: VolumeEnvelope,
  eqMode: EQFilterMode,
  fxMode: DJFXMode,
  intensity: MixIntensity,
  title: string,
  what: string,
  weight: number,
  enterAtDrop = false
): Candidate => ({ preset, compases, volumeEnvelope, eqMode, fxMode, intensity, title, what, weight, enterAtDrop });

/*
 * How the DJ mixes (redesigned). The songs play in YouTube players: only their volume can be
 * moved, and each one starts with an unpredictable delay, so two beats can never be locked
 * together. What sounds good under those limits (as in Mixxx's Auto DJ "full intro + outro"):
 *  - choose WHERE to mix: B's intro plays over A's ending, and B's first strong part lands when
 *    A's music ends; silent starts / ends are skipped;
 *  - keep the moment where both songs are loud short (no long flamming drums);
 *  - smooth volume curves in decibels (how the ear hears), and real cuts on A's bar line with B
 *    already running silently, so B enters exactly at its strong part.
 * No fake effects made with volume (echo, roll, vinyl, bass swap) and no synthesized hits: those
 * are what made the old transitions sound bad. Only one optional soft sweep before a "Subidón".
 * Four styles: Mezcla (blend), Fundido (fade), Corte en el 1 (cut), Subidón (build into the drop).
 */
function candidatesFor(t: TempoRelation, k: KeyRelation, energyUp: number): Candidate[] {
  const up = Math.max(0, energyUp);
  const list: Candidate[] = [];
  const blend = (bars: number, title: string, what: string, w: number) =>
    list.push(C('automatica', bars, 'superposicion', 'intercambio_graves_central', 'ninguno', 'smooth', title, what, w));
  const fade = (bars: number, what: string, w: number) =>
    list.push(C('fundido', bars, 'curva_s', 'sin_filtro', 'ninguno', 'basic', 'Fundido', what, w));
  const cut = (what: string, w: number) =>
    list.push(C('corte', 1, 'corte_directo', 'intercambio_graves_central', 'ninguno', 'basic', 'Corte en el 1', what, w, true));
  const build = (what: string, w: number) =>
    list.push(C('crescendo', 2, 'curva_s', 'intercambio_gradual', 'ninguno', 'wow', 'Subidón', what, w, true));

  if (t === 'same' || t === 'close') {
    const keysOk = k === 'compatible' || k === 'boost' || k === 'unknown';
    if (keysOk) {
      blend(8, 'Mezcla larga', 'la intro de B suena sobre el final de A y B toma el relevo justo cuando A termina', t === 'same' ? 3 : 1);
      blend(4, 'Mezcla', 'B entra desde lejos sobre el final de A y se queda con la pista en el último compás', 3);
    } else {
      // Keys that clash: overlap as little as possible
      blend(4, 'Mezcla corta', 'mezcla corta para que los tonos apenas coincidan', 1.5);
    }
    fade(2, 'fundido cruzado de dos compases', 1.2);
    cut('A suena entera hasta el compás y B entra justo en su parte fuerte', 1 + up * 2);
    if (up >= 0.1) build('B tiene más energía: A sostiene, sube la tensión y B entra en su parte fuerte', 1.2 + up * 6);
  } else if (t === 'moderate') {
    cut('con tempos distintos es mejor no solapar: B entra en el primer tiempo de su parte fuerte', 3);
    fade(1, 'fundido corto de un compás, sin solapar ritmos', 2.5);
    if (up >= 0.1) build('B tiene más energía: A sostiene y B entra de golpe en su parte fuerte', 1 + up * 5);
  } else {
    cut('corte limpio en el compás y B arranca en su parte fuerte', 3);
    fade(1, 'fundido corto para no mezclar ritmos', 2.5);
    if (up >= 0.1) build('B tiene más energía: A sostiene y B entra de golpe', 0.8 + up * 5);
  }
  return list;
}

/** The four mixing styles (any saved / older preset maps onto one of them) */
export type MixStyle = 'blend' | 'fade' | 'linear' | 'cut' | 'build';
export function mixStyleOf(config: Pick<DJTransitionConfig, 'preset' | 'volumeEnvelope'>): MixStyle {
  const preset = config.preset;
  const env = config.volumeEnvelope;
  if (preset === 'crescendo') return 'build';
  if (preset === 'corte' || preset === 'beat_roll' || preset === 'freno_vinilo' || env === 'corte_directo') return 'cut';
  if (preset === 'fundido' || preset === 'eco_out') return env === 'lineal' ? 'linear' : 'fade';
  if (env === 'lineal') return 'linear';
  if (env === 'curva_s') return 'fade';
  return 'blend';
}

/** Name of the style as shown to the user */
export function mixStyleName(style: MixStyle): string {
  if (style === 'build') return 'Subidón';
  if (style === 'cut') return 'Corte en el 1';
  if (style === 'fade' || style === 'linear') return 'Fundido';
  return 'Mezcla';
}

/**
 * Where song B starts so the mix lands right: for blends, B's intro ends when the mix ends
 * (A's music ends there); for cuts / builds, B's strong part (or first downbeat) is exactly at
 * the swap. B plays silently until it is heard, so its start delay doesn't matter.
 */
export function alignEntry(b: MixTrackInfo, style: MixStyle, durationSec: number, swap = 0.5): number {
  const an = b.analysis;
  const start = Math.max(0, an?.audioStartSec || 0);
  let t = start;
  if (style === 'cut' || style === 'build') {
    let land = start;
    if (an && typeof an.introEndSec === 'number' && an.introEndSec > start && an.introEndSec <= 45) land = an.introEndSec;
    const snapped = an ? snapToBarGrid(an, land, 'round') : null;
    if (snapped !== null && land > 0) land = snapped;
    t = Math.max(0, land - swap * durationSec);
  } else if (style === 'blend') {
    // B's intro plays over A's ending (only when the intro is long enough to carry the mix)
    if (an && typeof an.introEndSec === 'number' && an.introEndSec - start >= durationSec * 0.6 && an.introEndSec <= 60) {
      t = Math.max(start, an.introEndSec - durationSec);
      const snapped = snapToBarGrid(an, t, 'round');
      if (snapped !== null && snapped >= start - 0.05) t = snapped;
    }
  }
  return Math.round(t * 100) / 100;
}

/** Bars for a style that fit in the transition limits (1.5–16 s) at this tempo */
export function fitBars(bars: number, tempo: number): number {
  const bar = 240 / (tempo > 40 && tempo < 240 ? tempo : 120);
  let b = bars;
  while (b > 1 && b * bar > 16) b /= 2;
  return b;
}

function intensityBias(flavour: SessionFlavour, intensity: MixIntensity) {
  if (flavour === 'fluida') return intensity === 'smooth' ? 1.35 : intensity === 'wow' ? 0.8 : 1;
  if (flavour === 'club') return intensity === 'wow' ? 1.4 : 1;
  return intensity === 'basic' ? 1.35 : intensity === 'wow' ? 0.75 : 1; // radio
}

/** Where B should start: skip silent intros; drop-in styles enter at B's first full section. */
export function chooseMixInSec(b: MixTrackInfo, enterAtDrop: boolean): number {
  const an = b.analysis;
  if (!an) return 0;
  let t = Math.max(0, an.audioStartSec || 0);
  if (enterAtDrop && typeof an.introEndSec === 'number' && an.introEndSec > t && an.introEndSec <= 30) {
    t = an.introEndSec;
  }
  // Snap to B's bar grid so the first thing you hear is a downbeat (only where the grid is reliable)
  if (t > 0) {
    const snapped = snapToBarGrid(an, t, 'round');
    if (snapped !== null) t = snapped;
  }
  return Math.round(t * 100) / 100;
}

/**
 * Plans the transition between two tracks. `nonce` lets the editor ask for "another idea".
 */
export function planTransition(
  a: MixTrackInfo,
  b: MixTrackInfo,
  opts: { seed?: number; recent?: Array<{ preset: TransitionPreset; intensity: MixIntensity }>; nonce?: number } = {}
): PlannedTransition {
  const seed = opts.seed ?? getDJSessionSeed();
  const recent = opts.recent ?? recentPresets;
  const tr = tempoRelation(a.tempo, b.tempo);
  const kr = keyRelation(a, b);
  const energyUp = typeof a.energy === 'number' && typeof b.energy === 'number' ? b.energy - a.energy : 0;
  const flavour = getSessionFlavour(seed);
  // Our own key detection is often a step or two off on real songs: a measured "clash" is not
  // trustworthy enough to rule out a blend, so it is treated as unknown.
  const keyForPlan: KeyRelation = kr.relation === 'clash' && (a.keyMeasured || b.keyMeasured) ? 'unknown' : kr.relation;

  const cands = candidatesFor(tr.relation, keyForPlan, energyUp);
  const last = recent[recent.length - 1];
  const last3 = recent.slice(-3).map((r) => r.preset);
  const wowRecently = recent.slice(-2).some((r) => r.intensity === 'wow');
  const wowStarved = recent.length >= 3 && !recent.slice(-4).some((r) => r.intensity === 'wow');

  const weighted = cands.map((c) => {
    let w = c.weight * intensityBias(flavour, c.intensity);
    if (last && last.preset === c.preset) w *= 0.12;
    else if (last3.includes(c.preset)) w *= 0.55;
    if (c.intensity === 'wow') w *= wowRecently ? 0.4 : wowStarved ? 2.2 : 1.15;
    // If the BPM is only estimated, long overlapping blends are risky: prefer short moves
    if (!a.tempoReliable || !b.tempoReliable) {
      if (c.compases >= 8) w *= 0.3;
      else if (c.compases >= 4 && c.preset !== 'crescendo') w *= 0.6;
    }
    // A long blend only makes sense if A really has an ending to blend over (or it's unknown)
    const outroA = a.analysis && typeof a.analysis.outroStartSec === 'number' && typeof a.analysis.musicEndSec === 'number'
      ? a.analysis.musicEndSec - a.analysis.outroStartSec
      : null;
    if (c.preset === 'automatica' && c.compases >= 8 && outroA !== null && outroA < (240 / Math.max(60, a.tempo)) * 6) w *= 0.25;
    return { c, w: Math.max(0.0001, w) };
  });

  const rng = mulberry32(seed ^ hashString(`${a.id}>${b.id}#${opts.nonce ?? 0}`));
  const total = weighted.reduce((s, x) => s + x.w, 0);
  let r = rng() * total;
  let pick = weighted[0].c;
  for (const x of weighted) {
    r -= x.w;
    if (r <= 0) {
      pick = x.c;
      break;
    }
  }

  const tempoTxt = tr.octave
    ? `${Math.round(a.tempo)} ↔ ${Math.round(b.tempo)} BPM (doble/mitad, encajan)`
    : tr.relation === 'same'
      ? `mismo pulso (${Math.round(a.tempo)} → ${Math.round(b.tempo)} BPM)`
      : `${Math.round(a.tempo)} → ${Math.round(b.tempo)} BPM (${tr.relation === 'close' ? 'casi igual' : tr.relation === 'moderate' ? 'tempo distinto' : 'salto grande de tempo'})`;
  const energyTxt = energyUp > 0.12 ? ', B tiene más energía' : energyUp < -0.12 ? ', B es más tranquila' : '';
  const estimated = !a.tempoReliable || !b.tempoReliable ? ' (BPM estimado)' : '';
  const keyTxt =
    kr.relation === 'unknown' ? '' : keyForPlan === kr.relation ? `, ${kr.label}` : `, ${a.camelot} → ${b.camelot} (tono medido, poco seguro)`;
  const reason = `${capitalize(tempoTxt)}${keyTxt}${energyTxt}${estimated}: ${pick.what}.`;

  const h = calculateHarmonicCompatibility(a.camelot || '', b.camelot || '');
  const compases = fitBars(pick.compases, a.tempo);
  const durationSec = compases * (240 / (a.tempo > 40 && a.tempo < 240 ? a.tempo : 120));
  const cfgForStyle = { preset: pick.preset, volumeEnvelope: pick.volumeEnvelope, eqMode: pick.eqMode, fxMode: pick.fxMode };
  const style = mixStyleOf(cfgForStyle);
  return {
    trackAId: a.id,
    trackBId: b.id,
    compases,
    preset: pick.preset,
    volumeEnvelope: pick.volumeEnvelope,
    eqMode: pick.eqMode,
    fxMode: pick.fxMode,
    tempoA: a.tempo,
    tempoB: b.tempo,
    camelotA: a.camelot,
    camelotB: b.camelot,
    title: pick.title,
    label: `✦ ${pick.title}`,
    detail: reason,
    explanation: reason,
    harmonicScore: h.score,
    bpmDelta: tr.delta,
    isOctaveSynced: tr.octave,
    intensity: pick.intensity,
    reason,
    mixInSec: alignEntry(b, style, durationSec, transitionSwapPoint(cfgForStyle)),
  };
}

function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Memoised plan for a pair within the current session (the engine asks many times/second). */
export function getSessionPlan(trackA: Track, trackB: Track): PlannedTransition {
  const seed = getDJSessionSeed();
  const a = getMixTrackInfo(trackA);
  const b = getMixTrackInfo(trackB);
  // Re-plan when better data arrives (estimated → measured)
  const key = `${seed}:${a.id}:${b.id}:${a.tempoReliable ? 1 : 0}${b.tempoReliable ? 1 : 0}${a.keyReliable ? 1 : 0}${b.keyReliable ? 1 : 0}`;
  const memo = planMemo.get(key);
  if (memo) return memo;
  const plan = planTransition(a, b, { seed });
  planMemo.set(key, plan);
  return plan;
}

// ---------------------------------------------------------------------------
// Unified transition renderer (live mix + preview)
// ---------------------------------------------------------------------------
export interface TransitionGains {
  outVol: number; // 0..1 (multiply by master volume)
  inVol: number;
  rateOut: number; // playback rate for the outgoing deck (vinyl brake)
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

type GainsConfig = Pick<DJTransitionConfig, 'preset' | 'volumeEnvelope' | 'eqMode' | 'fxMode' | 'tempoA'>;

/**
 * Point of the transition (0..1) where song B "takes over" (the drop / the swap). The
 * volume shapes and the FX layers (impact, riser, roll) are all built around it, so the
 * moment is felt: tension before, impact on it.
 */
export function transitionSwapPoint(config: Pick<GainsConfig, 'preset' | 'volumeEnvelope'>): number {
  const style = mixStyleOf(config);
  return style === 'cut' || style === 'build' ? 0.92 : 0.5;
}

const dbToGain = (db: number) => (db <= -60 ? 0 : Math.pow(10, db / 20));
const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/**
 * Volume/rate of each deck at progress `p` (0..1) of a transition lasting `durationSec`.
 * Works with players that only expose volume and playback rate (YouTube decks).
 */
export function computeTransitionGains(
  config: Pick<DJTransitionConfig, 'preset' | 'volumeEnvelope' | 'eqMode' | 'fxMode' | 'tempoA'>,
  p: number,
  durationSec: number
): TransitionGains {
  p = clamp01(p);
  const style = mixStyleOf(config);
  let out = 1;
  let inn = 0;

  if (style === 'blend') {
    // B comes in from far away (-36 dB) and is fully up at 65%; A holds, then leaves from 35%.
    // Both are loud only around the middle, for a moment (the beats are never locked).
    const bDb = -36 * (1 - smooth(p / 0.65));
    const aDb = -50 * smooth((p - 0.35) / 0.65);
    inn = dbToGain(bDb);
    out = p >= 1 ? 0 : dbToGain(aDb);
  } else if (style === 'fade') {
    // Constant power: the overall loudness stays the same through the fade
    out = Math.cos(p * 0.5 * Math.PI);
    inn = Math.sin(p * 0.5 * Math.PI);
  } else if (style === 'linear') {
    out = 1 - p;
    inn = p;
  } else {
    // cut / build: B already runs silently; the handover takes ~120 ms on the swap
    const swap = transitionSwapPoint(config);
    const w = Math.min(0.04, 0.12 / Math.max(0.5, durationSec));
    const q = clamp01((p - swap) / w);
    let aBefore = 1;
    if (style === 'build') {
      // A makes a little room for the rise before the drop (-4 dB at most)
      aBefore = dbToGain(-4 * smooth((p - 0.55) / Math.max(0.01, swap - 0.55)));
    }
    out = p < swap ? aBefore : aBefore * Math.cos(q * 0.5 * Math.PI);
    inn = p < swap ? 0 : Math.sin(q * 0.5 * Math.PI);
  }

  return { outVol: clamp01(out), inVol: clamp01(inn), rateOut: 1 };
}

// ---------------------------------------------------------------------------
// Synthesized FX over the songs: only one soft sweep that rises into a "Subidón". Everything
// else stays clean (synthesized hits / rolls / cymbals over arbitrary songs sounded fake).
// ---------------------------------------------------------------------------
export type TransitionFXKind = 'riser' | 'roll' | 'impact' | 'reverse' | 'downlifter' | 'brake';

export interface TransitionFXLayer {
  kind: TransitionFXKind;
  /** start, seconds from the beginning of the transition */
  at: number;
  /** length in seconds (impact: decay length) */
  dur: number;
  /** 0..1.4 relative level */
  level: number;
}

export function transitionFXLayers(
  config: GainsConfig & Pick<DJTransitionConfig, 'intensity'>,
  durationSec: number
): TransitionFXLayer[] {
  if (mixStyleOf(config) !== 'build') return [];
  const tempo = config.tempoA && config.tempoA > 40 && config.tempoA < 240 ? config.tempoA : 120;
  const bar = 240 / tempo;
  const d = Math.max(1, durationSec);
  const swapAt = transitionSwapPoint(config) * d;
  // The rise covers the last two bars before the drop (or all the way, if shorter)
  const len = Math.min(swapAt, bar * 2);
  return [{ kind: 'riser', at: Math.max(0, swapAt - len), dur: len, level: 0.55 }];
}

/** User setting "Efectos de DJ": off / soft / normal / intense. */
export type DJFxLevel = 'off' | 'soft' | 'normal' | 'intense';
export const DJ_FX_LEVEL_KEY = 'spotifree_dj_fx_level';
export function getDJFxLevel(): DJFxLevel {
  try {
    const v = typeof window !== 'undefined' ? window.localStorage.getItem(DJ_FX_LEVEL_KEY) : null;
    if (v === 'off' || v === 'soft' || v === 'normal' || v === 'intense') return v;
  } catch {}
  return 'normal';
}
export function djFxLevelGain(level: DJFxLevel = getDJFxLevel()): number {
  return level === 'off' ? 0 : level === 'soft' ? 0.55 : level === 'intense' ? 1.45 : 1;
}

/** Synthesized layer that is allowed on top of the music (only musical, noise-based risers). */
export function auxFXForPreset(preset: TransitionPreset): 'repeticion_ritmo' | null {
  return preset === 'crescendo' || preset === 'beat_roll' ? 'repeticion_ritmo' : null;
}

// ---------------------------------------------------------------------------
// DJ set ordering (different every session)
// ---------------------------------------------------------------------------
export type SetStrategy = 'calentamiento' | 'olas' | 'viaje_armonico' | 'contrastes';

export const SET_STRATEGY_LABELS: Record<SetStrategy, string> = {
  calentamiento: 'De menos a más',
  olas: 'Subidas y bajadas',
  viaje_armonico: 'Viaje por tonos',
  contrastes: 'Contrastes',
};

export function buildDJSetOrder<T extends Pick<Track, 'id' | 'name' | 'artists' | 'duration_ms'>>(
  tracks: T[],
  seed = getDJSessionSeed(),
  infoOf: (t: T) => MixTrackInfo = (t) => getMixTrackInfo(t)
): { order: T[]; strategy: SetStrategy } {
  const strategies: SetStrategy[] = ['calentamiento', 'olas', 'viaje_armonico', 'contrastes'];
  const strategy = strategies[Math.floor(mulberry32(seed)() * strategies.length)];
  if (!tracks || tracks.length <= 2) return { order: [...(tracks || [])], strategy };

  const rng = mulberry32(seed ^ 0x9e3779b9);
  const infos = new Map(tracks.map((t) => [t, infoOf(t)]));
  // Energy proxy when not measured: tempo scaled into 0..1
  const energyOf = (i: MixTrackInfo) => (typeof i.energy === 'number' ? i.energy : Math.max(0, Math.min(1, (i.tempo - 80) / 70)));

  const remaining = [...tracks];
  const order: T[] = [];
  // Start: calm track for warm-ups, random otherwise
  let startIdx = Math.floor(rng() * remaining.length);
  if (strategy === 'calentamiento') {
    const sorted = remaining.map((t, i) => ({ i, e: energyOf(infos.get(t)!) })).sort((x, y) => x.e - y.e);
    startIdx = sorted[Math.floor(rng() * Math.min(3, sorted.length))].i;
  }
  order.push(remaining.splice(startIdx, 1)[0]);

  const n = tracks.length;
  while (remaining.length > 0) {
    const prev = infos.get(order[order.length - 1])!;
    const pos = order.length / Math.max(1, n - 1);
    const target =
      strategy === 'calentamiento'
        ? 0.25 + 0.7 * pos
        : strategy === 'olas'
          ? 0.5 + 0.35 * Math.sin(pos * Math.PI * 3)
          : strategy === 'contrastes'
            ? energyOf(prev) > 0.5
              ? 0.25
              : 0.8
            : energyOf(prev);
    const scored = remaining.map((t, i) => {
      const c = infos.get(t)!;
      const tr = tempoRelation(prev.tempo, c.tempo);
      let cost = Math.min(30, tr.pct) * (strategy === 'contrastes' ? 0.4 : 1);
      const kr = keyRelation(prev, c);
      const keyW = strategy === 'viaje_armonico' ? 2.2 : 1;
      if (kr.relation === 'compatible') cost -= 6 * keyW;
      else if (kr.relation === 'boost') cost -= 3 * keyW;
      else if (kr.relation === 'clash') cost += 6 * keyW;
      cost += Math.abs(energyOf(c) - target) * 25;
      cost += rng() * 9; // controlled randomness so each session is different
      return { i, cost };
    });
    scored.sort((x, y) => x.cost - y.cost);
    // Pick among the best 2-3 so the order is never fully predictable
    const top = scored.slice(0, Math.min(3, scored.length));
    const chosen = top[Math.floor(Math.pow(rng(), 1.8) * top.length)];
    order.push(remaining.splice(chosen.i, 1)[0]);
  }
  return { order, strategy };
}
