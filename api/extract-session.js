import crypto from 'node:crypto';

export function toHDImage(url) {
  if (!url) return '';
  return url
    .replace(/\/ab67616d[0-9a-f]{8}([0-9a-f]{24})/, '/ab67616d0000b273$1')
    .replace(/\/ab67706f[0-9a-f]{8}([0-9a-f]{24})/, '/ab67706f00000002$1')
    .replace(/\/ab676161[0-9a-f]{8}([0-9a-f]{24})/, '/ab6761610000e5eb$1')
    .replace(/\/ab67706c[0-9a-f]{8}([0-9a-f]{24})/, '/ab67706c0000d72c$1')
    .replace(/\/ab67706d[0-9a-f]{8}([0-9a-f]{24})/, '/ab67706d00000002$1')
    .replace('mosaic.scdn.co/60/', 'mosaic.scdn.co/640/')
    .replace('mosaic.scdn.co/300/', 'mosaic.scdn.co/640/')
    .replace('liked-songs-64.png', 'liked-songs-640.jpg')
    .replace('liked-songs-300.png', 'liked-songs-640.jpg');
}

export function extractEntityImage(it) {
  if (!it) return null;

  // 1. Artist visuals avatar & headers
  const avatarSources = it.visuals?.avatarImage?.sources || it.visuals?.headerImage?.sources || it.avatar?.sources;
  if (avatarSources && avatarSources.length > 0) {
    const best = avatarSources.find(s => (s.height || 0) >= 300) || avatarSources[0];
    if (best?.url) return toHDImage(best.url);
  }

  // 2. Direct images.sources (Pathfinder libraryV3)
  const directSources = it.images?.sources;
  if (directSources && directSources.length > 0) {
    const best = directSources.find(s => (s.height || 0) >= 300 || (s.width || 0) >= 300) || directSources[0];
    if (best?.url) return toHDImage(best.url);
  }

  // 3. Playlist / Album images.items
  if (it.images?.items && Array.isArray(it.images.items) && it.images.items.length > 0) {
    for (const imgItem of it.images.items) {
      if (imgItem?.sources && imgItem.sources.length > 0) {
        const best = imgItem.sources.find(s => (s.height || 0) >= 300 || (s.width || 0) >= 300) || imgItem.sources[0];
        if (best?.url) return toHDImage(best.url);
      }
      if (imgItem?.url && typeof imgItem.url === 'string') {
        return toHDImage(imgItem.url);
      }
    }
  }

  // 4. CoverArt sources (albums, podcasts, singles)
  const coverSources = it.coverArt?.sources;
  if (coverSources && coverSources.length > 0) {
    const best = coverSources.find(s => (s.height || 0) >= 300 || (s.width || 0) >= 300) || coverSources[0];
    if (best?.url) return toHDImage(best.url);
  }

  // 5. visualIdentity (embeds)
  const visualImages = it.visualIdentity?.image;
  if (visualImages && visualImages.length > 0) {
    const best = visualImages.find(s => (s.maxHeight || 0) >= 300) || visualImages[visualImages.length - 1];
    if (best?.url) return toHDImage(best.url);
  }

  // 6. defaultRepresentation (radio stations, mixes)
  const defaultSources = it.defaultRepresentation?.sources;
  if (defaultSources && defaultSources.length > 0) {
    const best = defaultSources.find(s => (s.height || 0) >= 300 || (s.width || 0) >= 300) || defaultSources[0];
    if (best?.url) return toHDImage(best.url);
  }

  // 7. Direct images array
  if (Array.isArray(it.images) && it.images.length > 0) {
    for (const img of it.images) {
      if (typeof img === 'string') return toHDImage(img);
      if (img?.url && typeof img.url === 'string') return toHDImage(img.url);
      if (img?.sources && img.sources.length > 0) {
        const best = img.sources.find(s => (s.height || 0) >= 300) || img.sources[0];
        if (best?.url) return toHDImage(best.url);
      }
    }
  }

  // 8. it.image object or string
  if (it.image) {
    if (typeof it.image === 'string') return toHDImage(it.image);
    if (it.image.url) return toHDImage(it.image.url);
    if (it.image.sources && it.image.sources.length > 0) return toHDImage(it.image.sources[0].url);
  }

  // 9. Deep recursive scanner for any Spotify CDN image URL in the entity
  function findCdnUrl(obj, depth = 0) {
    if (!obj || depth > 4) return null;
    if (typeof obj === 'string') {
      if (
        obj.startsWith('http') &&
        (obj.includes('scdn.co') || obj.includes('spotifycdn.com')) &&
        !obj.includes('liked-songs') &&
        !obj.includes('.svg')
      ) {
        return toHDImage(obj);
      }
      return null;
    }
    if (Array.isArray(obj)) {
      for (const el of obj) {
        const found = findCdnUrl(el, depth + 1);
        if (found) return found;
      }
      return null;
    }
    if (typeof obj === 'object') {
      for (const [key, val] of Object.entries(obj)) {
        if (key === '__typename') continue;
        const found = findCdnUrl(val, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  return findCdnUrl(it);
}

// Spotify TOTP generator matching active Web Player version
export function generateSpotifyTotp(timestamp = Date.now()) {
  const secretObj = { secret: ',7/*F("rLJ2oxaKL^f+E1xvP@N', version: 61 };
  const t = secretObj.secret;
  const r = t.split('').map((c, i) => c.charCodeAt(0) ^ ((i % 33) + 9));
  const str = r.join('');
  const key = Buffer.from(str, 'utf8');

  const counter = Math.floor(timestamp / 1000 / 30);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  ) % 1000000;

  return {
    totp: code.toString().padStart(6, '0'),
    version: secretObj.version,
  };
}

export async function getAccessTokenFromCookie(spDcCookie) {
  const cookie = cleanSpDcString(spDcCookie);
  try {
    const { totp, version } = generateSpotifyTotp(Date.now());
    const tokenUrl = `https://open.spotify.com/api/token?reason=init&productType=web-player&totp=${totp}&totpServer=${totp}&totpVer=${version}`;
    const tokenHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Referer': 'https://open.spotify.com/',
      'Origin': 'https://open.spotify.com',
    };
    if (cookie) {
      tokenHeaders['Cookie'] = `sp_dc=${cookie}`;
    }
    const tokenRes = await fetch(tokenUrl, { headers: tokenHeaders });
    if (tokenRes.ok) {
      const data = await tokenRes.json();
      if (data.accessToken) return data.accessToken;
    }
  } catch (e) {}

  // Fallback transport endpoint
  try {
    const fallbackHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Referer': 'https://open.spotify.com/',
    };
    if (cookie) fallbackHeaders['Cookie'] = `sp_dc=${cookie}`;
    const fallbackRes = await fetch('https://open.spotify.com/get_access_token?reason=transport&productType=web_player', {
      headers: fallbackHeaders,
    });
    if (fallbackRes.ok) {
      const data = await fallbackRes.json();
      return data.accessToken || null;
    }
  } catch (e) {}

  return null;
}

export async function getWebPlayerAuth(spDcCookie = '') {
  const cookie = cleanSpDcString(spDcCookie);
  let tokenData = null;

  try {
    const { totp, version } = generateSpotifyTotp(Date.now());
    const tokenUrl = `https://open.spotify.com/api/token?reason=init&productType=web-player&totp=${totp}&totpServer=${totp}&totpVer=${version}`;
    const tokenHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Referer': 'https://open.spotify.com/',
      'Origin': 'https://open.spotify.com',
    };
    if (cookie) tokenHeaders['Cookie'] = `sp_dc=${cookie}`;
    const tokenRes = await fetch(tokenUrl, { headers: tokenHeaders });
    if (tokenRes.ok) {
      tokenData = await tokenRes.json();
    }
  } catch (e) {}

  if (!tokenData || !tokenData.accessToken) {
    try {
      const fallbackHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://open.spotify.com/',
      };
      if (cookie) fallbackHeaders['Cookie'] = `sp_dc=${cookie}`;
      const fallbackRes = await fetch('https://open.spotify.com/get_access_token?reason=transport&productType=web_player', {
        headers: fallbackHeaders,
      });
      if (fallbackRes.ok) {
        tokenData = await fallbackRes.json();
      }
    } catch (e) {}
  }

  const accessToken = tokenData?.accessToken || '';
  const clientId = tokenData?.clientId || 'd8a5ed958d274c2e8ee717e6a4b0971d';

  let clientToken = '';
  if (clientId) {
    try {
      const clientTokenRes = await fetch('https://clienttoken.spotify.com/v1/clienttoken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
          'Origin': 'https://open.spotify.com',
          'Referer': 'https://open.spotify.com/',
        },
        body: JSON.stringify({
          client_data: {
            client_version: '1.3.8.509.g26b6eac7300d',
            client_id: clientId,
            js_sdk_data: {
              device_brand: 'unknown',
              device_model: 'unknown',
              os: 'windows',
              os_version: 'NT 10.0',
              device_id: '5db861f9-bb72-47f7-8b37-898a5d83024b',
              device_type: 'computer',
            },
          },
        }),
      });
      if (clientTokenRes.ok) {
        const ctData = await clientTokenRes.json();
        clientToken = ctData.granted_token?.token || '';
      }
    } catch (e) {}
  }

  return { accessToken, clientToken, clientId, isAnonymous: !!tokenData?.isAnonymous };
}

export function cleanSpDcString(raw) {
  if (!raw) return '';
  let str = String(raw).trim();
  str = str.replace(/^[\s"'“”‘’]+|[\s"'“”‘’;]+$/g, '').trim();
  const match = str.match(/sp_dc=([^;]+)/i);
  if (match) str = match[1].trim();
  str = str.replace(/^sp_dc=/i, '').trim();
  str = str.replace(/^[\s"'“”‘’]+|[\s"'“”‘’;]+$/g, '').trim();
  try {
    str = decodeURIComponent(str);
  } catch {}
  return str.replace(/^[\s"'“”‘’]+|[\s"'“”‘’;]+$/g, '').trim();
}

export async function extractSpotifySession(spDcCookie) {
  const cookie = cleanSpDcString(spDcCookie);
  if (!cookie || !cookie.startsWith('AQ') || cookie.length < 30) {
    throw new Error('Cookie no válida. La cookie sp_dc debe comenzar por "AQ" y contener el valor completo de open.spotify.com.');
  }

  // 1. Generate TOTP and request Web Player access token
  let tokenData = null;
  const now = Date.now();

  try {
    const { totp, version } = generateSpotifyTotp(now);
    const tokenUrl = `https://open.spotify.com/api/token?reason=init&productType=web-player&totp=${totp}&totpServer=${totp}&totpVer=${version}`;

    const tokenRes = await fetch(tokenUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
        'Cookie': `sp_dc=${cookie}`,
        'Accept': 'application/json',
        'Referer': 'https://open.spotify.com/',
        'Origin': 'https://open.spotify.com',
      },
    });

    if (tokenRes.ok) {
      tokenData = await tokenRes.json();
    }
  } catch (e) {
    console.warn('[Extractor] TOTP token error:', e.message);
  }

  // Fallback: If TOTP failed or returned anonymous/null, try get_access_token endpoint
  if (!tokenData || !tokenData.accessToken || tokenData.isAnonymous) {
    try {
      const fallbackRes = await fetch('https://open.spotify.com/get_access_token?reason=transport&productType=web_player', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cookie': `sp_dc=${cookie}`,
          'Accept': 'application/json',
          'Referer': 'https://open.spotify.com/',
        },
      });
      if (fallbackRes.ok) {
        tokenData = await fallbackRes.json();
      }
    } catch (e) {
      console.warn('[Extractor] get_access_token fallback error:', e.message);
    }
  }

  if (!tokenData || !tokenData.accessToken || tokenData.isAnonymous) {
    throw new Error('Cookie de Spotify no válida o sesión expirada. Comprueba que hayas copiado la cookie completa.');
  }

  const accessToken = tokenData.accessToken;
  const clientId = tokenData.clientId || 'd8a5ed958d274c2e8ee717e6a4b0971d';

  // 2. Request client-token
  let clientToken = '';
  try {
    const clientTokenRes = await fetch('https://clienttoken.spotify.com/v1/clienttoken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
        'Origin': 'https://open.spotify.com',
        'Referer': 'https://open.spotify.com/',
      },
      body: JSON.stringify({
        client_data: {
          client_version: '1.3.8.509.g26b6eac7300d',
          client_id: clientId,
          js_sdk_data: {
            device_brand: 'unknown',
            device_model: 'unknown',
            os: 'windows',
            os_version: 'NT 10.0',
            device_id: '5db861f9-bb72-47f7-8b37-898a5d83024b',
            device_type: 'computer',
          },
        },
      }),
    });
    if (clientTokenRes.ok) {
      const ctData = await clientTokenRes.json();
      clientToken = ctData.granted_token?.token || '';
    }
  } catch (e) {
    console.warn('[Extractor] Could not acquire client-token:', e.message);
  }

  // Helper for Pathfinder GraphQL POST queries
  async function queryPathfinder(payload) {
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'app-platform': 'WebPlayer',
      'spotify-app-version': '1.3.8.509.g26b6eac7300d',
      'Origin': 'https://open.spotify.com',
      'Referer': 'https://open.spotify.com/',
    };
    if (clientToken) headers['Client-Token'] = clientToken;

    const res = await fetch('https://api-partner.spotify.com/pathfinder/v2/query', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Pathfinder error HTTP ${res.status}`);
    }
    return await res.json();
  }

  // 3. Query Profile, Library and Home in parallel
  const [profileResult, libraryResult, homeResult] = await Promise.allSettled([
    queryPathfinder({
      operationName: 'profileAttributes',
      variables: {},
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: '08ffb4730af3746e04a8301396f20875dbbce10c75243803091a9274eacc8ac0',
        },
      },
    }),
    queryPathfinder({
      operationName: 'libraryV3',
      variables: {
        order: 'Recents',
        textFilter: '',
        features: ['LIKED_SONGS', 'YOUR_EPISODES_V2', 'PRERELEASES', 'PRERELEASES_V2', 'CLIPS', 'EVENTS'],
        limit: 50,
        offset: 0,
        flatten: false,
        expandedFolders: [],
        folderUri: null,
        includeFoldersWhenFlattening: true,
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: '390c78e5b951029bad359785e69b07b536a509c581cbcd0aded5e5067f187455',
        },
      },
    }),
    queryPathfinder({
      operationName: 'home',
      variables: {
        includeHomeChapterVideoCards: false,
        homeEndUserIntegration: 'INTEGRATION_WEB_PLAYER',
        timeZone: 'Europe/Madrid',
        sp_t: '5db861f9-bb72-47f7-8b37-898a5d83024b',
        facet: '',
        sectionItemsLimit: 10,
        includeEpisodeContentRatingsV2: true,
      },
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: '5fb7da7a03ee2776c0670856609cb85a189a3cecc36cc160b91cde79063b9cf1',
        },
      },
    }),
  ]);

  // Parse User Profile
  const rawProfile = profileResult.status === 'fulfilled' ? profileResult.value?.data?.me?.profile : null;
  const displayName = rawProfile?.name || rawProfile?.username || 'Usuario de Spotify';
  const userId = rawProfile?.username || rawProfile?.accountId || 'spotify-user';
  const userImages = rawProfile?.avatar?.sources?.map(s => ({ url: toHDImage(s.url) })) || [];

  const user = {
    id: userId,
    display_name: displayName,
    email: '',
    images: userImages,
    followers: { total: 0 },
    following: { total: 0 },
  };

  // Attempt real Spotify Web API /me profile & stats extraction
  try {
    const meRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(3500),
    });
    if (meRes.ok) {
      const meData = await meRes.json();
      if (meData.display_name) user.display_name = meData.display_name;
      if (meData.id) user.id = meData.id;
      if (meData.images && meData.images.length > 0) {
        user.images = meData.images.map(img => ({ url: toHDImage(img.url) }));
      }
      if (meData.followers && typeof meData.followers.total === 'number') {
        user.followers = { total: meData.followers.total };
      }
    }
  } catch (e) {
    console.warn('[Extractor] Could not fetch real profile stats:', e.message);
  }

  // Attempt real following count extraction
  try {
    const followRes = await fetch('https://api.spotify.com/v1/me/following?type=artist&limit=1', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(3500),
    });
    if (followRes.ok) {
      const followData = await followRes.json();
      if (typeof followData.artists?.total === 'number') {
        user.following = { total: followData.artists.total };
      }
    }
  } catch (e) {}

  // Real Liked Songs count from Spotify Web API
  let likedCount = 0;
  try {
    const meTracksRes = await fetch('https://api.spotify.com/v1/me/tracks?limit=1', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    if (meTracksRes.ok) {
      const meData = await meTracksRes.json();
      likedCount = typeof meData.total === 'number' ? meData.total : 0;
    }
  } catch (e) {
    console.warn('[Extractor] Could not fetch liked songs count:', e.message);
  }

  // Parse Library Playlists
  const rawLibraryItems = libraryResult.status === 'fulfilled' ? libraryResult.value?.data?.me?.libraryV3?.items || [] : [];
  const playlists = [];

  for (const item of rawLibraryItems) {
    const it = item.item?.data;
    if (!it) continue;
    const uri = it.uri || '';
    const cleanId = uri.split(':').pop();

    // Exclude podcast shows, episodes, and audiobooks completely
    if (
      it.__typename === 'Show' ||
      it.__typename === 'Episode' ||
      it.__typename === 'Audiobook' ||
      uri.includes(':show:') ||
      uri.includes(':episode:') ||
      uri.includes(':audiobook:')
    ) {
      continue;
    }

    // 1. Liked Songs (Strict check so other collections or playlists never get mistaken for Liked Songs)
    const isLikedCollection =
      uri === 'spotify:collection:tracks' ||
      uri.endsWith(':collection:tracks') ||
      (it.__typename === 'Collection' && (it.name?.toLowerCase().includes('canciones') || it.name?.toLowerCase().includes('liked') || !it.name));

    if (isLikedCollection) {
      playlists.push({
        id: 'collection-tracks',
        name: 'Canciones que te gustan',
        description: likedCount > 0 ? `${likedCount} canciones guardadas` : 'Tus canciones favoritas guardadas',
        type: 'playlist',
        images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
        owner: { display_name: displayName, id: userId },
        tracks: { total: likedCount },
        is_pinned: true,
        color: '#5038a0',
      });
      continue;
    }

    // 2. Folder
    if (it.__typename === 'Folder') {
      playlists.push({
        id: cleanId,
        name: it.name || 'Carpeta',
        description: `${it.playlistCount || 0} listas`,
        type: 'folder',
        is_folder: true,
        images: [],
        owner: { display_name: displayName, id: userId },
        tracks: { total: it.playlistCount || 0 },
        is_pinned: !!item.pinned,
        color: '#282828',
      });
      continue;
    }

    // 3. Artist
    if (it.__typename === 'Artist') {
      const artistName = it.profile?.name || it.name || 'Artista';
      const artistCover = extractEntityImage(it) || '';
      playlists.push({
        id: cleanId,
        name: artistName,
        description: 'Artista',
        type: 'artist',
        images: artistCover ? [{ url: artistCover }] : [],
        owner: { display_name: 'Spotify', id: 'spotify' },
        tracks: { total: 0 },
        is_pinned: !!item.pinned,
        color: '#303030',
      });
      continue;
    }

    // 4. Regular Playlist / Album
    const playlistCover = extractEntityImage(it);
    const isAlbum = it.__typename === 'Album';
    const albumArtist = it.artists?.items?.map(a => a.profile?.name || a.name).filter(Boolean).join(', ') || it.artist?.name;
    const ownerName = isAlbum ? (albumArtist || 'Spotify') : (it.ownerV2?.data?.name || displayName);
    const ownerId = isAlbum ? 'spotify' : (it.ownerV2?.data?.id || userId);
    const desc = it.description || (isAlbum ? 'Álbum' : 'Playlist');

    const trackTotal =
      it.tracks?.totalCount ??
      it.content?.totalCount ??
      it.trackCount ??
      it.tracks?.total ??
      it.totalCount ??
      0;

    playlists.push({
      id: cleanId,
      name: it.name || 'Lista sin título',
      description: desc,
      type: isAlbum ? 'album' : 'playlist',
      images: playlistCover ? [{ url: playlistCover }] : [],
      owner: { display_name: ownerName, id: ownerId },
      tracks: { total: trackTotal },
      is_pinned: !!item.pinned,
      color: '#303030',
    });
  }

  // Always guarantee 'Canciones que te gustan' is present & pinned at the top
  const hasLikedSongs = playlists.some(
    p => p.id === 'collection-tracks' || p.id === 'liked-songs' || p.name?.toLowerCase().trim() === 'canciones que te gustan'
  );
  if (!hasLikedSongs) {
    playlists.unshift({
      id: 'collection-tracks',
      name: 'Canciones que te gustan',
      description: likedCount > 0 ? `${likedCount} canciones guardadas` : 'Tus canciones favoritas guardadas',
      type: 'playlist',
      images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
      owner: { display_name: displayName, id: userId },
      tracks: { total: likedCount },
      is_pinned: true,
      color: '#5038a0',
    });
  }

  // Parse Home Feed Sections
  const rawSections = homeResult.status === 'fulfilled' ? homeResult.value?.data?.home?.sectionContainer?.sections?.items || [] : [];
  const shelves = [];

  for (let sIdx = 0; sIdx < rawSections.length; sIdx++) {
    const sec = rawSections[sIdx];
    const secTitle = sec.data?.title?.transformedLabel || sec.data?.title?.text;
    const secItems = sec.sectionItems?.items || [];
    if (!secTitle || secItems.length === 0) continue;

    const lower = secTitle.toLowerCase();
    if (
      lower.includes('pódcast') ||
      lower.includes('podcast') ||
      lower.includes('audiolibro') ||
      lower.includes('audiobook')
    ) {
      continue;
    }

    const cards = [];
    for (const cardItem of secItems) {
      const content = cardItem.content?.data;
      if (!content) continue;

      const uri = content.uri || '';
      // Skip podcast & audiobook cards
      if (
        content.__typename === 'Show' ||
        content.__typename === 'Episode' ||
        content.__typename === 'Audiobook' ||
        uri.includes(':show:') ||
        uri.includes(':episode:') ||
        uri.includes(':audiobook:')
      ) {
        continue;
      }

      const cardId = uri.split(':').pop() || `shelf-card-${cards.length}`;
      const cardTitle = content.name || content.title || content.profile?.name || '';
      if (!cardTitle) continue;

      const isArtist = content.__typename === 'Artist';
      const artistSubtitle = content.artists?.items?.map(a => a.profile?.name).filter(Boolean).join(', ');
      const cardSubtitle = content.description || artistSubtitle || (isArtist ? 'Artista' : 'Playlist');
      const cardCover = extractEntityImage(content) || '';

      cards.push({
        id: cardId,
        title: cardTitle,
        subtitle: cardSubtitle,
        image: cardCover,
        isRadio: uri.includes('station') || uri.includes('radio'),
      });
    }

    if (cards.length > 0) {
      let shelfType = 'mixes';
      if (lower.includes('hecho para') || lower.includes('made for')) shelfType = 'made_for';
      else if (lower.includes('reciente')) shelfType = 'recent';
      else if (lower.includes('fans de') || lower.includes('más como')) shelfType = 'artist';
      else if (lower.includes('popular') || lower.includes('novedades')) shelfType = 'featured';

      shelves.push({
        id: `dynamic-shelf-${sIdx}`,
        title: secTitle,
        type: shelfType,
        cards,
        hasSeeAll: cards.length > 5,
      });
    }
  }

  // Quick access cards (top 8 valid items from library)
  const quickAccess = [];
  const validItems = playlists.filter(p => p.type !== 'folder');
  for (const pl of validItems.slice(0, 8)) {
    quickAccess.push({
      id: pl.id,
      name: pl.name,
      image: pl.images?.[0]?.url || '',
      color: pl.color || '#303030',
    });
  }

  return {
    user,
    playlists,
    shelves,
    quickAccess,
    accessToken,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    let body = req.body;
    if (!body || typeof body !== 'object') {
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch {}
      } else {
        try {
          let raw = '';
          for await (const chunk of req) raw += chunk;
          if (raw) body = JSON.parse(raw);
        } catch {}
      }
    }
    body = body || {};

    const cookie = body.cookie;
    if (!cookie) {
      return res.status(400).json({ error: 'Falta la cookie de Spotify.' });
    }

    const session = await extractSpotifySession(cookie);
    return res.status(200).json(session);
  } catch (err) {
    console.error('[extract-session error]:', err.message);
    return res.status(400).json({ error: err.message || 'Error al procesar la sesión de Spotify.' });
  }
}
