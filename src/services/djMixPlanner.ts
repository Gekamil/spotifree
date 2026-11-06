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

function candidatesFor(t: TempoRelation, k: KeyRelation, energyUp: number): Candidate[] {
  const up = Math.max(0, energyUp);
  const down = Math.max(0, -energyUp);
  const list: Candidate[] = [];
  if (t === 'same') {
    if (k === 'compatible' || k === 'boost') {
      list.push(C('automatica', 8, 'superposicion', 'intercambio_graves_central', 'ninguno', 'smooth', 'Mezcla larga', 'mezcla larga de 8 compases con cruce de graves a mitad', 5));
      list.push(C('mezcla_voces', 4, 'superposicion', 'intercambio_graves_central', 'ninguno', 'smooth', 'Fusión vocal', 'las dos canciones conviven 4 compases antes del relevo', 3));
      list.push(C('crescendo', 4, 'curva_s', 'intercambio_gradual', 'ninguno', 'wow', 'Subidón', 'subida de tensión con barrido y entrada de B en su parte fuerte', 1.5 + up * 6, true));
      list.push(C('beat_roll', 2, 'curva_s', 'intercambio_gradual', 'repeticion_loop', 'wow', 'Beat roll', 'redoble que se acelera (1/4 → 1/8 → 1/16) hasta soltar B', 1.2 + up * 3, true));
    } else if (k === 'unknown') {
      // Same pulse, key not known: blend, but keep the overlap moderate and swap the bass
      // (two bass lines in different keys is what clashes most)
      list.push(C('automatica', 4, 'superposicion', 'intercambio_graves_central', 'ninguno', 'smooth', 'Relevo de graves', 'mezcla de 4 compases: B entra sin graves y a mitad se intercambian', 3.5));
      list.push(C('automatica', 8, 'superposicion', 'intercambio_graves_central', 'ninguno', 'smooth', 'Mezcla larga', 'mezcla larga de 8 compases con cruce de graves a mitad', 1.6));
      list.push(C('filtro', 4, 'superposicion', 'filtro_paso_alto', 'ninguno', 'smooth', 'Filtro', 'A se va vaciando con un filtro mientras entra B', 2.4));
      list.push(C('crescendo', 4, 'curva_s', 'intercambio_gradual', 'ninguno', 'wow', 'Subidón', 'subida de tensión y B entra en su parte fuerte', 1.2 + up * 5, true));
      list.push(C('beat_roll', 2, 'curva_s', 'intercambio_gradual', 'repeticion_loop', 'wow', 'Beat roll', 'redoble que se acelera hasta soltar B', 1 + up * 3, true));
      list.push(C('corte', 1, 'corte_directo', 'intercambio_graves_central', 'ninguno', 'basic', 'Corte en el 1', 'corte limpio justo en el primer tiempo del compás', 1 + up * 2, true));
    } else {
      list.push(C('automatica', 4, 'superposicion', 'intercambio_graves_central', 'ninguno', 'smooth', 'Relevo de graves', 'cruce corto: el ritmo encaja pero los tonos no, así que no se solapan mucho', 3.5));
      list.push(C('filtro', 4, 'superposicion', 'filtro_paso_alto', 'ninguno', 'smooth', 'Filtro', 'A se va vaciando mientras entra B, para que los tonos no choquen', 3));
      list.push(C('corte', 1, 'corte_directo', 'intercambio_graves_central', 'ninguno', 'basic', 'Corte en el 1', 'corte limpio justo en el primer tiempo del compás', 1.5 + up * 3, true));
      list.push(C('eco_out', 2, 'curva_s', 'filtro_paso_bajo', 'eco', 'wow', 'Eco', 'A se despide con un eco a tempo y B entra limpia', 1.3));
    }
  } else if (t === 'close') {
    list.push(C('automatica', 2, 'superposicion', 'intercambio_graves_central', 'ninguno', 'smooth', 'Relevo de graves', 'mezcla corta de 2 compases para que la pequeña diferencia de tempo no se note', 3));
    list.push(C('fundido', 2, 'curva_s', 'sin_filtro', 'ninguno', 'basic', 'Fundido', 'fundido cruzado sencillo', 2.5));
    list.push(C('corte', 1, 'corte_directo', 'intercambio_graves_central', 'ninguno', 'basic', 'Corte en el 1', 'corte limpio justo en el primer tiempo del compás', 2 + up * 3, true));
    list.push(C('beat_roll', 2, 'curva_s', 'intercambio_gradual', 'repeticion_loop', 'wow', 'Beat roll', 'redoble que se acelera hasta soltar B', 1.2 + up * 2, true));
  } else if (t === 'moderate') {
    list.push(C('corte', 1, 'corte_directo', 'intercambio_graves_central', 'ninguno', 'basic', 'Corte en el 1', 'corte en el primer tiempo: con tempos distintos es mejor no solapar', 3.5, true));
    list.push(C('eco_out', 2, 'curva_s', 'filtro_paso_bajo', 'eco', 'smooth', 'Eco', 'A se despide con un eco a su tempo y B entra sin pelearse con el ritmo', 3));
    list.push(C('fundido', 1, 'curva_s', 'sin_filtro', 'ninguno', 'basic', 'Fundido rápido', 'fundido de un compás, sin solapar ritmos', 2));
    list.push(C('beat_roll', 2, 'curva_s', 'intercambio_gradual', 'repeticion_loop', 'wow', 'Beat roll', 'redoble acelerado que rompe el ritmo de A antes de B', 1.5 + up * 2, true));
  } else {
    list.push(C('eco_out', 2, 'curva_s', 'filtro_paso_bajo', 'eco', 'smooth', 'Eco', 'cambio grande de tempo: A se apaga en eco y B arranca limpia', 3.5));
    list.push(C('corte', 1, 'corte_directo', 'intercambio_graves_central', 'ninguno', 'basic', 'Corte en el 1', 'cambio grande de tempo: corte seco en el primer tiempo', 2.5, true));
    list.push(C('freno_vinilo', 1, 'corte_directo', 'intercambio_graves_central', 'freno_vinilo', 'wow', 'Freno de vinilo', 'A se frena como un vinilo y entra B', 1 + down * 4));
    list.push(C('crescendo', 4, 'curva_s', 'intercambio_gradual', 'ninguno', 'wow', 'Subidón', 'barrido de tensión y B entra en su parte fuerte', 0.6 + up * 5, true));
  }
  return list;
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
    if (c.intensity === 'wow') w *= wowRecently ? 0.25 : wowStarved ? 1.9 : 1;
    // If the BPM is only estimated, long overlapping blends are risky: prefer short moves
    if (!a.tempoReliable || !b.tempoReliable) {
      if (c.compases >= 4 && c.preset !== 'crescendo') w *= 0.5;
    }
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
  return {
    trackAId: a.id,
    trackBId: b.id,
    compases: pick.compases,
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
    mixInSec: chooseMixInSec(b, Boolean(pick.enterAtDrop)),
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
  const tempo = config.tempoA && config.tempoA > 40 && config.tempoA < 240 ? config.tempoA : 120;
  const beat = 60 / tempo;
  const elapsed = p * durationSec;
  const preset = config.preset;
  const env = config.volumeEnvelope;
  let out = 1;
  let inn = 0;
  let rateOut = 1;

  // 1. Base volume envelope
  const isCut = env === 'corte_directo' || preset === 'corte' || config.eqMode === 'corte_instantaneo';
  if (isCut) {
    // A keeps the floor until the last beat, then a 40 ms-style handoff on the downbeat
    const cx = preset === 'corte' ? 0.94 : 0.5;
    const w = 0.03;
    if (p < cx) {
      out = 1;
      inn = 0;
    } else if (p < cx + w) {
      const q = (p - cx) / w;
      out = 1 - q;
      inn = q;
    } else {
      out = 0;
      inn = 1;
    }
  } else if (env === 'lineal') {
    out = 1 - p;
    inn = p;
  } else if (env === 'superposicion') {
    out = p < 0.5 ? 1 : Math.cos(((p - 0.5) / 0.5) * 0.5 * Math.PI);
    inn = Math.sin(Math.min(1, p / 0.5) * 0.5 * Math.PI);
  } else {
    // curva_s (equal power)
    out = Math.cos(p * 0.5 * Math.PI);
    inn = Math.sin(p * 0.5 * Math.PI);
  }

  // 2. EQ behaviour emulated with volume (YouTube decks cannot be filtered)
  if (!isCut) {
    if (config.eqMode === 'intercambio_graves_central') {
      if (p < 0.5) inn *= 0.6; // B enters "thin" (no bass) ...
      else out *= 0.45; // ... and takes over the low end at the middle downbeat
    } else if (config.eqMode === 'filtro_paso_alto' || config.eqMode === 'filtro_paso_bajo') {
      out *= Math.pow(1 - p, 0.9); // A empties out faster
    }
  }

  // 3. Preset-specific shapes
  if (preset === 'crescendo') {
    out = p < 0.85 ? 1 - 0.25 * (p / 0.85) : Math.max(0, (1 - p) / 0.15) * 0.75;
    inn = p < 0.85 ? 0.12 * (p / 0.85) : 0.12 + 0.88 * ((p - 0.85) / 0.15);
  } else if (preset === 'mezcla_voces') {
    out = Math.cos(Math.pow(p, 1.3) * 0.5 * Math.PI);
    inn = Math.sin(Math.pow(p, 0.75) * 0.5 * Math.PI);
    if (p < 0.5) inn *= 0.85;
  }

  // 4. FX
  if (config.fxMode === 'eco' || preset === 'eco_out') {
    // Tempo-synced dotted-eighth echo: A is gated into decaying repeats, B fades in late
    const period = beat * 0.75;
    const phase = (elapsed % period) / period;
    const decay = Math.pow(1 - p, 1.6);
    const pulse = phase < 0.35 ? 1 : 0.18;
    out = p < 0.25 ? 1 : decay * pulse;
    inn = p < 0.45 ? 0 : Math.sin(((p - 0.45) / 0.55) * 0.5 * Math.PI);
  } else if (config.fxMode === 'repeticion_loop' || preset === 'beat_roll') {
    if (p >= 0.25 && p < 0.97) {
      const div = p < 0.6 ? 1 : p < 0.82 ? 2 : 4; // 1/4 → 1/8 → 1/16
      const step = beat / div;
      const phase = (elapsed % step) / step;
      out = phase < 0.5 ? 1 : 0.12;
      inn = p < 0.82 ? 0.08 : 0.08 + 0.4 * ((p - 0.82) / 0.15);
    } else if (p >= 0.97) {
      out = 0;
      inn = 1;
    }
  } else if (config.fxMode === 'freno_vinilo' || preset === 'freno_vinilo') {
    if (p < 0.55) {
      out = 1;
      inn = 0;
      rateOut = 1;
    } else if (p < 0.92) {
      const q = (p - 0.55) / 0.37;
      rateOut = q < 0.34 ? 0.75 : q < 0.67 ? 0.5 : 0.25;
      out = 1 - 0.6 * q;
      inn = 0;
    } else {
      rateOut = 0.25;
      out = Math.max(0, (1 - p) / 0.08) * 0.4;
      inn = (p - 0.92) / 0.08;
    }
  } else if (config.fxMode === 'distorsion_wash') {
    if (p > 0.4) out *= 0.7 + 0.3 * Math.sin(((elapsed % (beat / 2)) / (beat / 2)) * 2 * Math.PI);
  }

  return { outVol: clamp01(out), inVol: clamp01(inn), rateOut };
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
