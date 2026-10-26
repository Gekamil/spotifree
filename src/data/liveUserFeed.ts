export interface FeedCard {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  href?: string;
  badge?: string;
  badgeColor?: string;
  isRadio?: boolean;
  video?: string | null;
}

export interface FeedShelf {
  id: string;
  title: string;
  prefix?: string;
  subtitle?: string;
  hasSeeAll?: boolean;
  cards: FeedCard[];
}

export const liveUserFeed: FeedShelf[] = [
  {
    id: 'shelf-novedades',
    title: '¡Hoy es viernes de novedades!',
    hasSeeAll: true,
    cards: [
      {
        id: 'nv-1',
        title: 'Novedades Viernes España',
        subtitle: 'La Pantera & Quevedo, Myke Towers, Saiko...',
        image: 'https://i.scdn.co/image/ab67706f00000002eaecef062c2877a5c0f5f10e',
      },
      {
        id: 'nv-2',
        title: 'Radar de Novedades',
        subtitle: 'Las novedades de los artistas que sigues y más.',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000bada/dt/v1/img/release-radar-v4/1i8SpTcr7yvPOmcqrbnVXY/es',
      },
      {
        id: 'nv-3',
        title: 'HOT NOW - Myke Towers',
        subtitle: 'LAS CANCIONES MÁS 🔥🔥🔥',
        image: 'https://i.scdn.co/image/ab67706f00000002ceeb931ff6337da45fe04a6a',
      },
      {
        id: 'nv-4',
        title: 'el nuevo urbano',
        subtitle: 'Descubre lo más nuevo del género urbano en español.',
        image: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426',
      },
      {
        id: 'nv-5',
        title: 'nuevo urbano 2026',
        subtitle: 'El nuevo urbano \'Made in Spain\' que se pega en todo el mundo.',
        image: 'https://i.scdn.co/image/ab67706f00000002a973a9cc67d246b7865e3e43',
      },
      {
        id: 'nv-6',
        title: 'el trap',
        subtitle: 'Lo mejor del trap en español actual.',
        image: 'https://i.scdn.co/image/ab67706f000000029e2b94ba77914439b74c02fe',
      },
      {
        id: 'nv-7',
        title: 'Fuego',
        subtitle: 'Las canciones más calientes del panorama internacional.',
        image: 'https://i.scdn.co/image/ab67706f000000020d3134542da32ee66663c23a',
      },
      {
        id: 'nv-8',
        title: 'Viva Latino',
        subtitle: 'El top de la música latina actual.',
        image: 'https://i.scdn.co/image/ab67706f00000002964880811c74069be12f02b5',
      },
    ],
  },
  {
    id: 'shelf-made-for-you',
    prefix: 'Hecho para',
    title: 'Jorgeperezvk',
    hasSeeAll: true,
    cards: [
      {
        id: 'dm-1',
        title: 'Mix diario 1',
        subtitle: 'Nacho, Bad Bunny, Tainy, Quevedo y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/1/ab6761610000e5ebba3ed5da785f99ce7ea6fb0b/es',
        badge: 'Mix diario 1',
        badgeColor: '#00F0FF',
      },
      {
        id: 'dm-2',
        title: 'Mix diario 2',
        subtitle: 'Bruno Mars, Taylor Swift, Maroon 5 y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/2/ab6761610000e5ebc7688aad1bf03986934d7e26/es',
        badge: 'Mix diario 2',
        badgeColor: '#FFE600',
      },
      {
        id: 'dm-3',
        title: 'Mix diario 3',
        subtitle: 'Romeo Santos, Aventura, Prince Royce y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/3/ab6761610000e5ebc8be3c6e5a824360d1bffc03/es',
        badge: 'Mix diario 3',
        badgeColor: '#FF4632',
      },
      {
        id: 'dm-4',
        title: 'Mix diario 4',
        subtitle: 'Malcolm Todd, PinkPantheress, kuala y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/4/ab6761610000e5eb9f6f7c2d12975d2a4b3a0fd8/es',
        badge: 'Mix diario 4',
        badgeColor: '#FF64B4',
      },
      {
        id: 'dm-5',
        title: 'Mix diario 5',
        subtitle: 'DZA, Quevedo, Cruz Cafuné, Duki y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/5/ab6761610000e5eb3f9c363c3eef1ed52b8043a7/es',
        badge: 'Mix diario 5',
        badgeColor: '#1ED760',
      },
      {
        id: 'dm-6',
        title: 'Mix diario 6',
        subtitle: 'The Weeknd, Post Malone, Travis Scott y más',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/6/ab6761610000e5ebce4257ca508a2c7e600192ed/es',
        badge: 'Mix diario 6',
        badgeColor: '#8C52FF',
      },
    ],
  },
  {
    id: 'shelf-recientes',
    title: 'Recientes',
    hasSeeAll: true,
    cards: [
      {
        id: 'rec-1',
        title: 'My top tracks playlist',
        subtitle: 'Lista • Jorgeperezvk',
        image: 'https://mosaic.scdn.co/300/ab67616d00001e0274d62f9a88da68519fa864f4ab67616d00001e027c7a7bfadfaa801d3285455bab67616d00001e02c019056033dfa6c6987f25ceab67616d00001e02d01f410ddd5776121c42bf59',
      },
      {
        id: 'rec-2',
        title: 'Romeo & Prince',
        subtitle: 'Lista • Jorgeperezvk',
        image: 'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000d72cfd28fd6f3ec5b7002c5649d7',
      },
      {
        id: 'rec-3',
        title: 'J+L(2026)',
        subtitle: 'Lista • Lucía :)',
        image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c804d43e5cc7f6a6d0ac65ffc',
      },
      {
        id: 'rec-4',
        title: 'Random',
        subtitle: 'Lista • Jorgeperezvk',
        image: 'https://mosaic.scdn.co/640/ab67616d00001e0274d62f9a88da68519fa864f4ab67616d00001e027c7a7bfadfaa801d3285455bab67616d00001e0281df105a4f0b2f6b07468179ab67616d00001e02c019056033dfa6c6987f25ce',
      },
      {
        id: 'rec-5',
        title: 'míticas',
        subtitle: 'Lista • Jorgeperezvk',
        image: 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6',
      },
      {
        id: 'rec-6',
        title: 'Bd 🎉🎂',
        subtitle: 'Lista • Jorgeperezvk',
        image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c8b5e9b3204bf524cd440e883',
      },
    ],
  },
  {
    id: 'shelf-mixes-escuchados',
    title: 'Tus mixes más escuchados',
    hasSeeAll: true,
    cards: [
      {
        id: 'tm-1',
        title: 'Mix de Romeo Santos',
        subtitle: 'Romeo Santos, Aventura y Prince Royce',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/artistmix/5lwmRuXgjX8xIwlnauTZIP/es',
      },
      {
        id: 'tm-2',
        title: 'Mix relajante',
        subtitle: 'Música tranquila para desconectar',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/topic/chill/0sfCfF62IjeupwxdvH7KM3/es',
      },
      {
        id: 'tm-3',
        title: 'Mix de Eloy',
        subtitle: 'Eloy, Zion & Lennox, Ken-Y',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/artistmix/0eet2VBconGGtNYJ0CBgHu/es',
      },
      {
        id: 'tm-4',
        title: 'Mix latino',
        subtitle: 'Ritmo, pasión y los éxitos más sonados',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/topic/latin/2oQX8QiMXOyuqbcZEFsZfm/es',
      },
      {
        id: 'tm-5',
        title: 'Mix de One Direction',
        subtitle: 'Harry Styles, Zayn, Niall Horan',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/artistmix/4AK6F7OLvEQ5QYCBNiQWHq/es',
      },
    ],
  },
  {
    id: 'shelf-emisoras-recomendadas',
    title: 'Emisoras recomendadas',
    subtitle: 'Música sin fin basada en tus canciones y artistas favoritos.',
    hasSeeAll: true,
    cards: [
      {
        id: 'rad-1',
        title: 'Radio Ozuna',
        subtitle: 'Con Bad Bunny, J Balvin, Anuel AA',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/radio/artist/1i8SpTcr7yvPOmcqrbnVXY/es',
      },
      {
        id: 'rad-2',
        title: 'Radio Bruno Mars',
        subtitle: 'Con Silk Sonic, The Weeknd, Michael Jackson',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/radio/artist/0du5cEVh5yTK9QJze8zA0C/es',
      },
      {
        id: 'rad-3',
        title: 'Radio Prince Royce',
        subtitle: 'Con Romeo Santos, Bachata Hits, Aventura',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/radio/artist/3MHaV05u0io8fQbZ2XPtlC/es',
      },
      {
        id: 'rad-4',
        title: 'Radio Es un Secreto',
        subtitle: 'Con Plan B, Chencho Corleone, Maldy',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/radio/track/3KZCP2StVGdWkOKyRZNWA4/es',
      },
      {
        id: 'rad-5',
        title: 'Radio KAROL G',
        subtitle: 'Con Becky G, Shakira, Natti Natasha',
        image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/radio/artist/790FomKkXshlbRYZFtlgla/es',
      },
    ],
  },
  {
    id: 'shelf-albumes-destacados',
    title: 'Álbumes con canciones que te gustan',
    hasSeeAll: true,
    cards: [
      {
        id: 'alb-1',
        title: 'K.O.B. Live',
        subtitle: 'Aventura • Álbum',
        image: 'https://i.scdn.co/image/ab67616d0000b273c28a6d0f6ed7b540f8208543',
      },
      {
        id: 'alb-2',
        title: 'Fórmula, Vol. 2 (Deluxe Edition)',
        subtitle: 'Romeo Santos • Álbum',
        image: 'https://i.scdn.co/image/ab67616d00001e024ced2cec7470960ad2385da7',
      },
      {
        id: 'alb-3',
        title: 'FRIENDS (Hoodtrap)',
        subtitle: 'Varios Artistas • Álbum',
        image: 'https://i.scdn.co/image/ab67616d00001e020e3a16a31ed7da2178228a68',
      },
      {
        id: 'alb-4',
        title: 'Verano 2026',
        subtitle: 'Spotify • Playlist',
        image: 'https://i.scdn.co/image/ab67706f000000025b14bc0bdbe5ad06c67fc881',
      },
    ],
  },
];
