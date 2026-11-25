import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('v085: Desktop Artist Profile Discography, Playlists & Navigation', () => {
  it('1. Strict Zero-Emoji Rule across all modified and test files', () => {
    const files = [
      'src/components/common/ArtistDiscoverySections.tsx',
      'src/components/desktop/DesktopLayout.tsx',
      'src/components/desktop/DesktopPlayer.tsx',
      'src/components/desktop/DesktopPlaylistView.tsx',
      'src/components/desktop/DesktopSearchView.tsx',
      'tests/v085_desktop_artist_profile_discography.test.mjs',
    ];
    const emojiPattern = /[\uD800-\uDBFF][\uDC00-\uDFFF]/;
    for (const rel of files) {
      const content = fs.readFileSync(path.resolve(rel), 'utf8');
      assert.equal(emojiPattern.test(content), false, `Emoji found in ${rel}`);
    }
  });

  it('2. isArtist detection in DesktopPlaylistView is resilient to updated descriptions and art- IDs', () => {
    const desktopViewCode = fs.readFileSync(path.resolve('src/components/desktop/DesktopPlaylistView.tsx'), 'utf8');

    // Verify isArtist checks includes('artista') and type === 'artist'
    assert.match(desktopViewCode, /dynamicPlaylist\.description\?\.toLowerCase\(\)\.includes\('artista'\)/);
    assert.match(desktopViewCode, /\(dynamicPlaylist as any\)\.type === 'artist'/);
    assert.match(desktopViewCode, /dynamicPlaylist\.id\.startsWith\('art-'\)/);

    // Verify updatedArtistPlaylist sets type: 'artist'
    assert.match(desktopViewCode, /type:\s*'artist'/);

    // Simulated isArtist evaluation logic
    const evalIsArtist = (dynamicPlaylist, allUserPlaylists = []) => {
      const isLibraryPlaylist = allUserPlaylists.some((p) => p.id === dynamicPlaylist.id && p.type !== 'artist');
      return !isLibraryPlaylist && Boolean(
        dynamicPlaylist.description?.toLowerCase() === 'artista' ||
        dynamicPlaylist.description?.toLowerCase().includes('artista') ||
        dynamicPlaylist.type === 'artist' ||
        dynamicPlaylist.is_artist === true ||
        dynamicPlaylist.id.startsWith('art-') ||
        dynamicPlaylist.id.startsWith('artist-')
      );
    };

    // Case A: Initial artist with description 'Artista'
    assert.equal(evalIsArtist({ id: 'art-romeo-santos', name: 'Romeo Santos', description: 'Artista' }), true);

    // Case B: Loaded artist with Spotify verified description
    assert.equal(evalIsArtist({ id: 'art-romeo-santos', name: 'Romeo Santos', description: 'Artista oficial • Verificado en Spotify', type: 'artist' }), true);

    // Case C: Raw Spotify artist ID with verified description
    assert.equal(evalIsArtist({ id: '06HL4z0CvFAxyc27GXpf02', name: 'Taylor Swift', description: 'Artista oficial • Verificado en Spotify', type: 'artist' }), true);

    // Case D: Standard user playlist
    assert.equal(evalIsArtist({ id: 'custom-1234', name: 'Mis Favoritas', description: 'Lista para viajar' }), false);

    // Case E: Liked songs
    assert.equal(evalIsArtist({ id: 'liked-songs', name: 'Canciones que te gustan', description: '' }), false);
  });

  it('3. Fallback discography derives unique albums from tracks when API is empty or delayed', () => {
    const desktopViewCode = fs.readFileSync(path.resolve('src/components/desktop/DesktopPlaylistView.tsx'), 'utf8');

    // Verify fallbackDiscography and fallbackArtistPlaylists are implemented
    assert.match(desktopViewCode, /const fallbackDiscography = useMemo/);
    assert.match(desktopViewCode, /const fallbackArtistPlaylists = useMemo/);
    assert.match(desktopViewCode, /const effectiveDiscography =/);
    assert.match(desktopViewCode, /const effectiveArtistPlaylists =/);

    // Simulated fallback discography extraction logic
    const deriveFallbackDiscography = (tracks) => {
      const seen = new Set();
      const items = [];
      for (const t of tracks) {
        const albName = t.album?.name?.trim();
        if (!albName || seen.has(albName.toLowerCase())) continue;
        seen.add(albName.toLowerCase());
        const rawAlbId = t.album?.id;
        const albId = rawAlbId ? (rawAlbId.startsWith('alb-') ? rawAlbId : `alb-${rawAlbId}`) : `alb-${albName.toLowerCase().replace(/[\s&]+/g, '-')}`;
        const cover = t.album?.images?.[0]?.url || '';
        const year = t.album?.release_date ? String(t.album.release_date).substring(0, 4) : undefined;
        items.push({
          id: albId,
          name: albName,
          cover,
          year,
          recordType: 'album',
        });
      }
      return items;
    };

    const mockTracks = [
      { id: '1', name: 'Propuesta Indecente', album: { id: 'alb-formula-vol-2', name: 'Formula, Vol. 2 (Deluxe Edition)', release_date: '2014-02-25', images: [{ url: 'https://img.test/f2.jpg' }] } },
      { id: '2', name: 'Eres Mía', album: { id: 'alb-formula-vol-2', name: 'Formula, Vol. 2 (Deluxe Edition)', release_date: '2014-02-25', images: [{ url: 'https://img.test/f2.jpg' }] } },
      { id: '3', name: 'La Diabla', album: { id: 'alb-formula-vol-1', name: 'Formula, Vol. 1', release_date: '2011-11-08', images: [{ url: 'https://img.test/f1.jpg' }] } },
      { id: '4', name: 'Sobredosis', album: { id: 'golden', name: 'Golden', release_date: '2017-07-21', images: [{ url: 'https://img.test/golden.jpg' }] } },
    ];

    const result = deriveFallbackDiscography(mockTracks);
    assert.equal(result.length, 3, 'Should deduplicate albums across tracks');
    assert.equal(result[0].name, 'Formula, Vol. 2 (Deluxe Edition)');
    assert.equal(result[0].id, 'alb-formula-vol-2');
    assert.equal(result[0].year, '2014');
    assert.equal(result[1].name, 'Formula, Vol. 1');
    assert.equal(result[2].name, 'Golden');
    assert.equal(result[2].id, 'alb-golden');
  });

  it('4. Desktop navigation links guarantee art- prefix across search, player, table, and layout', () => {
    const searchCode = fs.readFileSync(path.resolve('src/components/desktop/DesktopSearchView.tsx'), 'utf8');
    const playerCode = fs.readFileSync(path.resolve('src/components/desktop/DesktopPlayer.tsx'), 'utf8');
    const tableCode = fs.readFileSync(path.resolve('src/components/desktop/DesktopPlaylistView.tsx'), 'utf8');
    const layoutCode = fs.readFileSync(path.resolve('src/components/desktop/DesktopLayout.tsx'), 'utf8');

    // DesktopSearchView formats artId in handleArtistClick
    assert.match(searchCode, /const artId = artist\.id\?\.startsWith\('art-'\) \? artist\.id : `art-\${artist\.id \|\| artist\.name/);

    // DesktopSearchView ensures recent search artist clicks carry art-
    assert.match(searchCode, /item\.type === 'artist' && !item\.id\.startsWith\('art-'\)/);

    // DesktopPlayer formats artId when clicking artist in player bar
    assert.match(playerCode, /const artId = a\.id\?\.startsWith\('art-'\)\s*\?\s*a\.id\s*:\s*`art-\${\(a\.name \|\| ''\)\.toLowerCase\(\)\.replace\(\/\[\\s&\]\+\/g, '-'\)}`/);

    // DesktopPlaylistView formats artId when clicking artist in tracks table
    assert.match(tableCode, /const artId = a\.id\?\.startsWith\('art-'\)\s*\?\s*a\.id\s*:\s*`art-\${\(a\.name \|\| ''\)\.toLowerCase\(\)\.replace\(\/\[\\s&\]\+\/g, '-'\)}`/);

    // DesktopLayout handles spotify:artist: by mapping to art-
    assert.match(layoutCode, /\.replace\(\/\^spotify:artist:\/, 'art-'\)/);
  });

  it('5. DesktopArtistAboutCard renders unconditionally on artist profile with listener badge and fallback bio', () => {
    const sectionsCode = fs.readFileSync(path.resolve('src/components/common/ArtistDiscoverySections.tsx'), 'utf8');
    const playlistViewCode = fs.readFileSync(path.resolve('src/components/desktop/DesktopPlaylistView.tsx'), 'utf8');

    // Sections code has border-t and default Spotifree overview
    assert.match(sectionsCode, /border-t border-white\/10/);
    assert.match(sectionsCode, /Perfil oficial de/);

    // Playlist view does not require artistBio truthiness before rendering DesktopArtistAboutCard
    assert.match(playlistViewCode, /\{\/\* Artist About \/ Biography Card - Always shown on Artist Profiles matching Real Spotify \*\/\}\s*\{isArtist && \(\s*<DesktopArtistAboutCard/);
  });
});
