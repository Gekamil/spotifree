import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Lyrics Controls Simplification (Requirement R2)', () => {
  const rootDir = process.cwd();
  const mobileModalPath = path.join(rootDir, 'src', 'components', 'mobile', 'MobileNowPlayingModal.tsx');
  const desktopSidebarPath = path.join(rootDir, 'src', 'components', 'desktop', 'DesktopRightSidebar.tsx');

  const mobileContent = fs.readFileSync(mobileModalPath, 'utf8');
  const desktopContent = fs.readFileSync(desktopSidebarPath, 'utf8');

  it('MobileNowPlayingModal does not contain "Pantalla completa" button badge in lyrics card header', () => {
    // Should not have "Pantalla completa" in the lyrics card header
    assert.equal(
      mobileContent.includes('<span>Pantalla completa</span>'),
      false,
      'Lyrics card header must not contain "Pantalla completa" button badge'
    );
  });

  it('MobileNowPlayingModal does not contain green indicator dot next to "Letras"', () => {
    // The lyrics header should have plain "Letras" without green dot
    const hasGreenDotInLyricsHeader =
      mobileContent.includes('bg-[#1ed760] shadow-[0_0_8px_#1ed760]') ||
      /Letras\s*\{[^}]*#1ed760/s.test(mobileContent);
    assert.equal(
      hasGreenDotInLyricsHeader,
      false,
      'Lyrics card header must not contain green indicator dot next to "Letras"'
    );
  });

  it('MobileNowPlayingModal retains solely "Ampliar" button in lyrics card footer', () => {
    assert.equal(
      mobileContent.includes('<span>Ampliar</span>'),
      true,
      'Lyrics card footer must retain the "Ampliar" button'
    );
    assert.equal(
      mobileContent.includes('title="Pantalla completa"'),
      false,
      'Footer button title must not be "Pantalla completa"'
    );
  });

  it('DesktopRightSidebar does not contain green active indicator dot next to "Vista previa de la letra"', () => {
    const hasGreenDotInPreviewHeader =
      /Vista previa de la letra\s*\{[^}]*#1ed760/s.test(desktopContent) ||
      desktopContent.includes('<span className="w-1.5 h-1.5 rounded-full bg-[#1ed760] animate-pulse" title="Sincronizada" />');
    assert.equal(
      hasGreenDotInPreviewHeader,
      false,
      'Lyrics preview header must not contain green active indicator dot'
    );
  });
});
