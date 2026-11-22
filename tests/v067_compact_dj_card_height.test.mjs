import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('MobileLayout DJ card height is compact and does not expand to 200px', () => {
  const layoutPath = path.resolve('src/components/mobile/MobileLayout.tsx');
  assert.ok(fs.existsSync(layoutPath), 'MobileLayout.tsx must exist');

  const content = fs.readFileSync(layoutPath, 'utf8');

  // Verify compact height constraint on the DJ card
  assert.ok(
    content.includes('min-h-[118px] h-[118px]') || content.includes('min-h-[118px]'),
    'DJ card should have compact min-h-[118px] height'
  );

  // Locate the DJ card block in MobileLayout
  const djBlockMatch = content.match(/Tu DJ personal[\s\S]*?RotatingDJBannerText/);
  assert.ok(djBlockMatch, 'Must find DJ card block');
  const djBlock = djBlockMatch[0];

  // Visualizer must be positioned absolutely so it does not push the flex flow to ~200px
  assert.ok(
    djBlock.includes('absolute left-1/2 -translate-x-1/2') && djBlock.includes('-top-1'),
    'Visualizer must be positioned absolutely in the card to keep the rectangle compact'
  );

  // Visualizer size should remain prominent (142)
  assert.ok(
    djBlock.includes('size={142}'),
    'Visualizer ring size must remain 142'
  );

  // Bottom row should be positioned with z-20 and mt-auto
  assert.ok(
    djBlock.includes('relative z-20 mt-auto') || djBlock.includes('relative z-20'),
    'Bottom row must be in front of the visualizer ring glow'
  );
});

test('DesktopHomeView DJ card is also streamlined in height', () => {
  const desktopPath = path.resolve('src/components/desktop/DesktopHomeView.tsx');
  assert.ok(fs.existsSync(desktopPath), 'DesktopHomeView.tsx must exist');

  const content = fs.readFileSync(desktopPath, 'utf8');
  assert.ok(
    content.includes('min-h-[128px] md:min-h-[136px]'),
    'Desktop DJ card should use compact min-h-[128px] md:min-h-[136px]'
  );
});
