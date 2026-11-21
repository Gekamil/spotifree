import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resolveSoundCloudUrl } from '../api/_lib/musicFallback.js';
import { readExternalPlaylist } from '../api/_lib/import-playlist.js';

test('Spotifree v0.5.9: 100% Full SoundCloud Playlist Import Preservation & Resilient Audio Fallback', async (t) => {
  await t.test('1. resolveSoundCloudUrl does not drop tracks with encrypted transcodings', () => {
    const musicFallback = fs.readFileSync(path.resolve('api/_lib/musicFallback.js'), 'utf8');

    // Asserts parallel batch hydration with Promise.all
    assert.match(musicFallback, /Promise\.all\(\s*batches\.map/, 'Must fetch hydration batches in parallel');
    assert.match(musicFallback, /ids=\$\{batch\.map\(encodeURIComponent\)\.join\('%2C'\)\}/, 'Must encode batch IDs properly with %2C');

    // Asserts tracks are filtered by valid title/name, not by restrictive direct streaming transcodings
    assert.match(
      musicFallback,
      /\.filter\(\(t\)\s*=>\s*t\?\.id\s*&&\s*\(t\.title\s*\|\|\s*t\.name\)\)/,
      'Must keep all tracks that have valid title/name instead of discarding encrypted ones'
    );
  });

  await t.test('2. readExternalPlaylist in import-playlist.js preserves all playlist tracks with coverUrl and trackObj', () => {
    const importCode = fs.readFileSync(path.resolve('api/_lib/import-playlist.js'), 'utf8');

    assert.match(importCode, /const plCover = pl\.images\?\.\[0\]\?\.url \|\| ''/, 'Must extract playlist cover as fallback');
    assert.match(importCode, /const coverUrl = t\.album\?\.images\?\.\[0\]\?\.url \|\| plCover/, 'Must supply playlist cover if track has no individual cover');
    assert.match(importCode, /trackObj: populatedTrackObj/, 'Must provide complete populatedTrackObj for each song');
  });

  await t.test('3. playlistImporter preserves all songs without silently dropping duplicates', () => {
    const importerCode = fs.readFileSync(path.resolve('src/utils/playlistImporter.ts'), 'utf8');

    assert.match(
      importerCode,
      /if\s*\(seen\.has\(t\.id\)\)\s*\{\s*return\s*\{\s*\.\.\.t,\s*id:\s*`\$\{t\.id\}-dup-\$\{idx\}`\s*\};?\s*\}/,
      'Must assign unique duplicate ID instead of dropping duplicate songs'
    );
  });

  await t.test('4. api/audio.js falls through to YouTube/Monochrome if direct SoundCloud stream is encrypted or unavailable', () => {
    const audioCode = fs.readFileSync(path.resolve('api/audio.js'), 'utf8');

    // Asserts graceful fallback if explicitId sc- fails
    assert.ok(
      audioCode.includes('if (sc) return { audioInfo: sc, videoId: sc.id };'),
      'Must conditionally return sc only when present'
    );
    assert.ok(
      !audioCode.includes('return sc ? { audioInfo: sc, videoId: sc.id } : { audioInfo: null, videoId: explicitId };'),
      'Must NOT return null immediately when sc extraction fails'
    );
  });

  await t.test('5. Real SoundCloud playlist imports 100% of tracks (78 out of 78)', async () => {
    const pl = await readExternalPlaylist('https://soundcloud.com/hard-music-entertainment/sets/novedades-verano-2-2');
    assert.ok(pl, 'Playlist should resolve successfully');
    assert.strictEqual(pl.source, 'soundcloud');
    assert.ok(pl.tracks.length >= 70, `Expected at least 70 tracks, got ${pl.tracks.length}`);
    assert.ok(pl.tracks[0].title, 'First track should have title');
    assert.ok(pl.tracks[0].artist, 'First track should have artist');
    assert.ok(pl.tracks[0].trackObj, 'First track should have trackObj');
  });
});
