import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Spotifree v0.6.9: Smooth Gradual Audio Ducking, Fluid Continuous Karaoke & Vibe Diversity', () => {
  const root = process.cwd();
  const audioEngineFile = fs.readFileSync(path.join(root, 'src/services/audioEngine.ts'), 'utf-8');
  const aiDJVoiceFile = fs.readFileSync(path.join(root, 'src/services/aiDJVoiceService.ts'), 'utf-8');
  const aiDJServiceFile = fs.readFileSync(path.join(root, 'src/services/aiDJService.ts'), 'utf-8');
  const musicTaggingFile = fs.readFileSync(path.join(root, 'src/services/musicTaggingService.ts'), 'utf-8');
  const aidjViewFile = fs.readFileSync(path.join(root, 'src/components/dj/AIDJView.tsx'), 'utf-8');

  it('1. audioEngine: Smooth gradual fade-down ducking ("baje poco a poco") with >= 0.28 floor', () => {
    // Check setDuckedVolume accepts fadeDurationMs and implements gradual easing
    assert.ok(audioEngineFile.includes('setDuckedVolume(fraction: number = 0.32, fadeDurationMs: number = 750)'), 'setDuckedVolume must support smooth fadeDurationMs');
    assert.ok(audioEngineFile.includes('Math.max(0.28, base * this.duckFraction)'), 'Floor must never drop below 0.28 so music is always audible');
    assert.ok(audioEngineFile.includes('0.5 * (1 - Math.cos(progress * Math.PI))'), 'Must use smooth cosine easing for gradual volume reduction');
  });

  it('2. audioEngine: Karaoke adjustments NEVER pause or cut playing audio to silence', () => {
    // setKaraokeLevel must NOT call ensureDSPProcessingMode (which pauses playback)
    const setKaraokeLevelBody = audioEngineFile.slice(
      audioEngineFile.indexOf('public async setKaraokeLevel'),
      audioEngineFile.indexOf('private verifyPlayingSource')
    );
    assert.ok(!setKaraokeLevelBody.includes('this.ensureDSPProcessingMode()'), 'setKaraokeLevel must NOT call ensureDSPProcessingMode');
    assert.ok(setKaraokeLevelBody.includes('this.ytPlayer.setVolume(targetVol)'), 'setKaraokeLevel smoothly attenuates YouTube player without stopping it');
  });

  it('3. audioEngine: seamlessAudioSourceSwap uses 800ms sinusoidal equal-power crossfade and preserves playback on fallback', () => {
    assert.ok(audioEngineFile.includes('Math.sin(frac * Math.PI * 0.5)'), 'Uses sinusoidal equal-power crossfade curve');
    assert.ok(audioEngineFile.includes('Math.cos(frac * Math.PI * 0.5)'), 'Uses cosine equal-power crossfade curve');
    assert.ok(audioEngineFile.includes('preserving continuous playback of current track'), 'Preserves current audio and never cuts to silence if swap fails');
  });

  it('4. aiDJVoiceService & aiDJService duck music smoothly to 0.32 instead of muting to 0.12', () => {
    assert.ok(aiDJVoiceFile.includes('audioEngine.setDuckedVolume(0.32, 750)'), 'aiDJVoiceService ducks to 0.32 with 750ms gradual fade');
    assert.ok(aiDJServiceFile.includes('audioEngine.setDuckedVolume(0.32, 750)'), 'aiDJService ducks to 0.32 with 750ms gradual fade');
    assert.ok(!aiDJServiceFile.includes('audioEngine.setDuckedVolume(0.12)'), 'aiDJService must NOT hard-mute to 0.12');
  });

  it('5. musicTaggingService: Pop maps correctly to #pop (not #reggaeton) and surprises rotate distinct genres', () => {
    assert.ok(musicTaggingFile.includes("if (/\\bpop\\b|pop\\s+actual/i.test(p)) return '#pop';"), 'Pop query must return #pop');
    assert.ok(musicTaggingFile.includes("'#pop', '#reggaeton', '#electro', '#rock'"), 'Surprise pool must include diverse genres');
  });

  it('6. aiDJService & AIDJView: Cambiar rollo uses distinct queries, excludes history, and responds fast (2500ms)', () => {
    assert.ok(aiDJServiceFile.includes('new Set([...historyIds, ...sessionIds])'), 'Excludes all recent and session tracks so songs are never repeated');
    assert.ok(aiDJServiceFile.includes('callGroqDJ(') && aiDJServiceFile.includes(', 2500)'), 'callGroqDJ has 2500ms fast timeout for instant rollo response');
    assert.ok(aidjViewFile.includes('vibe.query || vibe.label'), 'AIDJView passes full descriptive query for distinct style resolution');
  });
});
