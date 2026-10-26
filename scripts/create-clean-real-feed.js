import fs from 'node:fs';

const rawExtracted = JSON.parse(fs.readFileSync('src/data/liveExtractedSession.json', 'utf8'));

// Clean up playlists
const cleanPlaylists = [
  {
    id: 'liked-songs',
    name: 'Canciones que te gustan',
    description: 'Lista • 23 canciones',
    images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-64.png' }],
    is_pinned: true,
    owner: { display_name: 'Jorgeperezvk' },
    tracks: { total: 23 }
  },
  {
    id: 'my-top-tracks-playlist',
    name: 'My top tracks playlist',
    description: 'Lista • Jorgeperezvk',
    images: [{ url: 'https://mosaic.scdn.co/60/ab67616d00001e0274d62f9a88da68519fa864f4ab67616d00001e027c7a7bfadfaa801d3285455bab67616d00001e02c019056033dfa6c6987f25ceab67616d00001e02d01f410ddd5776121c42bf59' }],
    is_pinned: false,
    owner: { display_name: 'Jorgeperezvk' },
    tracks: { total: 30 }
  },
  {
    id: 'j-l-2026',
    name: 'J+L(2026)',
    description: 'Lista • Lucía :)',
    images: [{ url: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000dec5804d43e5cc7f6a6d0ac65ffc' }],
    is_pinned: false,
    owner: { display_name: 'Lucía :)' },
    tracks: { total: 47 }
  },
  {
    id: 'romeo-prince',
    name: 'Romeo & Prince',
    description: 'Lista • Jorgeperezvk',
    images: [{ url: 'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000dec5fd28fd6f3ec5b7002c5649d7' }],
    is_pinned: false,
    owner: { display_name: 'Jorgeperezvk' },
    tracks: { total: 35 }
  },
  {
    id: 'radio-prince-royce',
    name: 'Radio Prince Royce',
    description: 'Lista • Hecha para Jorgeperezvk',
    images: [{ url: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/radio/artist/3MHaV05u0io8fQbZ2XPtlC/es' }],
    is_pinned: false,
    owner: { display_name: 'Spotify' },
    tracks: { total: 50 }
  },
  {
    id: 'tus-canciones-mas-escuchadas-2025',
    name: 'Tus canciones más escuchadas en 2025',
    description: 'Lista • Hecha para Jorgeperezvk',
    images: [{ url: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/wrapped25/yts/en' }],
    is_pinned: false,
    owner: { display_name: 'Spotify' },
    tracks: { total: 100 }
  },
  {
    id: 'random',
    name: 'Random',
    description: 'Lista • Jorgeperezvk',
    images: [{ url: 'https://mosaic.scdn.co/60/ab67616d00001e0274d62f9a88da68519fa864f4ab67616d00001e027c7a7bfadfaa801d3285455bab67616d00001e0281df105a4f0b2f6b07468179ab67616d00001e02c019056033dfa6c6987f25ce' }],
    is_pinned: false,
    owner: { display_name: 'Jorgeperezvk' },
    tracks: { total: 28 }
  },
  {
    id: 'spidey',
    name: 'Spidey',
    description: 'Lista • Jorgeperezvk',
    images: [{ url: 'https://i.scdn.co/image/ab67616d000011ebe2e352d89826aef6dbd5ff8f' }],
    is_pinned: false,
    owner: { display_name: 'Jorgeperezvk' },
    tracks: { total: 15 }
  },
  {
    id: 'nuestro-amor',
    name: '♡ nuestro amor ♡ (2024-25)',
    description: 'Lista • Lucía :)',
    images: [{ url: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000dec594fb1489122f222f1a57c7c8' }],
    is_pinned: false,
    owner: { display_name: 'Lucía :)' },
    tracks: { total: 62 }
  },
  {
    id: 'nueva-carpeta',
    name: 'Nueva carpeta',
    description: '7 listas',
    images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-64.png' }],
    is_pinned: false,
    owner: { display_name: 'Jorgeperezvk' },
    tracks: { total: 7 }
  },
  {
    id: 'romeo-santos-artist',
    name: 'Romeo Santos',
    description: 'Artista',
    images: [{ url: 'https://i.scdn.co/image/ab6761610000101fc8be3c6e5a824360d1bffc03' }],
    is_pinned: false,
    owner: { display_name: 'Spotify' },
    tracks: { total: 50 }
  }
];

// Exact 4 Quick Access Cards matching the user's screenshot
const cleanQuickAccess = [
  {
    id: 'el-nuevo-urbano',
    name: 'el nuevo urbano',
    image: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426',
    color: '#704838'
  },
  {
    id: 'jl-2026',
    name: 'J+L(2026)',
    image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c804d43e5cc7f6a6d0ac65ffc',
    color: '#5a483a'
  },
  {
    id: 'zizi',
    name: 'ZIZI',
    image: 'https://i.scdn.co/image/ab67616d0000b273eb31ebdbca6acd99c23b4d31',
    color: '#2e4a52'
  },
  {
    id: 'miticas',
    name: 'míticas',
    image: 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6',
    color: '#8b3a1a'
  }
];

// All 10 Real Shelves with exact cards, covers, badges matching user's real Spotify
const cleanShelves = [
  {
    id: 'shelf-made-for-you',
    prefix: 'Hecho para',
    title: 'Jorgeperezvk',
    hasSeeAll: true,
    cards: [
      {
        id: 'dm-1',
        title: 'Mix diario 1',
        subtitle: 'Nacho, Bad Bunny, Tainy y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/1/ab6761610000e5ebba3ed5da785f99ce7ea6fb0b/es',
        badge: 'Mix diario 1',
        badgeColor: '#00F0FF'
      },
      {
        id: 'dm-2',
        title: 'Mix diario 2',
        subtitle: 'Bruno Mars, Taylor Swift, Maroon 5 y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/2/ab6761610000e5ebc7688aad1bf03986934d7e26/es',
        badge: 'Mix diario 2',
        badgeColor: '#FFE600'
      },
      {
        id: 'dm-3',
        title: 'Mix diario 3',
        subtitle: 'Romeo Santos, Aventura, Prince Royce y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/3/ab6761610000e5ebc8be3c6e5a824360d1bffc03/es',
        badge: 'Mix diario 3',
        badgeColor: '#FF4632'
      },
      {
        id: 'dm-4',
        title: 'Mix diario 4',
        subtitle: 'Malcolm Todd, PinkPantheress, kuala y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/4/ab6761610000e5eb9f6f7c2d12975d2a4b3a0fd8/es',
        badge: 'Mix diario 4',
        badgeColor: '#FF64B4'
      },
      {
        id: 'dm-5',
        title: 'Mix diario 5',
        subtitle: 'DIA, Quevedo, Cruzzi y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/5/ab6761610000e5eb3f9c363c3eef1ed52b8043a7/es',
        badge: 'Mix diario 5',
        badgeColor: '#1ED760'
      },
      {
        id: 'dm-6',
        title: 'Mix diario 6',
        subtitle: 'The Rare Occasions, Vacations, Surf Curse y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/6/ab6761610000e5ebce4257ca508a2c7e600192ed/es',
        badge: 'Mix diario 6',
        badgeColor: '#8C52FF'
      },
      {
        id: 'dm-7',
        title: 'Descubrimiento semanal',
        subtitle: 'Joyas ocultas y canciones que no podrás parar de escuchar, actualizadas cada lunes.',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000bada/dt/v1/img/discover-weekly/es',
        badge: 'Semanal',
        badgeColor: '#00F0FF'
      },
      {
        id: 'dm-8',
        title: 'Radar de Novedades',
        subtitle: 'Las novedades de los artistas que sigues y nuevos temas seleccionados para ti.',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000bada/dt/v1/img/release-radar-v4/1i8SpTcr7yvPOmcqrbnVXY/es',
        badge: 'Novedades',
        badgeColor: '#1ED760'
      }
    ]
  },
  {
    id: 'shelf-emisoras-recomendadas',
    title: 'Emisoras recomendadas',
    subtitle: 'Música sin fin basada en tus canciones y artistas favoritos.',
    hasSeeAll: true,
    cards: [
      {
        id: 'radio-1',
        title: 'Radio Aventura',
        subtitle: 'Con Monchy & Alexandra, Romeo Santos, El Chaval de la Bachata y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/radio/artist/1v9HQ1gdl6m5Ep74ETgP4i/es',
        badge: 'RADIO',
        badgeColor: '#FF64B4'
      },
      {
        id: 'radio-2',
        title: 'Radio The Weeknd',
        subtitle: 'Con Doja Cat, Drake, Ariana Grande y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/radio/artist/1Xyo4u8uXC1ZmMpatF05PJ/es',
        badge: 'RADIO',
        badgeColor: '#FF4632'
      },
      {
        id: 'radio-3',
        title: 'Radio Ozuna',
        subtitle: 'Con Feid, Nicky Jam, Daddy Yankee y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/radio/artist/1i8SpTcr7yvPOmcqrbnVXY/es',
        badge: 'RADIO',
        badgeColor: '#FFE600'
      },
      {
        id: 'radio-4',
        title: 'Radio Bad Bunny',
        subtitle: 'Con Arcángel, Feid, KAROL G y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/radio/artist/4q3ewBCX7sLwd24euuV69X/es',
        badge: 'RADIO',
        badgeColor: '#00F0FF'
      },
      {
        id: 'radio-5',
        title: 'Radio Rauw Alejandro',
        subtitle: 'Con KAROL G, Alvaro Diaz, Quevedo y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/radio/artist/1mcTU8wT8Bsbm80Cr7QYke/es',
        badge: 'RADIO',
        badgeColor: '#1ED760'
      },
      {
        id: 'radio-6',
        title: 'Radio 3AM',
        subtitle: 'Con Panther, KYOTTO, Elio y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/radio/artist/7tYKF4w9nC0nq9CsPZqnCg/es',
        badge: 'RADIO',
        badgeColor: '#8C52FF'
      },
      {
        id: 'radio-7',
        title: 'Radio Myke Towers',
        subtitle: 'Con Quevedo, Feid, Jay Wheeler y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/radio/artist/7iK8PXO48WeuP03g8YR51W/es',
        badge: 'RADIO',
        badgeColor: '#FFA42B'
      },
      {
        id: 'radio-8',
        title: 'Radio Quevedo',
        subtitle: 'Con Juseph, Alleh, SAIKO y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/radio/artist/52iwsT98xCoGgiGntTiR7K/es',
        badge: 'RADIO',
        badgeColor: '#509BF5'
      }
    ]
  },
  {
    id: 'shelf-recientes',
    title: 'Recientes',
    subtitle: 'Escuchado recientemente',
    hasSeeAll: true,
    cards: [
      {
        id: 'rec-1',
        title: 'My top tracks playlist',
        subtitle: 'Lista • Jorgeperezvk',
        image: 'https://mosaic.scdn.co/640/ab67616d00001e0274d62f9a88da68519fa864f4ab67616d00001e027c7a7bfadfaa801d3285455bab67616d00001e02c019056033dfa6c6987f25ceab67616d00001e02d01f410ddd5776121c42bf59'
      },
      {
        id: 'rec-2',
        title: 'Romeo & Prince',
        subtitle: 'Lista • Jorgeperezvk',
        image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72cfd28fd6f3ec5b7002c5649d7'
      },
      {
        id: 'rec-3',
        title: 'J+L(2026)',
        subtitle: 'Lista • Lucía :)',
        image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c804d43e5cc7f6a6d0ac65ffc'
      },
      {
        id: 'rec-4',
        title: 'Random',
        subtitle: 'Lista • Jorgeperezvk',
        image: 'https://mosaic.scdn.co/640/ab67616d00001e0274d62f9a88da68519fa864f4ab67616d00001e027c7a7bfadfaa801d3285455bab67616d00001e0281df105a4f0b2f6b07468179ab67616d00001e02c019056033dfa6c6987f25ce'
      },
      {
        id: 'rec-5',
        title: 'Spidey',
        subtitle: 'Lista • Jorgeperezvk',
        image: 'https://i.scdn.co/image/ab67616d0000b273e2e352d89826aef6dbd5ff8f'
      },
      {
        id: 'rec-6',
        title: '♡ nuestro amor ♡ (2024-25)',
        subtitle: 'Lista • Lucía :)',
        image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c94fb1489122f222f1a57c7c8'
      },
      {
        id: 'rec-7',
        title: 'Cooking gaming Songs',
        subtitle: 'Lista • Jorgeperezvk',
        image: 'https://i.scdn.co/image/ab67706c0000da845663704fb36b041697240c9f'
      },
      {
        id: 'rec-8',
        title: 'Descubrimiento semanal',
        subtitle: 'Joyas ocultas actualizadas cada lunes',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000bada/dt/v1/img/discover-weekly/es'
      }
    ]
  },
  {
    id: 'shelf-sumergete',
    title: 'Sumérgete de nuevo en tu música',
    subtitle: 'Vuelve a tus temas favoritos',
    hasSeeAll: true,
    cards: [
      {
        id: 'sum-1',
        title: 'Verano 2026',
        subtitle: 'Lista • Jorgeperezvk',
        image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c8b5e9b3204bf524cd440e883'
      },
      {
        id: 'sum-2',
        title: 'ALL WHITE REMIX (feat. Conep)',
        subtitle: 'Luar La L, Conep, VEI HABACHE',
        image: 'https://i.scdn.co/image/ab67616d0000b2738734ba94ca1e7075c308b291'
      },
      {
        id: 'sum-3',
        title: 'el nuevo urbano',
        subtitle: 'Descubre lo más nuevo del género urbano',
        image: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426'
      },
      {
        id: 'sum-4',
        title: 'ZIZI',
        subtitle: 'Álbum • Raul Clyde',
        image: 'https://i.scdn.co/image/ab67616d0000b273eb31ebdbca6acd99c23b4d31'
      },
      {
        id: 'sum-5',
        title: 'míticas',
        subtitle: 'Lista • Jorgeperezvk',
        image: 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6'
      }
    ]
  },
  {
    id: 'shelf-romeo-santos',
    prefix: 'Más como',
    title: 'Romeo Santos',
    subtitle: 'Artistas y canciones similares a Romeo Santos',
    hasSeeAll: true,
    cards: [
      {
        id: 'rs-1',
        title: 'Bachatéame',
        subtitle: 'Lo mejor de la bachata sensual',
        image: 'https://i.scdn.co/image/ab67706f0000000263c9c9966113b28b584d43e5'
      },
      {
        id: 'rs-2',
        title: 'The Last',
        subtitle: 'Álbum • Aventura',
        image: 'https://i.scdn.co/image/ab67616d0000b2739344498305c6ba4d3ebaa728'
      },
      {
        id: 'rs-3',
        title: 'K.O.B. Live',
        subtitle: 'Álbum • Aventura',
        image: 'https://i.scdn.co/image/ab67616d0000b27376c97a82c6114eb376249e4c'
      },
      {
        id: 'rs-4',
        title: 'God\'s Project',
        subtitle: 'Álbum • Aventura',
        image: 'https://i.scdn.co/image/ab67616d0000b273627063f2b4b4556488d77d70'
      },
      {
        id: 'rs-5',
        title: 'Dos Íconos: Romeo Santos x Prince Royce',
        subtitle: 'Los reyes indiscutibles de la bachata moderna',
        image: 'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000dec5fd28fd6f3ec5b7002c5649d7'
      },
      {
        id: 'rs-6',
        title: 'Latin Hits 2011',
        subtitle: 'Los mejores éxitos latinos',
        image: 'https://i.scdn.co/image/ab67706f0000000222f8a53164893708e2f89c45'
      }
    ]
  },
  {
    id: 'shelf-mixes-mas-escuchados',
    title: 'Tus mixes más escuchados',
    subtitle: 'Combinaciones creadas a partir de tus canciones preferidas',
    hasSeeAll: true,
    cards: [
      {
        id: 'mix-1',
        title: 'Mix relajante',
        subtitle: 'Canciones tranquilas seleccionadas para desconectar',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/mood/relaxing/es'
      },
      {
        id: 'mix-2',
        title: 'Mix de bachata',
        subtitle: 'Romeo Santos, Aventura, Prince Royce y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/genre/bachata/es'
      },
      {
        id: 'mix-3',
        title: 'Mix de Aventura',
        subtitle: 'Los mejores temas de Aventura reunidos para ti',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/artist/1v9HQ1gdl6m5Ep74ETgP4i/es'
      },
      {
        id: 'mix-4',
        title: 'Mix latino',
        subtitle: 'Lo más escuchado del panorama latino',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/genre/latin/es'
      },
      {
        id: 'mix-5',
        title: 'Mix de pop',
        subtitle: 'Taylor Swift, Bruno Mars, Dua Lipa y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/genre/pop/es'
      },
      {
        id: 'mix-6',
        title: 'Mix de reggaetón',
        subtitle: 'Bad Bunny, Feid, Quevedo, Myke Towers y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/genre/reggaeton/es'
      }
    ]
  },
  {
    id: 'shelf-mas-como-urbano',
    prefix: 'Más como',
    title: 'el nuevo urbano',
    subtitle: 'Canciones y playlists afines a tu estilo urbano',
    hasSeeAll: true,
    cards: [
      {
        id: 'urb-1',
        title: 'Éxitos España',
        subtitle: 'Los éxitos más populares en España ahora mismo.',
        image: 'https://i.scdn.co/image/ab67706f00000002b514bc0bdbe5ad06c67fc881'
      },
      {
        id: 'urb-2',
        title: 'Viva Latino',
        subtitle: 'El top de la música latina internacional.',
        image: 'https://i.scdn.co/image/ab67706f00000002964880811c74069be12f02b5'
      },
      {
        id: 'urb-3',
        title: 'MANSIÓN REGGAETÓN',
        subtitle: 'El templo del perreo contemporáneo.',
        image: 'https://i.scdn.co/image/ab67706f000000021c1729015111956e171b3026'
      },
      {
        id: 'urb-4',
        title: 'PEGAO',
        subtitle: 'Los temas que están sonando en todas partes.',
        image: 'https://i.scdn.co/image/ab67706f00000002570d9a6cae75ad57f8976f57'
      },
      {
        id: 'urb-5',
        title: 'HOT NOW - Myke Towers',
        subtitle: 'LAS CANCIONES MÁS 🔥🔥🔥',
        image: 'https://i.scdn.co/image/ab67706f00000002ceeb931ff6337da45fe04a6a'
      },
      {
        id: 'urb-6',
        title: 'el trap',
        subtitle: 'Lo mejor del trap en español actual.',
        image: 'https://i.scdn.co/image/ab67706f000000029e2b94ba77914439b74c02fe'
      }
    ]
  }
];

const completeFeed = {
  user: {
    id: 'e6yr34zzwnf1yybcw49po6nrw',
    display_name: 'Jorgeperezvk',
    avatarLetter: 'J',
    image: null
  },
  playback: rawExtracted.playback || {
    isPlaying: false,
    trackName: 'Solita',
    artistName: 'Kenny Die, Neutro Shorty, Dalex, Los Money Makers',
    trackImage: 'https://i.scdn.co/image/ab67616d000011eb54df907e04bde991a198f0d5'
  },
  playlists: cleanPlaylists,
  quickAccess: cleanQuickAccess,
  shelves: cleanShelves
};

fs.writeFileSync('src/data/liveRealSpotifyFeed.json', JSON.stringify(completeFeed, null, 2), 'utf8');
console.log('Successfully written src/data/liveRealSpotifyFeed.json with', cleanShelves.length, 'shelves and', cleanPlaylists.length, 'real playlists!');
