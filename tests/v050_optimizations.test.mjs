import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Spotifree v0.5 Optimizations, Live Extraction & Mood Shelves', () => {
  describe('1. Version Bump Verification', () => {
    it('package.json version is 0.5.x or >= 1.0.0', () => {
      const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'));
      assert.ok(/^(0\.5\.|1\.[0-9]+(\.|$))/.test(pkg.version));
    });

    it('src/data/changelog.ts declares current APP_VERSION and keeps 0.5 release history', () => {
      const changelog = fs.readFileSync(path.resolve('src/data/changelog.ts'), 'utf-8');
      assert.ok(/export const APP_VERSION = '(0\.5\.|1\.[0-9]+)/.test(changelog));
      assert.ok(changelog.includes("version: '0.5"));
      assert.ok(changelog.includes('120 FPS'));
    });
  });

  describe('2. Desktop 120 FPS Performance & Fluidity', () => {
    it('DesktopPlaylistView has eliminated hoveredTrackId React state and onMouseEnter/Leave re-renders', () => {
      const viewCode = fs.readFileSync(path.resolve('src/components/desktop/DesktopPlaylistView.tsx'), 'utf-8');
      assert.strictEqual(viewCode.includes('hoveredTrackId'), false, 'Should have zero hoveredTrackId references');
      assert.strictEqual(viewCode.includes('setHoveredTrackId'), false, 'Should not trigger setState on hover');
      assert.ok(viewCode.includes('track-row-contain'), 'Must have track-row-contain class for CSS content-visibility');
      assert.ok(viewCode.includes('group-hover:flex'), 'Must use CSS group hover for play/pause');
    });

    it('DesktopShelfCarousel applies shelf-contain for GPU/layout virtualization', () => {
      const shelfCode = fs.readFileSync(path.resolve('src/components/desktop/DesktopShelfCarousel.tsx'), 'utf-8');
      assert.ok(shelfCode.includes('shelf-contain'), 'Shelf carousel must have shelf-contain');
    });

    it('DesktopHomeView uses gpu-accelerated sticky header without heavy backdrop-blur lag', () => {
      const homeCode = fs.readFileSync(path.resolve('src/components/desktop/DesktopHomeView.tsx'), 'utf-8');
      assert.ok(homeCode.includes('gpu-accelerated'), 'Sticky top filter must be gpu-accelerated');
      assert.ok(homeCode.includes('DOMINANT_COLOR_CACHE'), 'Must memoize dominant color extraction');
    });

    it('index.css declares shelf-contain with content-visibility auto', () => {
      const cssCode = fs.readFileSync(path.resolve('src/index.css'), 'utf-8');
      assert.ok(cssCode.includes('.shelf-contain'), 'Must declare .shelf-contain');
      assert.ok(cssCode.includes('content-visibility: auto'), 'Must use content-visibility: auto');
    });
  });

  describe('3. Spotify Playlist Live SWR Extraction & Revalidation', () => {
    it('useSpotifyDataStore implements 3-minute cooldown with _lastExtractedAt and removes 24h lockout', () => {
      const storeCode = fs.readFileSync(path.resolve('src/store/useSpotifyDataStore.ts'), 'utf-8');
      assert.ok(storeCode.includes('_lastExtractedAt'), 'Must track _lastExtractedAt timestamp');
      assert.ok(storeCode.includes('3 * 60 * 1000'), 'Must allow revalidation after 3 minutes cooldown');
      assert.ok(storeCode.includes('startDailySpotifyRefreshTimer'), 'Must maintain periodic check');
    });

    it('api/playlist.js clears in-memory cache and bypasses stale editorial cache on refresh=true', () => {
      const apiCode = fs.readFileSync(path.resolve('api/playlist.js'), 'utf-8');
      assert.ok(apiCode.includes('MEMORY_PLAYLIST_CACHE.delete(cleanId)'), 'Must delete cleanId from memory cache on refresh');
      assert.ok(apiCode.includes('!refresh && isEditorial'), 'Must not serve static json when refresh is requested');
    });

    it('MobilePlaylistView implements background SWR revalidation without blocking screen', () => {
      const mobileCode = fs.readFileSync(path.resolve('src/components/mobile/MobilePlaylistView.tsx'), 'utf-8');
      assert.ok(mobileCode.includes('// SWR: Revalidate in background'), 'Must have SWR background fetch');
    });

    it('DesktopPlaylistView provides instant manual sync button in action header', () => {
      const viewCode = fs.readFileSync(path.resolve('src/components/desktop/DesktopPlaylistView.tsx'), 'utf-8');
      assert.ok(viewCode.includes('handleSyncPlaylistSongs'), 'Must provide sync handler');
      assert.ok(viewCode.includes('Sincronizar canciones con Spotify ahora'), 'Must render sync button tooltip');
    });
  });

  describe('4. Mood & Trending Shelves in spotifreeMixes.ts', () => {
    it('defines MOOD_PLAYLIST_DEFINITIONS with Entreno, Relax, Focus, Fiesta and Coche', () => {
      const mixesCode = fs.readFileSync(path.resolve('src/services/spotifreeMixes.ts'), 'utf-8');
      assert.ok(mixesCode.includes('MOOD_PLAYLIST_DEFINITIONS'), 'Must export MOOD_PLAYLIST_DEFINITIONS');
      assert.ok(mixesCode.includes('sf-mood-entreno'), 'Must define entreno mix');
      assert.ok(mixesCode.includes('sf-mood-relax'), 'Must define relax mix');
      assert.ok(mixesCode.includes('sf-mood-focus'), 'Must define focus mix');
      assert.ok(mixesCode.includes('sf-mood-fiesta'), 'Must define fiesta mix');
      assert.ok(mixesCode.includes('sf-mood-coche'), 'Must define coche mix');
    });

    it('defines TRENDING_PLAYLIST_DEFINITIONS with Global 2026, España and Virales', () => {
      const mixesCode = fs.readFileSync(path.resolve('src/services/spotifreeMixes.ts'), 'utf-8');
      assert.ok(mixesCode.includes('TRENDING_PLAYLIST_DEFINITIONS'), 'Must export TRENDING_PLAYLIST_DEFINITIONS');
      assert.ok(mixesCode.includes('sf-trend-global'), 'Must define global mix');
      assert.ok(mixesCode.includes('sf-trend-spain'), 'Must define spain mix');
      assert.ok(mixesCode.includes('sf-trend-virales'), 'Must define virales mix');
    });

    it('withSpotifreeShelves inserts Estados de ánimo and Tendencias shelves', () => {
      const mixesCode = fs.readFileSync(path.resolve('src/services/spotifreeMixes.ts'), 'utf-8');
      assert.ok(mixesCode.includes('sf-mood-mixes'), 'Must insert sf-mood-mixes shelf');
      assert.ok(mixesCode.includes('sf-trending-mixes'), 'Must insert sf-trending-mixes shelf');
      assert.ok(mixesCode.includes('Estados de ánimo y Momentos'), 'Must have proper title');
      assert.ok(mixesCode.includes('Tendencias & Virales del Momento'), 'Must have proper title');
    });
  });

  describe('5. Genre Mixes Separation & Photo-Blended Themed Covers', () => {
    it('defines GENRE_PLAYLIST_DEFINITIONS and categorizes Rock, Pop, Urbano and EDM as genres', () => {
      const mixesCode = fs.readFileSync(path.resolve('src/services/spotifreeMixes.ts'), 'utf-8');
      assert.ok(mixesCode.includes('export const GENRE_PLAYLIST_DEFINITIONS'), 'Must export GENRE_PLAYLIST_DEFINITIONS');
      assert.ok(mixesCode.includes("category: 'genre' as const"), 'Must categorize genres separately from eras');
      assert.ok(mixesCode.includes("category: 'era' as const"), 'Must categorize decades as era');
    });

    it('withSpotifreeShelves isolates genres into "Playlists por género" shelf (sf-genre-mixes)', () => {
      const mixesCode = fs.readFileSync(path.resolve('src/services/spotifreeMixes.ts'), 'utf-8');
      assert.ok(mixesCode.includes('sf-genre-mixes'), 'Must define sf-genre-mixes shelf');
      assert.ok(mixesCode.includes('Playlists por género'), 'Must set title to Playlists por género');
      assert.ok(mixesCode.includes('GÉNEROS Y ESTILOS'), 'Must have GÉNEROS Y ESTILOS prefix');
    });

    it('sf-era-mixes strictly rotates decades without mixing in Rock, Pop or Urbano', () => {
      const mixesCode = fs.readFileSync(path.resolve('src/services/spotifreeMixes.ts'), 'utf-8');
      const eraSection = mixesCode.split('if (eraMixes.length)')[1]?.split('if (moodMixes.length)')[0] || '';
      assert.strictEqual(eraSection.includes("c.id.includes('pop')"), false, 'Decade shelf must not contain pop');
      assert.strictEqual(eraSection.includes("c.id.includes('rock')"), false, 'Decade shelf must not contain rock');
      assert.strictEqual(eraSection.includes("c.id.includes('urbano')"), false, 'Decade shelf must not contain urbano');
      assert.strictEqual(eraSection.includes("c.id.includes('edm')"), false, 'Decade shelf must not contain edm');
    });

    it('makeCuratedThemedCover generates canvas cover with blended photos, glow flares and SVG fallback', () => {
      const mixesCode = fs.readFileSync(path.resolve('src/services/spotifreeMixes.ts'), 'utf-8');
      assert.ok(mixesCode.includes('export async function makeCuratedThemedCover'), 'Must export makeCuratedThemedCover');
      assert.ok(mixesCode.includes('ctx.globalAlpha = 0.58') || mixesCode.includes('ctx.globalAlpha = 0.38'), 'Must blend photos with atmospheric opacity');
      assert.ok(mixesCode.includes('hexToRgba(color, 0.35)') || mixesCode.includes('hexToRgba(color, 0.38)'), 'Must draw glowing circular flare in theme color');
      assert.ok(mixesCode.includes('makeEraCoverSvg(badgeText, color, title'), 'Must fallback to SVG when in headless environment');
    });
  });
});
