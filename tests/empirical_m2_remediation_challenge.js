/**
 * Empirical Challenger Milestone 2 Remediation Test Harness
 * 
 * Independent, exhaustive adversarial test suite verifying:
 * 1. 576-pair Camelot parity between calculateHarmonicScore and calculateHarmonicCompatibility.score
 * 2. Asymmetry between forward Energy Boost (+2 -> 60, +7 -> 60) and backward drop (-2 -> 40, -7 -> 10)
 * 3. Wrap-around Camelot distances (1A vs 12A, 12B vs 1B, 1A vs 7A, 6B vs 12B, 1A vs 12B)
 * 4. All 48 diagonal mode shifts (score == 75, relation == 'diagonal')
 * 5. All 24 relative major/minor pairs (score == 85, relation == 'relative')
 * 6. Extreme tempos, non-finite values (NaN, Inf, -50, 0, 20, 40, 240, 300)
 * 7. Octave ratios (140 vs 70, 70 vs 140, 85 vs 170, 170 vs 85, 75 vs 150, 80 vs 160)
 * 8. Near-octave tolerance (142 vs 70 -> sync) vs outside-tolerance (155 vs 70 -> disconnect)
 * 9. Integration into calculateSmartTransition with accurate harmonicScore and octave bypass
 * 10. Direct verification of BUG-M2-01 resolution and zero regressions
 */

import { register } from 'node:module';
register(new URL('./test_loader.js', import.meta.url));

const feat = await import('../src/utils/audioFeatures.ts');
const dj = await import('../src/services/djTransitionService.ts');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testId, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✔ [PASS] [${testId}] ${message}`);
  } else {
    failedTests++;
    failures.push({ testId, message });
    console.log(`  ✖ [FAIL] [${testId}] ${message}`);
  }
}

console.log('='.repeat(80));
console.log('  CHALLENGER EMPIRICAL VERIFICATION HARNESS: HARMONIC & OCTAVE ENGINE');
console.log('='.repeat(80));

// ============================================================================
// SECTION 1: BUG-M2-01 RESOLUTION & ENERGY BOOST DIRECTIONALITY
// ============================================================================
console.log('\n--- Section 1: BUG-M2-01 Resolution & Energy Boost Directionality ---');

// HARM-07 resolution: 8A -> 10A must be 60, NOT 70
const score8to10 = feat.calculateHarmonicScore('8A', '10A');
const comp8to10 = feat.calculateHarmonicCompatibility('8A', '10A');
assert(score8to10 === 60, 'BUG-01.1', `8A -> 10A calculateHarmonicScore returns 60 (got ${score8to10})`);
assert(comp8to10.score === 60, 'BUG-01.2', `8A -> 10A calculateHarmonicCompatibility returns score 60 (got ${comp8to10.score})`);
assert(comp8to10.relation === 'energy_boost', 'BUG-01.3', `8A -> 10A relation is energy_boost (got ${comp8to10.relation})`);

// Asymmetry: 10A -> 8A (backward modulation) must be 40 (clash), NOT 70 and NOT energy_boost
const score10to8 = feat.calculateHarmonicScore('10A', '8A');
const comp10to8 = feat.calculateHarmonicCompatibility('10A', '8A');
assert(score10to8 === 40, 'BUG-01.4', `10A -> 8A backward modulation returns 40 (got ${score10to8})`);
assert(comp10to8.score === 40, 'BUG-01.5', `10A -> 8A calculateHarmonicCompatibility returns 40 (got ${comp10to8.score})`);
assert(comp10to8.relation === 'clash', 'BUG-01.6', `10A -> 8A relation is clash (got ${comp10to8.relation})`);

// Forward +2 across the 12A -> 2A boundary
const score12to2 = feat.calculateHarmonicScore('12A', '2A');
const comp12to2 = feat.calculateHarmonicCompatibility('12A', '2A');
assert(score12to2 === 60 && comp12to2.relation === 'energy_boost', 'BUG-01.7', `12A -> 2A wrap-around energy boost (+2) returns 60 (got ${score12to2})`);

// Forward +2 across the 11A -> 1A boundary
const score11to1 = feat.calculateHarmonicScore('11A', '1A');
const comp11to1 = feat.calculateHarmonicCompatibility('11A', '1A');
assert(score11to1 === 60 && comp11to1.relation === 'energy_boost', 'BUG-01.8', `11A -> 1A wrap-around energy boost (+2) returns 60 (got ${score11to1})`);

// Backward -2 across boundary: 2A -> 12A must be 40
const score2to12 = feat.calculateHarmonicScore('2A', '12A');
const comp2to12 = feat.calculateHarmonicCompatibility('2A', '12A');
assert(score2to12 === 40 && comp2to12.relation === 'clash', 'BUG-01.9', `2A -> 12A backward modulation (-2) returns 40 clash (got ${score2to12})`);

// Forward +7 energy boost: 8A -> 3A returns 60
const score8to3 = feat.calculateHarmonicScore('8A', '3A');
const comp8to3 = feat.calculateHarmonicCompatibility('8A', '3A');
assert(score8to3 === 60 && comp8to3.relation === 'energy_boost', 'BUG-01.10', `8A -> 3A forward +7 energy boost returns 60 (got ${score8to3})`);

// Backward -7: 3A -> 8A is forwardStep 5 -> clash distance 5 -> score 10
const score3to8 = feat.calculateHarmonicScore('3A', '8A');
const comp3to8 = feat.calculateHarmonicCompatibility('3A', '8A');
assert(score3to8 === 10 && comp3to8.relation === 'clash', 'BUG-01.11', `3A -> 8A backward -7 returns 10 clash (got ${score3to8})`);

// All 24 keys: verify all forward +2 modulations are score 60 and backward -2 are score 40
let allForwardPlus2Pass = true;
let allBackwardMinus2Pass = true;
for (let num = 1; num <= 12; num++) {
  for (const letter of ['A', 'B']) {
    const fromKey = `${num}${letter}`;
    const targetPlus2 = `${(((num + 1) % 12) + 1)}${letter}`;
    const targetMinus2 = `${(((num - 3 + 12) % 12) + 1)}${letter}`;

    const plus2Score = feat.calculateHarmonicScore(fromKey, targetPlus2);
    const minus2Score = feat.calculateHarmonicScore(fromKey, targetMinus2);

    if (plus2Score !== 60) allForwardPlus2Pass = false;
    if (minus2Score !== 40) allBackwardMinus2Pass = false;
  }
}
assert(allForwardPlus2Pass, 'BUG-01.12', `All 24 forward +2 modulations return 60 energy boost`);
assert(allBackwardMinus2Pass, 'BUG-01.13', `All 24 backward -2 modulations return 40 clash`);

// ============================================================================
// SECTION 2: 576-PAIR CAMELOT PARITY & CANONICAL CONSISTENCY
// ============================================================================
console.log('\n--- Section 2: 576-Pair Camelot Parity & Canonical Consistency ---');

const allKeys = [];
for (let i = 1; i <= 12; i++) {
  allKeys.push(`${i}A`, `${i}B`);
}

let parityDiscrepancies = 0;
let canonicalViolations = 0;

for (const k1 of allKeys) {
  for (const k2 of allKeys) {
    const sScore = feat.calculateHarmonicScore(k1, k2);
    const comp = feat.calculateHarmonicCompatibility(k1, k2);

    // Parity check
    if (sScore !== comp.score) {
      parityDiscrepancies++;
    }

    // Canonical verification
    const { numDiff, sameLetter, cA, cB } = feat.calculateCamelotDistance(k1, k2);
    const forwardStep = (cB.num - cA.num + 12) % 12;
    let expectedScore;
    let expectedRelation;

    if (numDiff === 0 && sameLetter) {
      expectedScore = 100;
      expectedRelation = 'exact';
    } else if (numDiff === 0 && !sameLetter) {
      expectedScore = 85;
      expectedRelation = 'relative';
    } else if (numDiff === 1 && sameLetter) {
      expectedScore = 90;
      expectedRelation = 'adjacent';
    } else if (numDiff === 1 && !sameLetter) {
      expectedScore = 75;
      expectedRelation = 'diagonal';
    } else if (sameLetter && (forwardStep === 7 || forwardStep === 2)) {
      expectedScore = 60;
      expectedRelation = 'energy_boost';
    } else {
      expectedScore = Math.max(10, 60 - numDiff * 10);
      expectedRelation = 'clash';
    }

    if (comp.score !== expectedScore || comp.relation !== expectedRelation) {
      canonicalViolations++;
    }
  }
}

assert(parityDiscrepancies === 0, 'PARITY-01', `576/576 pairs have 0 discrepancies between calculateHarmonicScore and calculateHarmonicCompatibility.score`);
assert(canonicalViolations === 0, 'PARITY-02', `576/576 pairs adhere 100% to canonical harmonic mixing specifications`);

// ============================================================================
// SECTION 3: CAMELOT DISTANCE & WRAP-AROUND MODULAR ARITHMETIC
// ============================================================================
console.log('\n--- Section 3: Camelot Distance & Wrap-Around Modular Arithmetic ---');

// 1A vs 12A
const d1_12A = feat.calculateCamelotDistance('1A', '12A');
assert(d1_12A.numDiff === 1 && d1_12A.sameLetter === true, 'CAM-DIST-01', `1A vs 12A modular distance is 1 with sameLetter=true`);

// 12A vs 1A
const d12_1A = feat.calculateCamelotDistance('12A', '1A');
assert(d12_1A.numDiff === 1 && d12_1A.sameLetter === true, 'CAM-DIST-02', `12A vs 1A modular distance is 1 with sameLetter=true`);

// 12B vs 1B
const d12_1B = feat.calculateCamelotDistance('12B', '1B');
assert(d12_1B.numDiff === 1 && d12_1B.sameLetter === true, 'CAM-DIST-03', `12B vs 1B modular distance is 1 with sameLetter=true`);

// 1A vs 7A (diametrically opposite max distance 6)
const d1_7A = feat.calculateCamelotDistance('1A', '7A');
assert(d1_7A.numDiff === 6, 'CAM-DIST-04', `1A vs 7A max modular distance is 6`);

// 6B vs 12B (diametrically opposite max distance 6)
const d6_12B = feat.calculateCamelotDistance('6B', '12B');
assert(d6_12B.numDiff === 6, 'CAM-DIST-05', `6B vs 12B max modular distance is 6`);

// Symmetry across all 576 pairs
let asymmetricPairs = 0;
for (const k1 of allKeys) {
  for (const k2 of allKeys) {
    const d1 = feat.calculateCamelotDistance(k1, k2);
    const d2 = feat.calculateCamelotDistance(k2, k1);
    if (d1.numDiff !== d2.numDiff || d1.sameLetter !== d2.sameLetter) {
      asymmetricPairs++;
    }
  }
}
assert(asymmetricPairs === 0, 'CAM-DIST-06', `calculateCamelotDistance is 100% symmetric across all 576 pairs`);

// ============================================================================
// SECTION 4: DIAGONAL SHIFTS & RELATIVE MAJOR/MINOR
// ============================================================================
console.log('\n--- Section 4: Diagonal Shifts & Relative Major/Minor ---');

// Relative major/minor across all 12 pairs
let relativeMajorMinorErrors = 0;
for (let num = 1; num <= 12; num++) {
  const kA = `${num}A`;
  const kB = `${num}B`;
  const compAB = feat.calculateHarmonicCompatibility(kA, kB);
  const compBA = feat.calculateHarmonicCompatibility(kB, kA);
  if (compAB.score !== 85 || compAB.relation !== 'relative' || !compAB.isRelativeMajorMinor) relativeMajorMinorErrors++;
  if (compBA.score !== 85 || compBA.relation !== 'relative' || !compBA.isRelativeMajorMinor) relativeMajorMinorErrors++;
}
assert(relativeMajorMinorErrors === 0, 'REL-01', `All 24 relative Major/Minor modulations return score 85, relation 'relative', and isRelativeMajorMinor: true`);

// Diagonal mode shifts across all 48 combinations:
let diagonalErrors = 0;
for (let num = 1; num <= 12; num++) {
  const nextNum = (num % 12) + 1;
  const prevNum = ((num - 2 + 12) % 12) + 1;

  // A to B diagonals
  const dA1 = feat.calculateHarmonicCompatibility(`${num}A`, `${nextNum}B`);
  const dA2 = feat.calculateHarmonicCompatibility(`${num}A`, `${prevNum}B`);
  // B to A diagonals
  const dB1 = feat.calculateHarmonicCompatibility(`${num}B`, `${nextNum}A`);
  const dB2 = feat.calculateHarmonicCompatibility(`${num}B`, `${prevNum}A`);

  if (dA1.score !== 75 || dA1.relation !== 'diagonal') diagonalErrors++;
  if (dA2.score !== 75 || dA2.relation !== 'diagonal') diagonalErrors++;
  if (dB1.score !== 75 || dB1.relation !== 'diagonal') diagonalErrors++;
  if (dB2.score !== 75 || dB2.relation !== 'diagonal') diagonalErrors++;
}
assert(diagonalErrors === 0, 'DIAG-01', `All 48 diagonal mode shift combinations return score 75 and relation 'diagonal'`);

// Wrap-around diagonal test: 1A -> 12B and 12A -> 1B
const diagWrap1 = feat.calculateHarmonicCompatibility('1A', '12B');
const diagWrap2 = feat.calculateHarmonicCompatibility('12A', '1B');
assert(diagWrap1.score === 75 && diagWrap1.relation === 'diagonal', 'DIAG-02', `1A -> 12B wrap-around diagonal shift returns score 75`);
assert(diagWrap2.score === 75 && diagWrap2.relation === 'diagonal', 'DIAG-03', `12A -> 1B wrap-around diagonal shift returns score 75`);

// ============================================================================
// SECTION 5: OCTAVE RATIOS & TEMPO MATH
// ============================================================================
console.log('\n--- Section 5: Octave Ratios & Tempo Math ---');

// 140 vs 70 (2:1 half-time)
const delta140_70 = feat.calculateOctaveDelta(140, 70);
assert(delta140_70 === 0, 'OCT-DELTA-01', `140 vs 70 BPM (2:1 ratio) yields octave delta 0`);

// 70 vs 140 (1:2 double-time)
const delta70_140 = feat.calculateOctaveDelta(70, 140);
assert(delta70_140 === 0, 'OCT-DELTA-02', `70 vs 140 BPM (1:2 ratio) yields octave delta 0`);

// 85 vs 170 (1:2 ratio)
const delta85_170 = feat.calculateOctaveDelta(85, 170);
assert(delta85_170 === 0, 'OCT-DELTA-03', `85 vs 170 BPM (1:2 ratio) yields octave delta 0`);

// 170 vs 85 (2:1 ratio)
const delta170_85 = feat.calculateOctaveDelta(170, 85);
assert(delta170_85 === 0, 'OCT-DELTA-04', `170 vs 85 BPM (2:1 ratio) yields octave delta 0`);

// 75 vs 150
const delta75_150 = feat.calculateOctaveDelta(75, 150);
assert(delta75_150 === 0, 'OCT-DELTA-05', `75 vs 150 BPM (1:2 ratio) yields octave delta 0`);

// 80 vs 160
const delta80_160 = feat.calculateOctaveDelta(80, 160);
assert(delta80_160 === 0, 'OCT-DELTA-06', `80 vs 160 BPM (1:2 ratio) yields octave delta 0`);

// Near octave: 142 vs 70 (delta 2)
const deltaNear1 = feat.calculateOctaveDelta(142, 70);
assert(deltaNear1 === 2, 'OCT-DELTA-07', `142 vs 70 BPM near-octave yields delta 2`);

// Near octave: 71 vs 140 (delta 2)
const deltaNear2 = feat.calculateOctaveDelta(71, 140);
assert(deltaNear2 === 2, 'OCT-DELTA-08', `71 vs 140 BPM near-octave yields delta 2`);

// Outside octave tolerance: 155 vs 70 BPM (155 vs 140 = 15)
const deltaOut = feat.calculateOctaveDelta(155, 70);
assert(deltaOut === 15, 'OCT-DELTA-09', `155 vs 70 BPM outside tolerance yields delta 15`);

// Extreme and boundary tempos:
const dNaN = feat.calculateOctaveDelta(NaN, 128);
const dInf = feat.calculateOctaveDelta(Infinity, 128);
const dNeg = feat.calculateOctaveDelta(-50, 128);
const dZero = feat.calculateOctaveDelta(0, 128);
const d20 = feat.calculateOctaveDelta(20, 128);
const d40 = feat.calculateOctaveDelta(40, 128);
const d240 = feat.calculateOctaveDelta(240, 128);
const d300 = feat.calculateOctaveDelta(300, 128);

assert(dNaN === 0 && dInf === 0 && dNeg === 0 && dZero === 0, 'OCT-SAN-01', `NaN, Infinity, negative, and zero sanitize to default 128 BPM`);
assert(d20 === 0 && d40 === 0, 'OCT-SAN-02', `Tempos <= 40 (20 BPM, 40 BPM) sanitize to default 128 BPM`);
assert(d240 === 0 && d300 === 0, 'OCT-SAN-03', `Tempos >= 240 (240 BPM, 300 BPM) sanitize to default 128 BPM`);

// ============================================================================
// SECTION 6: SMART TRANSITION END-TO-END INTEGRATION
// ============================================================================
console.log('\n--- Section 6: Smart Transition End-to-End Integration ---');

// Octave-locked 140 vs 70 BPM (8A vs 8A)
const tr140_70 = dj.calculateSmartTransition({ id: 't1', tempo: 140, camelot: '8A' }, { id: 't2', tempo: 70, camelot: '8A' });
assert(tr140_70.isOctaveSynced === true, 'SMART-OCT-01', `140 vs 70 BPM sets isOctaveSynced === true`);
assert(tr140_70.bpmDelta === 0, 'SMART-OCT-02', `140 vs 70 BPM sets effective bpmDelta === 0`);
assert(tr140_70.preset !== 'freno_vinilo' && tr140_70.preset !== 'eco_out', 'SMART-OCT-03', `140 vs 70 BPM does NOT trigger disconnect preset (got ${tr140_70.preset})`);
assert(tr140_70.harmonicScore === 100, 'SMART-OCT-04', `140 vs 70 BPM preserves exact harmonicScore 100`);

// Octave-locked 85 vs 170 BPM (8A vs 8A)
const tr85_170 = dj.calculateSmartTransition({ id: 't1', tempo: 85, camelot: '8A' }, { id: 't2', tempo: 170, camelot: '8A' });
assert(tr85_170.isOctaveSynced === true && tr85_170.bpmDelta === 0, 'SMART-OCT-05', `85 vs 170 BPM sets isOctaveSynced === true and bpmDelta === 0`);

// Non-octave 128 vs 150 BPM (8A vs 8A): gap 22 BPM
const tr128_150 = dj.calculateSmartTransition({ id: 't1', tempo: 128, camelot: '8A' }, { id: 't2', tempo: 150, camelot: '8A' });
assert(tr128_150.isOctaveSynced === false, 'SMART-NON-01', `128 vs 150 BPM sets isOctaveSynced === false`);
assert(tr128_150.bpmDelta === 22, 'SMART-NON-02', `128 vs 150 BPM sets bpmDelta === 22`);
assert(tr128_150.preset === 'freno_vinilo' || tr128_150.preset === 'eco_out', 'SMART-NON-03', `128 vs 150 BPM triggers disconnect preset (got ${tr128_150.preset})`);

// Energy boost in smart transition: 8A -> 10A (tempo 128 vs 128)
const trEnergyBoost = dj.calculateSmartTransition({ id: 't1', tempo: 128, camelot: '8A' }, { id: 't2', tempo: 128, camelot: '10A' });
assert(trEnergyBoost.harmonicScore === 60, 'SMART-HARM-01', `8A -> 10A embeds harmonicScore: 60 in DJTransitionConfig (got ${trEnergyBoost.harmonicScore})`);

// Backward modulation in smart transition: 10A -> 8A (tempo 128 vs 128)
const trBackwardMod = dj.calculateSmartTransition({ id: 't1', tempo: 128, camelot: '10A' }, { id: 't2', tempo: 128, camelot: '8A' });
assert(trBackwardMod.harmonicScore === 40, 'SMART-HARM-02', `10A -> 8A embeds harmonicScore: 40 in DJTransitionConfig (got ${trBackwardMod.harmonicScore})`);

// Relative Major/Minor in smart transition: 8A -> 8B
const trRelative = dj.calculateSmartTransition({ id: 't1', tempo: 128, camelot: '8A' }, { id: 't2', tempo: 128, camelot: '8B' });
assert(trRelative.harmonicScore === 85, 'SMART-HARM-03', `8A -> 8B embeds harmonicScore: 85 in DJTransitionConfig (got ${trRelative.harmonicScore})`);

// Diagonal in smart transition: 8A -> 9B
const trDiagonal = dj.calculateSmartTransition({ id: 't1', tempo: 128, camelot: '8A' }, { id: 't2', tempo: 128, camelot: '9B' });
assert(trDiagonal.harmonicScore === 75, 'SMART-HARM-04', `8A -> 9B embeds harmonicScore: 75 in DJTransitionConfig (got ${trDiagonal.harmonicScore})`);

// Extreme tempos in smart transition: 20 BPM vs 300 BPM
const trExtreme = dj.calculateSmartTransition({ id: 't1', tempo: 20, camelot: '8A' }, { id: 't2', tempo: 300, camelot: '8A' });
assert(trExtreme.bpmDelta === 0, 'SMART-EXT-01', `20 BPM vs 300 BPM both sanitize to 128 BPM, giving bpmDelta 0`);
assert(Number.isFinite(trExtreme.compases), 'SMART-EXT-02', `Extreme tempos produce valid finite compases: ${trExtreme.compases}`);

// Missing metadata in smart transition
const trMissing = dj.calculateSmartTransition({}, {});
assert(trMissing.harmonicScore >= 10 && trMissing.harmonicScore <= 100, 'SMART-MISS-01', `Missing metadata falls back gracefully with valid score (${trMissing.harmonicScore})`);
assert(trMissing.preset !== undefined, 'SMART-MISS-02', `Missing metadata produces valid preset: ${trMissing.preset}`);

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log(`HARNESS RESULT: Total Tests: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
console.log('='.repeat(80));

if (failedTests > 0) {
  console.log('\nFAILURES:');
  for (const f of failures) {
    console.log(`- [${f.testId}] ${f.message}`);
  }
}

process.exit(failedTests > 0 ? 1 : 0);
