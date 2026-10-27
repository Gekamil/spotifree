import { extractSpotifySession } from './extract-session.js';

async function parseRequestBody(req) {
  if (req.body) {
    if (Buffer.isBuffer(req.body)) {
      try { return JSON.parse(req.body.toString('utf8')); } catch {}
    }
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch {}
    }
    if (typeof req.body === 'object') return req.body;
  }

  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    if (chunks.length > 0) {
      const text = Buffer.concat(chunks).toString('utf8');
      if (text) return JSON.parse(text);
    }
  } catch {}

  if (req.query && typeof req.query === 'object') {
    return req.query;
  }

  return {};
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const parsed = await parseRequestBody(req);
    const body = { ...(req.query || {}), ...parsed };

    const { email, password, cookie, twoFactorCode } = body;

    // 1. Direct cookie connection (sp_dc)
    if (cookie && String(cookie).trim()) {
      const cleanCookie = String(cookie).trim();
      const session = await extractSpotifySession(cleanCookie);
      return res.status(200).json({ success: true, ...session, cookie: cleanCookie });
    }

    // 2. 6-digit code verification
    if (twoFactorCode) {
      const cleanCode = String(twoFactorCode).replace(/\s+/g, '');
      if (cleanCode.length >= 6) {
        const rawUser = (email || 'Usuario').trim();
        const username = rawUser.includes('@') ? rawUser.split('@')[0] : rawUser;
        const isMarco = username.toLowerCase().includes('marco');
        const isJorge = username.toLowerCase().includes('jorge');

        const resolvedName = isMarco ? 'marcooos' : isJorge ? 'Jorgeperezvk' : username;
        const resolvedId = isMarco ? 'marcooos' : isJorge ? 'Jorgeperezvk' : username.toLowerCase();

        const user = {
          id: resolvedId,
          display_name: resolvedName,
          email: email || `${resolvedId}@spotify.com`,
          images: [
            {
              url: isMarco
                ? 'https://i.scdn.co/image/ab6761610000e5eb9ad3eb759082ef7ef688b56d'
                : 'https://i.scdn.co/image/ab6761610000e5eb56e6d183815f9bca1b4a9296',
            },
          ],
        };

        const sessionCookie = `session-${resolvedId}-${cleanCode}`;

        const defaultPlaylists = [
          {
            id: '37i9dQZF1DWZdsS73T1ogG',
            name: 'el nuevo urbano',
            description: 'Lo más nuevo de la música urbana.',
            images: [{ url: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426' }],
            owner: { display_name: 'Spotify', id: 'spotify' },
            tracks: { total: 50, items: [] },
            is_pinned: true,
          },
          {
            id: '7b3MrCWtettvBKlfBSdorn',
            name: 'J+L(2026)',
            description: 'Selección de éxitos contemporáneos.',
            images: [{ url: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c804d43e5cc7f6a6d0ac65ffc' }],
            owner: { display_name: resolvedName, id: resolvedId },
            tracks: { total: 45, items: [] },
            is_pinned: false,
          },
          {
            id: '37i9dQZF1DX2EiUAL7Wdfc',
            name: 'míticas',
            description: 'Canciones que nunca pasarán de moda.',
            images: [{ url: 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6' }],
            owner: { display_name: 'Spotify', id: 'spotify' },
            tracks: { total: 50, items: [] },
            is_pinned: false,
          },
          {
            id: '37i9dQZF1EYkqdzS443B1r',
            name: 'Mix diario 1',
            description: `Música de Álvaro Díaz, Feid, Mora y más. Hecho para ${resolvedName}.`,
            images: [{ url: 'https://seed-mix-image.spotifycdn.com/v6/img/daily_mix_1/small/es/default' }],
            owner: { display_name: 'Spotify', id: 'spotify' },
            tracks: { total: 50, items: [] },
            is_pinned: false,
          },
          {
            id: '37i9dQZF1EYkqdzS443B2r',
            name: 'Mix diario 2',
            description: `Música de Romeo Santos, Prince Royce y más. Hecho para ${resolvedName}.`,
            images: [{ url: 'https://seed-mix-image.spotifycdn.com/v6/img/daily_mix_2/small/es/default' }],
            owner: { display_name: 'Spotify', id: 'spotify' },
            tracks: { total: 50, items: [] },
            is_pinned: false,
          },
          {
            id: '37i9dQZF1EYkqdzS443B3r',
            name: 'Mix diario 3',
            description: 'Música urbana y trap seleccionada para ti.',
            images: [{ url: 'https://seed-mix-image.spotifycdn.com/v6/img/daily_mix_3/small/es/default' }],
            owner: { display_name: 'Spotify', id: 'spotify' },
            tracks: { total: 50, items: [] },
            is_pinned: false,
          },
        ];

        const shelves = [
          {
            id: 'shelf-made-for-you',
            prefix: 'Especialmente para ti',
            title: `Hecho para ${resolvedName}`,
            subtitle: 'Tus listas y recomendaciones personalizadas',
            type: 'made_for',
            hasSeeAll: true,
            cards: [
              {
                id: '37i9dQZF1EYkqdzS443B1r',
                title: 'Mix diario 1',
                subtitle: 'Álvaro Díaz, Feid, Mora y más',
                image: 'https://seed-mix-image.spotifycdn.com/v6/img/daily_mix_1/small/es/default',
                badge: 'Mix diario 1',
                badgeColor: '#00F0FF',
              },
              {
                id: '37i9dQZF1EYkqdzS443B2r',
                title: 'Mix diario 2',
                subtitle: 'Romeo Santos, Prince Royce, Aventura',
                image: 'https://seed-mix-image.spotifycdn.com/v6/img/daily_mix_2/small/es/default',
                badge: 'Mix diario 2',
                badgeColor: '#FFA42B',
              },
              {
                id: '37i9dQZF1EYkqdzS443B3r',
                title: 'Mix diario 3',
                subtitle: 'Bad Bunny, Myke Towers, Eladio Carrión',
                image: 'https://seed-mix-image.spotifycdn.com/v6/img/daily_mix_3/small/es/default',
                badge: 'Mix diario 3',
                badgeColor: '#1ED760',
              },
              {
                id: '37i9dQZF1DWZdsS73T1ogG',
                title: 'el nuevo urbano',
                subtitle: 'Lo más nuevo de la música urbana',
                image: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426',
              },
              {
                id: '7b3MrCWtettvBKlfBSdorn',
                title: 'J+L(2026)',
                subtitle: `Lista personalizada de ${resolvedName}`,
                image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c804d43e5cc7f6a6d0ac65ffc',
              },
              {
                id: '37i9dQZF1DX2EiUAL7Wdfc',
                title: 'míticas',
                subtitle: 'Canciones que nunca pasarán de moda',
                image: 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6',
              },
            ],
          },
          {
            id: 'shelf-new-releases',
            prefix: 'Lanzamientos',
            title: 'Novedades para ti',
            subtitle: 'Nuevos temas de artistas que te gustan',
            type: 'featured',
            hasSeeAll: true,
            cards: [
              {
                id: '37i9dQZF1DXcBWIGoYBM5M',
                title: 'Éxitos España',
                subtitle: 'Los temas más virales y reproducidos hoy',
                image: 'https://i.scdn.co/image/ab67706f00000002e8ccdd567fff6a597b87586b',
              },
              {
                id: '4f0YTBqSbvM1iJpuY9r3yQ',
                title: 'ZIZI',
                subtitle: 'Música pop y urbana destacada',
                image: 'https://i.scdn.co/image/ab67616d0000b273eb31ebdbca6acd99c23b4d31',
              },
              {
                id: '37i9dQZF1EQncLwOalG3K7',
                title: 'Pop con Ñ',
                subtitle: 'El pop en español más fresco y actual',
                image: 'https://i.scdn.co/image/ab67706f000000020ad613a778fc3ef5c91f54cf',
              },
              {
                id: '37i9dQZF1DX10zKzsJ2jva',
                title: 'Viva Latino',
                subtitle: 'El corazón de la música latina actual',
                image: 'https://i.scdn.co/image/ab67706f00000002f232ffabeb0f993f45f20f06',
              },
              {
                id: '37i9dQZF1DX0XUsuxWHRQd',
                title: 'RapCaviar',
                subtitle: 'Los mejores lanzamientos urbanos e internacionales',
                image: 'https://i.scdn.co/image/ab67706f0000000259dc23c89658db41e7f353eb',
              },
              {
                id: '37i9dQZEVXbNFJfN1Vw8d9',
                title: 'Top 50: España',
                subtitle: 'Tu actualización diaria de los temas más escuchados',
                image: 'https://charts-images.scdn.co/assets/locale_en/regional/daily/region_es_large.jpg',
              },
            ],
          },
        ];

        return res.status(200).json({
          success: true,
          user,
          cookie: sessionCookie,
          accessToken: `token-${resolvedId}`,
          playlists: defaultPlaylists,
          shelves,
          session: {
            user,
            playlists: defaultPlaylists,
            shelves,
            accessToken: `token-${resolvedId}`,
          },
        });
      }

      return res.status(400).json({
        success: false,
        error: 'El código de verificación debe tener 6 cifras.',
      });
    }

    // 3. Email and password submitted -> prompt for verification code
    if (email) {
      return res.status(200).json({
        success: false,
        needs2FA: true,
        message: 'Código de verificación enviado a tu correo.',
      });
    }

    return res.status(400).json({ error: 'Faltan credenciales.' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Error en el servidor.' });
  }
}
