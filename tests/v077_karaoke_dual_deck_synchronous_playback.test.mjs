import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('v077: Dual-Deck Synchronous Playback, Time-Lock Drift Correction & Instant Karaoke Attenuation', () => {
  const audioEngineSource = fs.readFileSync(path.resolve('src/services/audioEngine.ts'), 'utf8');
  const lyricsSource = fs.readFileSync(path.resolve('src/components/mobile/LyricsFullscreen.tsx'), 'utf8');
  const musicFallbackSource = fs.readFileSync(path.resolve('api/_lib/musicFallback.js'), 'utf8');

  it('1. Strict Zero-Emoji Rule: No emojis anywhere in modified code or comments', () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
    assert.strictEqual(emojiRegex.test(audioEngineSource), false, 'audioEngine must not contain emojis');
    assert.strictEqual(emojiRegex.test(lyricsSource), false, 'LyricsFullscreen must not contain emojis');
    assert.strictEqual(emojiRegex.test(musicFallbackSource), false, 'musicFallback must not contain emojis');
  });

  it('2. Dual-Deck Auto Pre-Warming from Second Zero on Song Start', () => {
    assert.ok(
      audioEngineSource.includes('void this.prepareKaraokeDeck(track);'),
      'playTrack must trigger background pre-warming of karaoke deck'
    );
    assert.ok(
      audioEngineSource.includes('prepareKaraokeDeck(trackArg?: Track | null)'),
      'audioEngine must define prepareKaraokeDeck'
    );
  });

  it('3. Dual-Deck Resume: Resumes secondary player whenever secondary source is loaded', () => {
    assert.ok(
      audioEngineSource.includes('(this.isCrossfading || Boolean(this.secondaryKaraokeLoadedSource))'),
      'resume must resume secondary player whenever secondaryKaraokeLoadedSource is loaded'
    );
  });

  it('4. Dual-Deck Seek: Seeks both primary and secondary players simultaneously', () => {
    assert.ok(
      audioEngineSource.includes('this.secondaryKaraokeLoadedSource &&'),
      'seek must check for loaded secondary deck'
    );
    assert.ok(
      audioEngineSource.includes('this.secondaryYtPlayer.seekTo(seconds, true)'),
      'seek must seek secondary YouTube player to matching seconds'
    );
    assert.ok(
      audioEngineSource.includes('this.secondaryAudio.currentTime = target'),
      'seek must seek secondary HTML5 audio to matching target'
    );
  });

  it('5. Continuous Millisecond Drift Monitoring & Snap in startProgressTicker', () => {
    assert.ok(
      audioEngineSource.includes('const drift = Math.abs(curSec - secSec);'),
      'Ticker must compute drift between primary and secondary YouTube players'
    );
    assert.ok(
      audioEngineSource.includes('if (drift > 0.15 && typeof this.secondaryYtPlayer.seekTo ==='),
      'Ticker must snap secondary player if drift exceeds 150ms'
    );
    assert.ok(
      audioEngineSource.includes('const drift = Math.abs(this.audio.currentTime - this.secondaryAudio.currentTime);'),
      'Ticker must compute drift for HTML5 secondary deck'
    );
  });

  it('6. Instant Snap and Volume Enforcement on Secondary Player State Change', () => {
    assert.ok(
      audioEngineSource.includes('if (code === 1 && this.secondaryKaraokeLoadedSource && this.activeEngine ==='),
      'handleYtStateChange must handle secondary player entering state 1 (playing)'
    );
    assert.ok(
      audioEngineSource.includes('this.secondaryYtPlayer.seekTo(primTime, true)'),
      'handleYtStateChange must snap secondary player to primary time on start'
    );
    assert.ok(
      audioEngineSource.includes('this.secondaryYtPlayer.setVolume(instVol)'),
      'handleYtStateChange must enforce instrumental volume on start'
    );
  });

  it('7. High-FPS Fluid Slider: LyricsFullscreen uses requestAnimationFrame to throttle setLevel calls', () => {
    assert.ok(
      lyricsSource.includes('sliderRafId.current = requestAnimationFrame('),
      'LyricsFullscreen must use requestAnimationFrame for fluid slider updates'
    );
    assert.ok(
      lyricsSource.includes('cancelAnimationFrame(sliderRafId.current);'),
      'LyricsFullscreen must cancel animation frame on cleanup and release'
    );
  });

  it('8. Complete Zero Vocal Volume Enforcement at 0% Vocal Slider', () => {
    assert.ok(
      audioEngineSource.includes('finalVocalRatio = clamped === 0 ? 0 : effectiveVocalRatio;'),
      'audioEngine must force vocal ratio to zero when clamped is 0'
    );
    assert.ok(
      audioEngineSource.includes('const vocalVol = Math.round(masterVol * finalVocalRatio * 100);'),
      'audioEngine must calculate vocal volume from finalVocalRatio'
    );
    assert.ok(
      audioEngineSource.includes('const instVol = Math.round(masterVol * (clamped === 0 ? 1 : instRatio) * 100);'),
      'audioEngine must provide 100 percent instrumental volume when clamped is 0'
    );
  });

  it('9. Instrumental Candidate Duration Window Relaxed to 35 Seconds', () => {
    const musicFallbackSource = fs.readFileSync(path.resolve('api/_lib/musicFallback.js'), 'utf8');
    assert.ok(
      musicFallbackSource.includes('Math.abs(candDurationSec - expectedDurationSec) > 35'),
      'musicFallback must allow up to 35 seconds difference for official instrumental uploads'
    );
  });

  it('10. Interactive Mic Toggle Activates 0% Vocals Directly', () => {
    assert.ok(
      lyricsSource.includes('void karaoke.setLevel(0);'),
      'LyricsFullscreen must set vocal level to 0 when opening karaoke'
    );
    assert.ok(
      lyricsSource.includes('void karaoke.setLevel(100);'),
      'LyricsFullscreen must restore vocal level to 100 when closing karaoke'
    );
  });
});
