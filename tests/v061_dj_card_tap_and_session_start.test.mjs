import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('Spotifree v0.6.1: DJ Card Tap Responsiveness & Bulletproof Session Start', () => {
  const mobileLayoutPath = path.resolve('src/components/mobile/MobileLayout.tsx');
  const aidjViewPath = path.resolve('src/components/dj/AIDJView.tsx');
  const aidjServicePath = path.resolve('src/services/aiDJService.ts');
  const aidjVoiceServicePath = path.resolve('src/services/aiDJVoiceService.ts');

  const mobileLayoutSource = fs.readFileSync(mobileLayoutPath, 'utf8');
  const aidjViewSource = fs.readFileSync(aidjViewPath, 'utf8');
  const aidjServiceSource = fs.readFileSync(aidjServicePath, 'utf8');
  const aidjVoiceServiceSource = fs.readFileSync(aidjVoiceServicePath, 'utf8');

  it('1. DJ Card Tap Responsiveness: touch-action manipulation, touch gestures, and scroll reset', () => {
    // Check touchAction: manipulation
    assert.ok(
      mobileLayoutSource.includes("touchAction: 'manipulation'"),
      'Mobile DJ card must use touchAction manipulation to eliminate 300ms delay and avoid drag cancellation'
    );

    // Check touch handlers
    assert.ok(
      mobileLayoutSource.includes('onTouchStart') && mobileLayoutSource.includes('onTouchEnd'),
      'Mobile DJ card must implement dedicated onTouchStart and onTouchEnd handlers'
    );

    // Check audio unlock on touch start
    assert.ok(
      mobileLayoutSource.includes('aiDJVoiceService.unlockAudioForMobile()'),
      'MobileLayout must call unlockAudioForMobile() on touch/gesture'
    );

    // Check mobileScrollRef reset on entering DJ
    assert.ok(
      mobileLayoutSource.includes('mobileScrollRef.current.scrollTop = 0'),
      'MobileLayout must reset scroll to top so AIDJView is never scrolled down or off-screen'
    );
  });

  it('2. AIDJView Lifecycle: single-run mount, no re-entrancy loop, interactive visualizer', () => {
    // useEffect on mount
    assert.ok(
      aidjViewSource.includes('useEffect(() => {') && aidjViewSource.includes('useAIDJStore.getState()'),
      'AIDJView must read store state cleanly on mount'
    );

    // Does not wipe session on pause
    assert.ok(
      !aidjViewSource.includes('if (!p.isPlaying) {\n        void startDJSession(true'),
      'AIDJView must not re-trigger startDJSession(true) whenever music is paused'
    );

    // Interactive Visualizer Orb
    assert.ok(
      aidjViewSource.includes('nextSegment') || aidjViewSource.includes('togglePlay'),
      'AIDJView visualizer orb must be interactive (tap to skip segment or toggle play)'
    );

    // Clean cancellation on unmount
    assert.ok(
      aidjViewSource.includes('cancelDJIntroIfNotStarted()'),
      'AIDJView must clean up speech and ducking on unmount'
    );
  });

  it('3. aiDJService: Concurrency guard, instant ducked playback, and speech safety timeout', () => {
    // isThinking guard
    assert.ok(
      aidjServiceSource.includes('if (currentState.isThinking)'),
      'startDJSession must guard against simultaneous concurrent executions'
    );

    // Instant ducked track playback
    assert.ok(
      aidjServiceSource.includes('audioEngine.setDuckedVolume') &&
      aidjServiceSource.includes('usePlayerStore.getState().playTrack'),
      'DJ must start playback immediately with ducked volume so user never experiences dead silence'
    );

    // djSpeak safety timeout with Promise.race
    assert.ok(
      aidjServiceSource.includes('Promise.race([speakPromise, timeoutPromise])'),
      'djSpeak must race against a safety timeout to prevent hanging'
    );

    // Guaranteed volume restoration
    assert.ok(
      aidjServiceSource.includes('audioEngine.restoreDuckedVolume(1200)'),
      'djSpeak must restore ducked volume when speech completes'
    );
  });

  it('4. aiDJVoiceService: Reused unlocked audio element & mobile autoplay bypass', () => {
    // unlockedAudio property & reuse
    assert.ok(
      aidjVoiceServiceSource.includes('unlockedAudio'),
      'AIDJVoiceService must maintain an unlockedAudio element for mobile'
    );

    // AudioContext resume & audioEngine unlock
    assert.ok(
      aidjVoiceServiceSource.includes('unlockAudio') || aidjVoiceServiceSource.includes('analyserCtx.resume'),
      'unlockAudioForMobile must resume Web Audio contexts'
    );

    // fetchSpeech timeout
    assert.ok(
      aidjVoiceServiceSource.includes('AbortSignal.timeout'),
      'fetchSpeech must use AbortSignal timeout to avoid hanging on slow network'
    );
  });
});
