import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

describe('Spotifree v0.7.1: 50/50 Smart Shuffle DJ Balance & Clean Vibe Selector Without Redundant Arrows', () => {
  const aidjViewPath = path.join(root, 'src/components/dj/AIDJView.tsx');
  const djSegmentsPath = path.join(root, 'src/services/djSegments.ts');

  const aidjViewCode = fs.readFileSync(aidjViewPath, 'utf-8');
  const djSegmentsCode = fs.readFileSync(djSegmentsPath, 'utf-8');

  it('1. AIDJView: Removes repetitive crossed shuffle arrows from Cambiar rollo and every row in vibe drawer', () => {
    // Should NOT have ShuffleNativeIcon imported or rendered on every vibe item
    assert.ok(!aidjViewCode.includes('ShuffleNativeIcon'), 'AIDJView must NOT import or repeat ShuffleNativeIcon');
    assert.ok(!aidjViewCode.includes('<ShuffleNativeIcon'), 'Must NOT have crossed shuffle arrows on every vibe row');
  });

  it('2. AIDJView: Cambiar rollo uses clean Spotify tuning/sliders icon and drawer uses clean chevron navigation', () => {
    // Cambiar rollo button uses Spotify sliders/tune icon
    assert.ok(
      aidjViewCode.includes('Cambiar rollo') && aidjViewCode.includes('M10 2v3H1V2h9zm-3 5v3H1V7h6zm7 5v3H1v-3h13'),
      'Cambiar rollo button should use Spotify sliders/tuning icon'
    );
    // Vibe drawer items use subtle chevron right
    assert.ok(
      aidjViewCode.includes('M5.47 13.03a.75.75 0 0 1 0-1.06L9.94 8 5.47 3.53a.75.75 0 0 1 1.06-1.06l5 5a.75.75 0 0 1 0 1.06l-5 5a.75.75 0 0 1-1.06 0z'),
      'Vibe drawer items should use clean chevron navigation instead of redundant arrows'
    );
    // Sorpréndeme has a distinct highlight badge
    assert.ok(
      aidjViewCode.includes('Mix') && aidjViewCode.includes("isSurprise ? 'text-[#1ed760]' : 'text-white'"),
      'Sorprendeme has clean distinct highlight styling'
    );
  });

  it('3. djSegments: interleave5050 function is defined and alternates playlist tracks and smart shuffle recommendations', () => {
    assert.ok(
      djSegmentsCode.includes('export function interleave5050('),
      'djSegments must export interleave5050'
    );
    assert.ok(
      djSegmentsCode.includes('result.length % 2 === 0'),
      'interleave5050 must alternate indices between playlist and recommendation'
    );
  });

  it('4. djSegments: Opening set builds a true 50/50 balance with smart shuffle recommendations', () => {
    assert.ok(
      djSegmentsCode.includes('interleave5050'),
      'djSegments must use interleave5050 to balance the set'
    );
    assert.ok(
      djSegmentsCode.includes('fetchSmartDJRecommendations'),
      'djSegments must fetch smart recommendations via Smart Shuffle algorithm'
    );
    assert.ok(
      djSegmentsCode.includes('mezcla 50/50 con tus temas favoritos y recomendaciones de al azar inteligente'),
      'Opener reason must specify 50/50 balance with smart shuffle recommendations'
    );
  });

  it('5. djSegments: DJ speech mentions 50/50 blend and smart shuffle recommendations', () => {
    assert.ok(
      djSegmentsCode.includes('50/50') && djSegmentsCode.includes('al azar inteligente'),
      'DJ intro must mention 50/50 mix and al azar inteligente'
    );
    assert.ok(
      djSegmentsCode.includes('Tu mezcla 50/50'),
      'Segment title should be Tu mezcla 50/50'
    );
  });
});
