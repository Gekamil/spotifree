import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

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
      const source = fs.readFileSync(fileURLToPath(url), 'utf8').replace(/\bimport\.meta\.env\b/g, '({})');
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

describe('v083: Artist Discography, Playlists & Bio Sections (Desktop + Mobile)', () => {
  it('1. Strict Zero-Emoji Rule across all modified and added files', () => {
    const files = [
      'api/metadata.js',
      'src/utils/artistDiscography.ts',
      'src/components/common/ArtistDiscoverySections.tsx',
      'src/components/desktop/DesktopPlaylistView.tsx',
      'src/components/mobile/MobilePlaylistView.tsx',
      'src/components/mobile/MobileLayout.tsx',
      'tests/v083_artist_discography_sections.test.mjs',
    ];
    const emojiPattern = /[\uD83C-\uDBFF\uDC00-\uDFFF]/;
    for (const rel of files) {
      const content = fs.readFileSync(path.resolve(rel), 'utf8');
      assert.equal(emojiPattern.test(content), false, `Emoji found in ${rel}`);
    }
  });

  it('2. Discography formatters & filters format albums, singles, EPs and latest releases accurately', async () => {
    const {
      formatReleaseTypeLabel,
      formatDesktopReleaseSubtitle,
      formatMobileReleaseSubtitle,
      filterAndSortDiscography,
    } = await import('../src/utils/artistDiscography.ts');

    assert.equal(formatReleaseTypeLabel('album'), 'Álbum');
    assert.equal(formatReleaseTypeLabel('single'), 'Sencillo');
    assert.equal(formatReleaseTypeLabel('ep'), 'EP');
    assert.equal(formatReleaseTypeLabel('compile'), 'Recopilatorio');

    const sample = [
      { id: 'alb-1', name: 'Formula Vol. 2', cover: null, year: '2014', recordType: 'album', fans: 90000 },
      { id: 'alb-2', name: 'Latest Single', cover: null, year: '2026', recordType: 'single', fans: 5000, isLatest: true },
      { id: 'alb-3', name: 'Live EP', cover: null, year: '2021', recordType: 'ep', fans: 2000 },
      { id: 'alb-4', name: 'Hits Compilation', cover: null, year: '2020', recordType: 'compile', fans: 1000 },
    ];

    assert.equal(formatDesktopReleaseSubtitle(sample[0]), '2014 • Álbum');
    assert.equal(formatDesktopReleaseSubtitle(sample[1]), 'Último lanzamiento • Sencillo');
    assert.equal(formatMobileReleaseSubtitle(sample[0]), 'Álbum • 2014');
    assert.equal(formatMobileReleaseSubtitle(sample[1]), 'Último lanzamiento • Sencillo • 2026');

    const popular = filterAndSortDiscography(sample, 'popular');
    assert.equal(popular[0].id, 'alb-1', 'Most popular album ranks first in popular tab');
    assert.equal(filterAndSortDiscography(sample, 'album').length, 1);
    assert.equal(filterAndSortDiscography(sample, 'single_ep').length, 2);
    assert.equal(filterAndSortDiscography(sample, 'compile').length, 1);
  });

  it('3. Backend /api/discover returns discography, playlists and bio while guarding non-music bios', async () => {
    const { default: metadataHandler } = await import('../api/metadata.js');
    const origFetch = globalThis.fetch;

    globalThis.fetch = async (url) => {
      const u = String(url);
      if (u.includes('api.deezer.com/search/artist')) {
        return {
          ok: true,
          json: async () => ({ data: [{ id: 123456, name: 'TestArtistV083', nb_fan: 500000, picture_xl: 'https://cdn.example/art.jpg' }] }),
        };
      }
      if (u.includes('/top?')) {
        return {
          ok: true,
          json: async () => ({
            data: [{ id: 11, title: 'Hit Song', duration: 200, artist: { id: 123456, name: 'TestArtistV083' }, album: { id: 55, title: 'Hit Album' } }],
          }),
        };
      }
      if (u.includes('/related?')) {
        return {
          ok: true,
          json: async () => ({
            data: [{ id: 777, name: 'Similar Friend', nb_fan: 100000, picture_xl: 'https://cdn.example/sim.jpg' }],
          }),
        };
      }
      if (u.includes('/albums?')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              { id: 501, title: 'Main Studio Album', release_date: '2023-05-10', record_type: 'album', fans: 80000, cover_xl: 'https://cdn.example/a1.jpg' },
              { id: 502, title: 'Main Studio Album', release_date: '2023-05-10', record_type: 'single', fans: 100, cover_xl: 'https://cdn.example/a1_dup.jpg' },
              { id: 503, title: 'Brand New Track', release_date: '2026-11-01', record_type: 'single', fans: 15000, cover_xl: 'https://cdn.example/a2.jpg' },
            ],
          }),
        };
      }
      if (u.includes('/search/playlist')) {
        return {
          ok: true,
          json: async () => ({
            data: [
              { id: 901, title: 'This Is TestArtistV083', user: { name: 'Editor' }, picture_xl: 'https://cdn.example/pl1.jpg' },
              { id: 902, title: 'Unrelated Workout Mix', user: { name: 'Random' }, picture_xl: 'https://cdn.example/pl2.jpg' },
            ],
          }),
        };
      }
      if (u.includes('es.wikipedia.org/api/rest_v1/page/summary/') && u.includes('_(cantante)')) {
        return {
          ok: true,
          json: async () => ({
            type: 'standard',
            description: 'escritor del Siglo de Oro',
            extract: 'Poeta antiguo no musical.',
          }),
        };
      }
      if (u.includes('en.wikipedia.org/api/rest_v1/page/summary/') && u.includes('_(singer)')) {
        return {
          ok: true,
          json: async () => ({
            type: 'standard',
            description: 'American singer and songwriter',
            extract: 'TestArtistV083 is a singer known for hits.',
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };

    try {
      let statusCode = 0;
      let payload = null;
      const req = {
        method: 'GET',
        url: '/api/metadata?action=discover&artist=TestArtistV083',
        query: { action: 'discover', artist: 'TestArtistV083' },
        headers: { host: 'localhost' },
      };
      const res = {
        setHeader() {},
        status(code) { statusCode = code; return this; },
        json(data) { payload = data; return this; },
      };

      await metadataHandler(req, res);
      assert.equal(statusCode, 200);
      assert.ok(Array.isArray(payload.discography), 'discography array must be returned');
      assert.equal(payload.discography.length, 2, 'Duplicate album title must deduplicate preferring album over single');
      assert.equal(payload.discography[0].id, 'alb-503', 'Newest release sorts first');
      assert.equal(payload.discography[0].isLatest, true, 'Newest release is marked isLatest');
      assert.ok(Array.isArray(payload.playlists), 'playlists array must be returned');
      assert.ok(payload.playlists.some((p) => p.name.includes('TestArtistV083')), 'Artist playlist match must be kept');
      assert.equal(payload.playlists.some((p) => p.name.includes('Unrelated')), false, 'Unrelated playlists must be filtered out');
      assert.equal(payload.bio, 'TestArtistV083 is a singer known for hits.', 'Non-music summary must be skipped until verified musician bio');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('4. DesktopPlaylistView and MobilePlaylistView preserve existing artist buttons and integrate discography & playlists', () => {
    const desktopCode = fs.readFileSync(path.resolve('src/components/desktop/DesktopPlaylistView.tsx'), 'utf8');
    const mobileCode = fs.readFileSync(path.resolve('src/components/mobile/MobilePlaylistView.tsx'), 'utf8');
    const sectionsCode = fs.readFileSync(path.resolve('src/components/common/ArtistDiscoverySections.tsx'), 'utf8');

    // Existing preserved behavior & tests
    assert.ok(desktopCode.includes('Remixes, Leaks y Slowed'));
    assert.ok(desktopCode.includes('Fans también escuchan'));
    assert.ok(desktopCode.indexOf('const [artistDiscography') < desktopCode.indexOf('if (isDJ) {'));
    assert.ok(mobileCode.includes('Remixes, Leaks y Slowed'));
    assert.ok(mobileCode.includes('Fans también escuchan'));
    assert.ok(mobileCode.includes('playTrack(track, displayTracks, playlist.id, playlist.name)'));

    // New Spotify artist discovery sections present
    assert.ok(desktopCode.includes('DesktopArtistDiscographySection'));
    assert.ok(desktopCode.includes('DesktopArtistPlaylistsSection'));
    assert.ok(desktopCode.includes('DesktopArtistAboutCard'));
    assert.ok(desktopCode.includes('Ver más'));

    assert.ok(mobileCode.includes('MobileArtistDiscoverySections'));
    assert.ok(mobileCode.includes('Ver más'));

    assert.ok(sectionsCode.includes('Títulos populares'));
    assert.ok(sectionsCode.includes('Ver discografía'));
    assert.ok(sectionsCode.includes('Listas del artista'));
    assert.ok(sectionsCode.includes('Incluye a {artistName}'));
    assert.ok(sectionsCode.includes('Discografía'));
  });

  it('5. Version 1.2 release metadata and changelog entry are valid', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
    const changelog = fs.readFileSync(path.resolve('src/data/changelog.ts'), 'utf8');

    assert.equal(pkg.version, '1.2.0');
    assert.ok(changelog.includes("export const APP_VERSION = '1.2';"));
    assert.ok(changelog.includes("version: '1.2'"));
  });
});
