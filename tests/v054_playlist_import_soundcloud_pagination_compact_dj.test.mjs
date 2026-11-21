import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Spotifree v0.5.4: 300+ Track Pagination, SoundCloud Playlist Import & Compact DJ Card', async (t) => {
  await t.test('1. Compact DJ Card Layout & Proportion Improvements', () => {
    const mobileLayout = fs.readFileSync(path.resolve('src/components/mobile/MobileLayout.tsx'), 'utf8');

    // Asserts DJ card layout matches compact or enlarged chic design
    assert.match(mobileLayout, /min-h-\[(120|148)px\]/, 'DJ card min-height should be well-proportioned');
    assert.match(mobileLayout, /size=\{(94|124)\}/, 'DJ visualizer in card should use refined visualizer size');
    assert.match(mobileLayout, /mb-4\.5/, 'DJ card margin bottom should be tight to eliminate dead space');
    assert.match(mobileLayout, /w-8\.5 h-8\.5/, 'DJ play button should be proportionately sized');
  });

  await t.test('2. SoundCloud Playlist & Track Hydration in musicFallback.js', async () => {
    const musicFallback = fs.readFileSync(path.resolve('api/_lib/musicFallback.js'), 'utf8');

    // Verifies SoundCloud playlist hydration logic
    assert.match(musicFallback, /missingIds\.length > 0/, 'Must identify unhydrated SoundCloud stub track IDs');
    assert.match(musicFallback, /https:\/\/api-v2\.soundcloud\.com\/tracks\?ids=/, 'Must hydrate missing tracks in batches via /tracks?ids=');
    assert.match(musicFallback, /missingIds\.slice\(i,\s*i\s*\+\s*50\)/, 'Must batch hydrate in chunks of 50');
  });

  await t.test('3. Multi-App Detection & SoundCloud Support in import-playlist.js', () => {
    const importPlaylist = fs.readFileSync(path.resolve('api/_lib/import-playlist.js'), 'utf8');

    // Verifies SoundCloud source detection
    assert.match(importPlaylist, /host === 'soundcloud\.com'/, 'Must detect soundcloud.com');
    assert.match(importPlaylist, /host === 'on\.soundcloud\.com'/, 'Must detect on.soundcloud.com short mobile links');
    assert.match(importPlaylist, /host === 'spotify\.link'/, 'Must detect spotify.link short links');
    assert.match(importPlaylist, /src\.source === 'soundcloud'/, 'Must handle soundcloud source in readExternalPlaylist');
    assert.match(importPlaylist, /resolveSoundCloudUrl/, 'Must delegate to resolveSoundCloudUrl for real track extraction');
  });

  await t.test('4. Full Pagination & Offset Support in api/playlist.js for 300+ Track Playlists', () => {
    const playlistJs = fs.readFileSync(path.resolve('api/playlist.js'), 'utf8');

    // Verifies pagination support in resolveSpotifyPlaylist
    assert.match(playlistJs, /offset = 0,\s*limit = 100/, 'resolveSpotifyPlaylist must accept offset and limit');
    assert.match(playlistJs, /totalCount > rawItems\.length/, 'Must check if totalCount exceeds initial 100 items');
    assert.match(playlistJs, /url\.searchParams\.get\('offset'\)/, 'Handler must read offset searchParam');
    assert.match(playlistJs, /url\.searchParams\.get\('limit'\)/, 'Handler must read limit searchParam');
  });

  await t.test('5. Frontend 300+ Track Progressive Import Loop in playlistImporter.ts', () => {
    const importer = fs.readFileSync(path.resolve('src/utils/playlistImporter.ts'), 'utf8');

    // Verifies frontend progressive pagination
    assert.match(importer, /while \(allTracks\.length < total/, 'Must loop while loaded tracks are fewer than total tracks');
    assert.match(importer, /offset=\$\{currentOffset\}&limit=100/, 'Must fetch next chunk offsets from api');
    assert.match(importer, /onProgress\?\.\(allTracks\.length,\s*total\)/, 'Must update live progress on each chunk');
    assert.ok(importer.includes('soundcloud'), 'Importer must accept soundcloud');
    assert.match(importer, /song\.trackObj/, 'Must directly preserve real hydrated tracks from source');
  });

  await t.test('6. UI Components List SoundCloud in Supported Sources', () => {
    const dialog = fs.readFileSync(path.resolve('src/components/common/ImportPlaylistDialog.tsx'), 'utf8');
    const sheet = fs.readFileSync(path.resolve('src/components/mobile/MobileCreateSheet.tsx'), 'utf8');

    assert.ok(dialog.includes("'SoundCloud'"), 'ImportPlaylistDialog must display SoundCloud source pill');
    assert.ok(sheet.includes("'SoundCloud'"), 'MobileCreateSheet must display SoundCloud source pill');
  });
});
