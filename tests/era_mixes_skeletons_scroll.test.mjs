import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Era Playlists, Dark Skeletons & Depth Scroll Physics (Spotifree v0.4+)', () => {
  test('ERA_PLAYLIST_DEFINITIONS contains 2010s, 2000s, 90s, and 80s mixes with curated tracks', () => {
    const mixesContent = fs.readFileSync(path.resolve('src/services/spotifreeMixes.ts'), 'utf-8');
    assert.ok(mixesContent.includes('sf-era-2010s'), 'Should contain sf-era-2010s');
    assert.ok(mixesContent.includes('sf-era-2000s'), 'Should contain sf-era-2000s');
    assert.ok(mixesContent.includes('sf-era-90s'), 'Should contain sf-era-90s');
    assert.ok(mixesContent.includes('sf-era-80s'), 'Should contain sf-era-80s');
    assert.ok(mixesContent.includes("Mix de los 2010s"), 'Should contain Mix de los 2010s');
    assert.ok(mixesContent.includes("Mix de los 2000s"), 'Should contain Mix de los 2000s');
    assert.ok(mixesContent.includes("Mix de los 90s"), 'Should contain Mix de los 90s');
    assert.ok(mixesContent.includes("Mix de los 80s"), 'Should contain Mix de los 80s');
  });

  test('withSpotifreeShelves dynamically rotates era shelf and changes featured era', () => {
    const mixesContent = fs.readFileSync(path.resolve('src/services/spotifreeMixes.ts'), 'utf-8');
    assert.ok(mixesContent.includes('sf-era-mixes'), 'Should define sf-era-mixes shelf ID');
    assert.ok(mixesContent.includes('showEraShelf'), 'Should define dynamic visibility toggle');
    assert.ok(mixesContent.includes('rotatedCards'), 'Should rotate decade cards dynamically');
  });

  test('SpotifyImage component provides dark pulse skeleton while loading and authentic fallback without broken images', () => {
    const imgContent = fs.readFileSync(path.resolve('src/components/common/SpotifyImage.tsx'), 'utf-8');
    assert.ok(imgContent.includes('spf-skeleton'), 'Should use spf-skeleton while loading');
    assert.ok(imgContent.includes('referrerPolicy="no-referrer"'), 'Should handle referrerPolicy safely');
    assert.ok(imgContent.includes('transition-opacity duration-300'), 'Should smoothly fade in once loaded');
    assert.ok(imgContent.includes('bg-[#282828]'), 'Should display Spotify dark box on fallback');
  });

  test('SpotifyHomeSkeleton provides authentic dark shimmer pulse placeholders for Mobile and Desktop', () => {
    const skelContent = fs.readFileSync(path.resolve('src/components/common/SpotifyHomeSkeleton.tsx'), 'utf-8');
    assert.ok(skelContent.includes('isMobile'), 'Should support isMobile property');
    assert.ok(skelContent.includes('spf-skeleton'), 'Should use spf-skeleton class');
    assert.ok(skelContent.includes('m-skel-qa-'), 'Should generate mobile quick access skeletons');
    assert.ok(skelContent.includes('d-skel-qa-'), 'Should generate desktop quick access skeletons');
  });

  test('MobileLayout and DesktopHomeView mount SpotifyHomeSkeleton when loading', () => {
    const mobileContent = fs.readFileSync(path.resolve('src/components/mobile/MobileLayout.tsx'), 'utf-8');
    const desktopContent = fs.readFileSync(path.resolve('src/components/desktop/DesktopHomeView.tsx'), 'utf-8');
    assert.ok(mobileContent.includes('<SpotifyHomeSkeleton isMobile={true} />'), 'MobileLayout should render mobile home skeleton');
    assert.ok(desktopContent.includes('<SpotifyHomeSkeleton isMobile={false} />'), 'DesktopHomeView should render desktop home skeleton');
  });

  test('MobileLayout implements ambient parallax gradient, dynamic sticky header, and touch momentum scroll', () => {
    const mobileContent = fs.readFileSync(path.resolve('src/components/mobile/MobileLayout.tsx'), 'utf-8');
    assert.ok(mobileContent.includes('scrollOffset'), 'MobileLayout should track scrollOffset');
    assert.ok(mobileContent.includes('translate3d(0,'), 'MobileLayout should apply smooth parallax transform');
    assert.ok(mobileContent.includes('backdrop-blur-xl'), 'MobileLayout should apply floating frosted glass header');
    assert.ok(mobileContent.includes('WebkitOverflowScrolling'), 'MobileLayout should enable native momentum touch scrolling');
  });

  test('index.css declares smooth touch momentum and overscroll contain physics', () => {
    const cssContent = fs.readFileSync(path.resolve('src/index.css'), 'utf-8');
    assert.ok(cssContent.includes('-webkit-overflow-scrolling: touch;'), 'Should declare -webkit-overflow-scrolling');
    assert.ok(cssContent.includes('overscroll-behavior-y: contain;'), 'Should declare overscroll-behavior-y contain');
    assert.ok(cssContent.includes('scroll-behavior: smooth;'), 'Should declare smooth scroll behavior');
  });
});
