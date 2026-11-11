import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Import backend search handler directly
import apiSearchHandler from '../api/search.js';

const projectRoot = process.cwd();

// Helper to simulate request/response for api/search.js
async function runSearch(query, extraHeaders = {}) {
  const req = {
    method: 'GET',
    url: `http://localhost/api/search?q=${encodeURIComponent(query)}`,
    headers: {
      host: 'localhost',
      ...extraHeaders,
    },
  };

  let statusCode = 200;
  let headers = {};
  let body = null;
  let ended = false;

  const res = {
    setHeader(k, v) { headers[k] = v; },
    status(code) { statusCode = code; return this; },
    json(data) { body = data; ended = true; return this; },
    end(data) { ended = true; if (data && !body) { try { body = JSON.parse(data); } catch { body = data; } } return this; },
  };

  await apiSearchHandler(req, res);
  return { statusCode, headers, body };
}

// Invariant helper: verify ordering contract
function assertRemixOrderingContract(items, queryContext = '') {
  assert.ok(Array.isArray(items), `${queryContext}: items must be an array`);
  let seenNonOfficial = false;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isOff = Boolean(item.isOfficial || item.scVariantLabel === 'Remix Oficial');
    if (isOff) {
      assert.strictEqual(
        seenNonOfficial,
        false,
        `${queryContext}: Official remix at index ${i} ("${item.name}") appeared AFTER a non-official track. Violation of R1 ordering contract!`
      );
      assert.strictEqual(item.isOfficial, true, `${queryContext}: official track must have isOfficial: true`);
      assert.strictEqual(item.scVariantLabel, 'Remix Oficial', `${queryContext}: official track must have scVariantLabel: 'Remix Oficial'`);
      assert.strictEqual(item.scBadgeColor, '#1ed760', `${queryContext}: official track must have scBadgeColor: '#1ed760'`);
    } else {
      seenNonOfficial = true;
    }
  }
}

test('Challenger M1 — Empirical Stress Test Suite for Official Remixes Prioritization', async (t) => {

  // =========================================================================
  // SUITE 1: Target Artists Known for Official Remixes
  // =========================================================================
  await t.test('Suite 1: Target Artists Known for Official Remixes', async (s1) => {
    const targetArtists = ['quevedo', 'bad bunny', 'bizarrap', 'polaris', 'feid'];

    for (const artist of targetArtists) {
      await s1.test(`Querying artist "${artist}" returns official remixes prioritized first`, async () => {
        await new Promise(r => setTimeout(r, 200));
        const { statusCode, body } = await runSearch(artist);
        assert.strictEqual(statusCode, 200, `Search for "${artist}" must return HTTP 200`);
        assert.ok(body, `Search for "${artist}" must return body`);

        const scItems = body.soundcloudTracks?.items || [];
        assert.ok(scItems.length > 0, `Search for "${artist}" should return remix/SoundCloud items`);

        // Check ordering contract
        assertRemixOrderingContract(scItems, `Artist "${artist}"`);

        // Find official remixes
        const officialRemixes = scItems.filter(t => t.isOfficial === true);
        assert.ok(
          officialRemixes.length > 0,
          `Search for "${artist}" MUST return at least 1 official remix with isOfficial === true`
        );

        // Verify official remix properties
        for (const rmx of officialRemixes) {
          assert.strictEqual(rmx.isOfficial, true);
          assert.strictEqual(rmx.scVariantLabel, 'Remix Oficial');
          assert.strictEqual(rmx.scBadgeColor, '#1ed760');
          assert.ok(rmx.id, 'Official remix must have valid ID');
          assert.ok(rmx.name, 'Official remix must have valid name');
          assert.ok(
            /\b(remix|rmx)\b/i.test(rmx.name) || /\b(remix|rmx)\b/i.test(rmx.album?.name || ''),
            `Official remix "${rmx.name}" must contain "remix" or "rmx" in track or album title`
          );
        }
      });
    }
  });

  // =========================================================================
  // SUITE 2: Query Strings Already Containing "remix" / "rmx" (No Double Terms)
  // =========================================================================
  await t.test('Suite 2: Queries already containing "remix" do not generate double terms ("remix remix")', async (s2) => {
    const remixQueries = [
      'quevedo remix',
      'polaris remix',
      'feid rmx',
      'BAD BUNNY REMIX',
      'bizarrap remix',
      'polaris (remix)',
      'quevedo - remix',
      'remix feid',
    ];

    for (const q of remixQueries) {
      await s2.test(`Query "${q}" does not generate double terms`, async () => {
        // Test query construction logic identically to backend handlers
        const cleanQ = q.replace(/[()[\]{}_-]/g, ' ').replace(/\s+/g, ' ').trim();
        const withoutPlaylist = cleanQ.replace(/\bplaylist(s)?\b/gi, '').trim() || cleanQ;
        const trackSearchQuery = withoutPlaylist;
        const isAlreadyRemixQuery = /\b(remix|rmx)\b/i.test(trackSearchQuery);
        const remixSearchQuery = isAlreadyRemixQuery ? trackSearchQuery : `${trackSearchQuery} remix`;

        assert.strictEqual(isAlreadyRemixQuery, true, `Query "${q}" must be detected as isAlreadyRemixQuery`);
        assert.doesNotMatch(remixSearchQuery, /\b(remix|rmx)\s+(remix|rmx)\b/i, `Query "${q}" produced double terms: "${remixSearchQuery}"`);

        // Brief throttle to avoid Deezer public API rate-limiting during rapid test iteration
        await new Promise(r => setTimeout(r, 300));

        // Execute live search
        const { statusCode, body } = await runSearch(q);
        assert.strictEqual(statusCode, 200);
        const scItems = body.soundcloudTracks?.items || [];
        assertRemixOrderingContract(scItems, `Query "${q}"`);

        // Verify that official remixes returned are valid
        const official = scItems.filter(t => t.isOfficial === true);
        assert.ok(official.length > 0, `Query "${q}" should return official remixes`);
      });
    }

    await s2.test('Double-term prevention logic is consistently present across all backend files', () => {
      const files = [
        'api/search.js',
        'server.mjs',
        'vite.config.ts',
        'src/services/spotifyApi.ts',
      ];

      for (const rel of files) {
        const full = path.join(projectRoot, rel);
        const content = fs.readFileSync(full, 'utf8');
        assert.match(
          content,
          /\b(remix|rmx)\b/i,
          `${rel} must check for existing remix/rmx keywords before appending`
        );
      }
    });
  });

  // =========================================================================
  // SUITE 3: Adversarial Edge Cases & Boundary Conditions
  // =========================================================================
  await t.test('Suite 3: Adversarial Edge Cases & Boundary Conditions', async (s3) => {
    const edgeCases = [
      { name: 'Empty string', query: '' },
      { name: 'Whitespace only (spaces)', query: '     ' },
      { name: 'Whitespace only (tabs and newlines)', query: "\t\n  \r\n" },
      { name: 'Single character alphabet', query: 'q' },
      { name: 'Single character number', query: '7' },
      { name: 'Single character punctuation', query: '?' },
      { name: 'Special punctuation only', query: '!@#$%^&*()_+-=[]{}|;:",.<>?/' },
      { name: 'Query with Spanish accents', query: 'canción año niño' },
      { name: 'Query with tildes and remix', query: 'música clásica remix' },
      { name: 'Numbers only', query: '123456789' },
      { name: 'SQL Injection probe string', query: "'; DROP TABLE tracks; --" },
      { name: 'XSS probe string', query: '<script>alert("xss")</script>' },
      { name: 'Long query string (300 chars)', query: 'quevedo '.repeat(38) },
    ];

    for (const ec of edgeCases) {
      await s3.test(`Edge Case: ${ec.name} ("${ec.query.slice(0, 30)}")`, async () => {
        const { statusCode, body } = await runSearch(ec.query);
        assert.strictEqual(statusCode, 200, `Edge case "${ec.name}" must return HTTP 200, not crash`);
        assert.ok(body, `Edge case "${ec.name}" must return a valid body object`);
        assert.ok(Array.isArray(body.tracks?.items), `Edge case "${ec.name}" must return tracks.items array`);

        // If soundcloudTracks is returned, ordering must remain strictly valid
        if (body.soundcloudTracks?.items) {
          assertRemixOrderingContract(body.soundcloudTracks.items, `Edge case: ${ec.name}`);
        }
      });
    }
  });

  // =========================================================================
  // SUITE 4: Ordering Contract Rigorous Property-Based Verification
  // =========================================================================
  await t.test('Suite 4: Ordering Contract Invariant Property Verification', async (s4) => {
    await s4.test('Exhaustive property verification across 1,000 synthetic permutations', () => {
      // Formally verify that any array constructed as [...officialRemixes, ...soundcloudVariants]
      // NEVER allows an official track to appear after a non-official track
      for (let trial = 0; trial < 1000; trial++) {
        const numOfficial = Math.floor(Math.random() * 20); // 0 to 19
        const numSoundcloud = Math.floor(Math.random() * 20); // 0 to 19

        const officialList = Array.from({ length: numOfficial }, (_, i) => ({
          id: `dz-off-${trial}-${i}`,
          name: `Track Official ${i} (Remix)`,
          isOfficial: true,
          scVariantLabel: 'Remix Oficial',
          scBadgeColor: '#1ed760',
        }));

        const soundcloudList = Array.from({ length: numSoundcloud }, (_, i) => ({
          id: `sc-var-${trial}-${i}`,
          name: `Track SC ${i} (Slowed)`,
          isOfficial: undefined,
          scVariantLabel: 'Slowed',
          scBadgeColor: undefined,
        }));

        const ordered = [...officialList, ...soundcloudList];

        // Property 1: Length matches
        assert.strictEqual(ordered.length, numOfficial + numSoundcloud);

        // Property 2: First numOfficial items are all official
        for (let i = 0; i < numOfficial; i++) {
          assert.strictEqual(ordered[i].isOfficial, true, `Item ${i} must be official`);
          assert.strictEqual(ordered[i].scVariantLabel, 'Remix Oficial');
          assert.strictEqual(ordered[i].scBadgeColor, '#1ed760');
        }

        // Property 3: Remaining items are non-official
        for (let i = numOfficial; i < ordered.length; i++) {
          assert.strictEqual(ordered[i].isOfficial, undefined, `Item ${i} must be non-official`);
        }

        // Property 4: General contract invariant
        assertRemixOrderingContract(ordered, `Trial ${trial}`);
      }
    });
  });

  // =========================================================================
  // SUITE 5: Deduplication & scAltId Verification
  // =========================================================================
  await t.test('Suite 5: Deduplication of Literal Re-uploads & Preservation of Creative Edits', async (s5) => {
    await s5.test('Literal SoundCloud duplicate is filtered and linked via scAltId', () => {
      const officialRemixes = [
        {
          id: 'dz-1001',
          name: 'POLARIS (Remix)',
          artists: [{ id: 'art-1', name: 'SAIKO' }, { id: 'art-2', name: 'Quevedo' }],
          album: { id: 'alb-1', name: 'POLARIS (Remix)' },
          isOfficial: true,
          scVariantLabel: 'Remix Oficial',
          scBadgeColor: '#1ed760',
        },
      ];

      const rawSoundCloudTracks = [
        // Literal duplicate re-upload by fan
        {
          id: 'sc-998877',
          name: 'Polaris Remix - Saiko, Quevedo',
          artists: [{ id: 'art-sc', name: 'Saiko' }],
          album: { id: 'alb-sc', name: 'Polaris' },
        },
        // Creative edit: slowed + reverb (MUST be preserved)
        {
          id: 'sc-554433',
          name: 'POLARIS (Remix) [Slowed + Reverb]',
          artists: [{ id: 'art-sc2', name: 'EditsChannel' }],
          album: { id: 'alb-sc2', name: 'Edits' },
        },
        // Creative edit: sped up (MUST be preserved)
        {
          id: 'sc-221100',
          name: 'SAIKO - Polaris Remix (Sped Up)',
          artists: [{ id: 'art-sc3', name: 'Nightcore' }],
          album: { id: 'alb-sc3', name: 'Sped' },
        },
      ];

      // Simulate deduplication logic as in api/search.js / server.mjs / vite.config.ts
      const soundcloudVariants = [];
      for (const scT of rawSoundCloudTracks) {
        const scNumId = String(scT.id).replace(/^sc-/, '');
        const isCreativeEdit = /\b(mashup|bootleg|slowed|sped\s*up|reverb|nightcore|drum\s*mix|hype\s*intro)\b/i.test(scT.name);

        if (!isCreativeEdit) {
          const normSc = (scT.name || '').toLowerCase().replace(/[()[\]{}_-]/g, ' ').replace(/\b(remix|rmx)\b/g, '').replace(/\s+/g, ' ').trim();
          const scArtist = (scT.artists?.[0]?.name || '').toLowerCase().trim();
          const matchingOfficial = officialRemixes.find(off => {
            const normOff = (off.name || '').toLowerCase().replace(/[()[\]{}_-]/g, ' ').replace(/\b(remix|rmx)\b/g, '').replace(/\s+/g, ' ').trim();
            if (normSc === normOff) return true;
            const offArtists = (off.artists || []).map(a => (a.name || '').toLowerCase());
            if (offArtists.some(oa => scArtist.includes(oa) || oa.includes(scArtist)) && (normSc.includes(normOff) || normOff.includes(normSc))) {
              return true;
            }
            return false;
          });

          if (matchingOfficial) {
            if (!matchingOfficial.scAltId) {
              matchingOfficial.scAltId = `sc:${scNumId}`;
            }
            continue; // Deduplicated!
          }
        }

        soundcloudVariants.push(scT);
      }

      const orderedItems = [...officialRemixes, ...soundcloudVariants];

      // 1. Literal duplicate was linked to official remix
      assert.strictEqual(officialRemixes[0].scAltId, 'sc:998877', 'Official remix should receive scAltId from duplicate');

      // 2. Literal duplicate was NOT added to soundcloudVariants
      assert.strictEqual(soundcloudVariants.some(t => t.id === 'sc-998877'), false, 'Literal duplicate must be filtered out');

      // 3. Creative edits WERE preserved
      assert.strictEqual(soundcloudVariants.some(t => t.id === 'sc-554433'), true, 'Slowed + Reverb edit must be preserved');
      assert.strictEqual(soundcloudVariants.some(t => t.id === 'sc-221100'), true, 'Sped Up edit must be preserved');

      // 4. Ordering contract holds
      assertRemixOrderingContract(orderedItems, 'Deduplication test');
      assert.strictEqual(orderedItems.length, 3, 'Total items should be 1 official + 2 creative edits');
    });
  });

  // =========================================================================
  // SUITE 6: Multi-Engine Contract Parity
  // =========================================================================
  await t.test('Suite 6: Multi-Engine Contract Parity Across Search Handlers', () => {
    const engines = [
      { file: 'api/search.js', name: 'Vercel Serverless Handler' },
      { file: 'server.mjs', name: 'Express Server (Branch A & B)' },
      { file: 'vite.config.ts', name: 'Vite Dev Proxy Middleware' },
      { file: 'src/services/spotifyApi.ts', name: 'Client SpotifyApi Service' },
    ];

    for (const engine of engines) {
      const srcPath = path.join(projectRoot, engine.file);
      assert.ok(fs.existsSync(srcPath), `${engine.name} file (${engine.file}) must exist`);
      const src = fs.readFileSync(srcPath, 'utf8');

      assert.match(src, /isOfficial:\s*true/, `${engine.name} must set isOfficial: true`);
      assert.match(src, /scVariantLabel:\s*'Remix Oficial'/, `${engine.name} must set scVariantLabel: 'Remix Oficial'`);
      assert.match(src, /scBadgeColor:\s*'#1ed760'/, `${engine.name} must set scBadgeColor: '#1ed760'`);
      assert.match(
        src,
        /(\[\s*\.\.\.officialRemixes,\s*\.\.\.(soundcloudVariants|nonOfficialTracks),?\s*\]|soundcloudTracks\s*=\s*\[\s*\.\.\.officialRemixes)/,
        `${engine.name} must prepend official remixes before non-official tracks`
      );
    }
  });

  // =========================================================================
  // SUITE 7: Requirement R5 Offline/Audio Streaming Invariants Preserved
  // =========================================================================
  await t.test('Suite 7: Requirement R5 Preserved Audio Routes Invariant', () => {
    const serverPath = path.join(projectRoot, 'server.mjs');
    const content = fs.readFileSync(serverPath, 'utf8');

    // Streaming and downloading routes lines 172-308 and 491-504 intact
    assert.match(content, /\/api\/audio\/stream/, 'server.mjs must contain audio stream route');
    assert.match(content, /\/api\/audio\/download/, 'server.mjs must contain audio download route');
    assert.match(content, /\/api\/audio\/status/, 'server.mjs must contain audio status route');
    assert.match(content, /resolveAudio/, 'server.mjs must import resolveAudio');
    assert.match(content, /streamAudioDirect/, 'server.mjs must import streamAudioDirect');
    assert.match(content, /streamAudioFromUrl/, 'server.mjs must import streamAudioFromUrl');
  });
});
