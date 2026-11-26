// v1.3: two songs must never sound at once (dislike/skip, stale decks, karaoke off, SoundCloud playlists).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/services/audioEngine.ts', import.meta.url), 'utf8');
const playTrack = src.slice(src.indexOf('public async playTrack('), src.indexOf('private async resolveAndPlayAlternate('));

test('changing track pauses every deck before resetting the mobile deck index', () => {
  const pauseAllYt = playTrack.indexOf('for (const p of this.ytPlayers)');
  const pauseAllAudio = playTrack.indexOf('for (const a of this.audios)');
  const resetIdx = playTrack.indexOf('this.activeYtIndex = 0;');
  assert.ok(pauseAllYt > 0 && pauseAllAudio > 0, 'all YouTube and HTML5 decks are paused');
  assert.ok(resetIdx > pauseAllAudio, 'deck index is reset only after silencing both decks');
});

test('progress ticker enforces a single audible deck outside crossfade, audition and karaoke blend', () => {
  const fn = src.slice(src.indexOf('private enforceSingleAudibleDeck()'), src.indexOf('private startProgressTicker()'));
  assert.match(fn, /if \(this\.isCrossfading \|\| this\.isAuditioning\) return;/);
  assert.match(fn, /karaokeBlend/);
  assert.match(src, /this\.enforceSingleAudibleDeck\(\);\s*this\.checkAudioUiSync\(\);/);
});

test('SoundCloud tracks, including repeated ones (-dup-N), play directly without karaoke pre-warm', () => {
  assert.match(playTrack, /\^sc-\(\\d\+\)\(\?:-dup-\\d\+\)\?\$/);
  const scBlock = playTrack.slice(playTrack.indexOf('const scDirectMatch'), playTrack.indexOf('// 1. Resolve videoId'));
  assert.doesNotMatch(scBlock, /prepareKaraokeDeck/);
});
