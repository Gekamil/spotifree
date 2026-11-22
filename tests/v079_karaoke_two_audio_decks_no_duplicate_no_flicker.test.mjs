import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('v079: Two-Audio Deck Guarantee - Vocal vs Instrumental Separation, Zero Vocals at 0%, No Duplicate Audio', () => {
  const audioEngineSource = fs.readFileSync(path.resolve('src/services/audioEngine.ts'), 'utf8');
  const lyricsSource = fs.readFileSync(path.resolve('src/components/mobile/LyricsFullscreen.tsx'), 'utf8');

  it('1. Strict Zero-Emoji Rule: No emojis anywhere in modified code, tests or comments', () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
    assert.strictEqual(emojiRegex.test(audioEngineSource), false, 'audioEngine must not contain emojis');
    assert.strictEqual(emojiRegex.test(lyricsSource), false, 'LyricsFullscreen must not contain emojis');
  });

  it('2. Two-Audio Architecture Guarantee: Deck 0 is Vocals, Deck 1 is Instrumental', () => {
    // prepareKaraokeDeck ensures instrumental never duplicates current vocal video ID
    assert.ok(
      audioEngineSource.includes('inst.sourceId === this.currentVideoId'),
      'prepareKaraokeDeck must guard against loading identical video ID as vocal track'
    );
    // Secondary deck is only pre-cued/paused at 100% vocal volume, never playing audibly
    assert.ok(
      audioEngineSource.includes('isKaraokeActive ? Math.round(masterVol * instRatio * 100) : 0;'),
      'prepareKaraokeDeck must enforce volume 0 when karaoke is inactive or at 100% vocals'
    );
  });

  it('3. Zero Vocal Volume at 0%: Vocal deck is completely silenced and muted', () => {
    assert.ok(
      audioEngineSource.includes('activeYt.setVolume(0);'),
      'setKaraokeLevel must force primary vocal deck volume to 0 when clamped is 0'
    );
    assert.ok(
      audioEngineSource.includes('activeYt.mute?.();'),
      'setKaraokeLevel must mute primary vocal deck when clamped is 0'
    );
    assert.ok(
      audioEngineSource.includes('const instVol = Math.round(masterVol * (clamped === 0 ? 1 : instRatio) * 100);'),
      'setKaraokeLevel must provide 100% instrumental volume when clamped is 0'
    );
    assert.ok(
      audioEngineSource.includes('secYt.setVolume(instVol);'),
      'setKaraokeLevel must assign instVol to secondary player'
    );
  });

  it('4. Zero Duplicate Audio at 100%: Secondary instrumental deck is muted to 0 and paused', () => {
    assert.ok(
      audioEngineSource.includes('secYt.pauseVideo?.();'),
      'setKaraokeLevel must pause secondary deck when clamped is 100'
    );
    assert.ok(
      audioEngineSource.includes('secYt.mute?.();'),
      'setKaraokeLevel must mute secondary deck when clamped is 100'
    );
    assert.ok(
      audioEngineSource.includes('const curKaraokeActive = this.karaokeState.active && (this.karaokeState.vocalLevel ?? 100) < 100;'),
      'startProgressTicker must only keep secondary player rolling when karaoke is active and level < 100'
    );
  });

  it('5. No Destructive Source Swaps: toggleKaraokeMode sets vocal levels directly', () => {
    assert.ok(
      audioEngineSource.includes('await this.setKaraokeLevel(nextLevel, track);'),
      'toggleKaraokeMode must call setKaraokeLevel directly without hot-swapping video streams'
    );
    assert.ok(
      audioEngineSource.includes('const currentlyActive = this.karaokeState.trackId === clean && this.karaokeState.active && (this.karaokeState.vocalLevel ?? 100) < 100;'),
      'toggleKaraokeMode must determine active state based on vocal level'
    );
  });

  it('6. Interactive Mic Toggle: Direct Level Reset', () => {
    assert.ok(
      lyricsSource.includes('void karaoke.setLevel(0);'),
      'LyricsFullscreen must set vocal level to 0 when opening karaoke'
    );
    assert.ok(
      lyricsSource.includes('void karaoke.setLevel(100);'),
      'LyricsFullscreen must restore vocal level to 100 when closing karaoke'
    );
    assert.ok(
      lyricsSource.includes('void karaoke.toggle();'),
      'LyricsFullscreen must call karaoke.toggle'
    );
  });
});
