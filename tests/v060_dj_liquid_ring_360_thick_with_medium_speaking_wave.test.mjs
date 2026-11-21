import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Spotifree v0.6.0: 360° Liquid Ring in Thick with Medium Speaking Outer Wave', async (t) => {
  const visualizerPath = path.resolve('src/components/dj/SpotifyDJVisualizer.tsx');
  const visCode = fs.readFileSync(visualizerPath, 'utf8');

  await t.test('1. 360° liquid plasma ring with thick main line', () => {
    // Verifies thick main ring stroke width
    assert.match(
      visCode,
      /strokeWidth\s*=\s*mini\s*\?\s*Math\.max\(3\.8,\s*size\s*\*\s*0\.12\)\s*:\s*Math\.max\(7\.2,\s*size\s*\*\s*0\.054\)/,
      'Main ring must use thick stroke width (~7.2px minimum)'
    );

    // Verifies full 360° continuous harmonic waves without upper-right clipping
    assert.match(
      visCode,
      /const w1 = Math\.sin\(theta\s*\*\s*2\s*-\s*time\s*\*\s*0\.8\)\s*\*\s*0\.65;/,
      'Must calculate primary harmonic wave across all theta'
    );
    assert.match(
      visCode,
      /const w2 = Math\.cos\(theta\s*\*\s*3\s*\+\s*time\s*\*\s*0\.6\)\s*\*\s*0\.35;/,
      'Must calculate secondary harmonic wave across all theta'
    );
  });

  await t.test('2. Medium-sized outer wave that comes out when speaking', () => {
    // Verifies medium outer stroke width (~2.4px on mobile card, ~2.5px on 140px)
    assert.match(
      visCode,
      /outerStrokeWidth\s*=\s*mini\s*\?\s*Math\.max\(1\.8,\s*size\s*\*\s*0\.05\)\s*:\s*Math\.max\(2\.4,\s*size\s*\*\s*0\.018\)/,
      'Speaking outer wave must use medium stroke width'
    );

    // Verifies outer wave is rendered only when speaking or split is active
    assert.match(
      visCode,
      /if\s*\(split\s*>\s*0\.005\)\s*\{[\s\S]*?ctx\.lineWidth\s*=\s*outerStrokeWidth;/,
      'Must conditionally render outer wave when speaking split is active'
    );

    // Verifies smooth 360° outer flutter
    assert.match(
      visCode,
      /Math\.sin\(theta \* 4 - time \* 1\.6\)/,
      'Outer wave must undulate across 360 degrees'
    );
  });

  await t.test('3. MobileLayout card triggers outer wave dynamically when DJ speaks', () => {
    const layoutPath = path.resolve('src/components/mobile/MobileLayout.tsx');
    const layoutCode = fs.readFileSync(layoutPath, 'utf8');

    assert.match(
      layoutCode,
      /forceWaves=\{visualizerState === 'speaking'\}/,
      'Mobile card must activate outer wave specifically when the DJ is speaking'
    );
  });

  await t.test('4. AIDJView full-screen screen triggers outer wave during speech or listening', () => {
    const aidjPath = path.resolve('src/components/dj/AIDJView.tsx');
    const aidjCode = fs.readFileSync(aidjPath, 'utf8');

    assert.match(
      aidjCode,
      /forceWaves=\{visualizerState === 'speaking' \|\| visualizerState === 'listening'\}/,
      'AIDJView must activate outer wave when speaking or listening'
    );
  });

  await t.test('5. Backwards compatibility of legacy exported helper functions', () => {
    assert.match(visCode, /export function getAngularDistance/, 'Must export getAngularDistance');
    assert.match(visCode, /export function getUpperRightWeight/, 'Must export getUpperRightWeight');
    assert.match(visCode, /export function calculateOrbLayerDisplacement/, 'Must export calculateOrbLayerDisplacement');
  });
});
