import crypto from 'crypto';

// Spotify TOTP generator matching the active Web Player version
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

/**
 * Extracts a complete Spotify session dynamically using any valid sp_dc cookie.
 * @param {string} spDcCookie
 * @returns {Promise<{ user: any, playlists: any[], shelves: any[], quickAccess: any[] }>}
 */
export async function extractSpotifySession(spDcCookie) {
  const cookie = (spDcCookie || '').trim();
  if (!cookie || !cookie.startsWith('AQ') || cookie.length < 50) {
    throw new Error('Cookie no válida. La cookie sp_dc debe comenzar por "AQ" y contener el valor completo de open.spotify.com.');
  }

  // 1. Generate TOTP and request Web Player access token
  const now = Date.now();
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

  if (!tokenRes.ok) {
    throw new Error(`Spotify rechazó la solicitud de token (HTTP ${tokenRes.status}).`);
  }

  const tokenData = await tokenRes.json();
  if (tokenData.isAnonymous || !tokenData.accessToken) {
    throw new Error('Cookie de Spotify no válida o sesión expirada. Inicia sesión en open.spotify.com y copia tu nueva cookie sp_dc.');
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
  const userImages = rawProfile?.avatar?.sources?.map(s => ({ url: s.url })) || [];

  const user = {
    id: userId,
    display_name: displayName,
    email: '',
    images: userImages,
    followers: { total: 0 },
  };

  // Parse Library Playlists
  const rawLibraryItems = libraryResult.status === 'fulfilled' ? libraryResult.value?.data?.me?.libraryV3?.items || [] : [];
  const playlists = [];

  for (const item of rawLibraryItems) {
    const it = item.item?.data;
    if (!it) continue;
    const uri = it.uri || '';
    const cleanId = uri.split(':').pop();

    if (uri === 'spotify:collection:tracks' || it.__typename === 'Collection') {
      playlists.push({
        id: 'collection-tracks',
        name: 'Canciones que te gustan',
        description: 'Tus canciones favoritas guardadas',
        images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
        owner: { display_name: displayName, id: userId },
        tracks: { total: 0 },
        is_pinned: true,
        color: '#5038a0',
      });
      continue;
    }

    const cover = it.images?.items?.[0]?.sources?.[0]?.url || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';
    const ownerName = it.ownerV2?.data?.name || displayName;
    const ownerId = it.ownerV2?.data?.id || userId;

    playlists.push({
      id: cleanId,
      name: it.name || 'Lista sin título',
      description: it.description || (it.__typename === 'Artist' ? 'Artista' : 'Playlist'),
      images: [{ url: cover }],
      owner: { display_name: ownerName, id: ownerId },
      tracks: { total: 0 },
      is_pinned: !!item.pinned,
      color: '#303030',
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

    const cards = [];
    for (const cardItem of secItems) {
      const content = cardItem.content?.data;
      if (!content) continue;

      const uri = content.uri || '';
      const cardId = uri.split(':').pop() || `shelf-card-${cards.length}`;
      const cardTitle = content.name || content.title || '';
      if (!cardTitle) continue;

      const artistSubtitle = content.artists?.items?.map(a => a.profile?.name).filter(Boolean).join(', ');
      const cardSubtitle = content.description || artistSubtitle || (content.__typename === 'Artist' ? 'Artista' : 'Playlist');
      const cardCover = content.images?.items?.[0]?.sources?.[0]?.url ||
        content.coverArt?.sources?.[0]?.url ||
        'https://misc.scdn.co/liked-songs/liked-songs-640.jpg';

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
      const lower = secTitle.toLowerCase();
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

  // Quick access cards (top 6-8 items from library or first shelf)
  const quickAccess = [];
  const sourceItems = playlists.slice(0, 8);
  for (const pl of sourceItems) {
    quickAccess.push({
      id: pl.id,
      name: pl.name,
      image: pl.images?.[0]?.url || 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg',
      color: pl.color || '#303030',
    });
  }

  return {
    user,
    playlists,
    shelves,
    quickAccess,
  };
}
