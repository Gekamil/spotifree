import test from 'node:test';
import assert from 'node:assert/strict';

test('Playlist Search Gate: Searches real user-created and curated playlists', async (t) => {
  await t.test('1. "playlist estudiar" returns real playlists with creators and covers', async () => {
    const cleanQ = 'playlist estudiar';
    const withoutPlaylist = cleanQ.replace(/\bplaylist(s)?\b/gi, '').trim() || cleanQ;

    const [res1, res2] = await Promise.all([
      fetch('https://api.deezer.com/search/playlist?q=' + encodeURIComponent(cleanQ) + '&limit=15').then(r => r.json()),
      fetch('https://api.deezer.com/search/playlist?q=' + encodeURIComponent(withoutPlaylist) + '&limit=15').then(r => r.json()),
    ]);

    const raw = [...(res1.data || []), ...(res2.data || [])];
    const seen = new Set();
    const playlists = [];
    for (const p of raw) {
      if (!p || !p.id || seen.has(p.id)) continue;
      seen.add(p.id);
      playlists.push({
        id: `dz-pl-${p.id}`,
        name: p.title,
        description: `Playlist de ${p.user?.name || 'Usuario'} • ${p.nb_tracks || 0} canciones`,
        images: [{ url: p.picture_xl || p.picture_big || p.picture_medium || p.picture }],
        owner: { display_name: p.user?.name || 'Usuario' },
        tracks: { total: p.nb_tracks || 0, items: [] },
      });
    }

    assert.ok(playlists.length >= 5, `Expected at least 5 playlists, got ${playlists.length}`);
    const first = playlists[0];
    assert.ok(first.name && first.name.length > 0, 'Playlist has valid title');
    assert.ok(first.owner.display_name && first.owner.display_name.length > 0, 'Playlist has valid owner');
    assert.ok(first.images[0].url.startsWith('http'), 'Playlist has valid image cover');
    assert.ok(first.tracks.total > 0, 'Playlist has tracks total');
  });

  await t.test('2. "estudiar" returns study music playlists', async () => {
    const res = await fetch('https://api.deezer.com/search/playlist?q=' + encodeURIComponent('estudiar') + '&limit=10').then(r => r.json());
    assert.ok(res.data && res.data.length >= 3, 'Found playlists for estudiar');
    const titles = res.data.map(p => p.title.toLowerCase());
    const hasStudy = titles.some(t => t.includes('estudiar') || t.includes('study') || t.includes('estudar') || t.includes('leer'));
    assert.ok(hasStudy, 'At least one playlist title relates to study/reading');
  });

  await t.test('3. Resolving a playlist ID fetches all tracks with proper metadata', async () => {
    // Test resolving Deezer playlist ID 1629676895
    const res = await fetch('https://api.deezer.com/playlist/1629676895').then(r => r.json());
    assert.equal(res.id, 1629676895);
    assert.ok(res.title.includes('STUDY MUSIC'));
    assert.ok(res.tracks && res.tracks.data && res.tracks.data.length >= 10, 'Has track list');
    
    const track0 = res.tracks.data[0];
    assert.ok(track0.title, 'Track 0 has title');
    assert.ok(track0.artist && track0.artist.name, 'Track 0 has artist');
    assert.ok(track0.duration > 0, 'Track 0 has positive duration');
    assert.ok(track0.album && (track0.album.cover_xl || track0.album.cover_big || track0.album.cover_medium), 'Track 0 has cover art');
  });

  await t.test('4. Vercel handler in api/search.js processes query properly', async () => {
    const searchHandler = (await import('../api/search.js')).default;
    let statusCode = 0;
    let headers = {};
    let jsonResult = null;

    const mockReq = {
      method: 'GET',
      url: '/api/search?q=playlist+estudiar',
      headers: { host: 'localhost' },
    };

    const mockRes = {
      setHeader(k, v) { headers[k] = v; },
      status(c) { statusCode = c; return this; },
      json(data) { jsonResult = data; return this; },
    };

    await searchHandler(mockReq, mockRes);
    assert.equal(statusCode, 200);
    assert.ok(jsonResult, 'Got JSON result');
    assert.ok(jsonResult.playlists?.items?.length >= 3, 'Playlists returned by api/search');
    assert.ok(jsonResult.tracks?.items?.length >= 3, 'Tracks returned by api/search');
  });

  await t.test('5. Vercel handler in api/playlist.js resolves Deezer playlist', async () => {
    const playlistHandler = (await import('../api/playlist.js')).default;
    let statusCode = 0;
    let jsonResult = null;

    const mockReq = {
      method: 'GET',
      url: '/api/playlist?id=dz-pl-1629676895',
      headers: { host: 'localhost' },
    };

    const mockRes = {
      setHeader() {},
      status(c) { statusCode = c; return this; },
      json(data) { jsonResult = data; return this; },
    };

    await playlistHandler(mockReq, mockRes);
    assert.equal(statusCode, 200);
    assert.ok(jsonResult, 'Got playlist JSON');
    assert.ok(jsonResult.name.includes('STUDY MUSIC'));
    assert.ok(jsonResult.tracks?.items?.length >= 10, 'Got track items from Deezer playlist');
  });

  await t.test('6. Real Spotify Public Playlists search returns authentic Spotify user playlists', async () => {
    const { searchSpotifyPublicPlaylists } = await import('../api/_lib/extract-session.js');
    const playlists = await searchSpotifyPublicPlaylists('playlist para jugar', 10);
    assert.ok(playlists.length >= 3, `Expected at least 3 Spotify playlists, got ${playlists.length}`);
    const first = playlists[0];
    assert.ok(first.id && first.id.length === 22, `Expected 22-char Spotify playlist ID, got ${first.id}`);
    assert.ok(first.name && first.name.length > 0, 'Has title');
    assert.ok(first.images?.[0]?.url?.includes('scdn.co') || first.images?.[0]?.url?.includes('spotifycdn.com'), 'Has real Spotify CDN cover');
    assert.ok(first.owner?.display_name && first.owner.display_name.length > 0, 'Has real owner display name');
  });

  await t.test('7. Spotify public playlist ID resolves tracks via Spotify embed scraper', async () => {
    const { resolveSpotifyPlaylist } = await import('../api/playlist.js');
    // Test resolving a public Spotify playlist ID (e.g. 44ktlV6pvyWHx0wlKMEjga or 37i9dQZF1DXcBWIGoYBM5M)
    const resolved = await resolveSpotifyPlaylist('44ktlV6pvyWHx0wlKMEjga');
    assert.ok(resolved, 'Got resolved playlist');
    assert.ok(resolved.name && resolved.name.length > 0, 'Resolved has valid name');
    assert.ok(resolved.tracks?.items?.length > 0, `Expected tracks, got ${resolved.tracks?.items?.length}`);
    assert.ok(resolved.tracks.items[0].name, 'Track 0 has name');
    assert.ok(resolved.tracks.items[0].artists?.[0]?.name, 'Track 0 has artist');
  });
});
