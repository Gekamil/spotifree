import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

describe('Adversarial & Empirical Challenger M3: Desktop Settings, Playlists & Edge Cases', () => {
  const rootDir = process.cwd();
  const settingsPath = path.join(rootDir, 'src', 'components', 'desktop', 'DesktopSettingsView.tsx');
  const playlistPath = path.join(rootDir, 'src', 'components', 'desktop', 'DesktopPlaylistView.tsx');
  const contextMenuPath = path.join(rootDir, 'src', 'components', 'desktop', 'ContextMenu.tsx');
  const advancedSettingsPath = path.join(rootDir, 'src', 'components', 'common', 'AdvancedSettingsSection.tsx');

  const settingsSource = fs.readFileSync(settingsPath, 'utf8');
  const playlistSource = fs.readFileSync(playlistPath, 'utf8');
  const contextMenuSource = fs.readFileSync(contextMenuPath, 'utf8');
  const advancedSettingsSource = fs.readFileSync(advancedSettingsPath, 'utf8');

  // Parse TSX ASTs
  const settingsAST = ts.createSourceFile('DesktopSettingsView.tsx', settingsSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const playlistAST = ts.createSourceFile('DesktopPlaylistView.tsx', playlistSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const contextMenuAST = ts.createSourceFile('ContextMenu.tsx', contextMenuSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const advancedSettingsAST = ts.createSourceFile('AdvancedSettingsSection.tsx', advancedSettingsSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  // Helper: check if a node is a React hook call (starts with "use[A-Z]")
  function getHookCallName(node) {
    if (ts.isCallExpression(node)) {
      let calleeName = '';
      if (ts.isIdentifier(node.expression)) {
        calleeName = node.expression.text;
      } else if (ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.name)) {
        calleeName = node.expression.name.text;
      }
      if (/^use[A-Z]/.test(calleeName)) {
        return calleeName;
      }
    }
    return null;
  }

  describe('1. AST Analysis: React Component Structural Invariants & Rules of Hooks', () => {
    it('AdvancedSettingsSection: zero conditional or nested hook calls', () => {
      const violations = [];

      function checkNode(node, insideCondition = false) {
        let isCond = insideCondition;
        if (
          ts.isIfStatement(node) ||
          ts.isConditionalExpression(node) ||
          ts.isSwitchStatement(node) ||
          ts.isForStatement(node) ||
          ts.isWhileStatement(node)
        ) {
          isCond = true;
        }

        const hookName = getHookCallName(node);
        if (hookName && isCond) {
          const loc = advancedSettingsAST.getLineAndCharacterOfPosition(node.getStart());
          violations.push({ hook: hookName, line: loc.line + 1 });
        }

        ts.forEachChild(node, (child) => checkNode(child, isCond));
      }

      checkNode(advancedSettingsAST);
      assert.deepEqual(violations, [], `Found conditional hook calls in AdvancedSettingsSection: ${JSON.stringify(violations)}`);
    });

    it('ContextMenu: all hooks appear before the early return if (!contextMenu.isOpen)', () => {
      let earlyReturnLine = -1;
      const hookCalls = [];

      function visit(node) {
        if (ts.isIfStatement(node)) {
          const conditionText = node.expression.getText(contextMenuAST);
          if (conditionText.includes('!contextMenu.isOpen')) {
            earlyReturnLine = contextMenuAST.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          }
        }
        const hookName = getHookCallName(node);
        if (hookName) {
          const loc = contextMenuAST.getLineAndCharacterOfPosition(node.getStart());
          hookCalls.push({ hook: hookName, line: loc.line + 1 });
        }
        ts.forEachChild(node, visit);
      }

      visit(contextMenuAST);

      assert.ok(earlyReturnLine > 0, 'Could not locate early return if (!contextMenu.isOpen)');
      for (const h of hookCalls) {
        assert.ok(
          h.line < earlyReturnLine,
          `Hook "${h.hook}" at line ${h.line} is called AFTER early return at line ${earlyReturnLine}`
        );
      }
    });

    it('DesktopSettingsView: all hooks appear before the guest session early return', () => {
      let guestEarlyReturnLine = -1;
      const hookCalls = [];

      function visit(node) {
        if (ts.isIfStatement(node)) {
          const conditionText = node.expression.getText(settingsAST);
          if (conditionText.includes('isGuestInSession')) {
            guestEarlyReturnLine = settingsAST.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          }
        }
        const hookName = getHookCallName(node);
        if (hookName) {
          const loc = settingsAST.getLineAndCharacterOfPosition(node.getStart());
          hookCalls.push({ hook: hookName, line: loc.line + 1 });
        }
        ts.forEachChild(node, visit);
      }

      visit(settingsAST);

      assert.ok(guestEarlyReturnLine > 0, 'Could not locate early return if (isGuestInSession)');
      for (const h of hookCalls) {
        assert.ok(
          h.line < guestEarlyReturnLine,
          `Hook "${h.hook}" at line ${h.line} is called AFTER guest early return at line ${guestEarlyReturnLine}`
        );
      }
    });

    it('DesktopPlaylistView: all hooks appear before the early return if (isDJ)', () => {
      let isDJEarlyReturnLine = -1;
      const hookCalls = [];

      function visit(node) {
        if (ts.isIfStatement(node)) {
          const conditionText = node.expression.getText(playlistAST);
          if (conditionText.trim() === 'isDJ') {
            isDJEarlyReturnLine = playlistAST.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          }
        }
        const hookName = getHookCallName(node);
        if (hookName) {
          const loc = playlistAST.getLineAndCharacterOfPosition(node.getStart());
          hookCalls.push({ hook: hookName, line: loc.line + 1 });
        }
        ts.forEachChild(node, visit);
      }

      visit(playlistAST);

      assert.ok(isDJEarlyReturnLine > 0, 'Could not locate early return if (isDJ)');
      for (const h of hookCalls) {
        assert.ok(
          h.line < isDJEarlyReturnLine,
          `Hook "${h.hook}" at line ${h.line} is called AFTER isDJ early return at line ${isDJEarlyReturnLine}`
        );
      }
    });

    it('ContextMenu event lifecycle: cleans up mousedown and keydown event listeners on unmount/close', () => {
      assert.ok(
        contextMenuSource.includes("document.addEventListener('mousedown', handleClickOutside)") &&
        contextMenuSource.includes("document.removeEventListener('mousedown', handleClickOutside)"),
        'Must add and remove mousedown outside listener'
      );
      assert.ok(
        contextMenuSource.includes("document.addEventListener('keydown', handleKeyDown)") &&
        contextMenuSource.includes("document.removeEventListener('keydown', handleKeyDown)"),
        'Must add and remove keydown Escape listener'
      );
    });
  });

  describe('2. Flat Row Styling Consistency Across Desktop Settings & Subsections', () => {
    it('DesktopSettingsView renders the 8 Spotify canonical sections with flat row styling', () => {
      const requiredSections = [
        '1. CUENTA',
        '2. IDIOMA',
        '3. CALIDAD DE AUDIO Y ECUALIZADOR',
        '4. REPRODUCCIÓN',
        '5. VISUALIZACIÓN Y CONTENIDO',
        '6. TU BIBLIOTECA Y ARCHIVOS LOCALES',
        '7. ALMACENAMIENTO',
        '8. SOCIAL Y ACERCA DE',
      ];

      for (const section of requiredSections) {
        assert.ok(
          settingsSource.toUpperCase().includes(section),
          `DesktopSettingsView must contain section comment/header for ${section}`
        );
      }

      // Count occurrences of flat row divider border-b border-white/5
      const borderDivs = settingsSource.match(/border-b\s+border-white\/5/g) || [];
      assert.ok(
        borderDivs.length >= 12,
        `Expected at least 12 flat rows with "border-b border-white/5", found ${borderDivs.length}`
      );
    });

    it('AdvancedSettingsSection desktop variant applies border-b border-white/5 and avoids mobile card wrappers', () => {
      let desktopBlockText = '';
      function findIf(node) {
        if (ts.isIfStatement(node)) {
          if (node.expression.getText(advancedSettingsAST).includes('desktop')) {
            desktopBlockText = node.thenStatement.getText(advancedSettingsAST);
          }
        }
        ts.forEachChild(node, findIf);
      }
      findIf(advancedSettingsAST);

      assert.ok(desktopBlockText.length > 0, 'Must locate if (desktop) block via AST');
      assert.ok(
        desktopBlockText.includes('border-b border-white/5'),
        'AdvancedSettingsSection desktop mode must use flat row border-b border-white/5'
      );
      assert.ok(
        !desktopBlockText.includes('rounded-xl bg-[#181818]'),
        'AdvancedSettingsSection desktop mode must NOT use mobile card styling'
      );
    });

    it('AdvancedSettingsSection mobile fallback variant retains Spotify mobile card styling', () => {
      const mobileReturnIdx = advancedSettingsSource.lastIndexOf('return (');
      const mobileCode = advancedSettingsSource.substring(mobileReturnIdx);

      assert.ok(
        mobileCode.includes('rounded-xl bg-[#181818]'),
        'Mobile variant of AdvancedSettingsSection must preserve rounded card container'
      );
    });

    it('Accessibility roles: AdvancedSettingsSection provides radiogroup, radio, and switch roles', () => {
      assert.ok(advancedSettingsSource.includes('role="radiogroup"'), 'Must define role="radiogroup"');
      assert.ok(advancedSettingsSource.includes('role="radio"'), 'Must define role="radio"');
      assert.ok(advancedSettingsSource.includes('role="switch"'), 'Must define role="switch"');
      assert.ok(advancedSettingsSource.includes('aria-checked='), 'Must set aria-checked on interactive buttons');
    });
  });

  describe('3. Playlist View Scale & Stress Invariants (0, 1, 1000 tracks)', () => {
    // Exact simulation logic from DesktopPlaylistView
    function matchTrackId(a, b) {
      if (!a || !b) return false;
      const cleanA = a.replace(/^spotify:track:/i, '').split('?')[0].trim();
      const cleanB = b.replace(/^spotify:track:/i, '').split('?')[0].trim();
      return a === b || cleanA === cleanB || cleanA === b || a === cleanB;
    }

    function calculateTotalDuration(tracks) {
      const totalDurationMs = tracks.reduce((acc, t) => acc + (t.duration_ms || 0), 0);
      const totalMinutes = Math.floor(totalDurationMs / 60000);
      const totalHours = Math.floor(totalMinutes / 60);
      const remainingMinutes = totalMinutes % 60;
      return totalHours > 0 ? `${totalHours} h ${remainingMinutes} min` : `${totalMinutes} min`;
    }

    function simulateHandlePlayAll({ tracks, isPlaying: _isPlaying, currentTrack: _currentTrack, isCurrentPlaylistPlaying, loading, onToast, onTogglePlay, onPlayTrack }) {
      if (loading) {
        onToast('Cargando canciones de la lista...');
        return;
      }
      if (tracks.length === 0) {
        onToast('La lista no tiene canciones disponibles');
        return;
      }
      if (isCurrentPlaylistPlaying) {
        onTogglePlay();
      } else {
        const startTrack = tracks[0];
        onPlayTrack(startTrack, tracks);
      }
    }

    it('Scale: 0 tracks -> handlePlayAll alerts user without audio errors; duration is "0 min"', () => {
      const tracks = [];
      let toastMessage = null;
      let playTriggered = false;

      simulateHandlePlayAll({
        tracks,
        isPlaying: false,
        currentTrack: null,
        isCurrentPlaylistPlaying: false,
        loading: false,
        onToast: (msg) => { toastMessage = msg; },
        onTogglePlay: () => { playTriggered = true; },
        onPlayTrack: () => { playTriggered = true; }
      });

      assert.equal(toastMessage, 'La lista no tiene canciones disponibles');
      assert.equal(playTriggered, false, 'Audio playback must not be started for 0 tracks');
      assert.equal(calculateTotalDuration(tracks), '0 min');
    });

    it('Scale: 0 tracks while loading -> handlePlayAll informs user that songs are loading', () => {
      let toastMessage = null;
      simulateHandlePlayAll({
        tracks: [],
        isPlaying: false,
        currentTrack: null,
        isCurrentPlaylistPlaying: false,
        loading: true,
        onToast: (msg) => { toastMessage = msg; },
        onTogglePlay: () => {},
        onPlayTrack: () => {}
      });

      assert.equal(toastMessage, 'Cargando canciones de la lista...');
    });

    it('Scale: 0 tracks -> rotating track interval is cleanly skipped in code', () => {
      assert.ok(
        playlistSource.includes('if (!tracks || tracks.length <= 1 || isClipsModalOpen) return;'),
        'Rotating track interval must bail out if tracks.length <= 1'
      );
    });

    it('Scale: 1 track -> handlePlayAll starts track[0] and formats duration correctly', () => {
      const singleTrack = { id: 'track_1', name: 'Song 1', duration_ms: 215000, artists: [{ name: 'Artist A' }] };
      const tracks = [singleTrack];
      let playedTrack = null;

      simulateHandlePlayAll({
        tracks,
        isPlaying: false,
        currentTrack: null,
        isCurrentPlaylistPlaying: false,
        loading: false,
        onToast: () => {},
        onTogglePlay: () => {},
        onPlayTrack: (t) => { playedTrack = t; }
      });

      assert.equal(playedTrack?.id, 'track_1');
      assert.equal(calculateTotalDuration(tracks), '3 min');
    });

    it('Scale: 1000 tracks -> stress test search, sort, duration, and matchTrackId execute in < 30ms', () => {
      const tracks1000 = [];
      for (let i = 0; i < 1000; i++) {
        tracks1000.push({
          id: i % 2 === 0 ? `spotify:track:track_id_${i}` : `track_id_${i}`,
          name: `Track Number ${i} Title`,
          artists: [{ name: `Artist ${i % 50}` }],
          album: { name: `Album ${i % 100}` },
          duration_ms: 180000 + (i % 60) * 1000,
          added_at: new Date(1700000000000 + i * 3600000).toISOString(),
        });
      }

      // 1. Duration calculation performance
      const t0 = performance.now();
      const dur = calculateTotalDuration(tracks1000);
      const tDur = performance.now() - t0;
      assert.ok(dur.includes('h'), 'Duration for 1000 tracks should span multiple hours');
      assert.ok(tDur < 10, `Duration computation took ${tDur}ms, expected < 10ms`);

      // 2. Search query matching over 1000 tracks
      const t1 = performance.now();
      const query = 'Track Number 42';
      const searchResults = tracks1000.filter(
        (t) => t.name.toLowerCase().includes(query.toLowerCase()) || t.artists?.[0]?.name.toLowerCase().includes(query.toLowerCase())
      );
      const tSearch = performance.now() - t1;
      assert.ok(searchResults.length >= 1, 'Search query must find matches');
      assert.ok(tSearch < 10, `Search filtering took ${tSearch}ms, expected < 10ms`);

      // 3. Normalized ID match performance across 1000 tracks
      const currentTrack = { id: 'track_id_998' };
      const t2 = performance.now();
      const isMatch = tracks1000.some((t) => matchTrackId(t.id, currentTrack.id));
      const tMatch = performance.now() - t2;
      assert.equal(isMatch, true, 'Normalized matchTrackId must find track_id_998');
      assert.ok(tMatch < 10, `matchTrackId scanning took ${tMatch}ms, expected < 10ms`);

      // 4. Sorting 1000 tracks by Title
      const t3 = performance.now();
      const sortedByTitle = [...tracks1000].sort((a, b) => a.name.localeCompare(b.name));
      const tSort = performance.now() - t3;
      assert.equal(sortedByTitle.length, 1000);
      assert.ok(tSort < 50, `Sorting 1000 tracks took ${tSort}ms, expected < 50ms`);
    });
  });

  describe('4. Playlist Search Filter & Dedicated Empty Search State ("Borrar búsqueda")', () => {
    it('Search input includes clear button (X) when filterQuery is not empty', () => {
      assert.ok(
        playlistSource.includes("filterQuery && (") &&
        playlistSource.includes("onClick={() => setFilterQuery('')}"),
        'Must render clear button when filterQuery is active'
      );
      assert.ok(
        playlistSource.includes('title="Borrar búsqueda"') &&
        playlistSource.includes('aria-label="Borrar búsqueda"'),
        'Clear button must include descriptive title and aria-label'
      );
    });

    it('Search input handles Escape key to clear query and close filter', () => {
      assert.ok(
        playlistSource.includes("if (e.key === 'Escape')") &&
        playlistSource.includes("setFilterQuery('')") &&
        playlistSource.includes("setIsFilterOpen(false)"),
        'Escape keydown must clear filterQuery and close filter input'
      );
    });

    it('Search icon toggles filter input open/closed', () => {
      assert.ok(
        playlistSource.includes("onClick={() => setIsFilterOpen((v) => !v)}"),
        'Search button must toggle isFilterOpen state'
      );
    });

    it('Empty search state renders dedicated message and "Borrar búsqueda" button', () => {
      assert.ok(
        playlistSource.includes('No se han encontrado resultados para «{filterQuery.trim()}»'),
        'Must render "No se han encontrado resultados para «...»"'
      );
      assert.ok(
        playlistSource.includes('Comprueba que las palabras estén bien escritas o utiliza otras palabras clave.'),
        'Must render Spotify-style search hint'
      );
      assert.ok(
        playlistSource.includes('Borrar búsqueda'),
        'Must render "Borrar búsqueda" button'
      );
    });

    it('Search bar is hidden when dynamicTracks is empty', () => {
      assert.ok(
        playlistSource.includes('!isArtist && dynamicTracks.length > 0 && ('),
        'Search bar and sort menu must only render when playlist has tracks'
      );
    });
  });

  describe('5. ContextMenu & Download Playlist: Offline vs Online Guarding', () => {
    it('ContextMenu checks navigator.onLine === false and shows "Modo avión" toast without downloading', () => {
      assert.ok(
        contextMenuSource.includes("if (typeof navigator !== 'undefined' && navigator.onLine === false)"),
        'Must check navigator.onLine === false before triggering download'
      );
      assert.ok(
        contextMenuSource.includes("showGlobalToast('Modo avión: conéctate para descargar')"),
        'Must display "Modo avión: conéctate para descargar" toast'
      );
    });

    it('ContextMenu checks empty track list and shows toast before downloading', () => {
      assert.ok(
        contextMenuSource.includes("if (tracksToDownload.length === 0)"),
        'Must check if playlist tracks is empty before download'
      );
      assert.ok(
        contextMenuSource.includes("showGlobalToast('La lista no tiene canciones para descargar')"),
        'Must inform user when attempting to download an empty list'
      );
    });

    it('ContextMenu toggles between "Descargar lista" and "Eliminar descarga"', () => {
      assert.ok(
        contextMenuSource.includes("isPlaylistDownloaded(targetPlaylist.id) ? 'Eliminar descarga' : 'Descargar lista'"),
        'Must toggle menu label based on isPlaylistDownloaded'
      );
      assert.ok(
        contextMenuSource.includes("deleteDownloadedPlaylist(plId, tracksToDownload.map"),
        'Must call deleteDownloadedPlaylist when already downloaded'
      );
    });

    it('Offline state machine simulation: offline intercepts, online proceeds, downloaded deletes', async () => {
      let toastCalledWith = null;
      let downloadPlaylistCalled = false;
      let deletePlaylistCalled = false;

      const mockTargetPlaylist = {
        id: 'test-pl-123',
        name: 'Test Playlist',
        tracks: { items: [{ id: 't1' }, { id: 't2' }] }
      };

      async function simulateDownloadAction({ isOnline, isDownloaded, tracks }) {
        if (!tracks || tracks.length === 0) {
          toastCalledWith = 'La lista no tiene canciones para descargar';
          return;
        }
        if (isDownloaded) {
          deletePlaylistCalled = true;
          toastCalledWith = 'Descarga eliminada';
          return;
        }
        if (!isOnline) {
          toastCalledWith = 'Modo avión: conéctate para descargar';
          return;
        }
        downloadPlaylistCalled = true;
        toastCalledWith = `${tracks.length} canciones descargadas`;
      }

      // Case 1: Empty tracks
      await simulateDownloadAction({ isOnline: true, isDownloaded: false, tracks: [] });
      assert.equal(toastCalledWith, 'La lista no tiene canciones para descargar');

      // Case 2: Offline
      toastCalledWith = null;
      await simulateDownloadAction({ isOnline: false, isDownloaded: false, tracks: mockTargetPlaylist.tracks.items });
      assert.equal(toastCalledWith, 'Modo avión: conéctate para descargar');
      assert.equal(downloadPlaylistCalled, false);

      // Case 3: Online download
      toastCalledWith = null;
      await simulateDownloadAction({ isOnline: true, isDownloaded: false, tracks: mockTargetPlaylist.tracks.items });
      assert.equal(downloadPlaylistCalled, true);
      assert.equal(toastCalledWith, '2 canciones descargadas');

      // Case 4: Already downloaded -> delete
      toastCalledWith = null;
      await simulateDownloadAction({ isOnline: true, isDownloaded: true, tracks: mockTargetPlaylist.tracks.items });
      assert.equal(deletePlaylistCalled, true);
      assert.equal(toastCalledWith, 'Descarga eliminada');
    });
  });

  describe('6. Requirement R5: Preserved Files Forensic Integrity', () => {
    const preservedFiles = [
      'api/_lib/musicFallback.js',
      'api/audio.js',
      'scripts/audioService.mjs',
      'server.mjs',
      'native/android/SpotifreeLocalMusicPlugin.java',
      'src/utils/offlineStorage.ts',
      'tests/offline_downloads.test.js'
    ];

    it('All 7 R5 preserved files exist with valid non-zero content', () => {
      for (const relPath of preservedFiles) {
        const fullPath = path.join(rootDir, relPath);
        assert.ok(fs.existsSync(fullPath), `Preserved file must exist: ${relPath}`);
        const stat = fs.statSync(fullPath);
        assert.ok(stat.size > 100, `Preserved file must have content: ${relPath} (size: ${stat.size})`);
      }
    });

    it('offlineStorage.ts exports all required offline functions intact', () => {
      const offlineStoragePath = path.join(rootDir, 'src', 'utils', 'offlineStorage.ts');
      const content = fs.readFileSync(offlineStoragePath, 'utf8');

      const expectedExports = [
        'downloadPlaylist',
        'isPlaylistDownloaded',
        'deleteDownloadedPlaylist',
        'isTrackDownloaded',
        'getStorageUsage',
        'clearOfflineCache'
      ];

      for (const exp of expectedExports) {
        assert.ok(content.includes(exp), `offlineStorage.ts must export ${exp}`);
      }
    });
  });
});
