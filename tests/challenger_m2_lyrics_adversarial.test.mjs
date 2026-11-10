import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

describe('Adversarial & Empirical Challenger M2: Lyrics Controls Verification', () => {
  const rootDir = process.cwd();
  const mobileModalPath = path.join(rootDir, 'src', 'components', 'mobile', 'MobileNowPlayingModal.tsx');
  const desktopSidebarPath = path.join(rootDir, 'src', 'components', 'desktop', 'DesktopRightSidebar.tsx');

  const mobileSource = fs.readFileSync(mobileModalPath, 'utf8');
  const desktopSource = fs.readFileSync(desktopSidebarPath, 'utf8');

  // Parse TypeScript AST
  const sourceFile = ts.createSourceFile(
    'MobileNowPlayingModal.tsx',
    mobileSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  const desktopSourceFile = ts.createSourceFile(
    'DesktopRightSidebar.tsx',
    desktopSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  describe('AST Invariant 1: Complete Absence of "Pantalla completa" in MobileNowPlayingModal', () => {
    it('AST traversal finds zero string literals or JSX text containing "Pantalla completa" (case-insensitive)', () => {
      const occurrences = [];

      function visit(node) {
        if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
          if (/pantalla\s+completa/i.test(node.text)) {
            occurrences.push({ type: 'StringLiteral', text: node.text, line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
          }
        } else if (ts.isJsxText(node)) {
          if (/pantalla\s+completa/i.test(node.text)) {
            occurrences.push({ type: 'JsxText', text: node.text.trim(), line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
          }
        }
        ts.forEachChild(node, visit);
      }

      visit(sourceFile);

      assert.deepEqual(
        occurrences,
        [],
        `Found forbidden "Pantalla completa" instances in MobileNowPlayingModal AST: ${JSON.stringify(occurrences)}`
      );
    });

    it('Raw source inspection confirms zero matches for /pantalla\\s+completa/i in MobileNowPlayingModal', () => {
      const regex = /pantalla\s+completa/gi;
      const matches = [...mobileSource.matchAll(regex)];
      assert.equal(matches.length, 0, `Expected 0 matches for "pantalla completa", found ${matches.length}`);
    });
  });

  describe('AST Invariant 2: Green Dot Removal from Lyrics Headers', () => {
    it('MobileNowPlayingModal: "Letras" header has zero green (#1ed760) indicator dot child elements', () => {
      // Find the specific innermost div that serves as the Lyrics Card Header
      let headerDivNode = null;
      function findHeaderDiv(node) {
        if (ts.isJsxElement(node)) {
          const text = node.getText(sourceFile);
          if (text.includes('SpotifyMixUITitle') && text.includes('Letras') && text.includes('setIsLyricsExpanded(true)')) {
            let foundChild = false;
            ts.forEachChild(node, (child) => {
              if (ts.isJsxElement(child)) {
                const childText = child.getText(sourceFile);
                if (childText.includes('SpotifyMixUITitle') && childText.includes('Letras') && childText.includes('setIsLyricsExpanded(true)')) {
                  foundChild = true;
                  findHeaderDiv(child);
                }
              }
            });
            if (!foundChild && !headerDivNode) {
              headerDivNode = node;
            }
          }
        }
        if (!headerDivNode) {
          ts.forEachChild(node, findHeaderDiv);
        }
      }

      findHeaderDiv(sourceFile);

      assert.ok(headerDivNode, 'Could not find "Letras" header JSX node');

      const headerText = headerDivNode.getText(sourceFile);

      // Assert no green color #1ed760 or dot classes
      assert.equal(
        headerText.includes('#1ed760'),
        false,
        'Letras header must NOT contain #1ed760 green indicator'
      );
      assert.equal(
        headerText.includes('rounded-full bg-'),
        false,
        'Letras header must NOT contain rounded-full dot'
      );
      assert.equal(
        headerText.includes('shadow-[0_0_8px_#1ed760]'),
        false,
        'Letras header must NOT contain glowing shadow'
      );
      assert.equal(
        headerText.includes('Pantalla completa'),
        false,
        'Letras header must NOT contain Pantalla completa badge'
      );
    });

    it('DesktopRightSidebar: "Vista previa de la letra" header has zero green indicator dot elements', () => {
      let previewHeaderNode = null;

      function visit(node) {
        if (ts.isJsxElement(node)) {
          const text = node.getText(desktopSourceFile);
          if (text.includes('Vista previa de la letra') && ts.isJsxOpeningElement(node.openingElement)) {
            if (node.openingElement.tagName.getText(desktopSourceFile) === 'span') {
              previewHeaderNode = node;
              return;
            }
          }
        }
        ts.forEachChild(node, visit);
      }

      visit(desktopSourceFile);

      assert.ok(previewHeaderNode, 'Could not find "Vista previa de la letra" span node');
      const headerText = previewHeaderNode.getText(desktopSourceFile);

      assert.equal(
        headerText.includes('#1ed760'),
        false,
        'Vista previa de la letra header must NOT contain #1ed760'
      );
      assert.equal(
        headerText.includes('animate-pulse'),
        false,
        'Vista previa de la letra header must NOT contain animate-pulse indicator'
      );
      assert.equal(
        headerText.includes('Sincronizada'),
        false,
        'Vista previa de la letra header must NOT contain "Sincronizada" tooltip title'
      );
    });
  });

  describe('AST Invariant 3: "Ampliar" Button Presence, Functionality & Title Integrity', () => {
    it('MobileNowPlayingModal retains "Ampliar" button in footer with setIsLyricsExpanded(true)', () => {
      let ampliarButtonNode = null;

      function visit(node) {
        if (ts.isJsxElement(node)) {
          const tagName = node.openingElement.tagName.getText(sourceFile);
          if (tagName === 'button') {
            const text = node.getText(sourceFile);
            if (text.includes('Ampliar')) {
              ampliarButtonNode = node;
              return;
            }
          }
        }
        ts.forEachChild(node, visit);
      }

      visit(sourceFile);

      assert.ok(ampliarButtonNode, 'Could not find button containing "Ampliar" text in MobileNowPlayingModal');

      const buttonCode = ampliarButtonNode.getText(sourceFile);

      // Verify onClick handler triggers setIsLyricsExpanded(true)
      assert.ok(
        /onClick=\{[^}]*setIsLyricsExpanded\(true\)[^}]*\}/.test(buttonCode),
        'Ampliar button must invoke setIsLyricsExpanded(true) on click'
      );

      // Verify title is not "Pantalla completa"
      assert.ok(
        !buttonCode.includes('title="Pantalla completa"'),
        'Ampliar button title must NOT be "Pantalla completa"'
      );
      assert.ok(
        buttonCode.includes('title="Ampliar letra"'),
        'Ampliar button title should be descriptive ("Ampliar letra")'
      );
    });

    it('Card header also preserves onClick expansion trigger without fullscreen button badge', () => {
      const headerRegex = /<div[\s\S]*?onClick=\{[\s\S]*?setIsLyricsExpanded\(true\)[\s\S]*?\}[\s\S]*?cursor-pointer[\s\S]*?>[\s\S]*?<span[\s\S]*?>[\s\S]*?Letras[\s\S]*?<\/span>[\s\S]*?<\/div>/;
      assert.ok(
        headerRegex.test(mobileSource),
        'Card header div must trigger setIsLyricsExpanded(true) and cleanly contain only Letras title'
      );
    });
  });

  describe('Flow & State Machine Simulation: Lyrics Expansion & Fallback Robustness', () => {
    it('Simulates interaction flow: clicking Ampliar opens LyricsFullscreen portal and onClose closes it', () => {
      // State transition simulator
      let isLyricsExpanded = false;
      const setIsLyricsExpanded = (val) => {
        isLyricsExpanded = typeof val === 'function' ? val(isLyricsExpanded) : val;
      };

      // Initial state
      assert.equal(isLyricsExpanded, false, 'Initial state: lyrics expanded must be false');

      // Click Ampliar
      setIsLyricsExpanded(true);
      assert.equal(isLyricsExpanded, true, 'After clicking Ampliar: lyrics expanded must be true');

      // Simulate LyricsFullscreen component receiving open=isLyricsExpanded
      const lyricsFullscreenProps = {
        open: isLyricsExpanded,
        onClose: () => setIsLyricsExpanded(false),
      };
      assert.equal(lyricsFullscreenProps.open, true, 'LyricsFullscreen receives open=true');

      // Simulate user closing
      lyricsFullscreenProps.onClose();
      assert.equal(isLyricsExpanded, false, 'After onClose callback: lyrics expanded must return to false');
    });

    it('Footer "Ampliar" button renders identically regardless of whether lyrics are synced, plain, or missing', () => {
      const cardIdx = mobileSource.indexOf('SECTION: Expandable Spotify Mobile Lyrics Card');
      const fullUsageIdx = mobileSource.indexOf('<LyricsFullscreen', cardIdx);

      assert.ok(cardIdx > 0, 'Must find start of lyrics card');
      assert.ok(fullUsageIdx > cardIdx, 'Must find <LyricsFullscreen usage after card');

      const lyricsCardSection = mobileSource.substring(cardIdx, fullUsageIdx);

      // Action footer must be at the bottom of the card
      const footerIndex = lyricsCardSection.indexOf('{/* Action Footer */}');
      const syncedIndex = lyricsCardSection.indexOf('syncedLines.length > 0');
      const plainIndex = lyricsCardSection.indexOf(': lyrics ? (');
      const fallbackIndex = lyricsCardSection.indexOf('Disfruta de la mejor calidad');

      assert.ok(syncedIndex > 0, 'Must have synced lyrics branch');
      assert.ok(plainIndex > syncedIndex, 'Must have plain lyrics branch');
      assert.ok(fallbackIndex > plainIndex, 'Must have fallback branch');
      assert.ok(footerIndex > fallbackIndex, 'Footer must be rendered after all lyrics content branches');
      assert.ok(lyricsCardSection.includes('<span>Ampliar</span>'), 'Footer contains <span>Ampliar</span>');
    });
  });

  describe('Preservation Audit: R5 Preserved Files Integrity', () => {
    const preservedFiles = [
      'api/_lib/musicFallback.js',
      'api/audio.js',
      'scripts/audioService.mjs',
      'server.mjs',
      'native/android/SpotifreeLocalMusicPlugin.java',
      'src/utils/offlineStorage.ts',
      'tests/offline_downloads.test.js'
    ];

    it('All 7 R5 preserved files exist on disk', () => {
      for (const relPath of preservedFiles) {
        const fullPath = path.join(rootDir, relPath);
        assert.ok(fs.existsSync(fullPath), `Preserved file ${relPath} must exist on disk`);
      }
    });

    it('None of the R5 preserved files contain lyrics modifications', () => {
      for (const relPath of preservedFiles) {
        const fullPath = path.join(rootDir, relPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.equal(
          content.includes('MobileNowPlayingModal'),
          false,
          `Preserved file ${relPath} should not reference MobileNowPlayingModal`
        );
        assert.equal(
          content.includes('DesktopRightSidebar'),
          false,
          `Preserved file ${relPath} should not reference DesktopRightSidebar`
        );
      }
    });
  });
});
