import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

describe('v075: Karaoke Pre-Warming, Non-Stop Dual Playback & Drag Fluidity', () => {
  const audioEngineSource = fs.readFileSync(path.resolve('src/services/audioEngine.ts'), 'utf8');
  const lyricsSource = fs.readFileSync(path.resolve('src/components/mobile/LyricsFullscreen.tsx'), 'utf8');
  const useKaraokeSource = fs.readFileSync(path.resolve('src/utils/useKaraokeMode.ts'), 'utf8');

  it('1. Strict Zero-Emoji Rule: No emojis anywhere in modified code', () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
    assert.strictEqual(emojiRegex.test(audioEngineSource), false, 'audioEngine must not contain emojis');
    assert.strictEqual(emojiRegex.test(lyricsSource), false, 'LyricsFullscreen must not contain emojis');
    assert.strictEqual(emojiRegex.test(useKaraokeSource), false, 'useKaraokeMode must not contain emojis');
  });

  it('2. AudioEngine implements prepareKaraokeDeck to pre-warm instrumental in background at volume 0', () => {
    assert.ok(
      audioEngineSource.includes('prepareKaraokeDeck(trackArg?: Track | null)'),
      'Must define prepareKaraokeDeck'
    );
    assert.ok(
      audioEngineSource.includes('secYt.setVolume(targetInstVol)'),
      'Must set volume on secondary deck when preparing'
    );
    assert.ok(
      audioEngineSource.includes('this.secondaryKaraokeLoadedSource = inst.sourceId'),
      'Must store loaded source identifier'
    );
  });

  it('3. AudioEngine setKaraokeLevel avoids repeated loadVideoById during continuous pointermove dragging', () => {
    assert.ok(
      audioEngineSource.includes('if (this.secondaryKaraokeLoadedSource !== instSource && clamped < 100)'),
      'Must only trigger loadVideoById once when not yet loaded'
    );
  });

  it('4. AudioEngine NEVER cuts music to dead silence: keeps safe floor if secondary deck is still buffering', () => {
    assert.ok(
      audioEngineSource.includes('const isSecPlaying = secState === 1;'),
      'Must verify whether secondary deck is playing'
    );
    assert.ok(
      audioEngineSource.includes('(isSecPlaying || clamped >= 40) ? vocalRatio : (0.35 + 0.65 * vocalRatio)'),
      'Must preserve safe musical floor on primary track while secondary is buffering'
    );
  });

  it('5. LyricsFullscreen and useKaraokeMode pre-warm secondary deck on modal open & button click', () => {
    assert.ok(
      useKaraokeSource.includes('audioEngine.prepareKaraokeDeck(track)'),
      'useKaraokeMode must trigger prepareKaraokeDeck once candidate is verified'
    );
    assert.ok(
      lyricsSource.includes('audioEngine.prepareKaraokeDeck(p.track)'),
      'LyricsFullscreen must pre-warm karaoke deck'
    );
  });
});
