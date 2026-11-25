import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

// Minimal browser mocks for Zustand and storage
const storageMap = new Map();
if (!globalThis.window) {
  globalThis.window = {
    location: { origin: 'http://localhost', search: '', pathname: '/', hash: '' },
    localStorage: {
      getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
      setItem: (k, v) => storageMap.set(k, String(v)),
      removeItem: (k) => storageMap.delete(k),
      clear: () => storageMap.clear(),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  };
}
if (!globalThis.CustomEvent) {
  globalThis.CustomEvent = class CustomEvent extends Event {
    constructor(type, params) {
      super(type, params);
      this.detail = params?.detail;
    }
  };
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const parent = context.parentURL || '';
    const isProjectFile = !parent.includes('/node_modules/') && !parent.includes('\\node_modules\\');
    if (isProjectFile && (specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[a-z0-9]+$/i.test(specifier) && parent) {
      for (const ext of ['.ts', '.tsx', '.js']) {
        const candidate = new URL(`${specifier}${ext}`, parent);
        if (fs.existsSync(fileURLToPath(candidate))) {
          return nextResolve(candidate.href, context);
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if ((url.endsWith('.tsx') || url.endsWith('.ts')) && !url.includes('/node_modules/')) {
      const source = fs
        .readFileSync(fileURLToPath(url), 'utf8')
        .replace(/\bimport\.meta\.env\b/g, '({})');
      const transpiled = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.React,
        },
        fileName: fileURLToPath(url),
      });
      return { format: 'module', source: transpiled.outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

describe('Album Navigation & Track Loading Reliability', () => {
  it('1. Strict Zero-Emoji Rule: No emojis anywhere in modified code, tests or comments', () => {
    const filesToCheck = [
      'src/services/albumService.ts',
      'src/components/desktop/DesktopPlaylistView.tsx',
      'src/components/desktop/DesktopPlayer.tsx',
      'src/components/desktop/DesktopLayout.tsx',
      'src/components/mobile/MobilePlaylistView.tsx',
      'src/components/mobile/MobileLayout.tsx',
      'src/components/mobile/MobileNowPlayingModal.tsx',
      'server.mjs',
      'api/playlist.js',
      'tests/album_navigation_reliability.test.mjs',
    ];

    const emojiPattern = /[\uD83C-\uDBFF\uDC00-\uDFFF]/;
    for (const rel of filesToCheck) {
      const fullPath = path.resolve(rel);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        assert.equal(emojiPattern.test(content), false, `Emoji found in ${rel}`);
      }
    }
  });

  it('2. isAlbumIdentifier accurately detects album types and prefixes', async () => {
    const { isAlbumIdentifier } = await import('../src/services/albumService.ts');
    assert.equal(isAlbumIdentifier('alb-316164367'), true);
    assert.equal(isAlbumIdentifier('album-xyz'), true);
    assert.equal(isAlbumIdentifier('37i9dQZF1DXcBWIGoYBM5M', 'album'), true);
    assert.equal(isAlbumIdentifier('37i9dQZF1DXcBWIGoYBM5M', 'playlist', 'Álbum de Bad Bunny'), true);
    assert.equal(isAlbumIdentifier('spotify:album:4aawyAB9vmqN3uQ7FjRGTy'), true);
    assert.equal(isAlbumIdentifier('37i9dQZF1DXcBWIGoYBM5M', 'playlist', 'Lista oficial'), false);
    assert.equal(isAlbumIdentifier('liked-songs'), false);
  });

  it('3. DesktopLayout parses album IDs and alb-name- prefixes', () => {
    const layoutCode = fs.readFileSync(path.resolve('src/components/desktop/DesktopLayout.tsx'), 'utf8');
    assert.match(layoutCode, /cleanId\.startsWith\('album-'\)/, 'DesktopLayout must recognize album- prefix');
    assert.match(layoutCode, /fallbackName\.startsWith\('name-'\)/, 'DesktopLayout must decode name- prefix in album IDs');
    assert.match(layoutCode, /type:\s*isArtist\s*\?\s*'artist'\s*:\s*'album'/, 'DesktopLayout must assign album type');
  });

  it('4. MobileLayout sets type album and description Álbum for album navigation', () => {
    const mobileCode = fs.readFileSync(path.resolve('src/components/mobile/MobileLayout.tsx'), 'utf8');
    assert.match(mobileCode, /const isAlbum = cleanId\.startsWith\('alb-'\) \|\| cleanId\.startsWith\('album-'\);/, 'MobileLayout must check isAlbum');
    assert.match(mobileCode, /type:\s*isArtist\s*\?\s*'artist'\s*:\s*isAlbum\s*\?\s*'album'\s*:\s*'playlist'/, 'MobileLayout must set album type');
    assert.match(mobileCode, /description:\s*isArtist\s*\?\s*'Artista'\s*:\s*isAlbum\s*\?\s*'Álbum'\s*:\s*''/, 'MobileLayout must set Álbum description');
  });

  it('5. DesktopPlaylistView and MobilePlaylistView use fetchAlbumTracks to load album tracks', () => {
    const desktopView = fs.readFileSync(path.resolve('src/components/desktop/DesktopPlaylistView.tsx'), 'utf8');
    const mobileView = fs.readFileSync(path.resolve('src/components/mobile/MobilePlaylistView.tsx'), 'utf8');

    assert.match(desktopView, /fetchAlbumTracks/, 'DesktopPlaylistView must import and call fetchAlbumTracks');
    assert.match(desktopView, /setDynamicTracks\(albumRes\.tracks\)/, 'DesktopPlaylistView must populate dynamic tracks on album load');

    assert.match(mobileView, /fetchAlbumTracks/, 'MobilePlaylistView must import and call fetchAlbumTracks');
    assert.match(mobileView, /setTracks\(albumRes\.tracks\)/, 'MobilePlaylistView must populate tracks on mobile album load');
  });

  it('6. MobileNowPlayingModal Ir al álbum passes valid prefixed album ID and cover art', () => {
    const nowPlayingCode = fs.readFileSync(path.resolve('src/components/mobile/MobileNowPlayingModal.tsx'), 'utf8');
    assert.match(nowPlayingCode, /const albName = currentTrack\.album\?\.name \|\| currentTrack\.name;/, 'Must extract album or track name');
    assert.match(nowPlayingCode, /const albId = rawAlbId\.startsWith\('alb-'\) \|\| rawAlbId\.startsWith\('album-'\) \? rawAlbId : `alb-\$\{rawAlbId\}`;/, 'Must prefix album ID with alb-');
    assert.match(nowPlayingCode, /onSelectPlaylistById\(albId, albName, albCover\);/, 'Must pass albId, albName and albCover');
  });

  it('7. DesktopPlayer clicking track or artwork passes album details and alb- prefix', () => {
    const desktopPlayerCode = fs.readFileSync(path.resolve('src/components/desktop/DesktopPlayer.tsx'), 'utf8');
    assert.match(desktopPlayerCode, /const albName = currentTrack\.album\?\.name \|\| currentTrack\.name;/, 'Must resolve album name');
    assert.match(desktopPlayerCode, /onSelectPlaylistById\?\.\(albId, albName, toHDImage\(activeArtworkUrl\)\);/, 'Must pass albId, albName and activeArtworkUrl');
  });

  it('8. Server and API playlist handlers sanitize alb- before Spotify queries and support embed album', () => {
    const serverCode = fs.readFileSync(path.resolve('server.mjs'), 'utf8');
    const apiPlaylistCode = fs.readFileSync(path.resolve('api/playlist.js'), 'utf8');

    assert.match(serverCode, /const cleanAlbId = rawId\.replace\(\/\^\(alb-\|album-\)\/, ''\);/, 'Server must clean alb- prefix');
    assert.match(serverCode, /cleanAlbId\.startsWith\('itunes-'\)/, 'Server must support iTunes album IDs');
    assert.match(serverCode, /https:\/\/open\.spotify\.com\/embed\/\$\{et\}\/\$\{cleanTargetId\}/, 'Server must check embed album with cleaned target ID');

    assert.match(apiPlaylistCode, /const rawDzId = cleanId\.replace\(\/\^\(alb-\|album-\)\/, ''\);/, 'API must clean alb- prefix');
    assert.match(apiPlaylistCode, /rawDzId\.startsWith\('itunes-'\)/, 'API must support iTunes album IDs');
    assert.match(apiPlaylistCode, /spotify:album:\$\{spotifyAlbumId\}/, 'API must query Pathfinder album with cleaned ID');
  });
});
