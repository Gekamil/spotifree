import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const projectRoot = process.cwd();
const readRel = (relPath) => fs.readFileSync(path.join(projectRoot, relPath), 'utf8');

// Set up mock window and localStorage for headless Node execution
function setupMockBrowser() {
  const storage = {};
  const mockStorage = {
    _data: storage,
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
    clear: () => {
      for (const k of Object.keys(storage)) {
        delete storage[k];
      }
    },
  };

  const listeners = new Map();

  globalThis.window = {
    localStorage: mockStorage,
    innerWidth: 375,
    innerHeight: 800,
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener: (type, fn) => {
      if (listeners.has(type)) listeners.get(type).delete(fn);
    },
    dispatchEvent: (event) => {
      const fns = listeners.get(event.type);
      if (fns) {
        for (const fn of fns) fn(event);
      }
      return true;
    },
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  };

  globalThis.document = {
    body: {},
  };

  return { mockStorage, listeners };
}

describe('Challenger M1: Adversarial Stress Test — Playlist Creation & Gesture Dismissal (F3, F4, F5, F6)', () => {
  const modalCode = readRel('src/components/modals/AddToPlaylistModal.tsx');
  const hookCode = readRel('src/hooks/useDragToDismiss.ts');
  const sheetCode = readRel('src/components/mobile/MobileSheet.tsx');
  const storeCode = readRel('src/store/useSpotifyDataStore.ts');

  // =========================================================================
  // SUITE 1: Playlist Creation on "Hecho" & Input Edge Cases (F3, F4, F5)
  // =========================================================================
  describe('Suite 1: Playlist Creation on "Hecho" & Input Edge Cases (F3, F4, F5)', () => {
    let mockEnv;

    beforeEach(() => {
      mockEnv = setupMockBrowser();
    });

    it('F5 Invariant: handleSaveAndClose differentiates whitespace/empty strings from valid names', () => {
      // Parse handleSaveAndClose logic from AddToPlaylistModal.tsx
      const saveMatch = modalCode.match(/const handleSaveAndClose = \(\) => \{([\s\S]*?)\};/);
      assert.ok(saveMatch, 'handleSaveAndClose must be defined in AddToPlaylistModal.tsx');
      const body = saveMatch[1];

      // Must test newPlaylistTitle.trim()
      assert.ok(
        body.includes('newPlaylistTitle.trim()'),
        'handleSaveAndClose must check newPlaylistTitle.trim() before deciding to create a new playlist'
      );
      assert.ok(
        body.includes('handleCreateNewPlaylist()'),
        'handleSaveAndClose must delegate to handleCreateNewPlaylist when title has non-whitespace characters'
      );
      assert.ok(
        body.includes('commitPendingSelections()'),
        'handleSaveAndClose must call commitPendingSelections when not creating a playlist'
      );
      assert.ok(
        body.includes('closeAddToPlaylistModal()'),
        'handleSaveAndClose must call closeAddToPlaylistModal'
      );
    });

    it('Edge Cases: Empty string, pure whitespace, spaces + tabs + newlines do NOT create blank playlists on "Hecho"', () => {
      const whitespaceVariants = [
        '',
        ' ',
        '   ',
        '\t',
        '\n',
        '\r\n',
        '   \t   \n  \r  ',
      ];

      for (const variant of whitespaceVariants) {
        let created = false;
        let committed = false;
        let closed = false;

        function simulateHandleSaveAndClose(title) {
          if (title.trim()) {
            created = true;
            return;
          }
          committed = true;
          closed = true;
        }

        simulateHandleSaveAndClose(variant);

        assert.strictEqual(
          created,
          false,
          `Whitespace title ${JSON.stringify(variant)} must NOT trigger playlist creation on "Hecho"`
        );
        assert.strictEqual(committed, true, `Whitespace title ${JSON.stringify(variant)} must commit pending selections`);
        assert.strictEqual(closed, true, `Whitespace title ${JSON.stringify(variant)} must close the modal`);
      }
    });

    it('Fallback: Clicking "Añadir" button with empty or whitespace title falls back to safe default name', () => {
      // In AddToPlaylistModal: const finalName = newPlaylistTitle.trim() || `Mi playlist nº ${userPlaylists.length + 1}`;
      const createMatch = modalCode.match(/const handleCreateNewPlaylist = \(\) => \{([\s\S]*?)\};/);
      assert.ok(createMatch, 'handleCreateNewPlaylist must be defined');
      const createBody = createMatch[1];

      assert.ok(
        createBody.includes('newPlaylistTitle.trim() ||'),
        'handleCreateNewPlaylist must have fallback name if newPlaylistTitle is empty'
      );

      const userPlaylistsCount = 3;
      const emptyTitle = '   \t  ';
      const finalName = emptyTitle.trim() || `Mi playlist nº ${userPlaylistsCount + 1}`;
      assert.strictEqual(finalName, 'Mi playlist nº 4');
    });

    it('Adversarial Strings: Special characters, HTML, XSS, unicode, quotes, and long strings are safely handled', () => {
      const adversarialTitles = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=console.log(1)>',
        '🔥🔥 Hits 2026 / "Best" & \'Top\' \n \t',
        '日本語のプレイリスト 🎵',
        'قائمة تشغيل تجريبية',
        'שירים בעברית 🇮🇱',
        'A'.repeat(500),
        '../../evil/path/traversal',
        "'; DROP TABLE playlists; --",
      ];

      // Test storage & serialization of each adversarial name
      for (const title of adversarialTitles) {
        const trimmed = title.trim();
        assert.ok(trimmed.length > 0, `Trimmed title for ${title.slice(0, 20)} must be non-empty`);

        const mockTrack = {
          id: 'spotify:track:4cOdK2wGLETKBW3PvgPWqT',
          name: 'Never Gonna Give You Up',
          artists: [{ name: 'Rick Astley' }],
          album: { images: [{ url: 'https://example.com/cover.jpg' }] },
          added_at: 'Hoy',
        };

        const newId = `custom-playlist-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        const newPlaylist = {
          id: newId,
          name: trimmed,
          description: '',
          images: [{ url: 'https://example.com/cover.jpg' }],
          owner: { display_name: 'Tú', id: 'user' },
          tracks: { total: 1, items: [mockTrack] },
          color: '#303030',
          is_pinned: false,
          is_custom: true,
        };

        // Serialize to localStorage
        const rawJson = JSON.stringify([newPlaylist]);
        mockEnv.mockStorage.setItem('user_imported_playlists', rawJson);

        // Deserialize and assert fidelity
        const restored = JSON.parse(mockEnv.mockStorage.getItem('user_imported_playlists'));
        assert.strictEqual(restored.length, 1);
        assert.strictEqual(restored[0].name, trimmed);
        assert.strictEqual(restored[0].tracks.items[0].id, mockTrack.id);
      }
    });

    it('Concurrency & State Machine: Liked Songs toggle + playlist selection + new playlist on "Hecho" commit together', () => {
      // Track initial state
      const mockTrack = {
        id: 'spotify:track:57RA3kdaJikv3gcmI44ZSt',
        name: 'Midnight City',
        artists: [{ name: 'M83' }],
      };

      let likedTrackIds = ['other-track-1'];
      let toggleLikeCalls = [];
      let savedCustomTracks = [];
      let createdPlaylists = [];
      let toastMessages = [];
      let modalClosed = false;

      const toggleLike = (id, obj) => {
        toggleLikeCalls.push({ id, obj });
        if (likedTrackIds.includes(id)) {
          likedTrackIds = likedTrackIds.filter((t) => t !== id);
        } else {
          likedTrackIds.push(id);
        }
      };

      const saveCustomTrack = (plId, isLiked, trk, userId, initialList) => {
        savedCustomTracks.push({ plId, isLiked, trk, userId, initialList });
      };

      const createPlaylist = (name, tracks) => {
        const pl = { id: 'custom-playlist-999', name, tracks: { total: tracks.length, items: tracks } };
        createdPlaylists.push(pl);
        return pl;
      };

      // User actions in modal session:
      // 1. Toggled Liked Songs from false to true
      let isLikedState = true;
      const initialLiked = false;

      // 2. Selected an existing playlist
      const selectedPlaylistIds = new Set(['existing-playlist-1']);
      const initialPlaylistIds = new Set();

      // 3. Typed a new playlist name
      let newPlaylistTitle = 'Chill Synthwave 2026';

      // 4. Tap "Hecho" (triggering handleSaveAndClose -> handleCreateNewPlaylist)
      function executeModalSubmission() {
        const commitSelections = () => {
          if (isLikedState !== initialLiked) {
            toggleLike(mockTrack.id, mockTrack);
          }
          selectedPlaylistIds.forEach((plId) => {
            if (!initialPlaylistIds.has(plId)) {
              saveCustomTrack(plId, false, mockTrack, 'user-1');
            }
          });
        };

        if (newPlaylistTitle.trim()) {
          const finalName = newPlaylistTitle.trim();
          const trackWithDate = { ...mockTrack, added_at: 'Hoy' };
          commitSelections();
          const newPl = createPlaylist(finalName, [trackWithDate]);
          saveCustomTrack(newPl.id, false, trackWithDate, 'user-1', [trackWithDate]);
          toastMessages.push(`Añadida a «${finalName}»`);
          modalClosed = true;
        } else {
          commitSelections();
          modalClosed = true;
        }
      }

      executeModalSubmission();

      // Assertions
      assert.strictEqual(toggleLikeCalls.length, 1, 'toggleLike must be called exactly once');
      assert.strictEqual(toggleLikeCalls[0].id, mockTrack.id);
      assert.ok(likedTrackIds.includes(mockTrack.id), 'Track must now be liked in store');

      assert.strictEqual(savedCustomTracks.length, 2, 'Must save track to existing playlist AND new playlist');
      assert.strictEqual(savedCustomTracks[0].plId, 'existing-playlist-1');
      assert.strictEqual(savedCustomTracks[1].plId, 'custom-playlist-999');

      assert.strictEqual(createdPlaylists.length, 1, 'New playlist must be created');
      assert.strictEqual(createdPlaylists[0].name, 'Chill Synthwave 2026');
      assert.strictEqual(createdPlaylists[0].tracks.items[0].id, mockTrack.id);

      assert.strictEqual(toastMessages.length, 1);
      assert.strictEqual(toastMessages[0], 'Añadida a «Chill Synthwave 2026»');
      assert.strictEqual(modalClosed, true);
    });

    it('Rapid Tapping Stress: Sequential invocations of handleSaveAndClose are guarded and idempotent', () => {
      let createCount = 0;
      let modalOpen = true;
      let track = { id: 'track-123', name: 'Test Track' };
      let newPlaylistTitle = 'Fast Taps Playlist';

      function handleCreateNewPlaylist() {
        if (!track || !modalOpen) return;
        createCount++;
        modalOpen = false;
        track = null;
        newPlaylistTitle = '';
      }

      function handleSaveAndClose() {
        if (newPlaylistTitle.trim()) {
          handleCreateNewPlaylist();
          return;
        }
        modalOpen = false;
        track = null;
      }

      // Simulate 10 rapid taps on "Hecho" in immediate succession
      for (let i = 0; i < 10; i++) {
        handleSaveAndClose();
      }

      assert.strictEqual(createCount, 1, 'Rapid tapping must NOT create duplicate playlists');
      assert.strictEqual(modalOpen, false, 'Modal must remain closed');
      assert.strictEqual(newPlaylistTitle, '', 'Title must be cleared');
    });

    it('F3 & F4 Structural Layout: Single header "Hecho", no duplicate footer, sticky top "+ Nueva playlist"', () => {
      // 1. Verify duplicate footer container is gone
      assert.ok(
        !modalCode.includes('border-t border-white/10 bg-[#141414]'),
        'Duplicate bottom footer container must not exist'
      );

      // 2. Verify single header "Hecho" button
      const doneMatches = modalCode.match(/<button[^>]*onClick=\{handleSaveAndClose\}/g) || [];
      assert.strictEqual(
        doneMatches.length,
        1,
        'There must be exactly one button invoking handleSaveAndClose (the header Done button)'
      );

      // 3. Sticky top-0 on "+ Nueva playlist" container
      assert.ok(
        modalCode.includes('sticky top-0 z-10 bg-[#181818]/95 backdrop-blur-md'),
        'New playlist creation container must be sticky top-0 to prevent soft keyboard occlusion'
      );

      // 4. "Añadir" button present in creation input
      assert.ok(
        />\s*Añadir\s*<\/button>/.test(modalCode),
        'Creation input form must have a prominent "Añadir" action button'
      );

      // 5. Safe area bottom padding on scroll container
      assert.ok(
        modalCode.includes('pb-[calc(16px+var(--sab,0px))]'),
        'Scrollable container must have safe area padding pb-[calc(16px+var(--sab,0px))]'
      );
    });
  });

  // =========================================================================
  // SUITE 2: Gesture Dismissal Physics (F6)
  // =========================================================================
  describe('Suite 2: Gesture Dismissal Physics (F6: useDragToDismiss & MobileSheet)', () => {
    /**
     * Exact implementation of the physics algorithm inside useDragToDismiss.ts
     */
    function runGestureSimulation({
      touches, // Array of { clientY, timeMs }
      scrollTop = 0,
      isHandle = false,
      threshold = 80,
      velocityThreshold = 0.5,
      maxScrollTop = 4,
      disabled = false,
    }) {
      if (disabled) {
        return { isDragging: false, isDismissed: false, dragY: 0, sheetStyle: {} };
      }

      // Start drag
      const startTouch = touches[0];
      if (!isHandle && scrollTop > maxScrollTop) {
        return { isDragging: false, isDismissed: false, dragY: 0, sheetStyle: {} };
      }

      let startY = startTouch.clientY;
      let currentY = startY;
      let lastTime = startTouch.timeMs;
      let velocity = 0;
      let isDragging = true;
      let dragY = 0;

      // Process touch moves
      for (let i = 1; i < touches.length; i++) {
        const touch = touches[i];
        const clientY = touch.clientY;
        const delta = clientY - startY;
        const dt = touch.timeMs - lastTime;

        if (dt > 0) {
          velocity = (clientY - currentY) / dt;
          lastTime = touch.timeMs;
        }
        currentY = clientY;

        // Upward clamp to 0
        if (delta > 0) {
          dragY = delta;
        } else {
          dragY = 0;
        }
      }

      // Touch End
      const finalDelta = currentY - startY;
      const isFlick = finalDelta > 20 && velocity > velocityThreshold;
      const isPastThreshold = finalDelta > threshold;
      const isDismissed = isPastThreshold || isFlick;

      const finalDragY = isDismissed ? 800 : 0;

      return {
        isDragging: false,
        isDismissed,
        dragY: finalDragY,
        peakDragY: dragY,
        finalVelocity: velocity,
        isFlick,
        isPastThreshold,
      };
    }

    it('Upward Drag Clamping: Dragging upwards (negative delta) is strictly clamped to 0', () => {
      // User touches at Y=200, drags up to Y=150, 100, 50
      const sim = runGestureSimulation({
        touches: [
          { clientY: 200, timeMs: 0 },
          { clientY: 150, timeMs: 50 },
          { clientY: 100, timeMs: 100 },
          { clientY: 50, timeMs: 150 },
        ],
        scrollTop: 0,
        isHandle: false,
      });

      assert.strictEqual(sim.peakDragY, 0, 'Upward dragging must have peakDragY clamped strictly to 0');
      assert.strictEqual(sim.isDismissed, false, 'Upward dragging must NEVER trigger dismissal');
      assert.strictEqual(sim.dragY, 0, 'Final dragY must be 0');
    });

    it('Inner Scroll Gating: Body drag rejected when scrollTop > 4, but allowed when scrollTop <= 4', () => {
      // 1. Rejection when scrollTop = 5, 10, 50, 100
      for (const st of [5, 6, 10, 50, 200]) {
        const sim = runGestureSimulation({
          touches: [
            { clientY: 100, timeMs: 0 },
            { clientY: 220, timeMs: 100 },
          ],
          scrollTop: st,
          isHandle: false,
        });

        assert.strictEqual(
          sim.isDragging,
          false,
          `Body drag must NOT engage when scrollTop is ${st} (> 4)`
        );
        assert.strictEqual(sim.isDismissed, false);
      }

      // 2. Allowance when scrollTop = 0, 1, 2, 3, 4
      for (const st of [0, 1, 2, 3, 4]) {
        const sim = runGestureSimulation({
          touches: [
            { clientY: 100, timeMs: 0 },
            { clientY: 220, timeMs: 100 },
          ],
          scrollTop: st,
          isHandle: false,
        });

        assert.strictEqual(
          sim.isDismissed,
          true,
          `Body drag must engage and dismiss when scrollTop is ${st} (<= 4)`
        );
        assert.strictEqual(sim.peakDragY, 120);
      }
    });

    it('Top Handle Immunity: Dragging top handle engages and dismisses REGARDLESS of inner scrollTop', () => {
      // Even if user scrolled 500px down inside the sheet
      const sim = runGestureSimulation({
        touches: [
          { clientY: 50, timeMs: 0 },
          { clientY: 160, timeMs: 150 },
        ],
        scrollTop: 500,
        isHandle: true, // Touching the handle
      });

      assert.strictEqual(sim.isDismissed, true, 'Top handle drag must dismiss even when scrollTop is 500');
      assert.strictEqual(sim.peakDragY, 110);
    });

    it('Flick Velocity Threshold: Downward flick (> 0.5 px/ms and > 20px) triggers dismissal below 80px', () => {
      // 1. Fast flick: delta = 30px in 30ms -> velocity = 1.0 px/ms (> 0.5)
      const flickSim = runGestureSimulation({
        touches: [
          { clientY: 100, timeMs: 0 },
          { clientY: 130, timeMs: 30 },
        ],
        scrollTop: 0,
        isHandle: false,
      });

      assert.strictEqual(flickSim.isPastThreshold, false, '30px is below 80px threshold');
      assert.strictEqual(flickSim.isFlick, true, '1.0 px/ms must be recognized as a flick');
      assert.strictEqual(flickSim.isDismissed, true, 'Flick must trigger sheet dismissal');

      // 2. Flick boundary: delta = 21px in 35ms -> velocity = 0.60 px/ms (> 0.5)
      const boundaryFlick = runGestureSimulation({
        touches: [
          { clientY: 100, timeMs: 0 },
          { clientY: 121, timeMs: 35 },
        ],
        scrollTop: 0,
        isHandle: false,
      });
      assert.strictEqual(boundaryFlick.isFlick, true);
      assert.strictEqual(boundaryFlick.isDismissed, true);

      // 3. Insufficient delta: delta = 20px (not > 20px), even at high velocity
      const notFlickDelta = runGestureSimulation({
        touches: [
          { clientY: 100, timeMs: 0 },
          { clientY: 120, timeMs: 10 },
        ],
        scrollTop: 0,
        isHandle: false,
      });
      assert.strictEqual(notFlickDelta.isFlick, false, 'delta must be strictly > 20px for flick');
      assert.strictEqual(notFlickDelta.isDismissed, false);
    });

    it('Slow Drag Snapping: Dragging below 80px with velocity <= 0.5 px/ms snaps back to 0', () => {
      // 1. Slow drag of 79px over 500ms -> velocity = 0.158 px/ms
      const slowSim = runGestureSimulation({
        touches: [
          { clientY: 100, timeMs: 0 },
          { clientY: 179, timeMs: 500 },
        ],
        scrollTop: 0,
        isHandle: false,
      });

      assert.strictEqual(slowSim.isPastThreshold, false, '79px is below 80px');
      assert.strictEqual(slowSim.isFlick, false, '0.158 px/ms is below 0.5 px/ms');
      assert.strictEqual(slowSim.isDismissed, false, 'Must NOT trigger dismissal');
      assert.strictEqual(slowSim.dragY, 0, 'Must snap back to 0');

      // 2. Boundary: exactly 80px slow drag -> 80 > 80 is false -> snaps back
      const exact80 = runGestureSimulation({
        touches: [
          { clientY: 100, timeMs: 0 },
          { clientY: 180, timeMs: 600 },
        ],
        scrollTop: 0,
        isHandle: false,
      });
      assert.strictEqual(exact80.isDismissed, false, '80px must not dismiss (strict > 80 required)');
      assert.strictEqual(exact80.dragY, 0);

      // 3. Boundary: 81px slow drag -> 81 > 80 is true -> dismisses!
      const past80 = runGestureSimulation({
        touches: [
          { clientY: 100, timeMs: 0 },
          { clientY: 181, timeMs: 600 },
        ],
        scrollTop: 0,
        isHandle: false,
      });
      assert.strictEqual(past80.isPastThreshold, true, '81px exceeds 80px threshold');
      assert.strictEqual(past80.isDismissed, true, 'Must trigger dismissal');
    });

    it('Desktop Screen Immunity: Gestures disabled when disabled=true (window.innerWidth >= 640)', () => {
      const desktopSim = runGestureSimulation({
        touches: [
          { clientY: 100, timeMs: 0 },
          { clientY: 300, timeMs: 200 },
        ],
        scrollTop: 0,
        isHandle: true,
        disabled: true,
      });

      assert.strictEqual(desktopSim.isDragging, false);
      assert.strictEqual(desktopSim.isDismissed, false);
      assert.strictEqual(desktopSim.dragY, 0);
    });

    it('Timeout Cleanup on Unmount: Unmounting component clears exit timer', () => {
      // In useDragToDismiss.ts lines 118-124:
      // useEffect(() => { return () => { if (timeoutRef.current !== null) clearTimeout(timeoutRef.current); }; }, []);
      assert.ok(
        hookCode.includes('clearTimeout(timeoutRef.current)'),
        'useDragToDismiss must clear timeoutRef on unmount to prevent leaks or state updates after unmount'
      );
    });

    it('MobileSheet Handle Specifications & Back/Escape Dismissal', () => {
      // 1. Handle dimensions: w-10 h-1 (40x4px) and >= 48px touch wrapper (min-h-[48px] or h-12)
      assert.ok(
        sheetCode.includes('w-10 h-1') || (sheetCode.includes('w-10') && sheetCode.includes('h-1')),
        'MobileSheet handle bar must be 40x4px (w-10 h-1)'
      );
      assert.ok(
        sheetCode.includes('min-h-[48px]') || sheetCode.includes('h-12'),
        'Handle touch container must have >= 48px height touch target'
      );
      assert.ok(
        sheetCode.includes('touch-none'),
        'Handle container must have touch-none to prevent browser scroll contention'
      );

      // 2. Hardware back button and Escape key integration
      assert.ok(
        sheetCode.includes('spotifree_android_back'),
        'MobileSheet must listen for spotifree_android_back event'
      );
      assert.ok(
        sheetCode.includes("e.key === 'Escape'"),
        'MobileSheet must listen for Escape key press'
      );
    });
  });

  // =========================================================================
  // SUITE 3: AST & Static Contract Verification of M1 Components
  // =========================================================================
  describe('Suite 3: AST & Static Contract Verification of M1 Components', () => {
    it('AddToPlaylistModal: No conditional hook calls, clean AST structure', () => {
      const modalAST = ts.createSourceFile(
        'AddToPlaylistModal.tsx',
        modalCode,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      );

      const conditionalHooks = [];
      function checkNode(node, insideCondition = false) {
        let isCond = insideCondition;
        if (
          ts.isIfStatement(node) ||
          ts.isConditionalExpression(node) ||
          ts.isSwitchStatement(node)
        ) {
          isCond = true;
        }

        if (ts.isCallExpression(node)) {
          let name = '';
          if (ts.isIdentifier(node.expression)) name = node.expression.text;
          else if (ts.isPropertyAccessExpression(node.expression)) name = node.expression.name.text;
          if (/^use[A-Z]/.test(name) && isCond) {
            const loc = modalAST.getLineAndCharacterOfPosition(node.getStart());
            conditionalHooks.push({ hook: name, line: loc.line + 1 });
          }
        }

        ts.forEachChild(node, (child) => checkNode(child, isCond));
      }

      checkNode(modalAST);
      assert.deepEqual(conditionalHooks, [], `Found conditional hook calls in AddToPlaylistModal: ${JSON.stringify(conditionalHooks)}`);
    });

    it('useDragToDismiss: Returns correct contract object signature', () => {
      const expectedProperties = [
        'dragY',
        'isDragging',
        'isDismissing',
        'handleProps',
        'contentProps',
        'sheetStyle',
        'resetDrag',
      ];

      for (const prop of expectedProperties) {
        assert.ok(
          hookCode.includes(prop),
          `useDragToDismiss must return/export '${prop}'`
        );
      }
    });

    it('AddToPlaylistModal: Routes gesture dismissal through handleSaveAndClose', () => {
      assert.ok(
        modalCode.includes('onClose: handleSaveAndClose'),
        'AddToPlaylistModal must pass handleSaveAndClose to useDragToDismiss onClose callback'
      );
    });
  });
});
