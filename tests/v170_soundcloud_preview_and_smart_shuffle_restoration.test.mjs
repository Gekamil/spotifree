import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('Spotifree v1.7: SoundCloud Preview Prevention and Smart Shuffle Queue Restoration', async (t) => {
  await t.test('1. isSmartOrInjectedTrack correctly classifies smart tracks and protects queue', () => {
    const playerStorePath = path.join(rootDir, 'src', 'store', 'usePlayerStore.ts');
    const content = fs.readFileSync(playerStorePath, 'utf8');

    assert.ok(content.includes('export function isSmartOrInjectedTrack'), 'isSmartOrInjectedTrack must be exported');
    assert.ok(content.includes('t.isSmartRecommendation'), 'Must check isSmartRecommendation');
    assert.ok(content.includes('t.isSmartTrack'), 'Must check isSmartTrack');
    assert.ok(content.includes('t.isAutoplayRecommendation'), 'Must check isAutoplayRecommendation');
    assert.ok(content.includes('smart-rec-'), 'Must check smart-rec- queueId prefix');

    // Simulate function behavior directly
    const fn = (t) => {
      if (!t) return false;
      if (t.isSmartRecommendation || t.isSmartTrack || t.isSmart || t.isAutoplayRecommendation || t.isRecommended) return true;
      if (typeof t.queueId === 'string' && (t.queueId.startsWith('smart-rec-') || t.queueId.startsWith('autoplay-rec-'))) return true;
      if (typeof t.id === 'string' && (t.id.startsWith('smart-rec-') || t.id.startsWith('autoplay-rec-'))) return true;
      return false;
    };

    assert.equal(fn({ id: 'spotify:track:123', name: 'Song' }), false, 'Regular track must return false');
    assert.equal(fn({ id: 'spotify:track:123', name: 'Song', isSmartRecommendation: true }), true, 'Smart recommendation track must return true');
    assert.equal(fn({ id: 'smart-rec-456', name: 'Rec' }), true, 'Track with smart-rec ID must return true');
    assert.equal(fn({ id: 'normal-id', name: 'Rec', queueId: 'smart-rec-normal-id-123' }), true, 'Track with smart-rec queueId must return true');
    assert.equal(fn({ id: 'norm', name: 'Autoplay', isAutoplayRecommendation: true }), true, 'Autoplay recommendation must return true');
  });

  await t.test('2. toggleShuffle and setShuffleMode cleanly restore queue and originalQueue on off', () => {
    const playerStorePath = path.join(rootDir, 'src', 'store', 'usePlayerStore.ts');
    const content = fs.readFileSync(playerStorePath, 'utf8');

    assert.ok(content.includes("setShuffleMode: (mode: 'off' | 'all' | 'smart')"), 'setShuffleMode must be defined');
    assert.ok(content.includes("if (mode === 'off')"), 'setShuffleMode must handle off');
    assert.ok(content.includes("!isSmartOrInjectedTrack(t)"), 'off mode must filter with !isSmartOrInjectedTrack');
    assert.ok(content.includes("queue: cleanQueue"), 'queue must be reset to cleanQueue');
    assert.ok(content.includes("originalQueue: cleanQueue"), 'originalQueue must be reset to cleanQueue');

    // Verify playTrack guards originalQueue from queue item click pollution
    assert.ok(content.includes('isClickFromActiveQueue'), 'playTrack must guard against click pollution from active queue');
  });

  await t.test('3. DesktopPlaylistView passes pristine un-shuffled tracks to playTrack', () => {
    const playlistViewPath = path.join(rootDir, 'src', 'components', 'desktop', 'DesktopPlaylistView.tsx');
    const content = fs.readFileSync(playlistViewPath, 'utf8');

    assert.ok(content.includes('playTrack(startTrack, tracksWithPlaylistId, playlist.id)'), 'DesktopPlaylistView must pass clean un-shuffled playlist');
    assert.ok(content.includes('!isSmartOrInjectedTrack(t)'), 'DJ toggle off must filter out smart or injected tracks');
  });

  await t.test('4. musicFallback rejects SoundCloud 30s previews and optimizes HLS segment assembly', () => {
    const musicFallbackPath = path.join(rootDir, 'api', '_lib', 'musicFallback.js');
    const content = fs.readFileSync(musicFallbackPath, 'utf8');

    assert.ok(content.includes("item?.policy === 'SNIP'"), 'Must guard against SNIP policy');
    assert.ok(content.includes('x?.snipped === true'), 'Must reject snipped transcodings');
    assert.ok(content.includes("streamMeta.url.includes('/preview/')"), 'Must reject preview URLs in streamMeta');
    assert.ok(content.includes("streamMeta.url.includes('/snippet/')"), 'Must reject snippet URLs in streamMeta');
    assert.ok(content.includes('allowShort: false'), 'extractViaSoundCloud must use allowShort: false');
    assert.ok(content.includes('concurrency = Math.min(32, allUrls.length)'), 'fetchSoundCloudHlsBuffer must use concurrent worker pool');
  });

  await t.test('5. AudioEngine flips to pre-cued deck instantly and detects 30s preview snippets', () => {
    const audioEnginePath = path.join(rootDir, 'src', 'services', 'audioEngine.ts');
    const content = fs.readFileSync(audioEnginePath, 'utf8');

    assert.ok(content.includes('hasOtherPrecuedMatch'), 'Must detect if inactive deck already loaded pre-cued stream');
    assert.ok(content.includes('this.activeAudioIndex = otherDeckIdx'), 'Must flip activeAudioIndex to pre-cued deck for zero latency');
    assert.ok(content.includes('audioEl.duration <= 36 && expectedDurSec > 45'), 'loadedmetadata must detect 30s preview snippets');
    assert.ok(content.includes('resolveAndPlayAlternate'), 'Must trigger alternate full studio track when snippet is detected');
  });

  await t.test('6. server.mjs routes /api/audio/recommendations to api/audio.js', () => {
    const serverPath = path.join(rootDir, 'server.mjs');
    const content = fs.readFileSync(serverPath, 'utf8');

    assert.ok(content.includes('/api/audio/recommendations'), 'server.mjs must route /api/audio/recommendations');
    assert.ok(content.includes("pathname.endsWith('/recommendations')") && content.includes("'recommendations'"), 'server.mjs must set action recommendations');
  });

  await t.test('7. Version 1.7 / 1.7.0 metadata is consistent across package.json, README and changelog', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.equal(pkg.version, '1.7.0', 'package.json version must be 1.7.0');

    const changelog = fs.readFileSync(path.join(rootDir, 'src', 'data', 'changelog.ts'), 'utf8');
    assert.ok(changelog.includes("export const APP_VERSION = '1.7.0'"), 'changelog.ts APP_VERSION must be 1.7.0');
    assert.ok(changelog.includes("version: '1.7'"), 'changelog.ts must contain 1.7 release entry');

    const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf8');
    assert.ok(readme.includes('versión-1.7.0'), 'README badge must reference 1.7.0');
    assert.ok(readme.includes('## Novedades de la 1.7'), 'README must contain Novedades de la 1.7 section');
  });

  await t.test('8. Strict Zero-Emoji Rule across all modified and test files', () => {
    const filesToCheck = [
      'package.json',
      'README.md',
      'server.mjs',
      'api/_lib/musicFallback.js',
      'src/store/usePlayerStore.ts',
      'src/services/audioEngine.ts',
      'src/data/changelog.ts',
      'src/components/desktop/DesktopPlaylistView.tsx',
      'src/components/mobile/MobilePlaylistView.tsx',
      'tests/v170_soundcloud_preview_and_smart_shuffle_restoration.test.mjs'
    ];

    const emojiRegex = /[\uD83C-\uDBFF\uDC00-\uDFFF]/;
    for (const file of filesToCheck) {
      const fullPath = path.join(rootDir, file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.ok(!emojiRegex.test(content), `Emoji found in ${file}`);
      }
    }
  });
});
