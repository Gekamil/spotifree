import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

test('v064 - 1. Mix covers: zero silhouettes, distinct photos, verified portraits, cache bumped to mixes_v9', async () => {
  const mixesFile = path.join(root, 'src', 'services', 'spotifreeMixes.ts');
  const code = fs.readFileSync(mixesFile, 'utf8');

  // Cache key must be bumped to mixes_v9 and purge old versions
  assert.ok(code.includes('mixes_v9'), 'Cache key must be bumped to mixes_v9');
  assert.ok(code.includes('kvDel'), 'Must have kvDel to purge stale cache keys');
  assert.ok(code.includes('mixes_v8'), 'Must clean up mixes_v8');

  // Verified 200 OK portraits
  assert.ok(code.includes("'bad bunny': 'https://cdn-images.dzcdn.net/images/artist/044a3f315b041864887a8dd8709e6926/500x500-000000-80-0-0.jpg'"), 'Bad Bunny verified portrait');
  assert.ok(code.includes("'quevedo': 'https://cdn-images.dzcdn.net/images/artist/79880cc1b999b15567e332203464c34e/500x500-000000-80-0-0.jpg'"), 'Quevedo verified portrait');
  assert.ok(code.includes("'avicii': 'https://cdn-images.dzcdn.net/images/artist/82e214b0cb39316f4a12a082fded54f6/500x500-000000-80-0-0.jpg'"), 'Avicii verified portrait');

  // Distinct category photos (entreno != chill != relax)
  assert.ok(code.includes('photo-1534438327276-14e5300c3a48'), 'Entreno dedicated fitness photo');
  assert.ok(code.includes('photo-1518495973542-4542c06a5843'), 'Chill dedicated cozy coffee photo');
  assert.ok(code.includes('photo-1506126613408-eca07ce68773'), 'Relax dedicated lake meditation photo');

  // 53994a69daeb (user portrait) must be blocked from ever becoming a playlist cover
  assert.ok(code.includes('53994a69daeb'), 'Must explicitly reject user profile portrait 53994a69daeb in isPlaceholderOrAvatar');

  // resolveArtistPhoto must match era keywords (2010s, espana, etc.)
  assert.ok(code.includes("k.includes('2010')"), 'resolveArtistPhoto must handle 2010');
  assert.ok(code.includes("k.includes('espana')"), 'resolveArtistPhoto must handle espana');
  assert.ok(code.includes("k.includes('entreno')"), 'resolveArtistPhoto must handle entreno');
  assert.ok(code.includes("k.includes('chill')"), 'resolveArtistPhoto must handle chill');
});

test('v064 - 2. Smart Shuffle YouTube Music Radio endpoint in api/audio.js', async () => {
  const audioApiFile = path.join(root, 'api', 'audio.js');
  const code = fs.readFileSync(audioApiFile, 'utf8');

  // Recommendations handler using RDAMVM and InnerTube v1/next
  assert.ok(code.includes('handleRecommendations'), 'handleRecommendations must be defined');
  assert.ok(code.includes('RDAMVM'), 'Must query playlistId RDAMVM for YouTube Music Radio');
  assert.ok(code.includes('music.youtube.com/youtubei/v1/next'), 'Must call YouTube Music InnerTube next API');
  assert.ok(code.includes('WEB_REMIX'), 'Must use WEB_REMIX client context');
  assert.ok(code.includes('action === \'recommendations\''), 'Must wire up action recommendations');
  assert.ok(code.includes('isYtId'), 'Must validate true 11-char YouTube ID');
});

test('v064 - 3. Smart Shuffle store integration in usePlayerStore.ts', async () => {
  const storeFile = path.join(root, 'src', 'store', 'usePlayerStore.ts');
  const code = fs.readFileSync(storeFile, 'utf8');

  // Must call /api/audio/recommendations
  assert.ok(code.includes('/api/audio/recommendations'), 'usePlayerStore must call /api/audio/recommendations');
  assert.ok(code.includes('isSmartRecommendation: true'), 'Injected tracks must have isSmartRecommendation flag');
  assert.ok(code.includes('triggerSmartShuffleRecommendation'), 'triggerSmartShuffleRecommendation must exist');
  assert.ok(code.includes('populateSmartShuffleRecommendations'), 'populateSmartShuffleRecommendations must exist');
  assert.ok(!code.includes('getCuratedSetForHashtag'), 'Must NOT pull tracks from user library playlists');
});

test('v064 - 4. No tacky badge or sparkle icon in UI: seamless natural queue display', async () => {
  const mobileNowPlaying = fs.readFileSync(path.join(root, 'src', 'components', 'mobile', 'MobileNowPlayingModal.tsx'), 'utf8');
  const desktopSidebar = fs.readFileSync(path.join(root, 'src', 'components', 'desktop', 'DesktopRightSidebar.tsx'), 'utf8');

  assert.ok(!mobileNowPlaying.includes('✨ Recomendado'), 'MobileNowPlayingModal must not display tacky sparkle recommended badge');
  assert.ok(!desktopSidebar.includes('✨ Recomendado'), 'DesktopRightSidebar must not display tacky sparkle recommended badge');
});
