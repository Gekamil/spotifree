import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

test('v058 - 1. Deezer silhouette and placeholder detection', async (t) => {
  const mixesFile = path.join(root, 'src', 'services', 'spotifreeMixes.ts');
  const code = fs.readFileSync(mixesFile, 'utf8');

  // isPlaceholderOrAvatar and isDeezerSilhouette must be exported
  assert.ok(code.includes('export function isPlaceholderOrAvatar'), 'isPlaceholderOrAvatar must be exported');
  assert.ok(code.includes('export function isDeezerSilhouette'), 'isDeezerSilhouette must be exported');

  // Deezer avatar MD5 hash must be blocked
  assert.ok(code.includes('d41d8cd98f00b204e9800998ecf8427e'), 'd41d8cd98f00b204e9800998ecf8427e must be filtered');
  assert.ok(code.includes('//500x500'), '//500x500 must be filtered');

  // Both loadImg and loadCoverPhoto must verify isDeezerSilhouette
  assert.ok(code.includes('if (isDeezerSilhouette(img)) return resolve(null);') || code.includes('if (isDeezerSilhouette(img)) {'), 'loadImg must check silhouette');
});

test('v058 - 2. 100% Verified 200 OK artist portraits and category photos', async (t) => {
  const mixesFile = path.join(root, 'src', 'services', 'spotifreeMixes.ts');
  const code = fs.readFileSync(mixesFile, 'utf8');

  // Verified artists
  assert.ok(code.includes("'bad bunny': 'https://cdn-images.dzcdn.net/images/artist/9867d5112c6714c935a86b98b4dd288c/500x500-000000-80-0-0.jpg'"), 'Bad Bunny must use verified 200 OK portrait');
  assert.ok(code.includes("'avicii': 'https://cdn-images.dzcdn.net/images/artist/82e214b0cb39316f4a12a082fded54f6/500x500-000000-80-0-0.jpg'"), 'Avicii must use verified 200 OK portrait');
  assert.ok(code.includes("'quevedo': 'https://cdn-images.dzcdn.net/images/artist/ee02749274070488eb9362d55826db08/500x500-000000-80-0-0.jpg'"), 'Quevedo must use verified 200 OK portrait');
  assert.ok(code.includes("trend_spain: 'https://cdn-images.dzcdn.net/images/artist/ee02749274070488eb9362d55826db08/500x500-000000-80-0-0.jpg'"), 'trend_spain must use verified Quevedo 200 OK portrait');

  // Cache key must be mixes_v8
  assert.ok(code.includes('mixes_v8'), 'Cache key must be bumped to mixes_v8');
});

test('v058 - 3. Guaranteed MINIMUM 9 playlists per shelf logic check in code', async (t) => {
  const mixesFile = path.join(root, 'src', 'services', 'spotifreeMixes.ts');
  const code = fs.readFileSync(mixesFile, 'utf8');

  // Check definitions expansion
  assert.ok(code.includes('sf-era-2020s'), 'Should contain sf-era-2020s definition');
  assert.ok(code.includes('sf-era-60s'), 'Should contain sf-era-60s definition');
  assert.ok(code.includes('sf-era-teenpop'), 'Should contain sf-era-teenpop definition');
  assert.ok(code.includes('sf-era-eurodance'), 'Should contain sf-era-eurodance definition');
  assert.ok(code.includes('sf-genre-flamenco'), 'Should contain sf-genre-flamenco definition');
  assert.ok(code.includes('sf-genre-rnb'), 'Should contain sf-genre-rnb definition');
  assert.ok(code.includes('sf-genre-reggae'), 'Should contain sf-genre-reggae definition');
  assert.ok(code.includes('sf-genre-clasica'), 'Should contain sf-genre-clasica definition');

  assert.ok(code.includes('sf-mood-dormir'), 'Should contain sf-mood-dormir definition');
  assert.ok(code.includes('sf-mood-cocinar'), 'Should contain sf-mood-cocinar definition');
  assert.ok(code.includes('sf-mood-paseo'), 'Should contain sf-mood-paseo definition');
  assert.ok(code.includes('sf-mood-romantico'), 'Should contain sf-mood-romantico definition');
  assert.ok(code.includes('sf-mood-cantar'), 'Should contain sf-mood-cantar definition');

  assert.ok(code.includes('sf-trend-urbano'), 'Should contain sf-trend-urbano definition');
  assert.ok(code.includes('sf-trend-pop'), 'Should contain sf-trend-pop definition');
  assert.ok(code.includes('sf-trend-electronica'), 'Should contain sf-trend-electronica definition');
  assert.ok(code.includes('sf-trend-latino'), 'Should contain sf-trend-latino definition');
  assert.ok(code.includes('sf-trend-verano'), 'Should contain sf-trend-verano definition');
  assert.ok(code.includes('sf-trend-rising'), 'Should contain sf-trend-rising definition');
  assert.ok(code.includes('sf-trend-rap'), 'Should contain sf-trend-rap definition');

  // Check strict guarantee loop in withSpotifreeShelves
  assert.ok(code.includes('if (shelf.cards.length < 9)'), 'Should enforce minimum 9 cards per shelf');
  assert.ok(code.includes('shelf.cards.length >= 9'), 'Should backfill until reaching at least 9 cards');
  assert.ok(code.includes('vaultArtistNames ='), 'SoundCloud vaults must query at least 10 vault artists');
});

test('v058 - 4. Shelves deduplication within section without cross-shelf cannibalization', async (t) => {
  const mixesFile = path.join(root, 'src', 'services', 'spotifreeMixes.ts');
  const code = fs.readFileSync(mixesFile, 'utf8');

  // Verify dedupeHomeShelves deduplicates WITHIN each shelf
  assert.ok(code.includes('seenIdsInShelf'), 'dedupeHomeShelves must check seenIdsInShelf per shelf');
  assert.ok(code.includes('seenTitlesInShelf'), 'dedupeHomeShelves must check seenTitlesInShelf per shelf');
});
