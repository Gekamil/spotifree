/**
 * Spotifree Milestone 1 Adversarial Test Harness
 * Verification of Buffering Silence Elimination, Outro Preset Preservation, and Automation Cancellation.
 * Native Node 24 Test Runner (node:test & node:assert/strict)
 */

import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Register loader for ESM TypeScript imports with extension resolution
register(new URL('./adversarial_loader.js', import.meta.url));

// ============================================================================
// Web Audio API & Browser DOM High-Fidelity Simulation
// ============================================================================

class MockAudioParam {
  constructor(name, defaultValue = 0, minValue = -Infinity, maxValue = Infinity) {
    this.name = name;
    this.value = defaultValue;
    this.defaultValue = defaultValue;
    this.minValue = minValue;
    this.maxValue = maxValue;
    this.events = [];
  }

  setValueAtTime(value, startTime) {
    this.value = value;
    this.events.push({ type: 'setValueAtTime', value, startTime });
    return this;
  }

  linearRampToValueAtTime(value, endTime) {
    this.value = value;
    this.events.push({ type: 'linearRampToValueAtTime', value, endTime });
    return this;
  }

  exponentialRampToValueAtTime(value, endTime) {
    if (value <= 0) {
      throw new RangeError(
        `Failed to execute 'exponentialRampToValueAtTime' on 'AudioParam': The float target value must be positive, got ${value}`
      );
    }
    this.value = value;
    this.events.push({ type: 'exponentialRampToValueAtTime', value, endTime });
    return this;
  }

  setTargetAtTime(target, startTime, timeConstant) {
    this.value = target;
    this.events.push({ type: 'setTargetAtTime', target, startTime, timeConstant });
    return this;
  }

  cancelScheduledValues(startTime) {
    this.events.push({ type: 'cancelScheduledValues', startTime });
    return this;
  }
}

class MockAudioNode {
  constructor(context) {
    this.context = context;
    this.connections = [];
  }

  connect(destination) {
    this.connections.push(destination);
    return destination;
  }

  disconnect() {
    this.connections = [];
  }
}

class MockGainNode extends MockAudioNode {
  constructor(context, initialGain = 1.0) {
    super(context);
    this.gain = new MockAudioParam('gain', initialGain, 0, 10);
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.type = 'lowpass';
    this.frequency = new MockAudioParam('frequency', 350, 10, 24000);
    this.Q = new MockAudioParam('Q', 1.0, 0.0001, 1000);
    this.gain = new MockAudioParam('gain', 0.0, -40, 40);
    this.detune = new MockAudioParam('detune', 0, -153600, 153600);
  }
}

class MockDelayNode extends MockAudioNode {
  constructor(context, maxDelayTime = 5.0) {
    super(context);
    this.maxDelayTime = maxDelayTime;
    this.delayTime = new MockAudioParam('delayTime', 0.0, 0, maxDelayTime);
  }
}

class MockDynamicsCompressorNode extends MockAudioNode {
  constructor(context) {
    super(context);
    this.threshold = new MockAudioParam('threshold', -24);
    this.knee = new MockAudioParam('knee', 30);
    this.ratio = new MockAudioParam('ratio', 12);
    this.attack = new MockAudioParam('attack', 0.003);
    this.release = new MockAudioParam('release', 0.25);
  }
}

class MockMediaElementAudioSourceNode extends MockAudioNode {
  constructor(context, mediaElement) {
    super(context);
    this.mediaElement = mediaElement;
  }
}

class MockAudioContext {
  constructor() {
    this.currentTime = 0.0;
    this.sampleRate = 44100;
    this.state = 'running';
    this.destination = new MockAudioNode(this);
  }

  createGain() {
    return new MockGainNode(this);
  }

  createBiquadFilter() {
    return new MockBiquadFilterNode(this);
  }

  createDelay(maxDelay = 5.0) {
    return new MockDelayNode(this, maxDelay);
  }

  createDynamicsCompressor() {
    return new MockDynamicsCompressorNode(this);
  }

  createMediaElementSource(element) {
    return new MockMediaElementAudioSourceNode(this, element);
  }

  async resume() {
    this.state = 'running';
  }

  async suspend() {
    this.state = 'suspended';
  }

  async close() {
    this.state = 'closed';
  }
}

class MockAudioElement {
  constructor() {
    this.listeners = {};
    this.volume = 1.0;
    this.currentTime = 0.0;
    this.duration = 180.0;
    this.paused = true;
    this.readyState = 4;
    this.playbackRate = 1.0;
    this.src = '';
    this.preload = 'auto';
  }

  addEventListener(event, handler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  removeEventListener(event, handler) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((h) => h !== handler);
    }
  }

  dispatchEvent(event) {
    const type = typeof event === 'string' ? event : event.type;
    const handlers = this.listeners[type] || [];
    for (const h of handlers) h(event);
  }

  async play() {
    this.paused = false;
    this.dispatchEvent('play');
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    this.dispatchEvent('pause');
  }
}

class MockStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(k) {
    return this.store.get(k) ?? null;
  }
  setItem(k, v) {
    this.store.set(k, String(v));
  }
  removeItem(k) {
    this.store.delete(k);
  }
  clear() {
    this.store.clear();
  }
}

class MockYTPlayer {
  constructor(initialState = 1) {
    this.state = initialState; // 1: PLAYING, 2: PAUSED, 3: BUFFERING, 0: ENDED, -1: UNSTARTED
    this.volume = 100;
    this.muted = false;
    this.playbackRate = 1.0;
    this.currentTime = 0.0;
    this.duration = 210.0;
    this.videoData = { video_id: 'sample_vid_123' };
    this.events = [];
  }

  getPlayerState() {
    return this.state;
  }

  getCurrentTime() {
    return this.currentTime;
  }

  getDuration() {
    return this.duration;
  }

  getVideoData() {
    return this.videoData;
  }

  setVolume(vol) {
    this.volume = vol;
    this.events.push({ type: 'setVolume', vol });
  }

  mute() {
    this.muted = true;
    this.events.push({ type: 'mute' });
  }

  unMute() {
    this.muted = false;
    this.events.push({ type: 'unMute' });
  }

  isMuted() {
    return this.muted;
  }

  playVideo() {
    this.events.push({ type: 'playVideo' });
  }

  pauseVideo() {
    this.events.push({ type: 'pauseVideo' });
  }

  stopVideo() {
    this.events.push({ type: 'stopVideo' });
  }

  setPlaybackRate(rate) {
    this.playbackRate = rate;
    this.events.push({ type: 'setPlaybackRate', rate });
  }

  seekTo(seconds, allowSeekAhead) {
    this.currentTime = seconds;
    this.events.push({ type: 'seekTo', seconds, allowSeekAhead });
  }

  loadVideoById(opts) {
    this.events.push({ type: 'loadVideoById', opts });
  }

  cueVideoById(opts) {
    this.events.push({ type: 'cueVideoById', opts });
  }
}

// Install browser global mocks on globalThis before module import
const mockLocalStorage = new MockStorage();
mockLocalStorage.setItem('spotifree_dj_mode', 'true');
mockLocalStorage.setItem('spotifree_crossfade_enabled', 'true');
mockLocalStorage.setItem('spotifree_crossfade_sec', '5');

globalThis.window = {
  localStorage: mockLocalStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
  setInterval: globalThis.setInterval,
  clearInterval: globalThis.clearInterval,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  location: { origin: 'http://localhost:5173' },
  AudioContext: MockAudioContext,
};

globalThis.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelector: () => null,
  createElement: () => ({ src: '' }),
  head: { appendChild: () => {} },
  hidden: false,
};

globalThis.Audio = MockAudioElement;
globalThis.HTMLAudioElement = MockAudioElement;
globalThis.AudioContext = MockAudioContext;
globalThis.localStorage = mockLocalStorage;

// ============================================================================
// Load Spotifree Modules
// ============================================================================

let audioEngine;
let usePlayerStore;
let djTransitionServiceModule;
let djAudioNodesModule;

before(async () => {
  const playerStoreModule = await import('../src/store/usePlayerStore.ts');
  usePlayerStore = playerStoreModule.usePlayerStore;

  djTransitionServiceModule = await import('../src/services/djTransitionService.ts');
  djAudioNodesModule = await import('../src/services/djAudioNodes.ts');

  const engineModule = await import('../src/services/audioEngine.ts');
  audioEngine = engineModule.audioEngine;
});

// ============================================================================
// Test Suites: Empirical Challenger
// ============================================================================

describe('Adversarial M1 Playback Engine Challenges', () => {

  beforeEach(() => {
    // Reset player store state
    usePlayerStore.setState({
      isPlaying: true,
      volume: 1.0,
      isMuted: false,
      progressMs: 0,
      durationMs: 180000,
      currentTrack: {
        id: 'track_a',
        name: 'Track Alpha',
        duration_ms: 180000,
        artists: [{ id: 'art_a', name: 'DJ Alpha' }],
      },
      queue: [
        {
          id: 'track_a',
          name: 'Track Alpha',
          duration_ms: 180000,
          artists: [{ id: 'art_a', name: 'DJ Alpha' }],
        },
        {
          id: 'track_b',
          name: 'Track Beta',
          duration_ms: 200000,
          artists: [{ id: 'art_b', name: 'DJ Beta' }],
        },
      ],
      getNextTrack: () => ({
        id: 'track_b',
        name: 'Track Beta',
        duration_ms: 200000,
        artists: [{ id: 'art_b', name: 'DJ Beta' }],
      }),
    });

    // Ensure cleanly cancelled intervals
    if (audioEngine.crossfadeInterval !== null) {
      clearInterval(audioEngine.crossfadeInterval);
      audioEngine.crossfadeInterval = null;
    }
    audioEngine.isCrossfading = false;
  });

  // --------------------------------------------------------------------------
  // Suite 1: Buffering Silence Elimination in executeCrossfade
  // --------------------------------------------------------------------------
  describe('Challenge 1: Buffering Silence Elimination in executeCrossfade', () => {

    it('1.1: While Deck B is BUFFERING (state 3), Deck A volume remains 100% and crossfade does not advance', async () => {
      // Configure mock YouTube players
      const playerA = new MockYTPlayer(1); // Deck A PLAYING
      const playerB = new MockYTPlayer(3); // Deck B BUFFERING (state 3)
      playerB.currentTime = 0;

      audioEngine.ytPlayers = [playerA, playerB];
      audioEngine.activeYtIndex = 0;
      audioEngine.activeEngine = 'youtube';

      // Preloaded info for track B
      audioEngine.preloadedNext = {
        track: usePlayerStore.getState().getNextTrack(),
        videoId: 'vid_beta_999',
        query: 'Track Beta DJ Beta',
      };

      const djConfig = {
        preset: 'filtro',
        compases: 4,
        volumeEnvelope: 'superposicion',
        eqMode: 'filtro_paso_alto',
        fxMode: 'ninguno',
        tempoA: 128,
        tempoB: 128,
      };

      // Trigger executeCrossfade with 5.0 seconds duration
      await audioEngine.executeCrossfade(5.0, djConfig);

      assert.strictEqual(audioEngine.isCrossfading, true, 'audioEngine must mark isCrossfading = true');
      assert.ok(audioEngine.crossfadeInterval !== null, 'crossfadeInterval timer must be active');

      // Wait 300ms while player B is still in state 3 (BUFFERING)
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Player A (Deck A) must NOT be attenuated! Volume must remain 100%
      assert.strictEqual(playerA.volume, 100, 'Deck A volume must hold at 100 during Deck B buffering');
      // Player B (Deck B) must remain silenced at 0%
      assert.strictEqual(playerB.volume, 0, 'Deck B volume must remain at 0 during buffering');

      // Cleanup
      clearInterval(audioEngine.crossfadeInterval);
      audioEngine.crossfadeInterval = null;
      audioEngine.isCrossfading = false;
    });

    it('1.2: When Deck B transitions from BUFFERING (state 3) to PLAYING (state 1), crossfade begins fader progression', async () => {
      const playerA = new MockYTPlayer(1); // Deck A PLAYING
      const playerB = new MockYTPlayer(3); // Deck B starts BUFFERING
      playerB.currentTime = 0;

      audioEngine.ytPlayers = [playerA, playerB];
      audioEngine.activeYtIndex = 0;
      audioEngine.activeEngine = 'youtube';

      audioEngine.preloadedNext = {
        track: usePlayerStore.getState().getNextTrack(),
        videoId: 'vid_beta_999',
        query: 'Track Beta DJ Beta',
      };

      const djConfig = {
        preset: 'crescendo',
        compases: 2,
        volumeEnvelope: 'lineal',
        eqMode: 'intercambio_gradual',
        fxMode: 'ninguno',
        tempoA: 128,
        tempoB: 128,
      };

      await audioEngine.executeCrossfade(2.0, djConfig);

      // Verify initial buffer hold
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.strictEqual(playerA.volume, 100, 'Deck A volume holds at 100 before state 1');
      assert.strictEqual(playerB.volume, 0, 'Deck B volume holds at 0 before state 1');

      // Now Deck B finishes buffering and reports PLAYING (state 1) and audio output
      playerB.state = 1;
      playerB.currentTime = 0.05;

      // Allow crossfade ticker to detect ready state and advance
      await new Promise((resolve) => setTimeout(resolve, 350));

      // Deck B must now have received non-zero volume
      assert.ok(playerB.volume > 0, `Deck B volume should advance above 0 once playing, got ${playerB.volume}`);

      // Cleanup
      clearInterval(audioEngine.crossfadeInterval);
      audioEngine.crossfadeInterval = null;
      audioEngine.isCrossfading = false;
    });

    it('1.3: HTML5 Mode: while secondary audio is not ready (readyState < 3), Deck A volume holds at 1.0', async () => {
      const audioA = new MockAudioElement();
      audioA.volume = 1.0;
      audioA.readyState = 4;
      audioA.paused = false;

      const audioB = new MockAudioElement();
      audioB.volume = 0.0;
      audioB.readyState = 1; // HAVE_METADATA only, not ready for playback (< 3)
      audioB.paused = false;

      audioEngine.audios = [audioA, audioB];
      audioEngine.activeAudioIndex = 0;
      audioEngine.activeEngine = 'html5';

      audioEngine.preloadedNext = {
        track: usePlayerStore.getState().getNextTrack(),
        query: 'Track Beta DJ Beta',
      };

      await audioEngine.executeCrossfade(4.0, null);

      // Wait 250ms with audioB not ready
      await new Promise((resolve) => setTimeout(resolve, 250));

      assert.strictEqual(audioA.volume, 1.0, 'HTML5 primary deck volume must remain 1.0 while secondary is not ready');
      assert.strictEqual(audioB.volume, 0.0, 'HTML5 secondary deck volume must remain 0.0');

      // Now secondary becomes ready (readyState 4)
      audioB.readyState = 4;
      await new Promise((resolve) => setTimeout(resolve, 300));

      assert.ok(audioB.volume > 0, `HTML5 secondary deck volume must rise after readyState >= 3, got ${audioB.volume}`);

      // Cleanup
      clearInterval(audioEngine.crossfadeInterval);
      audioEngine.crossfadeInterval = null;
      audioEngine.isCrossfading = false;
    });

    it('1.4: 4000ms Safety Timeout Fallback triggers when secondary player stalls indefinitely in state 3', async () => {
      const playerA = new MockYTPlayer(1);
      const playerB = new MockYTPlayer(3); // Never leaves state 3
      playerB.currentTime = 0;

      audioEngine.ytPlayers = [playerA, playerB];
      audioEngine.activeYtIndex = 0;
      audioEngine.activeEngine = 'youtube';

      audioEngine.preloadedNext = {
        track: usePlayerStore.getState().getNextTrack(),
        videoId: 'vid_beta_999',
        query: 'Track Beta DJ Beta',
      };

      // Mock Date.now to fast-forward past 4000ms timeout
      const originalNow = Date.now;
      let virtualTime = 1000000;
      Date.now = () => virtualTime;

      try {
        await audioEngine.executeCrossfade(3.0, null);

        // Tick 1 at t=0: buffering, volume holds
        virtualTime += 100;
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.strictEqual(playerA.volume, 100, 'At t=100ms, playerA volume must still hold at 100');

        // Fast forward virtual time to t=4200ms (> 4000ms safety timeout)
        virtualTime += 4100;
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Advance further so crossfade ticks after timeout unblocking
        virtualTime += 500;
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Fallback must have engaged: crossfade is advancing despite state 3
        assert.ok(playerB.volume > 0, `Safety fallback must advance crossfade after 4000ms, got ${playerB.volume}`);
      } finally {
        Date.now = originalNow;
        if (audioEngine.crossfadeInterval !== null) {
          clearInterval(audioEngine.crossfadeInterval);
          audioEngine.crossfadeInterval = null;
        }
        audioEngine.isCrossfading = false;
      }
    });
  });

  // --------------------------------------------------------------------------
  // Suite 2: Outro Duration Clamping & Preset Preservation
  // --------------------------------------------------------------------------
  describe('Challenge 2: Outro Duration Clamping & Preset Preservation', () => {

    it('2.1: Track ending with remaining <= 0.4s strictly preserves djConfig.preset and volumeEnvelope', () => {
      let executedDuration = null;
      let executedConfig = null;

      // Spy on executeCrossfade
      const originalExecuteCrossfade = audioEngine.executeCrossfade;
      audioEngine.executeCrossfade = (duration, config) => {
        executedDuration = duration;
        executedConfig = config;
      };

      try {
        // Prepare tracks and DJ transition service configuration
        const curTrack = { id: 'track_outro_1', name: 'Epic Outro Song', duration_ms: 180000, artists: [{ name: 'Producer' }] };
        const nextTrack = { id: 'track_next_1', name: 'Next Intro Song', duration_ms: 210000, artists: [{ name: 'Producer' }] };

        usePlayerStore.setState({
          currentTrack: curTrack,
          getNextTrack: () => nextTrack,
          queue: [curTrack, nextTrack],
        });

        const configuredPreset = 'filtro';
        const configuredEnvelope = 'lineal';
        const mockConfig = {
          preset: configuredPreset,
          compases: 4,
          volumeEnvelope: configuredEnvelope,
          eqMode: 'filtro_paso_alto',
          fxMode: 'ninguno',
          tempoA: 120,
          tempoB: 120,
        };

        // Mock djTransitionService to return our specific preset
        const originalGetConfig = djTransitionServiceModule.djTransitionService.getTransitionConfig;
        djTransitionServiceModule.djTransitionService.getTransitionConfig = () => mockConfig;

        // Current time: 179.65s, Total: 180s => remaining = 0.35s (<= 0.4s)
        audioEngine.isCrossfading = false;
        audioEngine.isSeeking = false;
        audioEngine.checkCrossfade(179.65, 180.0);

        // Assertions:
        assert.ok(executedConfig !== null, 'executeCrossfade must be called');
        assert.strictEqual(
          executedConfig.preset,
          configuredPreset,
          `Preset must remain '${configuredPreset}', must NOT be mutated to 'corte'`
        );
        assert.strictEqual(
          executedConfig.volumeEnvelope,
          configuredEnvelope,
          `Volume envelope must remain '${configuredEnvelope}', must NOT be mutated to 'corte_directo'`
        );
        assert.strictEqual(
          executedDuration,
          1.5,
          'Duration for short outro must be safely clamped to minimum 1.5s'
        );

        djTransitionServiceModule.djTransitionService.getTransitionConfig = originalGetConfig;
      } finally {
        audioEngine.executeCrossfade = originalExecuteCrossfade;
      }
    });

    it('2.2: Preset eco_out with remaining = 0.2s is preserved without mutation to corte', () => {
      let executedConfig = null;
      const originalExecuteCrossfade = audioEngine.executeCrossfade;
      audioEngine.executeCrossfade = (duration, config) => {
        executedConfig = config;
      };

      try {
        const mockConfig = {
          preset: 'eco_out',
          compases: 2,
          volumeEnvelope: 'curva_s',
          eqMode: 'intercambio_graves_central',
          fxMode: 'eco',
          tempoA: 130,
          tempoB: 130,
        };

        const originalGetConfig = djTransitionServiceModule.djTransitionService.getTransitionConfig;
        djTransitionServiceModule.djTransitionService.getTransitionConfig = () => mockConfig;

        usePlayerStore.setState({
          currentTrack: { id: 'track_outro_2', name: 'Eco Song', duration_ms: 200000, artists: [{ name: 'Producer' }] },
        });

        audioEngine.isCrossfading = false;
        audioEngine.isSeeking = false;
        // Remaining = 0.2s <= 0.4s
        audioEngine.checkCrossfade(199.8, 200.0);

        assert.ok(executedConfig !== null, 'executeCrossfade must be triggered');
        assert.strictEqual(executedConfig.preset, 'eco_out', 'eco_out preset must be preserved');
        assert.strictEqual(executedConfig.volumeEnvelope, 'curva_s', 'curva_s envelope must be preserved');

        djTransitionServiceModule.djTransitionService.getTransitionConfig = originalGetConfig;
      } finally {
        audioEngine.executeCrossfade = originalExecuteCrossfade;
      }
    });

    it('2.3: Preset beat_roll with remaining = 0.1s is preserved without mutation to corte', () => {
      let executedConfig = null;
      let executedDur = null;
      const originalExecuteCrossfade = audioEngine.executeCrossfade;
      audioEngine.executeCrossfade = (duration, config) => {
        executedDur = duration;
        executedConfig = config;
      };

      try {
        const mockConfig = {
          preset: 'beat_roll',
          compases: 4,
          volumeEnvelope: 'superposicion',
          eqMode: 'intercambio_graves_central',
          fxMode: 'repeticion_loop',
          tempoA: 128,
          tempoB: 128,
        };

        const originalGetConfig = djTransitionServiceModule.djTransitionService.getTransitionConfig;
        djTransitionServiceModule.djTransitionService.getTransitionConfig = () => mockConfig;

        audioEngine.isCrossfading = false;
        audioEngine.isSeeking = false;
        // Remaining = 0.1s <= 0.4s
        audioEngine.checkCrossfade(149.9, 150.0);

        assert.ok(executedConfig !== null, 'executeCrossfade must be triggered');
        assert.strictEqual(executedConfig.preset, 'beat_roll', 'beat_roll preset must be preserved');
        assert.strictEqual(executedDur, 1.5, 'Duration clamped to 1.5s');

        djTransitionServiceModule.djTransitionService.getTransitionConfig = originalGetConfig;
      } finally {
        audioEngine.executeCrossfade = originalExecuteCrossfade;
      }
    });

    it('2.4: Preset automatica with central bass swap is preserved during short outros', () => {
      let executedConfig = null;
      const originalExecuteCrossfade = audioEngine.executeCrossfade;
      audioEngine.executeCrossfade = (duration, config) => {
        executedConfig = config;
      };

      try {
        const mockConfig = {
          preset: 'automatica',
          compases: 4,
          volumeEnvelope: 'superposicion',
          eqMode: 'intercambio_graves_central',
          fxMode: 'ninguno',
          tempoA: 128,
          tempoB: 128,
        };

        const originalGetConfig = djTransitionServiceModule.djTransitionService.getTransitionConfig;
        djTransitionServiceModule.djTransitionService.getTransitionConfig = () => mockConfig;

        audioEngine.isCrossfading = false;
        audioEngine.isSeeking = false;
        audioEngine.checkCrossfade(179.7, 180.0);

        assert.ok(executedConfig !== null, 'executeCrossfade must be triggered');
        assert.strictEqual(executedConfig.preset, 'automatica');
        assert.strictEqual(executedConfig.volumeEnvelope, 'superposicion');

        djTransitionServiceModule.djTransitionService.getTransitionConfig = originalGetConfig;
      } finally {
        audioEngine.executeCrossfade = originalExecuteCrossfade;
      }
    });
  });

  // --------------------------------------------------------------------------
  // Suite 3: Rapid Skip, Seek, and Automation Cancellation
  // --------------------------------------------------------------------------
  describe('Challenge 3: Rapid Skip, Seek, and Automation Cancellation', () => {

    it('3.1: Mid-crossfade seek cancels all Web Audio automations on both decks and clears interval', async () => {
      const playerA = new MockYTPlayer(1);
      const playerB = new MockYTPlayer(1);
      audioEngine.ytPlayers = [playerA, playerB];
      audioEngine.activeYtIndex = 0;
      audioEngine.activeEngine = 'youtube';

      // Preloaded info
      audioEngine.preloadedNext = {
        track: usePlayerStore.getState().getNextTrack(),
        videoId: 'vid_beta_999',
        query: 'Track Beta DJ Beta',
      };

      const djConfig = {
        preset: 'filtro',
        compases: 4,
        volumeEnvelope: 'superposicion',
        eqMode: 'filtro_paso_alto',
        fxMode: 'ninguno',
        tempoA: 128,
        tempoB: 128,
      };

      await audioEngine.executeCrossfade(5.0, djConfig);
      assert.strictEqual(audioEngine.isCrossfading, true, 'Crossfade must be active');
      assert.ok(audioEngine.crossfadeInterval !== null, 'crossfadeInterval must exist');

      const strip0 = audioEngine.deckStrip0;
      const strip1 = audioEngine.deckStrip1;
      assert.ok(strip0 && strip1, 'Deck strips must be initialized');

      // User performs a seek operation mid-crossfade
      audioEngine.seek(45.0);

      // Verify cancellation
      assert.strictEqual(audioEngine.isCrossfading, false, 'isCrossfading must reset to false after seek');
      assert.strictEqual(audioEngine.crossfadeInterval, null, 'crossfadeInterval must be cleared to null');

      // Verify cancelScheduledValues event on deck strips
      const cancelEvents0 = strip0.filterSweep.frequency.events.filter((e) => e.type === 'cancelScheduledValues');
      const cancelEvents1 = strip1.filterSweep.frequency.events.filter((e) => e.type === 'cancelScheduledValues');
      assert.ok(cancelEvents0.length > 0, 'Strip 0 filterSweep must have received cancelScheduledValues');
      assert.ok(cancelEvents1.length > 0, 'Strip 1 filterSweep must have received cancelScheduledValues');

      // Verify secondary player was stopped
      const stopEvent = playerB.events.find((e) => e.type === 'stopVideo');
      assert.ok(stopEvent, 'Secondary player must have received stopVideo on seek');
    });

    it('3.2: Mid-crossfade track skip (playTrack) cancels all scheduled automations and clears interval', async () => {
      const playerA = new MockYTPlayer(1);
      const playerB = new MockYTPlayer(1);
      audioEngine.ytPlayers = [playerA, playerB];
      audioEngine.activeYtIndex = 0;
      audioEngine.activeEngine = 'youtube';

      audioEngine.preloadedNext = {
        track: usePlayerStore.getState().getNextTrack(),
        videoId: 'vid_beta_999',
        query: 'Track Beta DJ Beta',
      };

      await audioEngine.executeCrossfade(4.0, null);
      assert.strictEqual(audioEngine.isCrossfading, true);

      const strip0 = audioEngine.deckStrip0;
      const strip1 = audioEngine.deckStrip1;

      // User skips track
      await audioEngine.playTrack('new_track_777', 'Fresh Song New Artist', 0);

      assert.strictEqual(audioEngine.isCrossfading, false, 'isCrossfading must be false');
      assert.strictEqual(audioEngine.crossfadeInterval, null, 'crossfadeInterval must be null');

      const cancelEq0 = strip0.eqLow.gain.events.filter((e) => e.type === 'cancelScheduledValues');
      const cancelEq1 = strip1.eqLow.gain.events.filter((e) => e.type === 'cancelScheduledValues');
      assert.ok(cancelEq0.length > 0, 'Strip 0 eqLow must have cancelScheduledValues');
      assert.ok(cancelEq1.length > 0, 'Strip 1 eqLow must have cancelScheduledValues');
    });

    it('3.3: Mid-crossfade pause() cancels automations and stops carrier', async () => {
      const playerA = new MockYTPlayer(1);
      const playerB = new MockYTPlayer(1);
      audioEngine.ytPlayers = [playerA, playerB];
      audioEngine.activeYtIndex = 0;

      audioEngine.initAudioContext();
      const strip0 = audioEngine.deckStrip0;
      const strip1 = audioEngine.deckStrip1;

      // Schedule dummy automation
      strip0.eqLow.gain.setTargetAtTime(-40, 1.0, 0.02);
      strip1.eqLow.gain.setTargetAtTime(0, 1.0, 0.02);

      audioEngine.pause();

      const cancel0 = strip0.eqLow.gain.events.filter((e) => e.type === 'cancelScheduledValues');
      const cancel1 = strip1.eqLow.gain.events.filter((e) => e.type === 'cancelScheduledValues');
      assert.ok(cancel0.length > 0, 'Strip 0 eqLow must be cancelled on pause');
      assert.ok(cancel1.length > 0, 'Strip 1 eqLow must be cancelled on pause');
    });

    it('3.4: Stress Test: 50 rapid consecutive skips and seeks while crossfades trigger leave 0 orphaned intervals', async () => {
      const playerA = new MockYTPlayer(1);
      const playerB = new MockYTPlayer(1);
      audioEngine.ytPlayers = [playerA, playerB];
      audioEngine.activeYtIndex = 0;
      audioEngine.activeEngine = 'youtube';

      // Perform 50 rapid interleaved operations
      for (let i = 0; i < 50; i++) {
        audioEngine.preloadedNext = {
          track: { id: `track_${i}`, name: `Song ${i}`, duration_ms: 180000, artists: [{ name: 'Artist' }] },
          videoId: `vid_${i}`,
          query: `Song ${i} Artist`,
        };

        // Fire crossfade without awaiting
        audioEngine.executeCrossfade(2.0, {
          preset: i % 2 === 0 ? 'filtro' : 'eco_out',
          compases: 2,
          volumeEnvelope: 'superposicion',
          eqMode: 'intercambio_graves_central',
          fxMode: 'ninguno',
          tempoA: 128,
          tempoB: 128,
        });

        // Immediately seek or skip
        if (i % 2 === 0) {
          audioEngine.seek(10.0 + i);
        } else {
          audioEngine.playTrack(`skip_track_${i}`, `Skip Song ${i}`, 0);
        }
      }

      // Final state verification
      assert.strictEqual(audioEngine.isCrossfading, false, 'Engine must not be crossfading after stress skips');
      assert.strictEqual(audioEngine.crossfadeInterval, null, 'Zero orphaned crossfade intervals must remain');
    });

    it('3.5: Channel strip cancelScheduledAutomations idempotency across all 10 nodes', () => {
      const ctx = new MockAudioContext();
      const strip = djAudioNodesModule.createDJChannelStrip(ctx);

      // Verify all 10 nodes exist
      assert.ok(strip.inputNode, 'inputNode');
      assert.ok(strip.eqLow, 'eqLow');
      assert.ok(strip.eqMid, 'eqMid');
      assert.ok(strip.eqHigh, 'eqHigh');
      assert.ok(strip.filterSweep, 'filterSweep');
      assert.ok(strip.delayNode, 'delayNode');
      assert.ok(strip.delayFeedback, 'delayFeedback');
      assert.ok(strip.delayDampFilter, 'delayDampFilter');
      assert.ok(strip.stutterGain, 'stutterGain');
      assert.ok(strip.outputNode, 'outputNode');

      // Call cancelScheduledAutomations 5 times in a row
      for (let i = 0; i < 5; i++) {
        djAudioNodesModule.cancelScheduledAutomations(strip, i * 0.5);
      }

      // Verify each node received 5 cancelScheduledValues calls
      const nodes = [
        strip.inputNode.gain,
        strip.eqLow.gain,
        strip.eqMid.gain,
        strip.eqHigh.gain,
        strip.filterSweep.frequency,
        strip.filterSweep.Q,
        strip.delayNode.delayTime,
        strip.delayFeedback.gain,
        strip.stutterGain.gain,
        strip.outputNode.gain,
      ];

      for (const param of nodes) {
        const cancels = param.events.filter((e) => e.type === 'cancelScheduledValues');
        assert.strictEqual(cancels.length, 5, `${param.name} must have exactly 5 cancelScheduledValues events`);
      }
    });

  });

  // --------------------------------------------------------------------------
  // Suite 4: Volume & Concurrency Resilience Under Adversarial Pressure
  // --------------------------------------------------------------------------
  describe('Challenge 4: Volume & Concurrency Resilience Under Adversarial Pressure', () => {

    it('4.1: Custom master volume (0.65) and muted state during buffering hold exact proportional volume', async () => {
      const playerA = new MockYTPlayer(1);
      const playerB = new MockYTPlayer(3); // BUFFERING
      playerB.currentTime = 0;

      audioEngine.ytPlayers = [playerA, playerB];
      audioEngine.activeYtIndex = 0;
      audioEngine.activeEngine = 'youtube';

      // Set volume to 0.65
      usePlayerStore.setState({ volume: 0.65, isMuted: false });

      audioEngine.preloadedNext = {
        track: usePlayerStore.getState().getNextTrack(),
        videoId: 'vid_beta_999',
        query: 'Track Beta DJ Beta',
      };

      await audioEngine.executeCrossfade(4.0, null);

      await new Promise((resolve) => setTimeout(resolve, 150));

      // Player A must hold at Math.round(0.65 * 100) = 65
      assert.strictEqual(playerA.volume, 65, `Deck A volume should hold at 65, got ${playerA.volume}`);
      assert.strictEqual(playerB.volume, 0, 'Deck B volume must hold at 0');

      clearInterval(audioEngine.crossfadeInterval);
      audioEngine.crossfadeInterval = null;
      audioEngine.isCrossfading = false;

      // Now test Muted initial condition: start crossfade while muted
      usePlayerStore.setState({ isMuted: true });
      await audioEngine.executeCrossfade(4.0, null);
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.strictEqual(playerA.volume, 0, 'Deck A volume must hold at 0 when crossfade initiated while muted');

      clearInterval(audioEngine.crossfadeInterval);
      audioEngine.crossfadeInterval = null;
      audioEngine.isCrossfading = false;
    });

    it('4.2: Duplicate rapid executeCrossfade replaces prior interval without timer leaks', async () => {
      const playerA = new MockYTPlayer(1);
      const playerB = new MockYTPlayer(1);
      audioEngine.ytPlayers = [playerA, playerB];
      audioEngine.activeYtIndex = 0;
      audioEngine.activeEngine = 'youtube';

      audioEngine.preloadedNext = {
        track: usePlayerStore.getState().getNextTrack(),
        videoId: 'vid_beta_999',
        query: 'Track Beta DJ Beta',
      };

      await audioEngine.executeCrossfade(4.0, null);
      const firstInterval = audioEngine.crossfadeInterval;
      assert.ok(firstInterval !== null, 'First interval created');

      // Fire another crossfade immediately
      await audioEngine.executeCrossfade(3.0, null);
      const secondInterval = audioEngine.crossfadeInterval;
      assert.ok(secondInterval !== null, 'Second interval created');
      assert.notStrictEqual(firstInterval, secondInterval, 'Second interval must replace first interval');

      clearInterval(audioEngine.crossfadeInterval);
      audioEngine.crossfadeInterval = null;
      audioEngine.isCrossfading = false;
    });

    it('4.3: checkCrossfade while already crossfading rejects duplicate invocation', () => {
      audioEngine.isCrossfading = true;
      let executed = false;
      const orig = audioEngine.executeCrossfade;
      audioEngine.executeCrossfade = () => { executed = true; };

      try {
        audioEngine.checkCrossfade(179.6, 180.0);
        assert.strictEqual(executed, false, 'checkCrossfade must not re-trigger if already crossfading');
      } finally {
        audioEngine.executeCrossfade = orig;
        audioEngine.isCrossfading = false;
      }
    });

    it('4.4: Low-End Clash Prevention: pre-crossover muting and downbeat bass swap schedule properly', async () => {
      audioEngine.initAudioContext();
      const strip0 = audioEngine.deckStrip0;
      const strip1 = audioEngine.deckStrip1;
      assert.ok(strip0 && strip1);

      const playerA = new MockYTPlayer(1);
      const playerB = new MockYTPlayer(1);
      audioEngine.ytPlayers = [playerA, playerB];
      audioEngine.activeYtIndex = 0;
      audioEngine.activeEngine = 'youtube';

      audioEngine.preloadedNext = {
        track: usePlayerStore.getState().getNextTrack(),
        videoId: 'vid_beta_999',
        query: 'Track Beta DJ Beta',
      };

      const djConfig = {
        preset: 'automatica',
        compases: 4,
        volumeEnvelope: 'superposicion',
        eqMode: 'intercambio_graves_central',
        fxMode: 'ninguno',
        tempoA: 128,
        tempoB: 128,
      };

      await audioEngine.executeCrossfade(4.0, djConfig);

      // Verify that strip1 (incoming) has eqLow pre-cut to -40dB at mixStart
      const setEventsIn = strip1.eqLow.gain.events.filter((e) => e.type === 'setValueAtTime');
      assert.ok(setEventsIn.some((e) => e.value === -40), 'Incoming deck eqLow must be pre-cut to -40dB at mix start');

      // Verify crossover downbeat snaps strip0 eqLow to -40dB and strip1 eqLow to 0dB with 20ms anti-click ramp
      const targetEventsOut = strip0.eqLow.gain.events.filter((e) => e.type === 'setTargetAtTime');
      const targetEventsIn = strip1.eqLow.gain.events.filter((e) => e.type === 'setTargetAtTime');
      assert.ok(targetEventsOut.some((e) => e.target === -40 && e.timeConstant === 0.02), 'Outgoing low-end snapped to -40dB at crossover');
      assert.ok(targetEventsIn.some((e) => e.target === 0 && e.timeConstant === 0.02), 'Incoming low-end snapped to 0dB at crossover');

      clearInterval(audioEngine.crossfadeInterval);
      audioEngine.crossfadeInterval = null;
      audioEngine.isCrossfading = false;
    });

  });

});
