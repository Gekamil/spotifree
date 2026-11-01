import { toHDImage, searchSpotifyPublicPlaylists } from './_lib/extract-session.js';

const searchCache = new Map();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-spotify-cookie');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const q = (url.searchParams.get('q') || '').trim();

  if (!q) {
    return res.status(200).json({
      tracks: { items: [] },
      artists: { items: [] },
      albums: { items: [] },
      playlists: { items: [] },
    });
  }

  const cacheKey = q.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 120000) {
    return res.status(200).json(cached.data);
  }

  try {
    const cleanQ = q.replace(/[()[\]{}_-]/g, ' ').replace(/\s+/g, ' ').trim();
    const withoutPlaylist = cleanQ.replace(/\bplaylist(s)?\b/gi, '').trim() || cleanQ;
    const words = cleanQ.toLowerCase().split(/\s+/).filter(Boolean);
    const STOPWORDS = new Set(['la', 'el', 'los', 'las', 'de', 'del', 'y', 'en', 'un', 'una', 'ft', 'feat', 'playlist', 'playlists']);
    const significantWords = words.filter(w => !STOPWORDS.has(w) && w.length >= 3);
    const firstWord = significantWords[0] || words[0] || cleanQ;
    const cookie = req.headers['x-spotify-cookie'] || '';

    // Track search uses withoutPlaylist to avoid searching songs called "playlist"
    const trackSearchQuery = withoutPlaylist;

    const fetchPromises = [
      // 0. Deezer Track Search
      fetch(`https://api.deezer.com/search?q=${encodeURIComponent(trackSearchQuery)}&limit=25`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),

      // 1. Deezer Artist Search
      fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(trackSearchQuery)}&limit=8`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),

      // 2. Deezer Album Search
      fetch(`https://api.deezer.com/search/album?q=${encodeURIComponent(trackSearchQuery)}&limit=8`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),

      // 3. Real Spotify Public Playlists (Internal Pathfinder GraphQL search)
      searchSpotifyPublicPlaylists(cleanQ, 20, cookie).catch(() => []),

      // 4. Deezer Playlist Search (exact query)
      fetch(`https://api.deezer.com/search/playlist?q=${encodeURIComponent(cleanQ)}&limit=20`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),

      // 5. Deezer Playlist Search (without "playlist" keyword to find topic playlists)
      fetch(`https://api.deezer.com/search/playlist?q=${encodeURIComponent(withoutPlaylist)}&limit=20`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] })),

      // 6. iTunes tracks
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(trackSearchQuery)}&media=music&entity=song&limit=15`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      }).then(r => r.ok ? r.json() : { results: [] }).catch(() => ({ results: [] })),
    ];

    if (significantWords.length > 1) {
      for (const sw of [significantWords[0], significantWords[significantWords.length - 1]]) {
        fetchPromises.push(
          fetch(`https://api.deezer.com/search?q=${encodeURIComponent(sw)}&limit=15`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          }).then(r => r.ok ? r.json() : { data: [] }).catch(() => ({ data: [] }))
        );
      }
    }

    const results = await Promise.all(fetchPromises);
    const deezerTracksRes = results[0];
    const deezerArtistsRes = results[1];
    const deezerAlbumsRes = results[2];
    const spotifyPlaylistsRes = results[3] || [];
    const deezerPlaylistsRes1 = results[4];
    const deezerPlaylistsRes2 = results[5];
    const itunesRes = results[6];
    const deezerExtraRes = results[7] || { data: [] };

    const allDeezerRaw = [...(deezerTracksRes.data || []), ...(deezerExtraRes.data || [])];
    const deezerTracks = allDeezerRaw.map(t => {
      const cover = t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || '';
      return {
        id: `dz-${t.id}`,
        name: t.title || t.title_short,
        duration_ms: (t.duration || 210) * 1000,
        preview_url: null,
        artists: [{ id: `art-${t.artist?.id || 'unknown'}`, name: t.artist?.name || 'Artista' }],
        album: {
          id: `alb-${t.album?.id || 'unknown'}`,
          name: t.album?.title || t.title,
          images: cover ? [{ url: toHDImage ? toHDImage(cover) : cover }] : [],
        },
      };
    });

    const itunesItems = (itunesRes.results || []).map(t => ({
      id: `itunes-${t.trackId}`,
      name: t.trackName,
      duration_ms: t.trackTimeMillis || 210000,
      preview_url: null,
      artists: [{ id: `art-${t.artistId}`, name: t.artistName }],
      album: {
        id: `alb-${t.collectionId}`,
        name: t.collectionName || t.trackName,
        images: [{ url: (t.artworkUrl100 || '').replace('100x100bb', '600x600bb') }],
      },
    }));

    // If multi-word search, enrich candidate tracks matching title words with Deezer contributors
    if (words.length > 1) {
      const candidates = deezerTracks.filter(t =>
        words.some(w => (t.name || '').toLowerCase().includes(w))
      ).slice(0, 4);

      await Promise.all(
        candidates.map(async t => {
          const trackId = t.id.replace('dz-', '');
          try {
            const detail = await fetch(`https://api.deezer.com/track/${trackId}`, {
              headers: { 'User-Agent': 'Mozilla/5.0' },
              signal: AbortSignal.timeout(1500),
            }).then(r => r.ok ? r.json() : null);
            if (detail && detail.contributors && detail.contributors.length > 0) {
              t.artists = detail.contributors.map(c => ({
                id: `art-${c.id}`,
                name: c.name,
              }));
            }
          } catch {}
        })
      );
    }

    const seenTitles = new Set();
    const combinedTracks = [];
    for (const t of [...deezerTracks, ...itunesItems]) {
      const key = `${(t.name || '').toLowerCase()} ${(t.artists?.[0]?.name || '').toLowerCase()}`.replace(/[^a-z0-9]/g, '');
      if (key && !seenTitles.has(key)) {
        seenTitles.add(key);
        combinedTracks.push(t);
      }
    }

    // Relevance scoring
    combinedTracks.sort((a, b) => {
      const scoreTrack = (t) => {
        const tName = (t.name || '').toLowerCase();
        const artistNames = (t.artists || []).map(art => (art.name || '').toLowerCase()).join(' ');
        const full = `${tName} ${artistNames}`;
        let score = 0;
        if (tName === cleanQ.toLowerCase()) score += 160;
        if (full === cleanQ.toLowerCase()) score += 150;
        if (words.some(w => tName === w)) score += 100;
        if (words.every(w => full.includes(w))) score += 80;
        if (words.some(w => tName.includes(w))) score += 50;
        if (words.some(w => artistNames.includes(w))) score += 20;
        return score;
      };
      return scoreTrack(b) - scoreTrack(a);
    });

    const artists = (deezerArtistsRes.data || []).map(a => ({
      id: `art-${a.id}`,
      name: a.name,
      images: [{ url: toHDImage ? toHDImage(a.picture_xl || a.picture_big || a.picture_medium || '') : (a.picture_xl || a.picture_big || a.picture_medium || '') }],
    }));

    const albums = (deezerAlbumsRes.data || []).map(a => ({
      id: `alb-${a.id}`,
      name: a.title,
      artists: [{ name: a.artist?.name || 'Artista' }],
      images: [{ url: toHDImage ? toHDImage(a.cover_xl || a.cover_big || a.cover_medium || '') : (a.cover_xl || a.cover_big || a.cover_medium || '') }],
      release_date: '2026',
    }));

    // Playlists: prioritize genuine Spotify user-created & public playlists
    const playlists = [];
    const seenPlaylistIds = new Set();

    if (Array.isArray(spotifyPlaylistsRes) && spotifyPlaylistsRes.length > 0) {
      for (const sp of spotifyPlaylistsRes) {
        if (!sp || !sp.id || seenPlaylistIds.has(sp.id)) continue;
        seenPlaylistIds.add(sp.id);
        playlists.push(sp);
      }
    }

    // Supplement with Deezer public & curated playlists
    const rawPlaylists = [...(deezerPlaylistsRes1.data || []), ...(deezerPlaylistsRes2.data || [])];
    for (const p of rawPlaylists) {
      if (!p || !p.id || seenPlaylistIds.has(`dz-pl-${p.id}`)) continue;
      seenPlaylistIds.add(`dz-pl-${p.id}`);

      const cover = p.picture_xl || p.picture_big || p.picture_medium || p.picture || '';
      playlists.push({
        id: `dz-pl-${p.id}`,
        name: p.title,
        description: `Playlist de ${p.user?.name || 'Usuario'} • ${p.nb_tracks || 0} canciones`,
        images: cover ? [{ url: toHDImage ? toHDImage(cover) : cover }] : [],
        owner: {
          display_name: p.user?.name || 'Spotify',
          id: `user-${p.user?.id || 'dz'}`,
        },
        tracks: {
          total: p.nb_tracks || 0,
          items: [],
        },
      });
    }

    const payload = {
      tracks: { items: combinedTracks },
      artists: { items: artists },
      albums: { items: albums },
      playlists: { items: playlists },
    };

    searchCache.set(cacheKey, { data: payload, timestamp: Date.now() });
    return res.status(200).json(payload);
  } catch (err) {
    console.error('[api/search] Error:', err);
    return res.status(500).json({
      tracks: { items: [] },
      artists: { items: [] },
      albums: { items: [] },
      playlists: { items: [] },
    });
  }
}
