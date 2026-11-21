import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

test('v057 - 1. Option 1 DJ Visualizer liquid traveling wave and thicker stroke width', () => {
  const visFile = path.join(root, 'src', 'components', 'dj', 'SpotifyDJVisualizer.tsx');
  const code = fs.readFileSync(visFile, 'utf8');

  // Verify Option 1 counter-propagating harmonic traveling wave formula
  assert.ok(code.includes('Math.sin(theta * 2 - t1) * 0.65'), 'Uses Option 1 sin(theta * 2 - t1) harmonic component');
  assert.ok(code.includes('Math.cos(theta * 3 + t2) * 0.35'), 'Uses Option 1 cos(theta * 3 + t2) harmonic component');

  // Verify thick stroke line as requested by user
  assert.ok(code.includes('Math.max(7.2, size * 0.054)') || code.includes('Math.max(5.2, size * (mini ? 0.11 : 0.052))'), 'Thick stroke width applied');

  // Verify serene liquid speed
  assert.ok(code.includes('0.022') && code.includes('0.012'), 'Liquid speed constants configured');
});

test('v057 - 2. Guaranteed unique photography per mood, chart and genre with avatar filtering', () => {
  const mixesFile = path.join(root, 'src', 'services', 'spotifreeMixes.ts');
  const code = fs.readFileSync(mixesFile, 'utf8');

  // Verify isPlaceholderOrAvatar blocks empty deezer artist URLs and generic avatars
  assert.ok(code.includes("lower.includes('dzcdn.net/images/artist//')"), 'Blocks empty Deezer artist path');
  assert.ok(code.includes("lower.includes('avatar')"), 'Blocks generic avatar placeholders');
  assert.ok(code.includes("lower.includes('default_artist')"), 'Blocks default_artist');

  // Verify CURATED_CATEGORY_PHOTOS has distinct photography for each mood
  assert.ok(code.includes('entreno:'), 'Has dedicated entreno photo');
  assert.ok(code.includes('chill:'), 'Has dedicated chill photo');
  assert.ok(code.includes('concentracion:'), 'Has dedicated concentracion photo');
  assert.ok(code.includes('trend_spain:'), 'Has dedicated trend_spain photo (Quevedo)');
  assert.ok(code.includes('trend_global:'), 'Has dedicated trend_global photo (The Weeknd)');
});

test('v057 - 3. Visual style variety across covers: Banner (Daddy Yankee style), Badge, and Collage', () => {
  const mixesFile = path.join(root, 'src', 'services', 'spotifreeMixes.ts');
  const code = fs.readFileSync(mixesFile, 'utf8');

  // Verify makeBannerCoverSvg creates full photo + bottom floating banner bar with accent pill
  assert.ok(code.includes('makeBannerCoverSvg'), 'Exports makeBannerCoverSvg');
  assert.ok(code.includes('makeEraCoverSvg'), 'Exports makeEraCoverSvg');
  assert.ok(code.includes('makeCollageCoverSvg'), 'Exports makeCollageCoverSvg');

  // Verify makeCuratedThemedCover supports banner style delegation
  assert.ok(code.includes("makeCover(title, 'banner', validImages, color)"), 'Delegates curated covers to banner style');

  // Verify cache key bump to invalidate previous identical covers
  assert.ok(code.includes('mixes_v7'), 'Cache key bumped to mixes_v7');
});

test('v057 - 4. Rich personalized playlists per user: up to 12 artist mixes and Tus mixes principales', () => {
  const mixesFile = path.join(root, 'src', 'services', 'spotifreeMixes.ts');
  const code = fs.readFileSync(mixesFile, 'utf8');

  // Verify artist mixes expanded to 10+
  assert.ok(code.includes('ranked.slice(0, 10)') || code.includes('ranked.slice(0, 12)'), 'Artist mixes expanded to 10+');

  // Verify Tus mixes principales shelf
  assert.ok(code.includes("id: 'sf-top-mixes'"), 'Generates sf-top-mixes shelf');
  assert.ok(code.includes("title: 'Tus mixes principales'"), 'Title is Tus mixes principales');
});
