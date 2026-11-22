import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('v078: Karaoke Redesign - Center-Channel Cancellation, Bass Crossover & Anti-Flicker Architecture', () => {
  const audioEngineSource = fs.readFileSync(path.resolve('src/services/audioEngine.ts'), 'utf8');
  const lyricsSource = fs.readFileSync(path.resolve('src/components/mobile/LyricsFullscreen.tsx'), 'utf8');
  const musicFallbackSource = fs.readFileSync(path.resolve('api/_lib/musicFallback.js'), 'utf8');

  it('1. Strict Zero-Emoji Rule: No emojis anywhere in modified code, tests or comments', () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
    assert.strictEqual(emojiRegex.test(audioEngineSource), false, 'audioEngine must not contain emojis');
    assert.strictEqual(emojiRegex.test(lyricsSource), false, 'LyricsFullscreen must not contain emojis');
    assert.strictEqual(emojiRegex.test(musicFallbackSource), false, 'musicFallback must not contain emojis');
  });

  it('2. Web Audio Center-Channel Cancellation with Bass Crossover DSP Pipeline', () => {
    assert.ok(
      audioEngineSource.includes('this.karaokeBassFilter = this.audioContext.createBiquadFilter();'),
      'audioEngine must build a dedicated lowpass bass crossover filter'
    );
    assert.ok(
      audioEngineSource.includes('this.karaokeBassFilter.frequency.value = 200;'),
      'audioEngine must configure 200Hz crossover frequency to preserve kick and bass'
    );
    assert.ok(
      audioEngineSource.includes('this.karaokeHighFilter = this.audioContext.createBiquadFilter();'),
      'audioEngine must build a dedicated highpass filter for vocal cancellation'
    );
    assert.ok(
      audioEngineSource.includes('this.karaokeCenterSum = this.audioContext.createGain();'),
      'audioEngine must create a center-channel summing node'
    );
    assert.ok(
      audioEngineSource.includes('this.karaokeCenterGain = this.audioContext.createGain();'),
      'audioEngine must create an adjustable center vocal attenuation node'
    );
    assert.ok(
      audioEngineSource.includes('this.karaokeSideDiff = this.audioContext.createGain();'),
      'audioEngine must create a side-channel difference node for stereo preservation'
    );
  });

  it('3. Instrument Track Role Awareness: Prevents Muting Active Instrumental Deck', () => {
    assert.ok(
      audioEngineSource.includes('const isPlayingInstrumental = Boolean(instSource && this.currentVideoId === instSource);'),
      'audioEngine must detect when current active deck is already the instrumental track'
    );
    assert.ok(
      audioEngineSource.includes('activeYt.setVolume(Math.round(masterVol * 100));'),
      'audioEngine must keep instrumental track at 100 percent volume instead of muting to zero'
    );
  });

  it('4. Anti-Flicker Debounce: Slider PointerMove Never Triggers Concurrent Hot-Swaps', () => {
    assert.ok(
      audioEngineSource.includes('this.karaokeSwapDebounceTimer = setTimeout('),
      'audioEngine must debounce track swaps to 450ms, allowing smooth volume dragging'
    );
    assert.ok(
      audioEngineSource.includes('clearTimeout(this.karaokeSwapDebounceTimer);'),
      'audioEngine must clear pending swap timers on continuous slider movement'
    );
  });

  it('5. Source Verification Immunity: verifyPlayingSource Never Mutes Karaoke or Instrumental Audio', () => {
    assert.ok(
      audioEngineSource.includes('(this.karaokeState.instrumental?.sourceId && this.currentVideoId === this.karaokeState.instrumental.sourceId)'),
      'verifyPlayingSource must never judge instrumental tracks as mismatches'
    );
    assert.ok(
      audioEngineSource.includes('(this.karaokeState.vocalLevel !== undefined && this.karaokeState.vocalLevel < 100)'),
      'verifyPlayingSource must never silence audio during active karaoke attenuation'
    );
  });

  it('6. Progressive Ticker Stabilization: Secondary Player Drift Seek Throttled to 4000ms', () => {
    assert.ok(
      audioEngineSource.includes('nowSync - this.lastSecondarySyncTime > 4000'),
      'startProgressTicker must throttle secondary player seekTo to at most once per 4 seconds'
    );
  });

  it('7. Interactive Mic Button Performs Direct Discrete Swap and Level Reset', () => {
    assert.ok(
      lyricsSource.includes('void karaoke.toggle();'),
      'LyricsFullscreen must trigger discrete track swap when mic button is tapped'
    );
  });
});
