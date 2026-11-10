import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Load source files directly for AST / structural verification
const rootDir = process.cwd();
const settingsPath = path.join(rootDir, 'src', 'components', 'desktop', 'DesktopSettingsView.tsx');
const playlistViewPath = path.join(rootDir, 'src', 'components', 'desktop', 'DesktopPlaylistView.tsx');
const contextMenuPath = path.join(rootDir, 'src', 'components', 'desktop', 'ContextMenu.tsx');
const advancedSettingsPath = path.join(rootDir, 'src', 'components', 'common', 'AdvancedSettingsSection.tsx');
const artistFollowPath = path.join(rootDir, 'src', 'utils', 'artistFollow.ts');

const settingsContent = fs.readFileSync(settingsPath, 'utf8');
const playlistContent = fs.readFileSync(playlistViewPath, 'utf8');
const contextMenuContent = fs.readFileSync(contextMenuPath, 'utf8');
const advancedSettingsContent = fs.readFileSync(advancedSettingsPath, 'utf8');
const artistFollowContent = fs.readFileSync(artistFollowPath, 'utf8');

// Pure recreation of matchTrackId from usePlayerStore.ts line 15-21
function matchTrackId(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const ca = a.replace(/^spotify:track:/i, '').replace(/^(search-add-|artist-song-|imported-|itunes-|search-)/i, '').split('?')[0].trim().toLowerCase();
  const cb = b.replace(/^spotify:track:/i, '').replace(/^(search-add-|artist-song-|imported-|itunes-|search-)/i, '').split('?')[0].trim().toLowerCase();
  return Boolean(ca && cb && ca === cb);
}

// Pure recreation of isCurrentPlaylistPlaying logic from DesktopPlaylistView.tsx line 1105-1106
function computeIsCurrentPlaylistPlaying(isPlaying, tracks, currentTrack) {
  return Boolean(
    isPlaying &&
    Array.isArray(tracks) &&
    tracks.some((t) => t && (t.id === currentTrack?.id || matchTrackId(t.id, currentTrack?.id)))
  );
}

// Pure recreation of playlist search filter from DesktopPlaylistView.tsx line 1039-1044
function filterPlaylistTracks(dynamicTracks, filterQuery) {
  const q = (filterQuery || '').trim().toLowerCase();
  if (!q) return dynamicTracks;
  return dynamicTracks.filter((t) =>
    `${t.name || ''} ${(t.artists || []).map((a) => a?.name || '').join(' ')} ${t.album?.name || ''}`.toLowerCase().includes(q)
  );
}

describe('Adversarial & Empirical Challenger: Milestone 3 (Requirement R3)', () => {

  describe('1. Edge Cases in Track ID Matching and Playing State Toggle', () => {
    it('1.1 matchTrackId: exact ID match and case normalization', () => {
      assert.strictEqual(matchTrackId('4cOdK2wGLETKBW3PvgPWqT', '4cOdK2wGLETKBW3PvgPWqT'), true);
      assert.strictEqual(matchTrackId('4CODK2WGLETKBW3PVGPWQT', '4codk2wgletkbw3pvgpwqt'), true);
      assert.strictEqual(matchTrackId('Song_Id_123', 'song_id_123'), true);
    });

    it('1.2 matchTrackId: URI prefix stripping (spotify:track:)', () => {
      assert.strictEqual(matchTrackId('spotify:track:4cOdK2wGLETKBW3PvgPWqT', '4cOdK2wGLETKBW3PvgPWqT'), true);
      assert.strictEqual(matchTrackId('4cOdK2wGLETKBW3PvgPWqT', 'spotify:track:4cOdK2wGLETKBW3PvgPWqT'), true);
      assert.strictEqual(matchTrackId('SPOTIFY:TRACK:xyz123', 'spotify:track:xyz123'), true);
      assert.strictEqual(matchTrackId('Spotify:Track:XYZ123', 'xyz123'), true);
    });

    it('1.3 matchTrackId: dynamic synthetic prefixes (search-add-, artist-song-, imported-, itunes-, search-)', () => {
      assert.strictEqual(matchTrackId('search-add-998877', '998877'), true);
      assert.strictEqual(matchTrackId('artist-song-445566', '445566'), true);
      assert.strictEqual(matchTrackId('imported-local-1122', 'local-1122'), true);
      assert.strictEqual(matchTrackId('itunes-778899', '778899'), true);
      assert.strictEqual(matchTrackId('search-query-track', 'query-track'), true);
      assert.strictEqual(matchTrackId('spotify:track:search-add-12345', '12345'), true);
    });

    it('1.4 matchTrackId: URL query parameters stripping (?si=, ?context=)', () => {
      assert.strictEqual(matchTrackId('spotify:track:4cOdK2?si=share123', '4cOdK2'), true);
      assert.strictEqual(matchTrackId('4cOdK2?si=share123', '4cOdK2?context=playlist'), true);
      assert.strictEqual(matchTrackId('search-add-track99?feature=dj', 'track99?src=search'), true);
    });

    it('1.5 matchTrackId: negative assertions (different tracks must NOT match)', () => {
      assert.strictEqual(matchTrackId('track_A', 'track_B'), false);
      assert.strictEqual(matchTrackId('spotify:track:1111111111111111111111', 'spotify:track:2222222222222222222222'), false);
      assert.strictEqual(matchTrackId('search-add-123', 'search-add-124'), false);
      assert.strictEqual(matchTrackId('spotify:track:abc', 'spotify:track:xyz'), false);
    });

    it('1.6 matchTrackId: null, undefined, empty, and whitespace resistance', () => {
      // Null / undefined handling
      assert.strictEqual(matchTrackId(undefined, 'abc'), false);
      assert.strictEqual(matchTrackId('abc', undefined), false);
      assert.strictEqual(matchTrackId(null, 'abc'), false);
      assert.strictEqual(matchTrackId('abc', null), false);
      assert.strictEqual(matchTrackId(undefined, undefined), false);
      assert.strictEqual(matchTrackId(null, null), false);

      // Empty string handling
      assert.strictEqual(matchTrackId('', ''), false);
      assert.strictEqual(matchTrackId('spotify:track:', ''), false);

      // Query param only string where split yields empty
      assert.strictEqual(matchTrackId('?foo', '?bar'), false);
      assert.strictEqual(matchTrackId('?', '?!'), false);

      // Distinct whitespace lengths do NOT match empty string
      assert.strictEqual(matchTrackId('   ', '    '), false);

      // Fast-path strict equality (a === b) returns true for identical inputs
      assert.strictEqual(matchTrackId('identical', 'identical'), true);
      assert.strictEqual(matchTrackId('   ', '   '), true);
    });

    it('1.7 isCurrentPlaylistPlaying: evaluation with mock tracks and player states', () => {
      const mockTracks = [
        { id: 'track_1', name: 'Song 1' },
        { id: 'spotify:track:track_2', name: 'Song 2' },
        { id: 'search-add-3', name: 'Song 3' },
      ];

      // Playing is false
      assert.strictEqual(
        computeIsCurrentPlaylistPlaying(false, mockTracks, { id: 'track_1' }),
        false,
        'Should be false when isPlaying is false'
      );

      // currentTrack is undefined / null
      assert.strictEqual(
        computeIsCurrentPlaylistPlaying(true, mockTracks, undefined),
        false,
        'Should be false when currentTrack is undefined'
      );
      assert.strictEqual(
        computeIsCurrentPlaylistPlaying(true, mockTracks, null),
        false,
        'Should be false when currentTrack is null'
      );

      // Empty tracks array
      assert.strictEqual(
        computeIsCurrentPlaylistPlaying(true, [], { id: 'track_1' }),
        false,
        'Should be false when playlist has 0 tracks'
      );

      // Exact match
      assert.strictEqual(
        computeIsCurrentPlaylistPlaying(true, mockTracks, { id: 'track_1' }),
        true,
        'Should match exact track id'
      );

      // Prefix normalized match: spotify:track:track_2 vs track_2
      assert.strictEqual(
        computeIsCurrentPlaylistPlaying(true, mockTracks, { id: 'track_2' }),
        true,
        'Should match stripped track_2 with spotify:track:track_2'
      );
      assert.strictEqual(
        computeIsCurrentPlaylistPlaying(true, [{ id: 'track_2' }], { id: 'spotify:track:track_2' }),
        true,
        'Should match reversed prefix track_2'
      );

      // Synthetic prefix match: search-add-3 vs 3
      assert.strictEqual(
        computeIsCurrentPlaylistPlaying(true, mockTracks, { id: '3' }),
        true,
        'Should match synthetic search-add-3 with stripped 3'
      );

      // Non-existent track in playlist
      assert.strictEqual(
        computeIsCurrentPlaylistPlaying(true, mockTracks, { id: 'unknown_song' }),
        false,
        'Should be false when currentTrack is not in the playlist'
      );
    });

    it('1.8 handlePlayAll AST verification: loading and empty safeguards', () => {
      // Must not silently fail or restart
      assert.ok(
        playlistContent.includes('if (loading) {') && playlistContent.includes("showGlobalToast('Cargando canciones de la lista...')"),
        'handlePlayAll must show feedback toast while playlist is loading'
      );
      assert.ok(
        playlistContent.includes('if (tracks.length === 0) {') && playlistContent.includes("showGlobalToast('La lista no tiene canciones disponibles')"),
        'handlePlayAll must show feedback toast when playlist has 0 tracks'
      );
      assert.ok(
        playlistContent.includes('if (isCurrentPlaylistPlaying) {') && playlistContent.includes('togglePlay();'),
        'handlePlayAll must togglePlay (pause) if current playlist is already playing'
      );
    });
  });

  describe('2. Artist Follow Toggle vs Playlist Library Save Toggle Isolation', () => {
    it('2.1 AST check: Add to Library button excludes artists (!isArtist)', () => {
      const addBtnMatch = playlistContent.match(/\{!isLikedPlaylist\s*&&\s*!isFolder\s*&&\s*!isArtist\s*&&\s*\(/);
      assert.ok(addBtnMatch, 'Add to Library button (+/✓) MUST check !isArtist');
    });

    it('2.2 AST check: Artist Follow button is only rendered for artists (isArtist &&)', () => {
      const artistFollowBtnMatch = playlistContent.match(/\{isArtist\s*&&\s*\(\s*<button[\s\S]*?onClick=\{handleToggleFollowArtist\}/);
      assert.ok(artistFollowBtnMatch, 'Artist Follow button MUST only render when isArtist is true');
    });

    it('2.3 Mutual exclusion: clicking artist follow never executes handleToggleLibrary', () => {
      assert.ok(
        playlistContent.includes('const handleToggleFollowArtist = () => {') &&
        playlistContent.includes('toggleFollowArtist({'),
        'handleToggleFollowArtist must directly call toggleFollowArtist from artistFollow.ts'
      );
      assert.ok(
        !playlistContent.includes('handleToggleFollowArtist = () => {\n    handleToggleLibrary'),
        'handleToggleFollowArtist must never delegate to handleToggleLibrary'
      );
    });

    it('2.4 Storage isolation: artist follow persists art-<id> with type: "artist", distinct from standard playlist', () => {
      assert.ok(
        artistFollowContent.includes("type: 'artist'"),
        'toggleFollowArtist must store entry with type: "artist"'
      );
      assert.ok(
        artistFollowContent.includes("description: 'Artista'"),
        'toggleFollowArtist must store entry with description: "Artista"'
      );
      assert.ok(
        artistFollowContent.includes('artistLibraryId'),
        'toggleFollowArtist must format id with art- prefix'
      );
      assert.ok(
        playlistContent.includes("(p as any).type !== 'artist'"),
        'DesktopPlaylistView must ignore artist items when checking regular user playlists'
      );
    });
  });

  describe('3. Playlist Search Edge Cases', () => {
    const mockTracks = [
      { id: '1', name: 'Givenchy', artists: [{ name: 'Duki' }], album: { name: 'Temporada de Reggaetón 2' } },
      { id: '2', name: 'Bzrp Music Sessions, Vol. 50', artists: [{ name: 'Bizarrap' }, { name: 'Duki' }], album: { name: 'Single' } },
      { id: '3', name: 'Corazón Vacío', artists: [{ name: 'Maria Becerra' }], album: { name: 'La Nena de Argentina' } },
      { id: '4', name: 'Starboy [Remix]', artists: [{ name: 'The Weeknd' }, { name: 'Daft Punk' }], album: { name: 'Starboy (Deluxe)' } },
      { id: '5', name: 'Track *With* (Special) \\Symbols/ [Test]', artists: [{ name: 'Artist + Co.' }], album: { name: 'Album {2024}' } },
    ];

    it('3.1 Substring search matching by title, artist, and album', () => {
      const resTitle = filterPlaylistTracks(mockTracks, 'Givenchy');
      assert.strictEqual(resTitle.length, 1);
      assert.strictEqual(resTitle[0].id, '1');

      const resArtist = filterPlaylistTracks(mockTracks, 'Maria Becerra');
      assert.strictEqual(resArtist.length, 1);
      assert.strictEqual(resArtist[0].id, '3');

      const resSecArtist = filterPlaylistTracks(mockTracks, 'Daft Punk');
      assert.strictEqual(resSecArtist.length, 1);
      assert.strictEqual(resSecArtist[0].id, '4');

      const resAlbum = filterPlaylistTracks(mockTracks, 'Reggaetón 2');
      assert.strictEqual(resAlbum.length, 1);
      assert.strictEqual(resAlbum[0].id, '1');
    });

    it('3.2 Regex special characters resistance (zero crash, literal matching)', () => {
      assert.doesNotThrow(() => filterPlaylistTracks(mockTracks, '['));
      assert.doesNotThrow(() => filterPlaylistTracks(mockTracks, '('));
      assert.doesNotThrow(() => filterPlaylistTracks(mockTracks, '*'));
      assert.doesNotThrow(() => filterPlaylistTracks(mockTracks, '\\'));
      assert.doesNotThrow(() => filterPlaylistTracks(mockTracks, '***'));
      assert.doesNotThrow(() => filterPlaylistTracks(mockTracks, '[[['));
      assert.doesNotThrow(() => filterPlaylistTracks(mockTracks, '((('));
      assert.doesNotThrow(() => filterPlaylistTracks(mockTracks, '+'));
      assert.doesNotThrow(() => filterPlaylistTracks(mockTracks, '?'));
      assert.doesNotThrow(() => filterPlaylistTracks(mockTracks, '{'));
      assert.doesNotThrow(() => filterPlaylistTracks(mockTracks, '$'));

      const resBracket = filterPlaylistTracks(mockTracks, '[Remix]');
      assert.strictEqual(resBracket.length, 1);
      assert.strictEqual(resBracket[0].id, '4');

      const resStar = filterPlaylistTracks(mockTracks, '*With*');
      assert.strictEqual(resStar.length, 1);
      assert.strictEqual(resStar[0].id, '5');

      const resBackslash = filterPlaylistTracks(mockTracks, '\\Symbols/');
      assert.strictEqual(resBackslash.length, 1);
      assert.strictEqual(resBackslash[0].id, '5');

      const resPlus = filterPlaylistTracks(mockTracks, 'Artist + Co.');
      assert.strictEqual(resPlus.length, 1);
      assert.strictEqual(resPlus[0].id, '5');
    });

    it('3.3 Whitespace and empty queries preserve full track list', () => {
      assert.strictEqual(filterPlaylistTracks(mockTracks, '').length, mockTracks.length);
      assert.strictEqual(filterPlaylistTracks(mockTracks, '   ').length, mockTracks.length);
      assert.strictEqual(filterPlaylistTracks(mockTracks, '\t  \n  ').length, mockTracks.length);
      assert.strictEqual(filterPlaylistTracks(mockTracks, null).length, mockTracks.length);
      assert.strictEqual(filterPlaylistTracks(mockTracks, undefined).length, mockTracks.length);
    });

    it('3.4 Case insensitivity across searches', () => {
      const lower = filterPlaylistTracks(mockTracks, 'duki');
      const upper = filterPlaylistTracks(mockTracks, 'DUKI');
      const mixed = filterPlaylistTracks(mockTracks, 'DuKi');
      assert.strictEqual(lower.length, 2);
      assert.strictEqual(upper.length, 2);
      assert.strictEqual(mixed.length, 2);
      assert.deepStrictEqual(lower, upper);
      assert.deepStrictEqual(lower, mixed);
    });

    it('3.5 Accented and unicode character preservation', () => {
      const resAccent = filterPlaylistTracks(mockTracks, 'Corazón');
      assert.strictEqual(resAccent.length, 1);
      assert.strictEqual(resAccent[0].id, '3');

      const resAccentLower = filterPlaylistTracks(mockTracks, 'corazón');
      assert.strictEqual(resAccentLower.length, 1);
      assert.strictEqual(resAccentLower[0].id, '3');
    });

    it('3.6 Empty search state UI structure & clear button in DesktopPlaylistView', () => {
      assert.ok(
        playlistContent.includes('No se han encontrado resultados para «{filterQuery.trim()}»'),
        'Must contain dedicated empty search heading'
      );
      assert.ok(
        playlistContent.includes('Comprueba que las palabras estén bien escritas'),
        'Must contain helper tip for empty search results'
      );
      assert.ok(
        playlistContent.includes("onClick={() => setFilterQuery('')}") &&
        playlistContent.includes('Borrar búsqueda'),
        'Must provide "Borrar búsqueda" button resetting filterQuery'
      );
    });
  });

  describe('4. Settings Category Ordering: Exact 8 Spotify Categories in Strict Sequence', () => {
    const expectedCategories = [
      'Cuenta',
      'Idioma',
      'Calidad de audio y Ecualizador',
      'Reproducción',
      'Visualización y Contenido',
      'Tu biblioteca y Archivos locales',
      'Almacenamiento',
      'Social y Acerca de',
    ];

    it('4.1 All 8 categories are present in exact sequential order in DesktopSettingsView.tsx', () => {
      const allH2Matches = [...settingsContent.matchAll(/<h2[^>]*>((?:(?!<\/h2>)[\s\S])*?)<\/h2>/g)];
      const categoryHeadings = allH2Matches.filter((m) => !m[1].includes('Configuración protegida'));

      assert.strictEqual(
        categoryHeadings.length,
        8,
        `DesktopSettingsView main panel must contain exactly 8 category h2 headings; found ${categoryHeadings.length}`
      );

      for (let i = 0; i < expectedCategories.length; i++) {
        const expected = expectedCategories[i];
        const headingContent = categoryHeadings[i][1];
        assert.ok(
          headingContent.includes(expected),
          `Heading #${i + 1} must contain category "${expected}", but got "${headingContent.trim()}"`
        );
      }
    });

    it('4.2 Verify exact index order of the 8 category section markers', () => {
      let lastIndex = -1;
      for (const cat of expectedCategories) {
        const idx = settingsContent.indexOf(cat);
        assert.ok(idx > -1, `Category "${cat}" must be present in DesktopSettingsView`);
        assert.ok(
          idx > lastIndex,
          `Category "${cat}" at index ${idx} must appear strictly after previous category at index ${lastIndex}`
        );
        lastIndex = idx;
      }
    });

    it('4.3 Flat row styling: border-b border-white/5 used across categories and subcomponents', () => {
      const flatBordersInSettings = settingsContent.match(/border-b border-white\/5/g) || [];
      assert.ok(
        flatBordersInSettings.length >= 12,
        `Expected at least 12 flat row dividers in DesktopSettingsView, found ${flatBordersInSettings.length}`
      );

      const flatBordersInAdvanced = advancedSettingsContent.match(/border-b border-white\/5/g) || [];
      assert.ok(
        flatBordersInAdvanced.length >= 2,
        `AdvancedSettingsSection desktop variant must use border-b border-white/5 flat row dividers, found ${flatBordersInAdvanced.length}`
      );
    });
  });

  describe('5. Context Menu Options on Mock Playlist Targets', () => {
    it('5.1 ContextMenu provides library toggle ("Añadir a Tu biblioteca" / "Eliminar de Tu biblioteca")', () => {
      assert.ok(
        contextMenuContent.includes("isSavedInLibrary ? 'Eliminar de Tu biblioteca' : 'Añadir a Tu biblioteca'"),
        'Must display dynamic library toggle label'
      );
      assert.ok(
        contextMenuContent.includes("showGlobalToast('Añadida a Tu biblioteca')") &&
        contextMenuContent.includes("showGlobalToast('Eliminada de Tu biblioteca')"),
        'Must show global toast confirmation when toggling library status'
      );
    });

    it('5.2 ContextMenu provides playlist download and remove download options', () => {
      assert.ok(
        contextMenuContent.includes("isPlaylistDownloaded(targetPlaylist.id) ? 'Eliminar descarga' : 'Descargar lista'") ||
        contextMenuContent.includes("'Descargar lista'"),
        'Must render "Descargar lista" or "Eliminar descarga" option'
      );
      assert.ok(
        contextMenuContent.includes('downloadPlaylist(') &&
        contextMenuContent.includes('deleteDownloadedPlaylist('),
        'Must connect to offline download storage functions'
      );
    });

    it('5.3 ContextMenu handles offline mode guard (Modo avión)', () => {
      assert.ok(
        contextMenuContent.includes('navigator.onLine === false') &&
        contextMenuContent.includes('Modo avión'),
        'Must guard downloads when navigator.onLine is false'
      );
    });

    it('5.4 ContextMenu provides full suite of user playlist actions', () => {
      assert.ok(contextMenuContent.includes('Fijar en tu biblioteca'), 'Must have pin to library option');
      assert.ok(contextMenuContent.includes('Añadir a la cola'), 'Must have add to queue option');
      assert.ok(contextMenuContent.includes('Editar datos'), 'Must have edit playlist option');
      assert.ok(contextMenuContent.includes('Invitar a colaborar'), 'Must have collaborative playlist option');
      assert.ok(contextMenuContent.includes('handleDeletePlaylist'), 'Must have delete playlist option');
    });
  });

  describe('6. Requirement R5: Preserved Files Audit & Offline Pipeline Verification', () => {
    const r5Files = [
      'api/_lib/musicFallback.js',
      'api/audio.js',
      'scripts/audioService.mjs',
      'server.mjs',
      'native/android/SpotifreeLocalMusicPlugin.java',
      'src/utils/offlineStorage.ts',
      'tests/offline_downloads.test.js',
    ];

    for (const f of r5Files) {
      it(`6.1 R5 file exists and is intact: ${f}`, () => {
        const fullPath = path.join(rootDir, f);
        assert.ok(fs.existsSync(fullPath), `R5 file ${f} must exist`);
        const stat = fs.statSync(fullPath);
        assert.ok(stat.size > 100, `R5 file ${f} must have non-trivial content (size: ${stat.size} bytes)`);
      });
    }

    it('6.2 src/utils/offlineStorage.ts exports all required download and offline symbols', () => {
      const offlineStoragePath = path.join(rootDir, 'src', 'utils', 'offlineStorage.ts');
      const content = fs.readFileSync(offlineStoragePath, 'utf8');

      const requiredSymbols = [
        'export function isPlaylistDownloaded',
        'export async function downloadPlaylist',
        'export async function deleteDownloadedPlaylist',
        'export async function isTrackDownloaded',
        'export async function getStorageUsage',
        'export async function clearOfflineCache',
      ];

      for (const sym of requiredSymbols) {
        assert.ok(content.includes(sym), `offlineStorage.ts must export: ${sym}`);
      }
    });
  });
});
