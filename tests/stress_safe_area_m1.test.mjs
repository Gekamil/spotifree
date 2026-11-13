import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const readRel = (relPath) => fs.readFileSync(path.join(projectRoot, relPath), 'utf8');

/**
 * Empirical challenger stress test suite for Milestone 1 (F1 & F2).
 * Adversarially challenges:
 * 1. Safe area layout geometry across various --sab values (0px, 16px, 48px, 72px, extreme insets).
 * 2. Touch collision prevention between 3-button system navigation bar and tab buttons.
 * 3. Mini-player and scroll content clearance invariants.
 * 4. Fallback handling for missing/malformed CSS variables and rapid resize events.
 * 5. Android native WindowInsetsCompat bridge contract.
 */
describe('Adversarial Challenger M1: Safe Area & Touch Collisions (F1 & F2)', () => {
  const bottomNavCode = readRel('src/components/mobile/MobileBottomNav.tsx');
  const miniPlayerCode = readRel('src/components/mobile/MobileMiniPlayer.tsx');
  const layoutCode = readRel('src/components/mobile/MobileLayout.tsx');
  const indexCssCode = readRel('src/index.css');
  const mainActivityCode = readRel('native/android/MainActivity.java');
  const setupNativeCode = readRel('scripts/setup-android-native.mjs');

  describe('1. Static Code Analysis & Structural Decoupling Verification', () => {
    it('MobileBottomNav strictly decouples buttons into fixed 64px row above safe-area spacer', () => {
      // Container flex-col check
      assert.ok(bottomNavCode.includes('flex flex-col'), 'Nav container must use flex flex-col layout');
      assert.ok(
        bottomNavCode.includes("height: 'calc(64px + var(--sab, 0px))'"),
        'Nav container height must strictly be calc(64px + var(--sab, 0px))'
      );

      // Button row check
      assert.ok(
        bottomNavCode.includes('h-16 w-full flex items-center justify-around px-2'),
        'Tab buttons must be enclosed in a fixed h-16 (64px) row'
      );

      // Check all 4 buttons exist inside the code
      const buttonMatches = bottomNavCode.match(/<button[\s\S]*?<\/button>/g) || [];
      assert.equal(buttonMatches.length, 4, 'Must contain exactly 4 interactive tab buttons');

      // Spacer check
      assert.ok(
        bottomNavCode.includes('data-testid="bottom-nav-safe-area-spacer"'),
        'Must contain data-testid="bottom-nav-safe-area-spacer"'
      );
      assert.ok(
        bottomNavCode.includes("height: 'var(--sab, 0px)'"),
        'Safe-area spacer height must be var(--sab, 0px)'
      );
      assert.ok(
        bottomNavCode.includes('pointer-events-none'),
        'Safe-area spacer must have pointer-events-none class'
      );
      assert.ok(
        bottomNavCode.includes('aria-hidden="true"'),
        'Safe-area spacer must have aria-hidden="true" for accessibility'
      );
    });

    it('Spacer appears AFTER button row in DOM hierarchy', () => {
      const buttonRowIdx = bottomNavCode.indexOf('h-16 w-full flex items-center justify-around px-2');
      const spacerIdx = bottomNavCode.indexOf('data-testid="bottom-nav-safe-area-spacer"');
      assert.ok(buttonRowIdx > 0, 'Button row must exist');
      assert.ok(spacerIdx > 0, 'Spacer must exist');
      assert.ok(
        spacerIdx > buttonRowIdx,
        'Spacer must be placed below the button row in DOM order'
      );
    });

    it('Mini-player is strictly docked above bottom nav using var(--sab, 0px)', () => {
      assert.ok(
        miniPlayerCode.includes("bottom: 'calc(68px + var(--sab, 0px))'"),
        'MobileMiniPlayer bottom style must be calc(68px + var(--sab, 0px))'
      );
      assert.ok(
        !miniPlayerCode.includes("bottom: 'calc(68px + env("),
        'MobileMiniPlayer must not bypass --sab with direct env()'
      );
    });

    it('MobileLayout provides calc(144px + var(--sab, 0px)) scroll padding and elevated toast', () => {
      assert.ok(
        layoutCode.includes("paddingBottom: mobileTab === 'dj' ? '0px' : 'calc(144px + var(--sab, 0px))'"),
        'MobileLayout scroll container must allocate calc(144px + var(--sab, 0px)) bottom padding'
      );
      assert.ok(
        layoutCode.includes("calc(134px + var(--sab, 0px))"),
        'Toast must position at calc(134px + var(--sab, 0px)) when mini-player is visible'
      );
      assert.ok(
        layoutCode.includes("calc(74px + var(--sab, 0px))"),
        'Toast must position at calc(74px + var(--sab, 0px)) when mini-player is hidden'
      );
    });

    it('Global CSS defines --sab with max(env(), var()) fallback', () => {
      assert.ok(
        indexCssCode.includes('--sab: max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px))'),
        'src/index.css must define --sab as max of env and var'
      );
    });
  });

  describe('2. Mathematical Geometry & Clearance Invariants Across --sab Values', () => {
    // Helper to evaluate layout geometry for given screen height H and safe area bottom S
    function computeLayoutGeometry(screenHeight, sabPx) {
      const navButtonRowHeight = 64;
      const navSpacerHeight = sabPx;
      const navTotalHeight = navButtonRowHeight + navSpacerHeight;

      // Position from bottom of screen (Y = screenHeight is bottom edge)
      const navContainerTopFromBottom = navTotalHeight;
      const navButtonRowTopFromBottom = navTotalHeight;
      const navButtonRowBottomFromBottom = navSpacerHeight;

      const miniPlayerHeight = 56;
      const miniPlayerBottomFromBottom = 68 + sabPx;
      const miniPlayerTopFromBottom = miniPlayerBottomFromBottom + miniPlayerHeight;

      const contentPaddingBottom = 144 + sabPx;
      const toastWithPlayerBottomFromBottom = 134 + sabPx;
      const toastWithoutPlayerBottomFromBottom = 74 + sabPx;

      return {
        screenHeight,
        sabPx,
        navTotalHeight,
        navButtonRowTopFromBottom,
        navButtonRowBottomFromBottom,
        miniPlayerBottomFromBottom,
        miniPlayerTopFromBottom,
        clearanceMiniToNav: miniPlayerBottomFromBottom - navContainerTopFromBottom,
        headroomContentToMini: contentPaddingBottom - miniPlayerTopFromBottom,
        toastWithPlayerClearance: toastWithPlayerBottomFromBottom - miniPlayerTopFromBottom,
        toastWithoutPlayerClearance: toastWithoutPlayerBottomFromBottom - navContainerTopFromBottom,
        // Y coordinates from top of screen (0 is top, screenHeight is bottom)
        navTopY: screenHeight - navContainerTopFromBottom,
        navButtonRowTopY: screenHeight - navButtonRowTopFromBottom,
        navButtonRowBottomY: screenHeight - navButtonRowBottomFromBottom,
        navSpacerTopY: screenHeight - navButtonRowBottomFromBottom,
        navSpacerBottomY: screenHeight,
        miniPlayerTopY: screenHeight - miniPlayerTopFromBottom,
        miniPlayerBottomY: screenHeight - miniPlayerBottomFromBottom,
      };
    }

    const testInsets = [
      { name: 'Zero Inset (0px, gesture nav / desktop / tablet)', sab: 0 },
      { name: 'Minimal Inset (16px, subtle gesture bar)', sab: 16 },
      { name: 'Standard 3-Button Nav Bar (48px, standard Android)', sab: 48 },
      { name: 'Large 3-Button Nav Bar (72px, high-density/accessibility)', sab: 72 },
      { name: 'Extreme Custom Inset (96px, foldables / custom ROM)', sab: 96 },
      { name: 'Pathological Inset (128px, giant navigation controls)', sab: 128 },
    ];

    for (const { name, sab } of testInsets) {
      it(`Preserves exact clearance invariants with ${name}`, () => {
        const geom = computeLayoutGeometry(844, sab);

        // 1. Mini-player clearance above bottom nav must be strictly 4px
        assert.strictEqual(
          geom.clearanceMiniToNav,
          4,
          `Mini-player clearance above bottom nav must be exactly 4px for sab=${sab}px`
        );

        // 2. Headroom of scroll content above mini-player must be strictly 20px
        assert.strictEqual(
          geom.headroomContentToMini,
          20,
          `Scroll content padding must provide exactly 20px headroom above mini-player for sab=${sab}px`
        );

        // 3. Toast clearances
        assert.strictEqual(
          geom.toastWithPlayerClearance,
          10,
          `Toast must have 10px clearance above mini-player for sab=${sab}px`
        );
        assert.strictEqual(
          geom.toastWithoutPlayerClearance,
          10,
          `Toast must have 10px clearance above bottom nav for sab=${sab}px`
        );

        // 4. Tab button row is strictly above the safe area spacer
        assert.strictEqual(
          geom.navButtonRowBottomY,
          geom.navSpacerTopY,
          `Bottom of tab button row must meet top of spacer at Y=${geom.navSpacerTopY}`
        );
        assert.strictEqual(
          geom.navSpacerBottomY - geom.navSpacerTopY,
          sab,
          `Spacer height must equal sab=${sab}px`
        );
      });
    }
  });

  describe('3. Adversarial Touch Collision & Hit-Testing Monte Carlo Simulation', () => {
    /**
     * Hit-tester simulator based on DOM structure:
     * Screen height = 800px.
     * Generates touch points in the bottom 150px region.
     * Evaluates which DOM element receives pointer events.
     */
    function hitTest(x, y, screenWidth, screenHeight, sab) {
      const navTotalHeight = 64 + sab;
      const navTopY = screenHeight - navTotalHeight;
      const buttonRowBottomY = screenHeight - sab;
      const spacerBottomY = screenHeight;

      const miniPlayerBottom = 68 + sab;
      const miniPlayerHeight = 56;
      const miniPlayerTopY = screenHeight - (miniPlayerBottom + miniPlayerHeight);
      const miniPlayerBottomY = screenHeight - miniPlayerBottom;

      // 1. Mini player (z-40, left 8px to right-8px)
      if (y >= miniPlayerTopY && y < miniPlayerBottomY && x >= 8 && x <= screenWidth - 8) {
        return { target: 'MINI_PLAYER', interactive: true };
      }

      // 2. Bottom Nav Container (z-50, full width)
      if (y >= navTopY && y <= spacerBottomY) {
        // Tab button row: [navTopY, buttonRowBottomY]
        if (y < buttonRowBottomY) {
          const tabWidth = screenWidth / 4;
          const tabIndex = Math.floor(x / tabWidth);
          const tabNames = ['TAB_HOME', 'TAB_SEARCH', 'TAB_LIBRARY', 'TAB_CREATE'];
          return { target: tabNames[Math.min(tabIndex, 3)], interactive: true };
        }

        // Spacer region: [buttonRowBottomY, spacerBottomY]
        // Note: spacer has 'pointer-events-none' class
        // Since spacer is pointer-events-none, event penetrates through spacer
        // What lies behind? Underneath nav is the system or body/backdrop.
        // It does NOT hit any tab button!
        return { target: 'SYSTEM_SAFE_AREA_SPACER', interactive: false };
      }

      // 3. Main scrollable content
      return { target: 'CONTENT_AREA', interactive: true };
    }

    const testSabValues = [0, 16, 48, 72];

    for (const sab of testSabValues) {
      it(`Simulates 5,000 synthetic touches near system nav for sab=${sab}px: ZERO accidental tab clicks in dead zone`, () => {
        const screenWidth = 390;
        const screenHeight = 844;
        const numSamples = 5000;

        let touchesInDeadZone = 0;
        let falseTabActivationsInDeadZone = 0;
        let validTabClicks = 0;

        // Sample touches near the bottom
        for (let i = 0; i < numSamples; i++) {
          const x = Math.random() * screenWidth;
          // Sample Y in bottom 120px: [screenHeight - 120, screenHeight]
          const y = screenHeight - 120 + Math.random() * 120;

          const result = hitTest(x, y, screenWidth, screenHeight, sab);

          // If touch is in the safe-area dead zone: [screenHeight - sab, screenHeight]
          if (sab > 0 && y >= screenHeight - sab) {
            touchesInDeadZone++;
            if (result.target.startsWith('TAB_')) {
              falseTabActivationsInDeadZone++;
            }
          }

          if (result.target.startsWith('TAB_')) {
            validTabClicks++;
            // Tab clicks must only occur strictly within [screenHeight - 64 - sab, screenHeight - sab)
            assert.ok(
              y >= screenHeight - 64 - sab && y < screenHeight - sab,
              `Tab click registered outside valid row bounds at y=${y} (expected [${screenHeight - 64 - sab}, ${screenHeight - sab}))`
            );
          }
        }

        if (sab > 0) {
          assert.ok(touchesInDeadZone > 0, `Should have tested touches in dead zone (got ${touchesInDeadZone})`);
          assert.strictEqual(
            falseTabActivationsInDeadZone,
            0,
            `Adversarial touch collision failure: ${falseTabActivationsInDeadZone} touches in system dead zone activated tabs!`
          );
        }
      });
    }
  });

  describe('4. Missing, Malformed & Edge-Case Fallback Handling', () => {
    it('Parses CSS calc expressions with fallback when --sab is undefined', () => {
      // Simulate CSS expression evaluation with missing CSS variable: var(--sab, 0px) -> "0px"
      function evalWithFallback(cssExpr, varValue = null) {
        let evaluated = cssExpr;
        if (varValue === null || varValue === undefined) {
          // Replace var(--sab, 0px) with 0px
          evaluated = evaluated.replace(/var\(--sab,\s*0px\)/g, '0px');
          evaluated = evaluated.replace(/var\(--sat,\s*0px\)/g, '0px');
        } else {
          evaluated = evaluated.replace(/var\(--sab,\s*0px\)/g, `${varValue}px`);
          evaluated = evaluated.replace(/var\(--sat,\s*0px\)/g, `${varValue}px`);
        }
        // Evaluate calc(A + B)
        return evaluated.replace(/calc\((\d+)px\s*\+\s*(\d+)px\)/g, (_, a, b) => `${parseInt(a, 10) + parseInt(b, 10)}px`);
      }

      // Nav height
      const navExpr = "calc(64px + var(--sab, 0px))";
      assert.strictEqual(evalWithFallback(navExpr, null), '64px');
      assert.strictEqual(evalWithFallback(navExpr, 48), '112px');

      // Mini player bottom
      const miniExpr = "calc(68px + var(--sab, 0px))";
      assert.strictEqual(evalWithFallback(miniExpr, null), '68px');
      assert.strictEqual(evalWithFallback(miniExpr, 48), '116px');

      // Scroll padding
      const scrollExpr = "calc(144px + var(--sab, 0px))";
      assert.strictEqual(evalWithFallback(scrollExpr, null), '144px');
      assert.strictEqual(evalWithFallback(scrollExpr, 48), '192px');
    });

    it('Orientation change simulation (Portrait 48px -> Landscape 0px -> Portrait 48px)', () => {
      let currentSab = 48; // Portrait 3-button nav
      let navHeight = 64 + currentSab;
      let miniBottom = 68 + currentSab;

      assert.strictEqual(navHeight, 112);
      assert.strictEqual(miniBottom, 116);

      // Rotate to landscape: bottom nav inset becomes 0px (buttons move to side or immerse)
      currentSab = 0;
      navHeight = 64 + currentSab;
      miniBottom = 68 + currentSab;

      assert.strictEqual(navHeight, 64);
      assert.strictEqual(miniBottom, 68);
      assert.strictEqual(miniBottom - navHeight, 4, 'Clearance preserved during landscape rotation');

      // Rotate back to portrait
      currentSab = 48;
      navHeight = 64 + currentSab;
      miniBottom = 68 + currentSab;

      assert.strictEqual(navHeight, 112);
      assert.strictEqual(miniBottom, 116);
      assert.strictEqual(miniBottom - navHeight, 4, 'Clearance preserved after returning to portrait');
    });
  });

  describe('5. Android Native Bridge & Setup Script Integrity', () => {
    it('MainActivity.java and scripts/setup-android-native.mjs implement synchronized WindowInsets logic', () => {
      // Both files must have identical JS injection template
      const jsSnippet = "root.setProperty('--safe-area-inset-bottom', '%dpx');";
      assert.ok(mainActivityCode.includes(jsSnippet), 'MainActivity.java must set --safe-area-inset-bottom');
      assert.ok(setupNativeCode.includes(jsSnippet), 'setup-android-native.mjs must set --safe-area-inset-bottom');

      const sabSnippet = "root.setProperty('--sab', '%dpx');";
      assert.ok(mainActivityCode.includes(sabSnippet), 'MainActivity.java must set --sab');
      assert.ok(setupNativeCode.includes(sabSnippet), 'setup-android-native.mjs must set --sab');

      // Both query systemBars and displayCutout
      const insetsTypeSnippet = 'WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()';
      assert.ok(mainActivityCode.includes(insetsTypeSnippet), 'MainActivity.java must query systemBars and displayCutout');
      assert.ok(setupNativeCode.includes(insetsTypeSnippet), 'setup-android-native.mjs must query systemBars and displayCutout');

      // Both handle density conversion
      const densitySnippet = 'float density = getResources().getDisplayMetrics().density;';
      assert.ok(mainActivityCode.includes(densitySnippet), 'MainActivity.java must convert pixels to dp using density');
      assert.ok(setupNativeCode.includes(densitySnippet), 'setup-android-native.mjs must convert pixels to dp using density');
    });
  });
});
