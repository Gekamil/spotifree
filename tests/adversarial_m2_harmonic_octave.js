/**
 * Spotifree Milestone 2 Adversarial Empirical Test Harness:
 * Harmonic Scoring, Camelot Modular Distance, and Octave Matching
 *
 * Verifies audioFeatures.ts and djTransitionService.ts against all M2 contracts.
 */

import { register } from 'node:module';
register(new URL('./test_loader.js', import.meta.url));

const feat = await import('../src/utils/audioFeatures.ts');
const dj = await import('../src/services/djTransitionService.ts');

const results = [];
let passCount = 0;
let failCount = 0;

function testCase(category, id, description, fn) {
  try {
    const outcome = fn();
    if (outcome === false || (typeof outcome === 'object' && outcome.pass === false)) {
      failCount++;
      const reason = outcome && outcome.reason ? outcome.reason : 'Assertion returned false';
      results.push({ category, id, description, passed: false, reason });
      console.log(`  ✖ [FAIL] [${id}] ${description} -> ${reason}`);
    } else {
      passCount++;
      const detail = outcome && outcome.detail ? ` (${outcome.detail})` : '';
      results.push({ category, id, description, passed: true });
      console.log(`  ✔ [PASS] [${id}] ${description}${detail}`);
    }
  } catch (err) {
    failCount++;
    results.push({ category, id, description, passed: false, reason: err.message });
    console.log(`  ✖ [ERROR] [${id}] ${description} -> Exception: ${err.message}`);
  }
}

console.log('='.repeat(80));
console.log('  MILESTONE 2 EMPIRICAL ADVERSARIAL TEST SUITE: HARMONIC & OCTAVE ENGINE');
console.log('='.repeat(80));

// ============================================================================
// 1. Octave Matching & BPM Delta
// ============================================================================
console.log('\n--- 1. Octave Matching & BPM Delta ---');

testCase('Octave', 'OCT-01', '140 vs 70 BPM (2:1 ratio) yields delta == 0', () => {
  const delta = feat.calculateOctaveDelta(140, 70);
  return delta === 0 ? { pass: true, detail: `delta=${delta}` } : { pass: false, reason: `Expected 0, got ${delta}` };
});

testCase('Octave', 'OCT-02', '85 vs 170 BPM (1:2 ratio) yields delta == 0', () => {
  const delta = feat.calculateOctaveDelta(85, 170);
  return delta === 0 ? { pass: true, detail: `delta=${delta}` } : { pass: false, reason: `Expected 0, got ${delta}` };
});

testCase('Octave', 'OCT-03', '75 vs 150 BPM (1:2 ratio) yields delta == 0', () => {
  const delta = feat.calculateOctaveDelta(75, 150);
  return delta === 0 ? { pass: true, detail: `delta=${delta}` } : { pass: false, reason: `Expected 0, got ${delta}` };
});

testCase('Octave', 'OCT-04', '80 vs 160 BPM (1:2 ratio) yields delta == 0', () => {
  const delta = feat.calculateOctaveDelta(80, 160);
  return delta === 0 ? { pass: true, detail: `delta=${delta}` } : { pass: false, reason: `Expected 0, got ${delta}` };
});

testCase('Octave', 'OCT-05', 'Near octave: 142 vs 70 BPM yields delta == 2', () => {
  const delta = feat.calculateOctaveDelta(142, 70);
  return delta === 2 ? { pass: true, detail: `delta=${delta}` } : { pass: false, reason: `Expected 2, got ${delta}` };
});

testCase('Octave', 'OCT-06', 'Near octave: 71 vs 140 BPM yields delta == 2', () => {
  const delta = feat.calculateOctaveDelta(71, 140);
  return delta === 2 ? { pass: true, detail: `delta=${delta}` } : { pass: false, reason: `Expected 2, got ${delta}` };
});

testCase('Octave', 'OCT-07', 'Non-octave: 128 vs 150 BPM yields delta == 22', () => {
  const delta = feat.calculateOctaveDelta(128, 150);
  return delta === 22 ? { pass: true, detail: `delta=${delta}` } : { pass: false, reason: `Expected 22, got ${delta}` };
});

testCase('Octave', 'OCT-08', 'Non-octave: 100 vs 130 BPM yields delta == 30', () => {
  const delta = feat.calculateOctaveDelta(100, 130);
  return delta === 30 ? { pass: true, detail: `delta=${delta}` } : { pass: false, reason: `Expected 30, got ${delta}` };
});

testCase('Octave', 'OCT-09', 'Edge tempo <= 40: bpmA=40 falls back to 128 (40 vs 128 -> delta 0)', () => {
  const delta = feat.calculateOctaveDelta(40, 128);
  return delta === 0 ? { pass: true, detail: `delta=${delta}` } : { pass: false, reason: `Expected 0, got ${delta}` };
});

testCase('Octave', 'OCT-10', 'Edge tempo <= 40: bpmA=20 falls back to 128 (20 vs 70 -> delta 12)', () => {
  const delta = feat.calculateOctaveDelta(20, 70);
  // 128 vs 70 -> min(|128-70|, |128-140|, |256-70|) = min(58, 12, 186) = 12
  return delta === 12 ? { pass: true, detail: `delta=${delta}` } : { pass: false, reason: `Expected 12, got ${delta}` };
});

testCase('Octave', 'OCT-11', 'Edge tempo >= 240: bpmA=240 falls back to 128 (240 vs 128 -> delta 0)', () => {
  const delta = feat.calculateOctaveDelta(240, 128);
  return delta === 0 ? { pass: true, detail: `delta=${delta}` } : { pass: false, reason: `Expected 0, got ${delta}` };
});

testCase('Octave', 'OCT-12', 'Edge tempo >= 240: bpmA=300 falls back to 128 (300 vs 128 -> delta 0)', () => {
  const delta = feat.calculateOctaveDelta(300, 128);
  return delta === 0 ? { pass: true, detail: `delta=${delta}` } : { pass: false, reason: `Expected 0, got ${delta}` };
});

testCase('Octave', 'OCT-13', 'Valid tempo just inside lower bound: 41 vs 82 yields delta == 0', () => {
  const delta = feat.calculateOctaveDelta(41, 82);
  return delta === 0 ? { pass: true, detail: `delta=${delta}` } : { pass: false, reason: `Expected 0, got ${delta}` };
});

testCase('Octave', 'OCT-14', 'Valid tempo just inside upper bound: 238 vs 119 yields delta == 0', () => {
  const delta = feat.calculateOctaveDelta(238, 119);
  return delta === 0 ? { pass: true, detail: `delta=${delta}` } : { pass: false, reason: `Expected 0, got ${delta}` };
});

testCase('Octave', 'OCT-15', 'Sanitization for non-finite / NaN inputs falls back to 128', () => {
  const dNaN = feat.calculateOctaveDelta(NaN, 128);
  const dInf = feat.calculateOctaveDelta(Infinity, 128);
  const dNeg = feat.calculateOctaveDelta(-50, 128);
  const pass = dNaN === 0 && dInf === 0 && dNeg === 0;
  return pass ? { pass: true, detail: 'NaN/Inf/-50 sanitized to 128' } : { pass: false, reason: `dNaN=${dNaN}, dInf=${dInf}, dNeg=${dNeg}` };
});

// ============================================================================
// 2. Camelot Modular Distance
// ============================================================================
console.log('\n--- 2. Camelot Modular Distance ---');

testCase('CamelotDistance', 'CAM-01', 'Wrap-around distance: distance(1A, 12A) == 1', () => {
  const res = feat.calculateCamelotDistance('1A', '12A');
  return res.numDiff === 1 && res.sameLetter === true
    ? { pass: true, detail: `numDiff=${res.numDiff}, sameLetter=${res.sameLetter}` }
    : { pass: false, reason: `Expected numDiff=1, sameLetter=true, got numDiff=${res.numDiff}, sameLetter=${res.sameLetter}` };
});

testCase('CamelotDistance', 'CAM-02', 'Wrap-around distance: distance(12B, 1B) == 1', () => {
  const res = feat.calculateCamelotDistance('12B', '1B');
  return res.numDiff === 1 && res.sameLetter === true
    ? { pass: true, detail: `numDiff=${res.numDiff}, sameLetter=${res.sameLetter}` }
    : { pass: false, reason: `Expected numDiff=1, sameLetter=true, got numDiff=${res.numDiff}, sameLetter=${res.sameLetter}` };
});

testCase('CamelotDistance', 'CAM-03', 'Max distance: distance(1A, 7A) == 6', () => {
  const res = feat.calculateCamelotDistance('1A', '7A');
  return res.numDiff === 6 && res.sameLetter === true
    ? { pass: true, detail: `numDiff=${res.numDiff}` }
    : { pass: false, reason: `Expected numDiff=6, got ${res.numDiff}` };
});

testCase('CamelotDistance', 'CAM-04', 'Max distance: distance(6B, 12B) == 6', () => {
  const res = feat.calculateCamelotDistance('6B', '12B');
  return res.numDiff === 6 && res.sameLetter === true
    ? { pass: true, detail: `numDiff=${res.numDiff}` }
    : { pass: false, reason: `Expected numDiff=6, got ${res.numDiff}` };
});

testCase('CamelotDistance', 'CAM-05', 'Identity: distance(K, K) == 0 across all 24 Camelot keys', () => {
  const keys = [];
  for (let i = 1; i <= 12; i++) {
    keys.push(`${i}A`, `${i}B`);
  }
  for (const k of keys) {
    const res = feat.calculateCamelotDistance(k, k);
    if (res.numDiff !== 0 || !res.sameLetter) {
      return { pass: false, reason: `Key ${k} self-distance gave numDiff=${res.numDiff}` };
    }
  }
  return { pass: true, detail: 'All 24 keys have self-distance 0' };
});

testCase('CamelotDistance', 'CAM-06', 'Symmetry: distance(A, B) == distance(B, A) across all 576 key pairs', () => {
  const keys = [];
  for (let i = 1; i <= 12; i++) {
    keys.push(`${i}A`, `${i}B`);
  }
  let asymmetricCount = 0;
  for (const k1 of keys) {
    for (const k2 of keys) {
      const d1 = feat.calculateCamelotDistance(k1, k2);
      const d2 = feat.calculateCamelotDistance(k2, k1);
      if (d1.numDiff !== d2.numDiff || d1.sameLetter !== d2.sameLetter) {
        asymmetricCount++;
      }
    }
  }
  return asymmetricCount === 0
    ? { pass: true, detail: '576/576 pairs perfectly symmetric' }
    : { pass: false, reason: `${asymmetricCount} pairs failed symmetry` };
});

testCase('CamelotDistance', 'CAM-07', 'Case insensitivity and format normalization in parsing', () => {
  const p1 = feat.parseCamelot('8a');
  const p2 = feat.parseCamelot('12b');
  const p3 = feat.parseCamelot('9A');
  const pass = p1.num === 8 && p1.letter === 'A' && p2.num === 12 && p2.letter === 'B' && p3.num === 9 && p3.letter === 'A';
  return pass ? { pass: true, detail: 'Normalized lowercase and uppercase keys' } : { pass: false, reason: 'Case parsing failed' };
});

testCase('CamelotDistance', 'CAM-08', 'Out-of-range number normalization (0A -> 12A, 13A -> 1A)', () => {
  const p0 = feat.parseCamelot('0A');
  const p13 = feat.parseCamelot('13A');
  const pass = p0.num === 12 && p13.num === 1;
  return pass ? { pass: true, detail: '0A normalized to 12A, 13A normalized to 1A' } : { pass: false, reason: `p0=${p0.num}, p13=${p13.num}` };
});

// ============================================================================
// 3. Harmonic Scoring
// ============================================================================
console.log('\n--- 3. Harmonic Scoring ---');

testCase('HarmonicScoring', 'HARM-01', 'Exact match (8A, 8A) -> score == 100', () => {
  const s = feat.calculateHarmonicScore('8A', '8A');
  return s === 100 ? { pass: true, detail: `score=${s}` } : { pass: false, reason: `Expected 100, got ${s}` };
});

testCase('HarmonicScoring', 'HARM-02', 'Adjacent key (8A, 9A) -> score == 90', () => {
  const s = feat.calculateHarmonicScore('8A', '9A');
  return s === 90 ? { pass: true, detail: `score=${s}` } : { pass: false, reason: `Expected 90, got ${s}` };
});

testCase('HarmonicScoring', 'HARM-03', 'Adjacent key wrap-around (1A, 12A) -> score == 90', () => {
  const s = feat.calculateHarmonicScore('1A', '12A');
  return s === 90 ? { pass: true, detail: `score=${s}` } : { pass: false, reason: `Expected 90, got ${s}` };
});

testCase('HarmonicScoring', 'HARM-04', 'Relative mode (8A, 8B) -> score == 85', () => {
  const s = feat.calculateHarmonicScore('8A', '8B');
  return s === 85 ? { pass: true, detail: `score=${s}` } : { pass: false, reason: `Expected 85, got ${s}` };
});

testCase('HarmonicScoring', 'HARM-05', 'Diagonal shift (8A, 9B) -> score == 75', () => {
  const s = feat.calculateHarmonicScore('8A', '9B');
  return s === 75 ? { pass: true, detail: `score=${s}` } : { pass: false, reason: `Expected 75, got ${s}` };
});

testCase('HarmonicScoring', 'HARM-06', 'Diagonal shift wrap-around (1A, 12B) -> score == 75', () => {
  const s = feat.calculateHarmonicScore('1A', '12B');
  return s === 75 ? { pass: true, detail: `score=${s}` } : { pass: false, reason: `Expected 75, got ${s}` };
});

testCase('HarmonicScoring', 'HARM-07', 'Energy boost +2 (8A, 10A) -> score == 60', () => {
  const s = feat.calculateHarmonicScore('8A', '10A');
  const comp = feat.calculateHarmonicCompatibility('8A', '10A');
  return s === 60
    ? { pass: true, detail: `calculateHarmonicScore=${s}, compatibility.score=${comp.score}` }
    : { pass: false, reason: `Expected score==60, but calculateHarmonicScore returned ${s} (compatibility.score=${comp.score})` };
});

testCase('HarmonicScoring', 'HARM-08', 'Energy boost +7 (8A, 3A) -> score == 60', () => {
  const s = feat.calculateHarmonicScore('8A', '3A');
  const comp = feat.calculateHarmonicCompatibility('8A', '3A');
  return s === 60
    ? { pass: true, detail: `score=${s}, relation=${comp.relation}` }
    : { pass: false, reason: `Expected score==60, got ${s}` };
});

testCase('HarmonicScoring', 'HARM-09', 'Clash (1A, 7A) -> score <= 50', () => {
  const s = feat.calculateHarmonicScore('1A', '7A');
  return s <= 50 ? { pass: true, detail: `score=${s}` } : { pass: false, reason: `Expected <= 50, got ${s}` };
});

testCase('HarmonicScoring', 'HARM-10', 'Clash (1A, 6A) -> score <= 50', () => {
  const s = feat.calculateHarmonicScore('1A', '6A');
  return s <= 50 ? { pass: true, detail: `score=${s}` } : { pass: false, reason: `Expected <= 50, got ${s}` };
});

testCase('HarmonicScoring', 'HARM-11', 'Internal Consistency: calculateHarmonicScore matches calculateHarmonicCompatibility.score across all 576 pairs', () => {
  const keys = [];
  for (let i = 1; i <= 12; i++) {
    keys.push(`${i}A`, `${i}B`);
  }
  const discrepancies = [];
  for (const k1 of keys) {
    for (const k2 of keys) {
      const sScore = feat.calculateHarmonicScore(k1, k2);
      const sComp = feat.calculateHarmonicCompatibility(k1, k2).score;
      if (sScore !== sComp) {
        discrepancies.push({ k1, k2, sScore, sComp });
      }
    }
  }
  return discrepancies.length === 0
    ? { pass: true, detail: '576/576 pairs match perfectly between score functions' }
    : {
        pass: false,
        reason: `${discrepancies.length} discrepancies found between calculateHarmonicScore and calculateHarmonicCompatibility (e.g., 8A->10A: score=${discrepancies[0].sScore} vs comp=${discrepancies[0].sComp})`,
      };
});

// ============================================================================
// 4. Smart Transition Octave Detection & Preset Routing
// ============================================================================
console.log('\n--- 4. Smart Transition Octave Detection & Preset Routing ---');

testCase('SmartTransition', 'SMART-01', '140 BPM (8A) vs 70 BPM (8A): isOctaveSynced === true', () => {
  const tA = { id: 'trackA', tempo: 140, camelot: '8A' };
  const tB = { id: 'trackB', tempo: 70, camelot: '8A' };
  const res = dj.calculateSmartTransition(tA, tB);
  return res.isOctaveSynced === true
    ? { pass: true, detail: `isOctaveSynced=${res.isOctaveSynced}` }
    : { pass: false, reason: `Expected isOctaveSynced=true, got ${res.isOctaveSynced}` };
});

testCase('SmartTransition', 'SMART-02', '140 BPM (8A) vs 70 BPM (8A): bpmDelta === 0', () => {
  const tA = { id: 'trackA', tempo: 140, camelot: '8A' };
  const tB = { id: 'trackB', tempo: 70, camelot: '8A' };
  const res = dj.calculateSmartTransition(tA, tB);
  return res.bpmDelta === 0
    ? { pass: true, detail: `bpmDelta=${res.bpmDelta}` }
    : { pass: false, reason: `Expected bpmDelta=0, got ${res.bpmDelta}` };
});

testCase('SmartTransition', 'SMART-03', '140 BPM (8A) vs 70 BPM (8A): Does NOT trigger freno_vinilo', () => {
  const tA = { id: 'trackA', tempo: 140, camelot: '8A' };
  const tB = { id: 'trackB', tempo: 70, camelot: '8A' };
  const res = dj.calculateSmartTransition(tA, tB);
  return res.preset !== 'freno_vinilo'
    ? { pass: true, detail: `preset=${res.preset}` }
    : { pass: false, reason: `Preset is incorrectly freno_vinilo` };
});

testCase('SmartTransition', 'SMART-04', '140 BPM (8A) vs 70 BPM (8A): Does NOT trigger eco_out', () => {
  const tA = { id: 'trackA', tempo: 140, camelot: '8A' };
  const tB = { id: 'trackB', tempo: 70, camelot: '8A' };
  const res = dj.calculateSmartTransition(tA, tB);
  return res.preset !== 'eco_out'
    ? { pass: true, detail: `preset=${res.preset}` }
    : { pass: false, reason: `Preset is incorrectly eco_out` };
});

testCase('SmartTransition', 'SMART-05', '140 BPM (8A) vs 70 BPM (8A): Chooses a harmonic blend (automatica or crescendo)', () => {
  const tA = { id: 'trackA', tempo: 140, camelot: '8A' };
  const tB = { id: 'trackB', tempo: 70, camelot: '8A' };
  const res = dj.calculateSmartTransition(tA, tB);
  const isBlend = res.preset === 'automatica' || res.preset === 'crescendo';
  return isBlend
    ? { pass: true, detail: `preset=${res.preset}, compases=${res.compases}` }
    : { pass: false, reason: `Expected harmonic blend (automatica or crescendo), got ${res.preset}` };
});

testCase('SmartTransition', 'SMART-06', '85 BPM (8A) vs 170 BPM (8A): Double-time octave syncs harmonically', () => {
  const tA = { id: 'trackA', tempo: 85, camelot: '8A' };
  const tB = { id: 'trackB', tempo: 170, camelot: '8A' };
  const res = dj.calculateSmartTransition(tA, tB);
  return res.isOctaveSynced === true && (res.preset === 'automatica' || res.preset === 'crescendo')
    ? { pass: true, detail: `isOctaveSynced=${res.isOctaveSynced}, preset=${res.preset}` }
    : { pass: false, reason: `Failed double-time octave sync: isOctaveSynced=${res.isOctaveSynced}, preset=${res.preset}` };
});

testCase('SmartTransition', 'SMART-07', '75 BPM (8A) vs 150 BPM (8A): Double-time octave syncs harmonically', () => {
  const tA = { id: 'trackA', tempo: 75, camelot: '8A' };
  const tB = { id: 'trackB', tempo: 150, camelot: '8A' };
  const res = dj.calculateSmartTransition(tA, tB);
  return res.isOctaveSynced === true && (res.preset === 'automatica' || res.preset === 'crescendo')
    ? { pass: true, detail: `isOctaveSynced=${res.isOctaveSynced}, preset=${res.preset}` }
    : { pass: false, reason: `Failed double-time octave sync: isOctaveSynced=${res.isOctaveSynced}, preset=${res.preset}` };
});

testCase('SmartTransition', 'SMART-08', 'Non-octave 128 vs 150 BPM: Triggers tempo disconnect (freno_vinilo or eco_out)', () => {
  const tA = { id: 'trackA', tempo: 128, camelot: '8A' };
  const tB = { id: 'trackB', tempo: 150, camelot: '8A' };
  const res = dj.calculateSmartTransition(tA, tB);
  const isDisconnect = res.preset === 'freno_vinilo' || res.preset === 'eco_out';
  return isDisconnect && !res.isOctaveSynced
    ? { pass: true, detail: `preset=${res.preset}, isOctaveSynced=${res.isOctaveSynced}, bpmDelta=${res.bpmDelta}` }
    : { pass: false, reason: `Expected disconnect preset, got ${res.preset}` };
});

testCase('SmartTransition', 'SMART-09', 'Deterministic seed variation across 10 iterations never triggers disconnect for 140 vs 70 BPM', () => {
  let allBlends = true;
  for (let seed = 0; seed < 10; seed++) {
    const res = dj.calculateSmartTransition('t1', 't2', 140, 70, '8A', '8A', seed);
    if (res.preset === 'freno_vinilo' || res.preset === 'eco_out' || !res.isOctaveSynced) {
      allBlends = false;
      break;
    }
  }
  return allBlends
    ? { pass: true, detail: 'All 10 seeds maintain harmonic blend and isOctaveSynced=true' }
    : { pass: false, reason: 'A seed triggered disconnect preset on octave-locked pair' };
});

// ============================================================================
// 5. Phrase & Duration Math Bounds Clamping
// ============================================================================
console.log('\n--- 5. Phrase & Duration Math Bounds Clamping ---');

testCase('DurationMath', 'DUR-01', '4/4 meter phrase math at 128 BPM: 1 bar = 1.875s, 2 bars = 3.75s, 4 bars = 7.5s', () => {
  const d1 = dj.calculateDurationSeconds(128, 1);
  const d2 = dj.calculateDurationSeconds(128, 2);
  const d4 = dj.calculateDurationSeconds(128, 4);
  const pass = Math.abs(d1 - 1.875) < 1e-4 && Math.abs(d2 - 3.75) < 1e-4 && Math.abs(d4 - 7.5) < 1e-4;
  return pass
    ? { pass: true, detail: `1 bar=${d1}s, 2 bars=${d2}s, 4 bars=${d4}s` }
    : { pass: false, reason: `Math failed: d1=${d1}, d2=${d2}, d4=${d4}` };
});

testCase('DurationMath', 'DUR-02', 'Lower clamp bound: 239 BPM, 1 compás (raw 1.004s) is clamped to >= 1.5s', () => {
  const d = dj.calculateDurationSeconds(239, 1);
  return d === 1.5 ? { pass: true, detail: `duration=${d}s` } : { pass: false, reason: `Expected 1.5, got ${d}` };
});

testCase('DurationMath', 'DUR-03', 'Upper clamp bound: 41 BPM, 8 compases (raw 46.8s) is clamped to <= 16.0s', () => {
  const d = dj.calculateDurationSeconds(41, 8);
  return d === 16.0 ? { pass: true, detail: `duration=${d}s` } : { pass: false, reason: `Expected 16.0, got ${d}` };
});

testCase('DurationMath', 'DUR-04', 'Tempo boundary <= 40 and >= 240 defaults to 128 BPM in calculateDurationSeconds', () => {
  const dLow = dj.calculateDurationSeconds(40, 2);
  const dHigh = dj.calculateDurationSeconds(240, 2);
  const dNorm = dj.calculateDurationSeconds(128, 2); // 3.75
  const pass = dLow === dNorm && dHigh === dNorm;
  return pass ? { pass: true, detail: `40 BPM -> ${dLow}s, 240 BPM -> ${dHigh}s (both 128 BPM default)` } : { pass: false, reason: `dLow=${dLow}, dHigh=${dHigh}` };
});

testCase('DurationMath', 'DUR-05', 'Beat and Bar duration helper functions calculate exact 60/BPM and 240/BPM', () => {
  const beat = dj.calculateBeatDuration(120); // 0.5s
  const bar = dj.calculateBarDuration(120);   // 2.0s
  const pass = Math.abs(beat - 0.5) < 1e-4 && Math.abs(bar - 2.0) < 1e-4;
  return pass ? { pass: true, detail: `beat=${beat}s, bar=${bar}s` } : { pass: false, reason: `beat=${beat}, bar=${bar}` };
});

// ============================================================================
// Summary
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log(`SUMMARY: Total Tests: ${results.length} | Passed: ${passCount} | Failed: ${failCount}`);
console.log('='.repeat(80));

if (failCount > 0) {
  console.log('\nFAILED TEST DETAILS:');
  for (const r of results) {
    if (!r.passed) {
      console.log(`- [${r.id}] ${r.description}`);
      console.log(`  Reason: ${r.reason}`);
    }
  }
}

process.exit(failCount > 0 ? 1 : 0);
