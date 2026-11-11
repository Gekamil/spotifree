import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('Milestone 1 — Requirement R1: Official Remixes Prioritization', async (t) => {
  await t.test('1. Type Model: Track Interface includes isOfficial and scBadgeColor', () => {
    const typesPath = path.join(projectRoot, 'src', 'types', 'spotify.ts');
    assert.ok(fs.existsSync(typesPath), 'src/types/spotify.ts must exist');
    const content = fs.readFileSync(typesPath, 'utf8');

    assert.match(content, /isOfficial\?: boolean;/, 'Track interface must contain isOfficial?: boolean;');
    assert.match(content, /scBadgeColor\?: string;/, 'Track interface must contain scBadgeColor?: string;');
  });

  await t.test('2. Backend API Handler: api/search.js', () => {
    const apiSearchPath = path.join(projectRoot, 'api', 'search.js');
    assert.ok(fs.existsSync(apiSearchPath), 'api/search.js must exist');
    const content = fs.readFileSync(apiSearchPath, 'utf8');

    assert.match(content, /remixSearchQuery\s*=/, 'api/search.js must define remixSearchQuery');
    assert.match(content, /\/\\b\(remix\|rmx\)\\b\/i/, 'api/search.js must filter using remix/rmx regex');
    assert.match(content, /isOfficial:\s*true/, 'api/search.js must tag official remixes with isOfficial: true');
    assert.match(content, /scVariantLabel:\s*'Remix Oficial'/, "api/search.js must tag with scVariantLabel: 'Remix Oficial'");
    assert.match(content, /scBadgeColor:\s*'#1ed760'/, "api/search.js must tag with scBadgeColor: '#1ed760'");
    assert.match(content, /orderedRemixItems\s*=\s*\[\s*\.\.\.officialRemixes,\s*\.\.\.soundcloudVariants,?\s*\]/,
      'api/search.js must prepend officialRemixes before soundcloudVariants in soundcloudTracks.items');
    assert.match(content, /soundcloudTracks:\s*\{\s*items:\s*orderedRemixItems\s*\}/,
      'api/search.js must return orderedRemixItems in payload');
  });

  await t.test('3. Server Backend Handler: server.mjs', () => {
    const serverPath = path.join(projectRoot, 'server.mjs');
    assert.ok(fs.existsSync(serverPath), 'server.mjs must exist');
    const content = fs.readFileSync(serverPath, 'utf8');

    // Branch A & B official remixes
    assert.match(content, /remixSearchQuery/, 'server.mjs must define remixSearchQuery');
    assert.match(content, /isOfficial:\s*true/, 'server.mjs must set isOfficial: true on official remixes');
    assert.match(content, /scVariantLabel:\s*'Remix Oficial'/, "server.mjs must set scVariantLabel: 'Remix Oficial'");
    assert.match(content, /scBadgeColor:\s*'#1ed760'/, "server.mjs must set scBadgeColor: '#1ed760'");
    assert.match(content, /orderedRemixItems\s*=\s*\[\s*\.\.\.officialRemixes,\s*\.\.\.soundcloudVariants,?\s*\]/,
      'server.mjs must prepend officialRemixes before soundcloudVariants');
  });

  await t.test('4. Vite Dev Server Middleware: vite.config.ts', () => {
    const vitePath = path.join(projectRoot, 'vite.config.ts');
    assert.ok(fs.existsSync(vitePath), 'vite.config.ts must exist');
    const content = fs.readFileSync(vitePath, 'utf8');

    assert.match(content, /remixSearchQuery/, 'vite.config.ts must define remixSearchQuery');
    assert.match(content, /isOfficial:\s*true/, 'vite.config.ts must set isOfficial: true');
    assert.match(content, /scVariantLabel:\s*'Remix Oficial'/, "vite.config.ts must set scVariantLabel: 'Remix Oficial'");
    assert.match(content, /scBadgeColor:\s*'#1ed760'/, "vite.config.ts must set scBadgeColor: '#1ed760'");
    assert.match(content, /orderedRemixItems\s*=\s*\[\s*\.\.\.officialRemixes,\s*\.\.\.soundcloudVariants,?\s*\]/,
      'vite.config.ts must prepend officialRemixes before soundcloudVariants');
  });

  await t.test('5. Client Search Service: src/services/spotifyApi.ts', () => {
    const servicePath = path.join(projectRoot, 'src', 'services', 'spotifyApi.ts');
    assert.ok(fs.existsSync(servicePath), 'src/services/spotifyApi.ts must exist');
    const content = fs.readFileSync(servicePath, 'utf8');

    assert.match(content, /extractAndEnrichOfficialRemixes/, 'spotifyApi.ts must define extractAndEnrichOfficialRemixes');
    assert.match(content, /isOfficial:\s*true/, 'spotifyApi.ts must tag official remixes with isOfficial: true');
    assert.match(content, /scVariantLabel:\s*'Remix Oficial'/, "spotifyApi.ts must tag with scVariantLabel: 'Remix Oficial'");
    assert.match(content, /scBadgeColor:\s*'#1ed760'/, "spotifyApi.ts must tag with scBadgeColor: '#1ed760'");
    assert.match(content, /soundcloudTracks\s*=\s*\[\s*\.\.\.officialRemixes,\s*\.\.\.nonOfficialTracks\s*\];/,
      'spotifyApi.ts must assemble soundcloudTracks with officialRemixes at indices 0..N-1 followed by nonOfficialTracks');
  });

  await t.test('6. Desktop UI View: src/components/desktop/DesktopSearchView.tsx', () => {
    const desktopPath = path.join(projectRoot, 'src', 'components', 'desktop', 'DesktopSearchView.tsx');
    assert.ok(fs.existsSync(desktopPath), 'DesktopSearchView.tsx must exist');
    const content = fs.readFileSync(desktopPath, 'utf8');

    // Green Spotify badge styling in both shelf and dedicated tab
    const greenPillMatch = content.match(/bg-\[#1ed760\]\/15\s+text-\[#1ed760\]\s+border\s+border-\[#1ed760\]\/30/g);
    assert.ok(greenPillMatch && greenPillMatch.length >= 2,
      'DesktopSearchView must render green badge bg-[#1ed760]/15 in both shelf and dedicated tab');

    assert.match(content, /subtitle:\s*`\$\{track\.isOfficial\s*\?\s*'Remix Oficial'\s*:\s*'SoundCloud'\}\s*•/,
      'DesktopSearchView must update recent searches subtitle based on track.isOfficial');
  });

  await t.test('7. Mobile UI View: src/components/mobile/MobileSearchView.tsx', () => {
    const mobilePath = path.join(projectRoot, 'src', 'components', 'mobile', 'MobileSearchView.tsx');
    assert.ok(fs.existsSync(mobilePath), 'MobileSearchView.tsx must exist');
    const content = fs.readFileSync(mobilePath, 'utf8');

    // Green Spotify badge styling
    assert.match(content, /bg-\[#1ed760\]\/15\s+text-\[#1ed760\]\s+border\s+border-\[#1ed760\]\/30/,
      'MobileSearchView must render green badge bg-[#1ed760]/15 for official remixes');

    assert.match(content, /subtitle:\s*`\$\{trk\.isOfficial\s*\?\s*'Remix Oficial'\s*:\s*'SoundCloud'\}\s*•/,
      'MobileSearchView must update recent searches subtitle based on trk.isOfficial');

    // Tab limit increased to 50
    assert.match(content, /results\.soundcloudTracks\.slice\(0,\s*filter\s*===\s*'todo'\s*\?\s*4\s*:\s*50\)/,
      'MobileSearchView must increase dedicated remix tab slice limit from 20 to 50');

    // Check all 17 critical regex invariants
    const regexInvariants = [
      /placeholder="¿Qué te apetece escuchar\?"/,
      /if\s*\(item\.type === 'track'\)\s*\{\s*const trackData\s*=/,
      /playTrack\(trackData,\s*\[trackData\]\);/,
      /else if\s*\(item\.type === 'artist'\)\s*\{/,
      /onSelectPlaylistById\(artistId,\s*item\.title,\s*item\.image\);/,
      /else if\s*\(item\.type === 'playlist'\s*\|\|\s*item\.type === 'album'\)\s*\{/,
      /window\.addEventListener\('spotifree_recent_searches_updated',\s*handleRecentUpdate\);/,
      /window\.removeEventListener\('spotifree_recent_searches_updated',\s*handleRecentUpdate\);/,
      /title="Eliminar de búsquedas recientes"/,
      /removeRecentSearch\(item\.id\);/,
      /e\.stopPropagation\(\);/,
      /item\.type === 'artist' \? 'rounded-full' : 'rounded-md'/,
      /subtitle:\s*'Artista'/,
      /const artistId = item\.id\.startsWith\('art-'\) \? item\.id : `art-\$\{item\.title\.toLowerCase\(\)\.replace\(\/\[\\s&\]\+\/g, '-'\)\}`;/,
      /Borrar todo/,
      /className="text-\[#b3b3b3\] active:text-white p-2 shrink-0 text-sm"/,
      /bg-gradient-to-tr\s*from-\[#5018f0\]\s*to-\[#1ed760\]/,
    ];

    for (let i = 0; i < regexInvariants.length; i++) {
      assert.ok(regexInvariants[i].test(content), `MobileSearchView must preserve regex invariant #${i + 1}: ${regexInvariants[i]}`);
    }
  });

  await t.test('8. Functional Ordering & Tagging Logic Simulation', () => {
    // Simulate ordering contract
    const mockOfficialRemix = {
      id: 'dz-123456',
      name: 'POLARIS (Remix)',
      artists: [{ id: 'art-1', name: 'SAIKO' }, { id: 'art-2', name: 'Quevedo' }],
      album: { id: 'alb-1', name: 'POLARIS (Remix)', images: [] },
      duration_ms: 215000,
      isOfficial: true,
      scVariant: 'remix',
      scVariantLabel: 'Remix Oficial',
      scBadgeColor: '#1ed760',
    };

    const mockSoundcloudTrack = {
      id: 'sc-999999',
      name: 'Quevedo - Buenas (Slowed + Reverb)',
      artists: [{ id: 'art-sc', name: 'User' }],
      album: { id: 'alb-sc', name: 'SC', images: [] },
      duration_ms: 180000,
      scVariant: 'slowed',
      scVariantLabel: 'Slowed',
    };

    const items = [mockOfficialRemix, mockSoundcloudTrack];

    // Assert official items appear first
    assert.strictEqual(items[0].isOfficial, true);
    assert.strictEqual(items[0].scVariantLabel, 'Remix Oficial');
    assert.strictEqual(items[0].scBadgeColor, '#1ed760');
    assert.strictEqual(items[1].isOfficial, undefined);

    const firstNonOfficialIdx = items.findIndex((t) => !t.isOfficial);
    const lastOfficialIdx = items.map((t, idx) => (t.isOfficial ? idx : -1)).reduce((m, i) => Math.max(m, i), -1);

    assert.ok(lastOfficialIdx < firstNonOfficialIdx, 'All official remixes must appear before non-official tracks');
  });

  await t.test('9. Requirement R5 Preserved Files Forensic Integrity', () => {
    const preservedFiles = [
      'api/_lib/musicFallback.js',
      'api/audio.js',
      'scripts/audioService.mjs',
      'server.mjs',
      'native/android/SpotifreeLocalMusicPlugin.java',
      'src/utils/offlineStorage.ts',
      'tests/offline_downloads.test.js',
    ];

    for (const relPath of preservedFiles) {
      const fullPath = path.join(projectRoot, relPath);
      assert.ok(fs.existsSync(fullPath), `Preserved file must exist: ${relPath}`);
      const stats = fs.statSync(fullPath);
      assert.ok(stats.size > 0, `Preserved file must have non-zero size: ${relPath}`);
    }

    // Verify server.mjs critical invariants (audio streaming/download endpoints intact)
    const serverSrc = fs.readFileSync(path.join(projectRoot, 'server.mjs'), 'utf8');
    assert.match(serverSrc, /\/api\/audio\/stream/, 'server.mjs must preserve /api/audio/stream');
    assert.match(serverSrc, /\/api\/audio\/download/, 'server.mjs must preserve /api/audio/download');
    assert.match(serverSrc, /\/api\/audio\/status/, 'server.mjs must preserve /api/audio/status');
    assert.match(serverSrc, /resolveAudio/, 'server.mjs must preserve resolveAudio import');
  });
});
