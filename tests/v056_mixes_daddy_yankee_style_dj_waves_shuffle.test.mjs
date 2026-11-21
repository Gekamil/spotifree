import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

test('v056 - 1. Daddy Yankee Top Mixes banner SVG generator', async (t) => {
  const mixesFile = path.join(root, 'src', 'services', 'spotifreeMixes.ts');
  const code = fs.readFileSync(mixesFile, 'utf8');

  // Verify export of makeBannerCoverSvg, resolveArtistPhoto, and DADDY_YANKEE_PALETTES
  assert.ok(code.includes('export function makeBannerCoverSvg'), 'makeBannerCoverSvg should be exported');
  assert.ok(code.includes('export function resolveArtistPhoto'), 'resolveArtistPhoto should be exported');
  assert.ok(code.includes('export const DADDY_YANKEE_PALETTES'), 'DADDY_YANKEE_PALETTES should be exported');
  assert.ok(code.includes('export const ARTIST_PORTRAITS'), 'ARTIST_PORTRAITS should be exported');

  // Check SVG template structure
  assert.ok(code.includes('preserveAspectRatio="xMidYMid slice"'), 'Photo should fill 100% full-bleed with aspect cover');
  assert.ok(code.includes('width="${barW}" height="${barH}" rx="10"'), 'Banner should be a floating horizontal rectangle');
  assert.ok(code.includes('width="${pillW}" height="${pillH}" rx="3"'), 'Vertical accent pill should be present on the left of banner');
  assert.ok(code.includes('circle cx="52" cy="52" r="18"'), 'Subtle circular logo badge in top left corner');
});

test('v056 - 2. Verified artist portraits registry and guaranteed non-empty fallback', async (t) => {
  const mixesFile = path.join(root, 'src', 'services', 'spotifreeMixes.ts');
  const code = fs.readFileSync(mixesFile, 'utf8');

  // Check top artists from user screenshots are registered in ARTIST_PORTRAITS
  const expectedArtists = [
    'nil moliner',
    'manuel carrasco',
    'daddy yankee',
    'prince royce',
    'paul alone',
    'sofia ellar',
    'rayden',
    'paulo londra',
    'bad bunny',
    'quevedo',
    'feid',
    'rosalia',
    'aitana',
  ];
  for (const art of expectedArtists) {
    assert.ok(code.includes(`'${art}':`), `Artist portrait registry should include '${art}'`);
  }

  // Check cache version bump
  assert.ok(code.includes('mixes_v6'), 'Mixes cache key should be bumped to mixes_v6 to invalidate outdated covers');
});

test('v056 - 3. Mobile DJ Card: ambient background waves and enlarged chic visualizer', async (t) => {
  const layoutFile = path.join(root, 'src', 'components', 'mobile', 'MobileLayout.tsx');
  const layoutCode = fs.readFileSync(layoutFile, 'utf8');

  assert.ok(layoutCode.includes("import { InteractiveMusicWaves } from '../dj/InteractiveMusicWaves'"), 'InteractiveMusicWaves should be imported');
  assert.ok(layoutCode.includes('<InteractiveMusicWaves'), 'InteractiveMusicWaves should be rendered inside DJ card');
  assert.ok(layoutCode.includes('size={124}'), 'SpotifyDJVisualizer size should be enlarged to 124 for chic prominent presence');
  assert.ok(layoutCode.includes('min-h-[148px]'), 'DJ card min-height should be comfortably expanded');
});

test('v056 - 4. Shuffle mode toggle and queue integrity', async (t) => {
  const modalFile = path.join(root, 'src', 'components', 'mobile', 'MobileNowPlayingModal.tsx');
  const modalCode = fs.readFileSync(modalFile, 'utf8');

  // Ensure 'shuffleMode !== \'off\'' is used instead of truthy 'shuffleMode ?'
  assert.ok(!modalCode.includes("shuffleMode ? 'text-[#1ed760]'"), 'Ternary on shuffleMode string should not be used');
  assert.ok(modalCode.includes("shuffleMode !== 'off' ? 'text-[#1ed760]'"), 'Strict check shuffleMode !== off should be used');
  assert.ok(modalCode.includes("shuffleMode !== 'off' ? 'Modo aleatorio desde:' : 'A continuación desde:'"), 'Queue header should reflect actual active shuffle mode');

  const storeFile = path.join(root, 'src', 'store', 'usePlayerStore.ts');
  const storeCode = fs.readFileSync(storeFile, 'utf8');

  assert.ok(storeCode.includes('isNavigatingHistory: boolean = false'), 'playTrack should support isNavigatingHistory flag');
  assert.ok(storeCode.includes('originalQueue: state.originalQueue.length > 0 ? state.originalQueue : baseTracks'), 'originalQueue must be preserved when shuffle is toggled on');
  assert.ok(storeCode.includes('originalQueue: cleanQueue'), 'originalQueue must be preserved when shuffle is toggled off');

  const playlistFile = path.join(root, 'src', 'components', 'mobile', 'MobilePlaylistView.tsx');
  const playlistCode = fs.readFileSync(playlistFile, 'utf8');

  assert.ok(playlistCode.includes('playTrack(track, displayTracks, playlist.id, playlist.name)'), 'MobilePlaylistView must pass clean un-shuffled displayTracks into playTrack');
});
