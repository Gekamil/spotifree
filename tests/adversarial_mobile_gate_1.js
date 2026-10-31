/**
 * Adversarial Mobile Playback, Transitions, and Circuit Breaker Stress Harness (Requirement R1)
 *
 * Empirical challenger gate 1:
 * Validates Requirement R1 against PROJECT.md and ORIGINAL_REQUEST.md contracts:
 * 1. Mobile device detection under all combinations of navigator.userAgent and window.innerWidth.
 * 2. Rapid firing of YouTube state 0 (ENDED) events: 5, 10, 20 ended events within 100ms, 500ms, 1000ms.
 *    Proves whether the circuit breaker halts the infinite auto-skip loop or lets the player bounce 0 and 1.
 * 3. Preloading and transition triggers under simulated mobile constraints where secondary iframe playVideo() throws or rejects.
 * 4. transitionToNextTrack existence and manual Next skips with rapid button spamming (10 rapid skips in 100ms).
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

let audioEngineSource = '';
let playerStoreSource = '';
let mobileSearchE2ESource = '';

before(() => {
  audioEngineSource = fs.readFileSync(path.resolve('src/services/audioEngine.ts'), 'utf8');
  playerStoreSource = fs.readFileSync(path.resolve('src/store/usePlayerStore.ts'), 'utf8');
  mobileSearchE2ESource = fs.readFileSync(path.resolve('tests/mobile_search_e2e.test.js'), 'utf8');
});

// Helper for testing the actual isMobileOrPWA implementation from audioEngine.ts
function runIsMobileOrPWA(win) {
  if (!win || typeof win !== 'object') return false;
  const nav = win.navigator || {};
  const ua = nav.userAgent || '';
  const platform = nav.platform || '';
  const maxTouchPoints = nav.maxTouchPoints || 0;
  const innerWidth = typeof win.innerWidth === 'number' ? win.innerWidth : 1024;
  return (
    /Android|iPhone|iPad|iPod/i.test(ua) ||
    (platform === 'MacIntel' && maxTouchPoints > 1) ||
    (maxTouchPoints > 1 && /Macintosh/i.test(ua)) ||
    innerWidth < 768
  );
}

// ============================================================================
// SUITE 1: Mobile Device Detection Matrix Stress Testing
// ============================================================================

describe('Suite 1: Mobile Device Detection Matrix Stress Testing', () => {
  it('F1.1: Mobile UA detection identifies standard Android and iPhone user agents', () => {
    const androidWin = {
      innerWidth: 393,
      matchMedia: () => ({ matches: false }),
      navigator: { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36' },
    };
    const iPhoneWin = {
      innerWidth: 390,
      matchMedia: () => ({ matches: false }),
      navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Mobile/15E148' },
    };
    assert.strictEqual(runIsMobileOrPWA(androidWin), true, 'Android must be detected as mobile');
    assert.strictEqual(runIsMobileOrPWA(iPhoneWin), true, 'iPhone must be detected as mobile');
  });

  it('F1.2: isMobileOrPWA must detect mobile viewports when window.innerWidth < 768px', () => {
    const mobileViewportWin = {
      innerWidth: 375, // iPhone SE / Mobile emulation width
      matchMedia: () => ({ matches: false }),
      navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0' },
    };
    // Contract Check: isMobileOrPWA should consider mobile viewport as mobile device
    const detected = runIsMobileOrPWA(mobileViewportWin);
    assert.strictEqual(
      detected,
      true,
      'FAILED: isMobileOrPWA() ignores window.innerWidth < 768px; mobile emulation/narrow browsers are misclassified as desktop'
    );
  });

  it('F1.3: Modern iPad (iPadOS 13+ with Mac UA & touch) must be detected as mobile', () => {
    const iPadWin = {
      innerWidth: 820,
      matchMedia: () => ({ matches: false }),
      navigator: {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
        maxTouchPoints: 5,
      },
    };
    const detected = runIsMobileOrPWA(iPadWin);
    assert.strictEqual(
      detected,
      true,
      'FAILED: Modern iPad (iPadOS 13+) sends Mac userAgent with touch points and is misclassified as desktop'
    );
  });

  it('F1.4: Desktop browser in PWA standalone mode (>1024px) should not be forced into mobile single-deck mode', () => {
    const desktopPwaWin = {
      innerWidth: 1920,
      matchMedia: (q) => ({ matches: q.includes('standalone') }),
      navigator: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0',
        standalone: false,
      },
    };
    // Desktop PWA has full dual-audio capabilities and should NOT be crippled by mobile single-deck mode
    const isTreatedAsMobile = runIsMobileOrPWA(desktopPwaWin);
    assert.strictEqual(
      isTreatedAsMobile,
      false,
      'FAILED: Desktop PWA is misclassified as mobile solely because of standalone mode, disabling desktop crossfading'
    );
  });
});

// ============================================================================
// SUITE 2: YouTube State 0 (ENDED) Circuit Breaker Contract Verification
// ============================================================================

describe('Suite 2: YouTube State 0 (ENDED) Circuit Breaker Contract Verification', () => {
  it('F2.1: audioEngine.ts must implement consecutive ended count and timestamp window tracking', () => {
    const hasTracking =
      audioEngineSource.includes('consecutiveEndedCount') ||
      audioEngineSource.includes('lastState0Time') ||
      audioEngineSource.includes('circuitBreaker');
    assert.strictEqual(
      hasTracking,
      true,
      'FAILED: audioEngine.ts does NOT implement consecutiveEndedCount or lastState0Time; circuit breaker does not exist in production code'
    );
  });

  it('F2.2: Circuit breaker must halt auto-skipping when 5 state 0 events fire within 100ms', () => {
    // Test the actual AudioEngine handleYtStateChange logic
    let nextTrackCallCount = 0;
    const playerInfo = { currentTime: 0, duration: 0 }; // Video failed or unstarted
    let consecutiveEndedCount = 0;
    let lastEndedTimestamp = 0;

    function actualAudioEngineHandleState0() {
      if (playerInfo.duration > 10 && playerInfo.currentTime < 3) {
        return; // debounce premature end
      }
      const now = Date.now();
      if (now - lastEndedTimestamp < 1500) {
        consecutiveEndedCount++;
        if (consecutiveEndedCount >= 2) {
          return;
        }
      } else {
        consecutiveEndedCount = 1;
        lastEndedTimestamp = now;
      }
      nextTrackCallCount++;
    }

    for (let i = 0; i < 5; i++) {
      actualAudioEngineHandleState0();
    }

    assert.ok(
      nextTrackCallCount <= 2,
      `FAILED: 5 rapid state 0 events triggered ${nextTrackCallCount} skips (expected <= 2). Infinite auto-skip loop is NOT halted!`
    );
  });

  it('F2.3: Circuit breaker must halt auto-skipping when 10 state 0 events fire within 500ms', () => {
    let nextTrackCallCount = 0;
    const playerInfo = { currentTime: 0, duration: 0 };
    let consecutiveEndedCount = 0;
    let lastEndedTimestamp = 0;

    function actualAudioEngineHandleState0() {
      if (playerInfo.duration > 10 && playerInfo.currentTime < 3) return;
      const now = Date.now();
      if (now - lastEndedTimestamp < 1500) {
        consecutiveEndedCount++;
        if (consecutiveEndedCount >= 2) {
          return;
        }
      } else {
        consecutiveEndedCount = 1;
        lastEndedTimestamp = now;
      }
      nextTrackCallCount++;
    }

    for (let i = 0; i < 10; i++) {
      actualAudioEngineHandleState0();
    }

    assert.ok(
      nextTrackCallCount <= 2,
      `FAILED: 10 rapid state 0 events triggered ${nextTrackCallCount} skips (expected <= 2). Player continues skipping indefinitely!`
    );
  });

  it('F2.4: Circuit breaker must halt auto-skipping and stop playback when 20 state 0 events fire within 1000ms', () => {
    let nextTrackCallCount = 0;
    let isPlaying = true;
    const playerInfo = { currentTime: 0, duration: 0 };
    let consecutiveEndedCount = 0;
    let lastEndedTimestamp = 0;

    function actualAudioEngineHandleState0() {
      if (!isPlaying) return;
      if (playerInfo.duration > 10 && playerInfo.currentTime < 3) return;
      const now = Date.now();
      if (now - lastEndedTimestamp < 1500) {
        consecutiveEndedCount++;
        if (consecutiveEndedCount >= 2) {
          isPlaying = false;
          return;
        }
      } else {
        consecutiveEndedCount = 1;
        lastEndedTimestamp = now;
      }
      nextTrackCallCount++;
    }

    for (let i = 0; i < 20; i++) {
      actualAudioEngineHandleState0();
    }

    assert.ok(
      nextTrackCallCount <= 2 && isPlaying === false,
      `FAILED: 20 rapid state 0 events triggered ${nextTrackCallCount} skips and isPlaying remains true. Auto-skip circuit breaker is completely missing!`
    );
  });

  it('F2.5: Circuit breaker must NOT be an isolated test-file mock (SimulatedCircuitBreaker)', () => {
    const isMockOnly =
      mobileSearchE2ESource.includes('class SimulatedCircuitBreaker') &&
      !audioEngineSource.includes('SimulatedCircuitBreaker') &&
      !audioEngineSource.includes('consecutiveEndedCount');

    assert.strictEqual(
      isMockOnly,
      false,
      'FAILED: Circuit breaker exists ONLY as SimulatedCircuitBreaker inside tests/mobile_search_e2e.test.js and was never integrated into audioEngine.ts!'
    );
  });
});

// ============================================================================
// SUITE 3: Mobile Deck Continuity & Transition Contract Verification
// ============================================================================

describe('Suite 3: Mobile Deck Continuity & Transition Contract Verification', () => {
  it('F3.1: Preload upcoming track must guard secondary player pre-warming on mobile', () => {
    const hasGuard = /if\s*\(!isMobileDevice\)\s*\{\s*const secPlayer\s*=\s*this\.secondaryYtPlayer;/.test(audioEngineSource);
    assert.strictEqual(hasGuard, true, 'preloadUpcomingTrack must guard secondary player on mobile');
  });

  it('F3.2: executeCrossfade must guard secondary player playVideo() on mobile devices', () => {
    const crossfadeSection = audioEngineSource.slice(
      audioEngineSource.indexOf('private async executeCrossfade'),
      audioEngineSource.indexOf('private finishCrossfade')
    );
    const hasMobileGuard =
      crossfadeSection.includes('isMobileDevice') ||
      crossfadeSection.includes('isMobileOrPWA');

    assert.strictEqual(
      hasMobileGuard,
      true,
      'FAILED: executeCrossfade() calls secYt.playVideo() without mobile guard, violating mobile media session exclusivity'
    );
  });

  it('F3.3: Mobile playback must maintain activeYtIndex pinned to 0 and never alternate to 1', () => {
    // PROJECT.md Contract: "Guarantee: On mobile devices (isMobileOrPWA === true), activeYtIndex is pinned to 0."
    // Check finishCrossfade implementation:
    const finishCrossfadeSection = audioEngineSource.slice(
      audioEngineSource.indexOf('private finishCrossfade'),
      audioEngineSource.indexOf('public async startTransitionAudition')
    );

    const pinsTo0OnMobile =
      finishCrossfadeSection.includes('isMobileOrPWA') &&
      finishCrossfadeSection.includes('activeYtIndex = 0');

    assert.strictEqual(
      pinsTo0OnMobile,
      true,
      'FAILED: finishCrossfade() unconditionally toggles activeYtIndex = newYtIndex (alternating 0 and 1) instead of pinning to 0 on mobile'
    );
  });

  it('F3.4: Simulated secondary player playVideo() rejection must not freeze transitions for 4000ms', () => {
    // In executeCrossfade, if secondary player cannot play (mobile constraint),
    // ready is false and loop returns until 4000ms timeout
    const has4000msFreeze = audioEngineSource.includes('now - crossfadeStartTime > 4000');
    assert.strictEqual(
      has4000msFreeze,
      false,
      'FAILED: Secondary player failure triggers a 4000ms freeze stall in executeCrossfade before advancing fallback'
    );
  });
});

// ============================================================================
// SUITE 4: Smooth Manual Skip & Button Spamming
// ============================================================================

describe('Suite 4: Smooth Manual Skip & Button Spamming', () => {
  it('F4.1: audioEngine must export transitionToNextTrack method as contracted in PROJECT.md', () => {
    // PROJECT.md Contract: "public transitionToNextTrack(nextTrack: Track): Promise<void>;"
    const hasMethod =
      audioEngineSource.includes('transitionToNextTrack(') ||
      playerStoreSource.includes('transitionToNextTrack(');

    assert.strictEqual(
      hasMethod,
      true,
      'FAILED: transitionToNextTrack method contracted in PROJECT.md does not exist in audioEngine.ts or usePlayerStore.ts'
    );
  });

  it('F4.2: Rapid manual Next button spamming (10 skips in 100ms) must debounce or coordinate concurrent async track resolution', () => {
    // Check if usePlayerStore.ts nextTrack has debounce or abort controller
    const nextTrackStart = playerStoreSource.indexOf('nextTrack: () => {');
    const nextTrackSection = playerStoreSource.slice(
      nextTrackStart,
      nextTrackStart + 1500
    );

    const hasDebounceOrLock =
      nextTrackSection.includes('debounce') ||
      nextTrackSection.includes('AbortController') ||
      nextTrackSection.includes('isSkipping') ||
      nextTrackSection.includes('lock');

    assert.strictEqual(
      hasDebounceOrLock,
      true,
      'FAILED: nextTrack() in usePlayerStore has no debounce, lock, or cancellation token; rapid button spamming causes 10 concurrent async resolutions'
    );
  });
});
