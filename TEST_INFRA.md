# Test Infrastructure: Spotifree Professional DJ Transitions & Harmonic Mixing

## 1. Overview
This document specifies the test harness architecture, test tiers, and verification infrastructure for Spotifree's studio-grade DJ transitions and harmonic mixing engine (Requirements R1-R4).

- **Target System**: Web Audio API DSP channel strips, Camelot Wheel harmonic compatibility engine, BPM octave-ratio tempo matching, musical phrase quantization, and adaptive DJ transition decision matrix.
- **Test Runner**: Node.js 24 native test runner (`node:test` and `node:assert/strict`).
- **Execution Script**: `npm test` / `node tests/dj_transitions.test.js`.
- **Total Test Cases**: 83 automated test cases across 18 suites (100% pass rate).
- **Average Runtime**: ~75ms.

---

## 2. 4-Tier Test Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Tier 4: Real-World Scenarios (5 tests)               │
│   Full playlist mix, audition scrubbing, continuous crossfade, skips   │
├────────────────────────────────────────────────────────────────────────┤
│             Tier 3: Cross-Feature Combinations (Pairwise, 8 tests)      │
│   Harmonic + Tempo delta, Clash + HPF sweep, Large gap + Echo out      │
├────────────────────────────────────────────────────────────────────────┤
│           Tier 2: Boundary & Corner Cases (8 features × 5 tests = 40)   │
│   Zero/negative limits, extreme tempos, unusual keys, ramp >= 20Hz     │
├────────────────────────────────────────────────────────────────────────┤
│             Tier 1: Feature Coverage (6 features × 5 tests = 30)       │
│   Camelot mapping, BPM sync, phrase 4-32 beats, Web Audio DSP, modal   │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Tier 1: Feature Coverage (30 Tests)
Covers primary happy paths and specification contracts (≥5 tests per feature):
1. **Feature 1: Camelot Wheel Mapping (R2)** (5 tests)
   - F1.1: Minor Mode (0) mapping across traditional keys (0=C minor -> 5A, 9=A minor -> 8A, 2=D minor -> 7A).
   - F1.2: Major Mode (1) mapping across traditional keys (0=C major -> 8B, 9=A major -> 11B, 7=G major -> 9B).
   - F1.3: Visual badge colors comply with Spotify DJ chip palette (`#f94144`, `#00cba9`, etc.).
   - F1.4: Relative Major/Minor pairs share exact same Camelot number (8A/8B, 11A/11B).
   - F1.5: Client-side real features resolution from verified catalog (`realAudioFeatures.json`) & genre heuristics.
2. **Feature 2: BPM Tempo Matching & Octave Detection (R2)** (5 tests)
   - F2.1: Tight tempo sync detection ($\Delta BPM \le 4$ or $\Delta_\% \le 3\%$).
   - F2.2: Moderate tempo gap classification ($8 < \Delta BPM \le 17$).
   - F2.3: Wide tempo disparity classification ($\Delta BPM \ge 18$).
   - F2.4: Half-time octave alignment detection (140 BPM Trap vs 70 BPM Hip-Hop, $\Delta_{\text{octave}} = 0$).
   - F2.5: Double-time octave alignment detection (85 BPM vs 170 BPM Drum & Bass, $\Delta_{\text{octave}} = 0$).
3. **Feature 3: Musical Phrase & Compases Structure (R2)** (5 tests)
   - F3.1: 1 compás (4 beats) duration ($T = 4 \times 60 / BPM$, at 128 BPM = 1.875s, at 120 BPM = 2.0s).
   - F3.2: 2 compases (8 beats, mini-phrase) duration ($3.75$s at 128 BPM).
   - F3.3: 4 compases (16 beats, standard phrase) duration ($7.5$s at 128 BPM).
   - F3.4: 8 compases (32 beats, extended club section) duration ($15.0$s at 128 BPM).
   - F3.5: Duration clamping within safe bounds $[1.5\text{s}, 16\text{s}]$.
4. **Feature 4: Web Audio DSP Node Creation & Parameters (R1)** (5 tests)
   - F4.1: 3-band Isolator EQ instantiation (lowshelf 250Hz, peaking 1500Hz $Q=1.0$, highshelf 4000Hz).
   - F4.2: Bass Swap crossover schedule (outgoing low-shelf cut to $-40\text{dB}$ with 20ms anti-click time constant).
   - F4.3: Resonant HPF & LPF filter sweeps configuration ($Q \in [2.5, 3.5]$, HPF sweeps 20Hz-18kHz, LPF 20kHz-80Hz).
   - F4.4: Beat-synchronized DelayNode tempo-locked delay times ($t_{\text{delay}} = (60/BPM) \times \text{subdivision}$).
   - F4.5: Delay feedback loop topology (feedback gain $\le 0.70$ and 250Hz highpass damping filter).
5. **Feature 5: Adaptive DJ Decision Engine Outputs (R3)** (5 tests)
   - F5.1: High tempo gap ($\ge 18\text{ BPM}$) triggers tempo-disconnect preset (`eco_out` or `freno_vinilo`).
   - F5.2: Moderate BPM gap (8-17 BPM) triggers tension-building preset (`beat_roll`, `eco_out`, or `corte`).
   - F5.3: Perfect harmonic match + tight BPM ($\le 5\text{ BPM}$) selects extended 4-compases transition.
   - F5.4: Relative Major/Minor (8A vs 8B) selects 2-compases tonal EQ blend.
   - F5.5: Decision output preserves complete DJ transition configuration interface.
6. **Feature 6: DJTransitionPreviewModal Export & Contract (R4)** (5 tests)
   - F6.1: `TransitionEditorModal.tsx` source exists and exports modal interface.
   - F6.2: Modal interface declares standard props (`isOpen`, `onClose`, `trackA`, `trackB`, `onSaved`).
   - F6.3: Modal binds dynamic smart transitions via `djTransitionService.getTransitionConfig`.
   - F6.4: Modal supports complete set of transition presets (`automatica`, `corte`, `eco_out`, `freno_vinilo`, `beat_roll`).
   - F6.5: Audition state lifecycle stops audition and cleans up audio engine when modal closes.

---

### 2.2 Tier 2: Boundary & Corner Cases (40 Tests)
Covers extreme inputs, edge values, and error-handling conditions (8 boundary features × 5 tests):
1. **Feature 7: Zero/Negative Limits & Modulo Normalization** (5 tests)
   - B7.1: Key index negative values normalize via modulo 12 (key = -1 becomes 11).
   - B7.2: Key index large values > 11 normalize via modulo 12 (key = 24 becomes 0).
   - B7.3: Mode values other than 1 default safely to minor (mode = 0).
   - B7.4: Zero BPM sanitizes to default 128 BPM without division by zero (`Infinity`).
   - B7.5: Negative BPM sanitizes to default 128 BPM without negative duration.
2. **Feature 8: Extreme Tempos & Boundary Clamping** (5 tests)
   - B8.1: Ultra-fast BPM (300 BPM) clamped to safe range ($\le 240\text{ BPM}$).
   - B8.2: Ultra-slow BPM (20 BPM) clamped to safe range ($\ge 40\text{ BPM}$).
   - B8.3: 1 compás at 239 BPM (raw 1.0s) clamps to minimum 1.5s.
   - B8.4: 8 compases at 41 BPM (raw 46.8s) clamps to maximum 16s.
   - B8.5: Fractional BPM values (127.85 BPM) compute duration with floating-point precision.
3. **Feature 9: Unusual & Malformed Keys Graceful Recovery** (5 tests)
   - B9.1: Clock boundary wrap-around: distance between 12A and 1A is exactly 1 (not 11).
   - B9.2: Clock boundary wrap-around: distance between 12B and 1B is exactly 1.
   - B9.3: Maximum clock distance: 1A to 7A is exactly 6 hours apart (opposite side of circle).
   - B9.4: Empty or malformed Camelot string defaults to safe 9A without throwing.
   - B9.5: Unrecognized key format (e.g. "XYZ") parses safely with fallback.
4. **Feature 10: Half/Double Time Ratio Matching & Tolerances** (5 tests)
   - B10.1: Exact half-time match (140 BPM vs 70 BPM) has effective delta 0 BPM.
   - B10.2: Exact double-time match (80 BPM vs 160 BPM) has effective delta 0 BPM.
   - B10.3: Near half-time within 3 BPM tolerance (142 BPM vs 70 BPM, $\Delta_{\text{eff}} = 2\text{ BPM} \le 3$).
   - B10.4: Beyond half-time tolerance (155 BPM vs 70 BPM, $\Delta_{\text{eff}} = 15\text{ BPM} > 3$).
   - B10.5: Incompatible tempo ratios (100 BPM vs 130 BPM) retain standard delta 30 BPM.
5. **Feature 11: Non-Zero Exponential Ramp Frequencies >= 20Hz** (5 tests)
   - B11.1: Web Audio spec constraint: exponential ramp with value $\le 0$ throws `RangeError`.
   - B11.2: Filter sweep enforces floor of $\ge 20\text{Hz}$ to avoid Web Audio RangeError.
   - B11.3: LPF sweep target frequency is clamped to $\ge 20\text{Hz}$ (80Hz default).
   - B11.4: HPF sweep starts at safe 20Hz and ramps up without zero-crossing error.
   - B11.5: Filter cutoff clamped within audio range ($\le 20{,}000\text{Hz}$).
6. **Feature 12: Delay Feedback Loop Gain Stability < 1.0** (5 tests)
   - B12.1: Feedback gain must be strictly $< 0.80$ to prevent explosive oscillation runaway.
   - B12.2: Feedback gain value $\ge 1.0$ is hard-limited to safe maximum (0.80).
   - B12.3: Delay damping filter operates as highpass at 250Hz to prevent low-end mud accumulation.
   - B12.4: Delay time parameter with 0 BPM sanitizes to safe default (0.46875s for 128 BPM).
   - B12.5: Delay tail fade-out exponential ramp terminates at non-zero floor (0.001).
7. **Feature 13: Empty / Unknown Genres & Missing Acoustic Metadata** (5 tests)
   - B13.1: Missing track A metadata defaults safely without throwing TypeError.
   - B13.2: Missing track B metadata defaults safely without throwing TypeError.
   - B13.3: Empty string genre or unknown genre falls back to neutral default transition config.
   - B13.4: Unregistered track ID not in `realAudioFeatures.json` falls back gracefully.
   - B13.5: Unknown artist and title falls back to standard 130 BPM / 9A without crashing.
8. **Feature 14: Instant Cuts & Extreme Short Outro Timing** (5 tests)
   - B14.1: Corte directo volume envelope switches instantly on crossover downbeat.
   - B14.2: Compases for direct cut preset is exactly 1 compás (4 beats) for immediate impact.
   - B14.3: Outro with remaining time $< 4$ seconds dynamically clamps transition duration to fit.
   - B14.4: Zero remaining time in track cleanly completes transition without negative intervals.
   - B14.5: Rapid skip during active transition invokes `cancelScheduledValues` on AudioParams.

---

### 2.3 Tier 3: Cross-Feature Combinations (8 Tests)
Covers pairwise interactions between musical variables and DSP processing:
- **P1**: Harmonic Compatibility (score 100) + Tight Tempo ($\Delta \le 4$) -> 4 compases blend with Bass Swap.
- **P2**: Harmonic Clash (Camelot distance $\ge 3$) + Similar Tempo ($\Delta \le 5$) -> Resonant Filter Sweep.
- **P3**: Large Tempo Gap ($\Delta \ge 18\text{ BPM}$) + Rising Energy -> Echo Out with tempo-synced delay tail.
- **P4**: Large Tempo Gap ($\Delta \ge 18\text{ BPM}$) + Falling Energy -> Vinyl Brake platter deceleration.
- **P5**: Moderate Tempo Gap (8-17 BPM) + High Energy -> Loop Stutter Roll accelerating $1/4 \rightarrow 1/8$.
- **P6**: Half-Time Octave Lock (70 vs 140 BPM) + Adjacent Key -> Energetic Bass Swap without disconnect.
- **P7**: Relative Major/Minor (8A vs 8B) + Dual-Deck Filter Balancing -> 2-bar tonal crossfade.
- **P8**: Equal-Power Envelope + 3-Band Isolator Bass Swap coordinates volume curves and low-cut.

---

### 2.4 Tier 4: Real-World Application Scenarios (5 Tests)
End-to-end simulations of actual user and system workflows:
- **S1**: Full 5-Track Multi-Genre Playlist Continuous DJ Mix Simulation (Pop -> Bachata -> Reggaeton -> Trap -> Dubstep).
- **S2**: Audition Timeline Simulation in `DJTransitionPreviewModal` (start, scrub 0.0 -> 0.5 -> 1.0, stop).
- **S3**: Continuous Playback Transition in `AudioEngine` with dual-deck DSP automations.
- **S4**: Rapid Consecutive Skips During Active Transition cancel automations and clear timers.
- **S5**: Offline / Missing Features Catalog Graceful Degradation without sound artefacts.

---

## 3. Web Audio API Mock Engine Specifications

To execute pure Web Audio DSP graph tests in Node 24 without headless browser overhead, a high-fidelity mock implementation is built into `tests/dj_transitions.test.js`:
- `MockAudioContext`: Simulates audio clock, destination, and node factory methods (`createGain`, `createBiquadFilter`, `createDelay`).
- `MockAudioParam`: Records scheduled automation timelines and enforces Web Audio API constraints:
  - `setValueAtTime(v, t)`
  - `linearRampToValueAtTime(v, t)`
  - `exponentialRampToValueAtTime(v, t)`: **Strictly throws RangeError if target value $\le 0$**, verifying that sweep schedulers clamp to positive floors ($\ge 20\text{Hz}$).
  - `setTargetAtTime(target, t, timeConstant)`
  - `cancelScheduledValues(t)`
- `MockBiquadFilterNode`: Tracks filter type (`lowshelf`, `peaking`, `highshelf`, `lowpass`, `highpass`), cutoff frequency, $Q$, and gain params.
- `MockDelayNode`: Validates maximum delay time and tempo-synchronized delay times.

---

## 4. Test Execution Guide

```bash
# Execute via NPM script
npm test

# Execute directly via Node 24
node tests/dj_transitions.test.js
```
