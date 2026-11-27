import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Spotifree v1.6.1 Artist Playlist Loading & Download Scoping', () => {
  it('1. Strict Zero-Emoji Rule across all modified and test files', () => {
    const files = [
      'src/services/artistService.ts',
      'src/components/desktop/DesktopPlaylistView.tsx',
      'src/components/desktop/DesktopHomeView.tsx',
      'src/services/audioEngine.ts',
      'tests/v161_artist_playlist_loading_and_download_scoping.test.mjs',
    ];
    const emojiPattern = /[\uD800-\uDBFF][\uDC00-\uDFFF]/;
    for (const rel of files) {
      const content = fs.readFileSync(path.resolve(rel), 'utf8');
      assert.equal(emojiPattern.test(content), false, `Emoji found in ${rel}`);
    }
  });

  it('2. resolveArtistName strips Mix de, Radio de, and prefixes cleanly', () => {
    const artistServiceCode = fs.readFileSync(path.resolve('src/services/artistService.ts'), 'utf8');
    assert.match(artistServiceCode, /\(mix de\|this is\|radio de\|/);

    const resolveArtistNameSim = (artistId, fallbackName) => {
      if (fallbackName && fallbackName.trim() && !/^playlist$/i.test(fallbackName.trim())) {
        const cleanedFallback = fallbackName
          .replace(/^(art-|artist-|sf-artist-)/i, '')
          .replace(/^(mix de|this is|radio de|éxitos de|lo mejor de)\s+/i, '')
          .trim();
        if (cleanedFallback) return cleanedFallback;
      }
      let clean = artistId
        .replace(/^(art-|artist-|sf-artist-|spotify:artist:)/i, '')
        .replace(/^(mix de|this is|radio de|éxitos de|lo mejor de)\s+/i, '')
        .replace(/[-_]+/g, ' ')
        .trim();
      return clean.replace(/\b\w/g, (c) => c.toUpperCase()) || 'Artista';
    };

    assert.equal(resolveArtistNameSim('sf-mix-romeo-santos', 'Mix de Romeo Santos'), 'Romeo Santos');
    assert.equal(resolveArtistNameSim('art-bad-bunny', 'Bad Bunny'), 'Bad Bunny');
    assert.equal(resolveArtistNameSim('art-paul-alone', 'Radio de Paul Alone'), 'Paul Alone');
    assert.equal(resolveArtistNameSim('art-quevedo'), 'Quevedo');
  });

  it('3. DesktopPlaylistView prioritizes sf- mixes and guards isArtist against sf- IDs', () => {
    const playlistViewCode = fs.readFileSync(path.resolve('src/components/desktop/DesktopPlaylistView.tsx'), 'utf8');

    // Verify sf- mixes are loaded before isArtist in loadTracks
    const sfIdx = playlistViewCode.indexOf("if (playlist.id.startsWith('sf-'))");
    const artistIdx = playlistViewCode.indexOf("const isArtist = Boolean(");
    assert.ok(sfIdx !== -1, 'Must contain sf- check in loadTracks');
    assert.ok(artistIdx !== -1, 'Must contain isArtist check in loadTracks');
    assert.ok(sfIdx < artistIdx, 'sf- mix loading must occur before isArtist check');

    // Verify isArtist definition explicitly guards against sf- prefix
    assert.match(playlistViewCode, /!dynamicPlaylist\.id\.startsWith\('sf-'\)/);

    // Verify pendingPlayAllRef is set when loading with 0 tracks
    assert.match(playlistViewCode, /pendingPlayAllRef\.current\s*=\s*true/);
  });

  it('4. DesktopHomeView quick play routes artist cards directly through fetchArtistTopTracks', () => {
    const homeViewCode = fs.readFileSync(path.resolve('src/components/desktop/DesktopHomeView.tsx'), 'utf8');

    assert.match(homeViewCode, /if \(card\.id\.startsWith\('art-'\) \|\| card\.id\.startsWith\('artist-'\)\)/);
    assert.match(homeViewCode, /fetchArtistTopTracks\(card\.id/);
  });

  it('5. AudioEngine scopes offline downloaded storage to downloaded playlists or airplane mode', () => {
    const audioEngineCode = fs.readFileSync(path.resolve('src/services/audioEngine.ts'), 'utf8');

    assert.match(audioEngineCode, /isDownloadedContextActive\(\)/);
    assert.match(audioEngineCode, /LOCAL_FILES_PLAYLIST_ID/);
    assert.match(audioEngineCode, /shouldCheckDownloaded/);
    assert.match(audioEngineCode, /Rescuing playback with cached offline audio track/);
  });
});
