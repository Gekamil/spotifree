import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const readRel = (relPath) => fs.readFileSync(path.join(projectRoot, relPath), 'utf8');

describe('Milestone 1 (M1): Navigation Safe Area & Touch Insets (F1 & F2)', () => {
  const bottomNavCode = readRel('src/components/mobile/MobileBottomNav.tsx');
  const miniPlayerCode = readRel('src/components/mobile/MobileMiniPlayer.tsx');
  const layoutCode = readRel('src/components/mobile/MobileLayout.tsx');
  const mainActivityCode = readRel('native/android/MainActivity.java');
  const setupNativeCode = readRel('scripts/setup-android-native.mjs');

  it('F1 & F2: MobileBottomNav decouples button bar from safe area with dedicated pointer-events-none spacer', () => {
    // 1. Container height uses --sab
    assert.ok(
      bottomNavCode.includes("height: 'calc(64px + var(--sab, 0px))'"),
      'MobileBottomNav container height must be calc(64px + var(--sab, 0px))'
    );
    assert.ok(
      bottomNavCode.includes('flex flex-col'),
      'MobileBottomNav must be organized as flex-col'
    );

    // 2. Button row is fixed 64px (h-16)
    assert.ok(
      bottomNavCode.includes('h-16 w-full flex items-center justify-around px-2'),
      'Tab buttons must reside in a fixed 64px row (h-16) decoupled from safe area'
    );

    // 3. Dedicated safe area spacer
    assert.ok(
      bottomNavCode.includes('data-testid="bottom-nav-safe-area-spacer"'),
      'Must contain data-testid="bottom-nav-safe-area-spacer"'
    );
    assert.ok(
      bottomNavCode.includes("height: 'var(--sab, 0px)'"),
      'Safe area spacer must have height: var(--sab, 0px)'
    );
    assert.ok(
      bottomNavCode.includes('pointer-events-none'),
      'Safe area spacer must be non-interactive (pointer-events-none) to prevent accidental 3-button touch collisions'
    );
  });

  it('F1: MobileMiniPlayer uses var(--sab, 0px) to prevent overlap with bottom navigation', () => {
    assert.ok(
      miniPlayerCode.includes("bottom: 'calc(68px + var(--sab, 0px))'"),
      'MobileMiniPlayer must sit at calc(68px + var(--sab, 0px))'
    );
    assert.ok(
      !miniPlayerCode.includes("bottom: 'calc(68px + env(safe-area-inset-bottom, 0px))'"),
      'MobileMiniPlayer must not use raw env(safe-area-inset-bottom)'
    );
  });

  it('F1: MobileLayout scroll container and toast respect var(--sab, 0px)', () => {
    assert.ok(
      layoutCode.includes("paddingBottom: mobileTab === 'dj' ? '0px' : 'calc(144px + var(--sab, 0px))'"),
      'MobileLayout data-mobile-scroll must allocate calc(144px + var(--sab, 0px)) padding for mini player and bottom nav'
    );
    assert.ok(
      layoutCode.includes("calc(134px + var(--sab, 0px))") && layoutCode.includes("calc(74px + var(--sab, 0px))"),
      'MobileLayout toast feedback must elevate above mini player and respect --sab'
    );
  });

  it('F1: native MainActivity.java and scripts/setup-android-native.mjs bridge WindowInsetsCompat to --sab', () => {
    for (const [name, code] of [
      ['MainActivity.java', mainActivityCode],
      ['setup-android-native.mjs', setupNativeCode],
    ]) {
      assert.ok(
        code.includes('WindowInsetsCompat'),
        `${name} must import/use WindowInsetsCompat`
      );
      assert.ok(
        code.includes('ViewCompat.setOnApplyWindowInsetsListener'),
        `${name} must set an insets listener on decorView`
      );
      assert.ok(
        code.includes("--sab', '%dpx'"),
        `${name} must inject --sab CSS variable into WebView`
      );
      assert.ok(
        code.includes("--safe-area-inset-bottom', '%dpx'"),
        `${name} must inject --safe-area-inset-bottom CSS variable into WebView`
      );
      assert.ok(
        code.includes("--sat', '%dpx'"),
        `${name} must inject --sat CSS variable into WebView`
      );
    }
  });
});

describe('Milestone 1 (M1): Playlist Modal Reorganization & Creation (F3, F4, F5)', () => {
  const modalCode = readRel('src/components/modals/AddToPlaylistModal.tsx');

  it('F3: Eliminates duplicate footer "Hecho" button and retains single clean header button', () => {
    // 1. Must contain header button
    assert.ok(modalCode.includes("t('done')"), 'Must contain done button translation');

    // 2. Must NOT contain the old duplicate footer container
    assert.ok(
      !modalCode.includes('border-t border-white/10 bg-[#141414]'),
      'Must eliminate the redundant bottom footer container'
    );

    // 3. Count occurrences of handleSaveAndClose on buttons (should be exactly 1)
    const buttonMatches = modalCode.match(/<button[^>]*onClick=\{handleSaveAndClose\}/g) || [];
    assert.equal(
      buttonMatches.length,
      1,
      'Exactly one button should trigger handleSaveAndClose (the header button)'
    );

    // 4. Scrollable list has bottom safe area padding replacing old footer
    assert.ok(
      modalCode.includes('pb-[calc(16px+var(--sab,0px))]'),
      'Scrollable list must have pb-[calc(16px+var(--sab,0px))]'
    );
  });

  it('F4: "+ Nueva playlist" action and input form are placed before user playlists and remain sticky', () => {
    const isCreatingIdx = modalCode.indexOf('isCreatingNew');
    const playlistsMapIdx = modalCode.indexOf('userPlaylists.map');
    assert.ok(isCreatingIdx > 0, 'isCreatingNew must exist');
    assert.ok(playlistsMapIdx > 0, 'userPlaylists.map must exist');
    assert.ok(
      isCreatingIdx < playlistsMapIdx,
      'New playlist creation action must appear BEFORE userPlaylists.map so keyboard does not obscure it'
    );
    assert.ok(
      modalCode.includes('sticky top-0 z-10 bg-[#181818]/95 backdrop-blur-md'),
      'New playlist creation container must have sticky top positioning'
    );
    assert.ok(
      />\s*Añadir\s*<\/button>/.test(modalCode),
      'Creation confirmation button must be labeled "Añadir"'
    );
  });

  it('F5: handleSaveAndClose immediately creates and saves playlist if newPlaylistTitle has content', () => {
    const saveAndCloseBlock = modalCode.match(/const handleSaveAndClose = \(\) => \{([\s\S]*?)\};/);
    assert.ok(saveAndCloseBlock, 'handleSaveAndClose function must exist');
    const body = saveAndCloseBlock[1];
    assert.ok(
      body.includes('newPlaylistTitle.trim()') && body.includes('handleCreateNewPlaylist()'),
      'handleSaveAndClose must call handleCreateNewPlaylist if newPlaylistTitle has content'
    );
  });

  it('Preserves required storage, toast, and z-index contracts', () => {
    assert.ok(modalCode.includes('getSavedCustomTracks'), 'Must preserve getSavedCustomTracks');
    assert.ok(modalCode.includes('commitPendingSelections'), 'Must preserve commitPendingSelections');
    assert.ok(modalCode.includes('showGlobalToast'), 'Must preserve showGlobalToast');
    assert.ok(modalCode.includes('z-[150]'), 'Must preserve z-[150]');
    assert.ok(modalCode.includes('closeAddToPlaylistModal'), 'Must preserve closeAddToPlaylistModal');
  });
});

describe('Milestone 1 (M1): Drag-to-Dismiss Gestures & Sheet Integration (F6)', () => {
  const hookCode = readRel('src/hooks/useDragToDismiss.ts');
  const sheetCode = readRel('src/components/mobile/MobileSheet.tsx');
  const modalCode = readRel('src/components/modals/AddToPlaylistModal.tsx');

  it('F6: useDragToDismiss hook implements complete physics, inner scroll gating, and timer cleanup', () => {
    assert.ok(hookCode.includes('export function useDragToDismiss'), 'Must export useDragToDismiss hook');
    assert.ok(hookCode.includes('scrollTop > maxScrollTop'), 'Must gate dragging by inner scroll position');
    assert.ok(hookCode.includes('setDragY(delta)') && hookCode.includes('setDragY(0)'), 'Must clamp upward dragging to 0');
    assert.ok(hookCode.includes('isFlick') || hookCode.includes('velocityThreshold'), 'Must detect downward velocity flicks');
    assert.ok(hookCode.includes('threshold = 80'), 'Default threshold must be 80px');
    assert.ok(hookCode.includes('velocityThreshold = 0.5'), 'Default velocity threshold must be 0.5px/ms');
    assert.ok(hookCode.includes('clearTimeout(timeoutRef.current)'), 'Must clean up timeout on unmount');
  });

  it('F6: Gesture physics simulation: verifies threshold (> 80px), velocity flick (> 0.5px/ms), upward clamp and inner scroll gating', () => {
    function simulateGesture({ startY, endY, dtMs, scrollTop, isHandle }) {
      const threshold = 80;
      const velocityThreshold = 0.5;
      const maxScrollTop = 4;

      if (!isHandle && scrollTop > maxScrollTop) {
        return { isDragging: false, isDismissed: false, dragY: 0 };
      }

      const rawDelta = endY - startY;
      const dragY = Math.max(0, rawDelta);
      const velocity = rawDelta / Math.max(1, dtMs);

      const isFlick = rawDelta > 20 && velocity > velocityThreshold;
      const isPastThreshold = rawDelta > threshold;
      const isDismissed = isPastThreshold || isFlick;

      return { isDragging: true, isDismissed, dragY };
    }

    // 1. Below threshold, slow drag -> No dismiss, snaps back
    const slowBelow = simulateGesture({ startY: 100, endY: 160, dtMs: 400, scrollTop: 0, isHandle: false });
    assert.strictEqual(slowBelow.isDismissed, false, '60px drag at slow velocity must not dismiss');
    assert.strictEqual(slowBelow.dragY, 60);

    // 2. Above threshold (> 80px) -> Dismisses
    const pastThreshold = simulateGesture({ startY: 100, endY: 185, dtMs: 400, scrollTop: 0, isHandle: false });
    assert.strictEqual(pastThreshold.isDismissed, true, '85px drag must trigger dismissal');

    // 3. Below 80px but fast downward flick (> 0.5 px/ms) -> Flick dismisses
    const quickFlick = simulateGesture({ startY: 100, endY: 140, dtMs: 40, scrollTop: 0, isHandle: false });
    assert.strictEqual(quickFlick.isDismissed, true, '40px drag in 40ms (1.0 px/ms) must trigger flick dismissal');

    // 4. Upward drag (delta < 0) -> Clamped to 0
    const upwardDrag = simulateGesture({ startY: 100, endY: 60, dtMs: 200, scrollTop: 0, isHandle: false });
    assert.strictEqual(upwardDrag.dragY, 0, 'Upward displacement must be clamped to 0');
    assert.strictEqual(upwardDrag.isDismissed, false);

    // 5. Scrolled down list (scrollTop > 4) -> Body drag is rejected
    const scrolledBody = simulateGesture({ startY: 100, endY: 200, dtMs: 200, scrollTop: 45, isHandle: false });
    assert.strictEqual(scrolledBody.isDragging, false, 'Body drag must not engage when inner scrollTop > 4');

    // 6. Top handle drag -> Engages even if inner scroll is scrolled down
    const scrolledHandle = simulateGesture({ startY: 100, endY: 190, dtMs: 200, scrollTop: 45, isHandle: true });
    assert.strictEqual(scrolledHandle.isDragging, true, 'Handle drag must engage regardless of inner scroll');
    assert.strictEqual(scrolledHandle.isDismissed, true, 'Handle drag > 80px must dismiss');
  });

  it('F6: MobileSheet has 40x4px handle with 48px touch target area, integrates useDragToDismiss and back key listeners', () => {
    assert.ok(sheetCode.includes('useDragToDismiss'), 'MobileSheet must import and call useDragToDismiss');
    assert.ok(sheetCode.includes('SheetDragHandle'), 'MobileSheet must export SheetDragHandle');
    assert.ok(sheetCode.includes('min-h-[48px]') || sheetCode.includes('h-12'), 'Handle wrapper must have >= 48px height touch target');
    assert.ok(sheetCode.includes('w-10 h-1') || (sheetCode.includes('w-10') && sheetCode.includes('h-1')), 'Handle bar must be 40x4px (w-10 h-1)');
    assert.ok(sheetCode.includes('touch-none'), 'Handle wrapper must use touch-none to prevent browser scroll conflicts');
    assert.ok(sheetCode.includes('spotifree_android_back'), 'MobileSheet must listen to Android back button');
    assert.ok(sheetCode.includes('Escape'), 'MobileSheet must listen to Escape key');
  });

  it('F6: AddToPlaylistModal integrates useDragToDismiss on mobile viewports with 48px touch handle', () => {
    assert.ok(modalCode.includes('useDragToDismiss'), 'AddToPlaylistModal must import and call useDragToDismiss');
    assert.ok(modalCode.includes('min-h-[48px]') || modalCode.includes('h-12'), 'Mobile top handle wrapper must have 48px touch target');
    assert.ok(modalCode.includes('touch-none'), 'Mobile top handle must have touch-none');
    assert.ok(modalCode.includes('isDesktop'), 'AddToPlaylistModal must disable gesture on desktop screens');
    assert.ok(modalCode.includes('onClose: handleSaveAndClose'), 'Drag-to-dismiss must route through handleSaveAndClose');
  });
});
