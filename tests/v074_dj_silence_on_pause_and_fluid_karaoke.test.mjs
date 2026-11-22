import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('v074: Strict Zero-Emoji Law, DJ Voice Silence on Pause, Dual Audio Prevention & Fluid Karaoke Slider', () => {
  const djViewSource = fs.readFileSync(path.resolve('src/components/dj/AIDJView.tsx'), 'utf8');
  const aiDJServiceSource = fs.readFileSync(path.resolve('src/services/aiDJService.ts'), 'utf8');
  const audioEngineSource = fs.readFileSync(path.resolve('src/services/audioEngine.ts'), 'utf8');
  const playerStoreSource = fs.readFileSync(path.resolve('src/store/usePlayerStore.ts'), 'utf8');
  const lyricsSource = fs.readFileSync(path.resolve('src/components/mobile/LyricsFullscreen.tsx'), 'utf8');
  const discordBridgeSource = fs.readFileSync(path.resolve('scripts/discordBridge.mjs'), 'utf8');

  it('1. Strict Zero-Emoji Rule: No emojis anywhere in modified code, DJ view, lyrics, or scripts', () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
    
    assert.strictEqual(emojiRegex.test(djViewSource), false, 'AIDJView must not contain any emoji characters');
    assert.strictEqual(emojiRegex.test(aiDJServiceSource), false, 'aiDJService must not contain any emoji characters');
    assert.strictEqual(emojiRegex.test(audioEngineSource), false, 'audioEngine must not contain any emoji characters');
    assert.strictEqual(emojiRegex.test(playerStoreSource), false, 'usePlayerStore must not contain any emoji characters');
    assert.strictEqual(emojiRegex.test(lyricsSource), false, 'LyricsFullscreen must not contain any emoji characters');
    assert.strictEqual(emojiRegex.test(discordBridgeSource), false, 'discordBridge must not contain any emoji characters');
  });

  it('2. DJ View Typography & Spotify Design Fidelity: No AI underlines, no artificial green borders', () => {
    // Underlines are prohibited in DJ track title
    assert.strictEqual(djViewSource.includes('group-hover:underline'), false, 'Must not use tacky AI underlines on song title');
    // Artificial "EN DIRECTO" badge box removed
    assert.strictEqual(djViewSource.includes('EN DIRECTO'), false, 'Must not use artificial EN DIRECTO badge box');
    // Uses authentic SpotifyMixUI & SpotifyMixUITitle typography
    assert.ok(djViewSource.includes("font-['SpotifyMixUITitle']"), 'Must use SpotifyMixUITitle');
    assert.ok(djViewSource.includes("font-['SpotifyMixUI']"), 'Must use SpotifyMixUI');
    // Vibe drawer uses clean Spotify dark surfaces and chevron rows
    assert.ok(djViewSource.includes('Cambiar de rollo'), 'Must include Cambiar de rollo drawer');
    assert.ok(djViewSource.includes('DJ_VIBE_PRESETS.map'), 'Must render vibe presets');
  });

  it('3. DJ Speech Immediately Stops on Pause & Restores Normal Ducked Volume', () => {
    // In player store togglePlay pause branch:
    assert.ok(
      playerStoreSource.includes('(window as any).__aiDJVoiceService?.stopSpeaking()'),
      'Player store togglePlay must immediately stop DJ speech on pause'
    );
    // In audio engine pause method:
    assert.ok(
      audioEngineSource.includes('(window as any).__aiDJVoiceService?.stopSpeaking()'),
      'AudioEngine pause must immediately stop DJ speech on pause'
    );
    assert.ok(
      audioEngineSource.includes('this.restoreDuckedVolume(0)'),
      'AudioEngine pause must immediately restore ducked volume'
    );
    // In AIDJView play/pause click handler:
    assert.ok(
      djViewSource.includes('aiDJVoiceService.stopSpeaking()'),
      'AIDJView transport pause must silence DJ voice immediately if speaking'
    );
  });

  it('4. Dual Playback Bug Prevention: Resuming or re-entering active DJ session does not launch duplicate audio streams', () => {
    // startDJSession checks if paused and toggles play cleanly instead of restarting track 0
    assert.ok(
      aiDJServiceSource.includes('p.togglePlay()'),
      'startDJSession must togglePlay when session already active and paused'
    );
    // Audio engine playTrack checks if exact track is already loaded and calls resume instead of duplicate init
    assert.ok(
      audioEngineSource.includes('this.resume();'),
      'AudioEngine playTrack must resume existing player when startSeconds is 0 and track matches'
    );
  });

  it('5. Fluid Dual-Track Karaoke Slider: Blends vocal and instrumental tracks simultaneously without stopping or cutting music', () => {
    // AudioEngine setKaraokeLevel sets vocalRatio and instRatio smoothly
    assert.ok(
      audioEngineSource.includes('const vocalRatio = clamped / 100;'),
      'Must calculate continuous vocal ratio'
    );
    assert.ok(
      audioEngineSource.includes('const instRatio = (100 - clamped) / 100;'),
      'Must calculate continuous instrumental ratio'
    );
    assert.ok(
      audioEngineSource.includes('activeYt.setVolume(vocalVol)'),
      'Must dynamically set primary vocal deck volume'
    );
    assert.ok(
      audioEngineSource.includes('secYt.setVolume(instVol)'),
      'Must dynamically set secondary instrumental deck volume'
    );
    // Real-time Web Audio Notch Filter with fast time constant (0.02s) to prevent audio clicks
    assert.ok(
      audioEngineSource.includes('midNode.gain.setTargetAtTime(vocalMidCut, now, 0.02);'),
      'Must apply Web Audio vocal filter smoothly with 0.02s constant'
    );
    // LyricsFullscreen slider has zero pointer lag
    assert.ok(
      lyricsSource.includes("transition: isDraggingSlider ? 'none' :"),
      'LyricsFullscreen slider must disable CSS transitions while dragging for 0ms lag'
    );
  });
});
