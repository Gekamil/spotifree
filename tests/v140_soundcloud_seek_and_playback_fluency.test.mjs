// v1.4: SoundCloud/imported playlists, fluid seeking without stalls, cross-engine overlap prevention, and version metadata.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const audioEngineSrc = fs.readFileSync(path.resolve('src/services/audioEngine.ts'), 'utf8');
const mobileModalSrc = fs.readFileSync(path.resolve('src/components/mobile/MobileNowPlayingModal.tsx'), 'utf8');
const lyricsFsSrc = fs.readFileSync(path.resolve('src/components/mobile/LyricsFullscreen.tsx'), 'utf8');
const contextMenuSrc = fs.readFileSync(path.resolve('src/components/desktop/ContextMenu.tsx'), 'utf8');
const apiAudioSrc = fs.readFileSync(path.resolve('api/audio.js'), 'utf8');
const musicFallbackSrc = fs.readFileSync(path.resolve('api/_lib/musicFallback.js'), 'utf8');
const audioServiceSrc = fs.readFileSync(path.resolve('scripts/audioService.mjs'), 'utf8');

describe('Spotifree v1.4 Playback Fluency, Seek Stability, and Overlap Prevention', () => {
  it('1. SoundCloud and HTML5 playback send full fallback metadata and guard stale async sequences', () => {
    const scBlock = audioEngineSrc.slice(
      audioEngineSrc.indexOf('const scDirectMatch'),
      audioEngineSrc.indexOf('// 1. Resolve videoId')
    );
    assert.ok(scBlock.includes('this.buildStreamUrl('), 'SoundCloud direct branch builds stream URL with metadata');
    assert.ok(scBlock.includes('this.playSequenceId !== currentSeq'), 'SoundCloud branch checks sequence staleness after await');
    assert.ok(scBlock.includes('this.resolveAndPlayAlternate('), 'SoundCloud branch recovers via alternate resolver on error');

    const altBlock = audioEngineSrc.slice(
      audioEngineSrc.indexOf('private async resolveAndPlayAlternate('),
      audioEngineSrc.indexOf('public startCarrier()')
    );
    assert.ok(altBlock.includes('consecutiveFailedTracks'), 'resolveAndPlayAlternate tracks consecutive failures cleanly');
    assert.ok(altBlock.includes('this.consecutiveFailedTracks < 3'), 'skips unplayable track even when store isPlaying is already true');
  });

  it('2. HTML5 seeking avoids 1e101 HTTP stream jump, queues metadata seeks, and resumes cleanly', () => {
    const seekBlock = audioEngineSrc.slice(
      audioEngineSrc.indexOf('public seek('),
      audioEngineSrc.indexOf('public isAudioDucked')
    );
    assert.equal(seekBlock.includes('1e101'), false, 'HTML5 seek must never jump HTTP audio streams to 1e101');
    assert.ok(seekBlock.includes('pendingHtml5Seek'), 'HTML5 seek queues seek target when readyState === 0');
    assert.ok(seekBlock.includes('seekResetTimer'), 'seek manages debounced seekResetTimer cleanly');
    assert.ok(seekBlock.includes('shouldBePlaying') && seekBlock.includes('startProgressTicker()'), 'seek restarts ticker and playback when active');
  });

  it('3. Mobile progress sliders commit seek on pointer/touch release rather than dragging at 60Hz', () => {
    assert.ok(mobileModalSrc.includes('isScrubbingRef') && mobileModalSrc.includes('handleSeekEnd'));
    assert.ok(mobileModalSrc.includes('onPointerUp={handleSeekEnd}') && mobileModalSrc.includes('onTouchEnd={handleSeekEnd}'));
    assert.ok(lyricsFsSrc.includes('isScrubbingSeekRef') && lyricsFsSrc.includes('dragSeekPercentRef'));
    assert.ok(lyricsFsSrc.includes('onPointerUp=') && lyricsFsSrc.includes('onTouchEnd='));
  });

  it('4. Karaoke block 2 and volume controls never awaken inactive decks across engines', () => {
    const setKaraokeBlock = audioEngineSrc.slice(
      audioEngineSrc.indexOf('public async setKaraokeLevel('),
      audioEngineSrc.indexOf('// 3. Web Audio Real-Time Center-Channel Cancellation')
    );
    assert.ok(
      setKaraokeBlock.includes("if (this.activeEngine === 'html5' && this.audio)"),
      'HTML5 karaoke modulation must be gated on activeEngine === html5'
    );

    const setMutedBlock = audioEngineSrc.slice(
      audioEngineSrc.indexOf('public setMuted('),
      audioEngineSrc.indexOf('public setEqualizerBand(')
    );
    assert.ok(
      setMutedBlock.includes("a === this.audio && this.activeEngine === 'html5'"),
      'Unmuting must only unmute active decks'
    );
    assert.ok(contextMenuSrc.includes('dislikeCurrentTrack()'), 'Desktop context menu dislike delegates active track to dislikeCurrentTrack()');
  });

  it('5. Backend Range streaming keeps format deterministic, slices upstream 200 responses, and expands SoundCloud fallback', () => {
    assert.ok(apiAudioSrc.includes("const preferCompact = action === 'download' && !clientRangeHeader;"), 'Streaming never flips bitrate between initial fetch and Range seeks');
    assert.ok(apiAudioSrc.includes('parsedRange && upstream.status === 200'), 'Slices upstream 200 full-body responses to requested byte range');
    assert.ok(apiAudioSrc.includes('forceRefresh: true'), 'Stream retry passes forceRefresh and explicitId');
    assert.ok(musicFallbackSrc.includes('segUrls.length > 320'), 'SoundCloud HLS buffer supports longer tracks and mixes');
    assert.ok(musicFallbackSrc.includes('allowShort = false'), 'SoundCloud explicit ID allows short imported tracks');
    assert.ok(audioServiceSrc.includes('if (!videoId && (isScId || isMonoId))'), 'Local audioService resolves text query instead of ytsearch1:sc:<id>');
  });

  it('6. Release metadata includes version 1.4 without emojis', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
    const changelog = fs.readFileSync(path.resolve('src/data/changelog.ts'), 'utf8');

    assert.ok(['1.4.0', '1.5.0', '1.6.0', '1.6.1', '1.7.0'].includes(pkg.version));
    assert.ok(/export const APP_VERSION = '1\.[4-9]+(\.[0-9]+)?';/.test(changelog));
    assert.ok(changelog.includes("version: '1.4'"));
  });
});
