import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register(new URL('./test_loader.js', import.meta.url));

let A; // audioAnalysis
let P; // djMixPlanner
let F; // audioFeatures

before(async () => {
  A = await import('../src/utils/audioAnalysis.ts');
  P = await import('../src/services/djMixPlanner.ts');
  F = await import('../src/utils/audioFeatures.ts');
});

// --- Synthetic music: kick on every beat, high-passed hats, chord pad + bass ----------------
function synth({ bpm, sr = 44100, sec = 45, chord, startSilence = 0 }) {
  const n = Math.floor(sr * sec);
  const x = new Float32Array(n);
  const beat = 60 / bpm;
  const midiF = (m) => 440 * Math.pow(2, (m - 69) / 12);
  let lastR = 0;
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (let i = Math.floor(startSilence * sr); i < n; i++) {
    const t = i / sr - startSilence;
    let v = 0;
    for (const m of chord) {
      const f = midiF(m);
      v += 0.08 * Math.sin(2 * Math.PI * f * t) + 0.03 * Math.sin(4 * Math.PI * f * t);
    }
    v += 0.12 * Math.sin(2 * Math.PI * midiF(chord[0] - 12) * t);
    const bi = Math.floor(t / beat);
    const tb = t - bi * beat;
    v += (bi % 4 === 0 ? 1 : 0.6) * 0.9 * Math.exp(-tb * 30) * Math.sin(2 * Math.PI * (55 + 80 * Math.exp(-tb * 40)) * tb);
    const th = tb - beat / 2;
    if (th > 0) {
      const r = rnd();
      v += 0.15 * Math.exp(-th * 80) * (r - lastR);
      lastR = r;
    }
    x[i] = v;
  }
  return x;
}

const bar = (bpm) => 240 / bpm;
const nearGrid = (t, origin, period) => {
  const d = (((t - origin) % period) + period) % period;
  return Math.min(d, period - d);
};

describe('Real audio analysis (tempo, beat grid, key, structure)', () => {
  const cases = [
    { bpm: 124, chord: [57, 60, 64], key: 9, mode: 0, label: 'A minor' },
    { bpm: 95, chord: [60, 64, 67], key: 0, mode: 1, label: 'C major' },
    { bpm: 140, chord: [54, 57, 61], key: 6, mode: 0, label: 'F# minor' },
  ];
  for (const c of cases) {
    it(`A.${c.bpm}: detects ${c.bpm} BPM, ${c.label} and the bar grid`, () => {
      const r = A.analyzeAudio([synth(c)], 44100);
      assert.ok(Math.abs(r.tempo - c.bpm) <= 1, `tempo ${r.tempo} vs ${c.bpm}`);
      assert.equal(r.key, c.key, `key ${r.key}`);
      assert.equal(r.mode, c.mode, `mode ${r.mode}`);
      assert.ok(nearGrid(r.downbeatOffsetSec, 0, bar(c.bpm)) < 0.06, `downbeat ${r.downbeatOffsetSec}`);
    });
  }

  it('A.silence: finds the first audible second and keeps the grid aligned after it', () => {
    const r = A.analyzeAudio([synth({ bpm: 105, chord: [55, 59, 62], startSilence: 3 })], 44100);
    assert.ok(Math.abs(r.audioStartSec - 3) <= 0.5, `audioStart ${r.audioStartSec}`);
    assert.ok(Math.abs(r.tempo - 105) <= 1);
    assert.ok(nearGrid(r.downbeatOffsetSec, 3, bar(105)) < 0.06, `downbeat ${r.downbeatOffsetSec}`);
  });

  it('A.fft: magnitude spectrum peaks at the right bin', () => {
    const N = 1024;
    const f = new Float32Array(N);
    for (let i = 0; i < N; i++) f[i] = Math.sin((2 * Math.PI * 64 * i) / N);
    const m = A.magnitudeSpectrum(f);
    let best = 0;
    for (let i = 1; i < m.length; i++) if (m[i] > m[best]) best = i;
    assert.equal(best, 64);
  });
});

describe('Measured data overrides estimates', () => {
  it('M.1: resolveClientSideRealFeature uses measured BPM/key and reports the source', () => {
    const before = F.resolveClientSideRealFeature('measure_1', 'Some Unknown Song', 'Unknown Artist');
    assert.equal(before.source, 'estimated');
    F.setTrackAnalysis('measure_1', { tempo: 122.6, tempoSource: 'analysis', key: 9, mode: 0, keySource: 'analysis', analyzedAt: 1 });
    const after = F.resolveClientSideRealFeature('measure_1', 'Some Unknown Song', 'Unknown Artist');
    assert.equal(after.tempo, 123);
    assert.equal(after.camelot, '8A');
    assert.equal(after.source, 'analysis');
  });

  it('M.2: a Deezer BPM never downgrades a real audio analysis', () => {
    F.setTrackAnalysis('measure_1', { tempo: 99, tempoSource: 'deezer', analyzedAt: 2 });
    assert.equal(F.getTrackAnalysis('measure_1').tempoSource, 'analysis');
  });
});

describe('Transition planner', () => {
  const info = (id, tempo, camelot, energy, reliable = true) => ({
    id,
    tempo,
    tempoReliable: reliable,
    camelot,
    keyReliable: reliable,
    energy,
  });

  it('P.1: tempo relations (same / close / moderate / far, octave aware)', () => {
    assert.equal(P.tempoRelation(124, 125).relation, 'same');
    assert.equal(P.tempoRelation(120, 126).relation, 'close');
    assert.equal(P.tempoRelation(100, 110).relation, 'moderate');
    assert.equal(P.tempoRelation(96, 128).relation, 'far');
    const oct = P.tempoRelation(70, 140);
    assert.equal(oct.octave, true);
    assert.equal(oct.relation, 'same');
  });

  it('P.2: same seed + same pair = same plan; different sessions vary', () => {
    const a = info('a', 124, '8A', 0.6);
    const b = info('b', 125, '9A', 0.6);
    const p1 = P.planTransition(a, b, { seed: 42, recent: [] });
    const p2 = P.planTransition(a, b, { seed: 42, recent: [] });
    assert.equal(p1.preset, p2.preset);
    const seen = new Set();
    for (let s = 1; s <= 40; s++) seen.add(P.planTransition(a, b, { seed: s, recent: [] }).preset);
    assert.ok(seen.size >= 3, `only ${[...seen].join(',')}`);
  });

  it('P.3: big tempo gaps never use long overlapping blends', () => {
    for (let s = 1; s <= 60; s++) {
      const p = P.planTransition(info('a', 96, '8A', 0.5), info('b', 128, '8A', 0.7), { seed: s, recent: [] });
      assert.ok(['eco_out', 'corte', 'freno_vinilo', 'crescendo'].includes(p.preset), p.preset);
      assert.ok(!(p.preset === 'automatica' && p.compases >= 4));
    }
  });

  it('P.4: compatible keys at the same pulse allow long musical blends', () => {
    const presets = new Set();
    for (let s = 1; s <= 60; s++) {
      const p = P.planTransition(info('a', 124, '8A', 0.6), info('b', 124, '9A', 0.6), { seed: s, recent: [] });
      presets.add(`${p.preset}:${p.compases}`);
    }
    assert.ok(presets.has('automatica:8'), [...presets].join(','));
  });

  it('P.5: a simulated set never repeats the same effect twice in a row and spaces out "wow" moves', () => {
    const tempos = [120, 122, 121, 128, 96, 124, 125, 140, 70, 118, 119, 132, 100, 101, 126, 127];
    const keys = ['8A', '9A', '8B', '3A', '9A', '10A', '10B', '1A', '1A', '6B', '7B', '12A', '5A', '5A', '8A', '9A'];
    for (const seed of [7, 99, 2024, 31337]) {
      const recent = [];
      let wowCount = 0;
      for (let i = 0; i < tempos.length - 1; i++) {
        const p = P.planTransition(info(`t${i}`, tempos[i], keys[i], 0.3 + (i % 5) * 0.12), info(`t${i + 1}`, tempos[i + 1], keys[i + 1], 0.3 + ((i + 1) % 5) * 0.12), { seed, recent });
        recent.push({ preset: p.preset, intensity: p.intensity });
        if (p.intensity === 'wow') wowCount++;
      }
      let sameInARow = 0;
      for (let i = 1; i < recent.length; i++) if (recent[i].preset === recent[i - 1].preset) sameInARow++;
      assert.ok(sameInARow <= 2, `seed ${seed}: ${sameInARow} repeats`);
      assert.ok(wowCount >= 1, `seed ${seed}: no wow transition at all`);
      assert.ok(wowCount <= Math.ceil(recent.length / 2), `seed ${seed}: too many wow (${wowCount})`);
    }
  });

  it('P.6: every plan explains itself in plain words', () => {
    const p = P.planTransition(info('a', 124, '8A', 0.4), info('b', 126, '9A', 0.8), { seed: 5, recent: [] });
    assert.ok(typeof p.reason === 'string' && p.reason.length > 20);
    assert.ok(/BPM/.test(p.reason));
  });

  it('P.7: song B skips its silent intro and enters on its own bar grid', () => {
    const b = {
      ...info('b', 120, '8A', 0.6),
      analysis: { tempo: 120, tempoSource: 'analysis', downbeatOffsetSec: 0.5, audioStartSec: 3.1, introEndSec: 16.4, analyzedAt: 1 },
    };
    const plain = P.chooseMixInSec(b, false);
    assert.ok(Math.abs(plain - 2.5) < 0.01 || Math.abs(plain - 4.5) < 0.01, `entry ${plain}`);
    const drop = P.chooseMixInSec(b, true);
    assert.ok(Math.abs(((drop - 0.5) / 2) - Math.round((drop - 0.5) / 2)) < 0.01, `drop entry on bar: ${drop}`);
    assert.ok(drop > 14 && drop < 18);
  });

  it('P.8: the bar grid is used inside the analysed audio and dropped when it would drift', () => {
    const an = { tempo: 120, tempoSource: 'analysis', tempoConfidence: 0.6, downbeatOffsetSec: 0.5, durationSec: 150, analyzedAt: 1 };
    // Inside the analysed chunk: snapped to a bar line (bars every 2 s from 0.5)
    const inside = F.snapToBarGrid(an, 101.3);
    assert.equal(inside, 100.5);
    // Slightly past the chunk: drift still tiny, keep aligning
    assert.notEqual(F.snapToBarGrid(an, 170), null);
    // Far past it (minute 5 of a long song): extrapolated grid would be off by ~a beat
    assert.equal(F.snapToBarGrid(an, 300), null);
    // Low tempo confidence or Deezer disagreement: never trust the grid that far
    assert.equal(F.snapToBarGrid({ ...an, tempoConfidence: 0.1 }, 50), null);
    assert.equal(F.snapToBarGrid({ ...an, tempoRelErr: 0.01 }, 190), null);
    // Not measured from audio: no grid at all
    assert.equal(F.snapToBarGrid({ ...an, tempoSource: 'deezer' }, 50), null);
  });

  it('P.9: same pulse with unknown key still gets blends (not only cuts)', () => {
    const a = { ...info('a', 124, undefined, 0.5), keyReliable: false };
    const b = { ...info('b', 125, undefined, 0.55), keyReliable: false };
    const presets = new Set();
    for (let seed = 1; seed <= 60; seed++) presets.add(P.planTransition(a, b, { seed, recent: [] }).preset);
    assert.ok(presets.has('automatica') || presets.has('filtro'), `presets: ${[...presets]}`);
    assert.ok(presets.size >= 3, `variety: ${[...presets]}`);
  });

  it('P.10: a "clash" from our own key measurement is not trusted as a clash', () => {
    const a = { ...info('a', 124, '2B', 0.5), keyMeasured: true };
    const b = { ...info('b', 124, '6B', 0.5), keyMeasured: true };
    const p = P.planTransition(a, b, { seed: 3, recent: [] });
    assert.ok(/poco seguro/.test(p.reason), p.reason);
    assert.ok(!/tonos que chocan/.test(p.reason));
  });
});

describe('Unified transition renderer (live mix == preview)', () => {
  const envelopes = ['superposicion', 'corte_directo', 'lineal', 'curva_s'];
  const presets = ['automatica', 'corte', 'filtro', 'eco_out', 'freno_vinilo', 'beat_roll', 'crescendo', 'fundido', 'mezcla_voces'];
  it('R.1: volumes stay in [0,1] and every transition starts on A and ends on B', () => {
    for (const preset of presets) {
      for (const volumeEnvelope of envelopes) {
        const cfg = { preset, volumeEnvelope, eqMode: 'intercambio_graves_central', fxMode: 'ninguno', tempoA: 124 };
        for (let i = 0; i <= 100; i++) {
          const g = P.computeTransitionGains(cfg, i / 100, 8);
          assert.ok(g.outVol >= 0 && g.outVol <= 1 && g.inVol >= 0 && g.inVol <= 1, `${preset}/${volumeEnvelope}`);
        }
        const start = P.computeTransitionGains(cfg, 0, 8);
        const end = P.computeTransitionGains(cfg, 1, 8);
        assert.ok(start.outVol >= 0.7, `${preset}/${volumeEnvelope} start out ${start.outVol}`);
        assert.ok(start.inVol <= 0.15, `${preset}/${volumeEnvelope} start in ${start.inVol}`);
        assert.ok(end.inVol >= 0.95, `${preset}/${volumeEnvelope} end in ${end.inVol}`);
        assert.ok(end.outVol <= 0.05, `${preset}/${volumeEnvelope} end out ${end.outVol}`);
      }
    }
  });

  it('R.2: "corte" keeps A at full volume until the last beat, then hands over', () => {
    const cfg = { preset: 'corte', volumeEnvelope: 'corte_directo', eqMode: 'intercambio_graves_central', fxMode: 'ninguno', tempoA: 128 };
    assert.equal(P.computeTransitionGains(cfg, 0.9, 2).outVol, 1);
    assert.equal(P.computeTransitionGains(cfg, 0.9, 2).inVol, 0);
    assert.equal(P.computeTransitionGains(cfg, 0.99, 2).inVol, 1);
  });

  it('R.3: vinyl brake slows A down in steps (0.75 → 0.5 → 0.25)', () => {
    const cfg = { preset: 'freno_vinilo', volumeEnvelope: 'corte_directo', eqMode: 'intercambio_graves_central', fxMode: 'freno_vinilo', tempoA: 120 };
    const rates = new Set();
    for (let i = 0; i <= 100; i++) rates.add(P.computeTransitionGains(cfg, i / 100, 2).rateOut);
    assert.deepEqual([...rates].sort(), [0.25, 0.5, 0.75, 1]);
  });

  it('R.4: every DJ transition except a plain fade gets audible layers built around the swap', () => {
    const base = { volumeEnvelope: 'curva_s', eqMode: 'intercambio_graves_central', fxMode: 'ninguno', tempoA: 124, intensity: 'smooth' };
    assert.deepEqual(P.transitionFXLayers({ ...base, preset: 'fundido' }, 8), []);
    for (const preset of ['automatica', 'crescendo', 'filtro', 'corte', 'mezcla_voces', 'eco_out']) {
      const layers = P.transitionFXLayers({ ...base, preset }, 8);
      assert.ok(layers.length > 0, preset);
      for (const l of layers) assert.ok(l.at >= 0 && l.dur > 0 && l.level > 0 && l.level <= 1.5, `${preset} ${JSON.stringify(l)}`);
    }
    // The impact lands exactly where B takes over
    const cres = { ...base, preset: 'crescendo', intensity: 'wow' };
    const impact = P.transitionFXLayers(cres, 8).find((l) => l.kind === 'impact');
    assert.ok(Math.abs(impact.at - P.transitionSwapPoint(cres) * 8) < 1e-9);
    const roll = { ...base, preset: 'beat_roll', fxMode: 'repeticion_loop' };
    assert.ok(P.transitionFXLayers(roll, 4).some((l) => l.kind === 'roll'));
  });

  it('R.5: build-ups breathe in right before the drop (tension gap), then B lands at full level', () => {
    const cfg = { preset: 'crescendo', volumeEnvelope: 'curva_s', eqMode: 'intercambio_gradual', fxMode: 'ninguno', tempoA: 120 };
    const swap = P.transitionSwapPoint(cfg);
    const dur = 8;
    const justBefore = P.computeTransitionGains(cfg, swap - 0.01, dur);
    const after = P.computeTransitionGains(cfg, Math.min(1, swap + 0.1), dur);
    assert.ok(justBefore.outVol < 0.2 && justBefore.inVol < 0.2, JSON.stringify(justBefore));
    assert.ok(after.inVol > 0.6, JSON.stringify(after));
  });
});

describe('DJ set ordering', () => {
  const tracks = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, name: `Song ${i}`, artists: [{ name: 'X' }], duration_ms: 200000 }));
  const infoOf = (t) => {
    const i = Number(t.id.slice(1));
    return { id: t.id, tempo: 90 + i * 4, tempoReliable: true, camelot: `${(i % 12) + 1}A`, keyReliable: true, energy: (i % 6) / 6 };
  };

  it('O.1: returns every track exactly once', () => {
    const { order } = P.buildDJSetOrder(tracks, 77, infoOf);
    assert.equal(order.length, tracks.length);
    assert.deepEqual(new Set(order.map((t) => t.id)), new Set(tracks.map((t) => t.id)));
  });

  it('O.2: deterministic for a session, different between sessions', () => {
    const a = P.buildDJSetOrder(tracks, 77, infoOf).order.map((t) => t.id).join(',');
    const b = P.buildDJSetOrder(tracks, 77, infoOf).order.map((t) => t.id).join(',');
    assert.equal(a, b);
    const variants = new Set();
    for (let s = 1; s <= 20; s++) variants.add(P.buildDJSetOrder(tracks, s, infoOf).order.map((t) => t.id).join(','));
    assert.ok(variants.size >= 10, `only ${variants.size} distinct orders`);
  });

  it('O.3: uses several ordering strategies across sessions', () => {
    const strategies = new Set();
    for (let s = 1; s <= 40; s++) strategies.add(P.buildDJSetOrder(tracks, s, infoOf).strategy);
    assert.ok(strategies.size >= 3, [...strategies].join(','));
  });
});
