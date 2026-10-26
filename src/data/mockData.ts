import type { Playlist, Track, UserProfile } from '../types/spotify';

export const mockUser: UserProfile = {
  id: 'jorgeperezvk',
  display_name: 'Jorgeperezvk',
  email: 'jorge@example.com',
  images: [
    {
      url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    },
  ],
  followers: { total: 42 },
};

// Exact 8 Quick Access cards from the live Spotify screen with real CDN assets
export const mockQuickAccess = [
  {
    id: 'liked-songs',
    name: 'Canciones que te gustan',
    image: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg',
    isLiked: true,
  },
  {
    id: 'jl-2026',
    name: 'J+L(2026)',
    image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c804d43e5cc7f6a6d0ac65ffc',
    isLiked: false,
  },
  {
    id: 'romeo-prince',
    name: 'Romeo & Prince',
    image: 'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000d72cfd28fd6f3ec5b7002c5649d7',
    isLiked: false,
  },
  {
    id: 'nuestro-amor',
    name: '♡ nuestro amor ♡ (2024-25)',
    image: 'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000d72c94fb1489122f222f1a57c7c8',
    isLiked: false,
  },
  {
    id: 'bd-cake',
    name: 'Bd 🎉🎂',
    image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c8b5e9b3204bf524cd440e883',
    isLiked: false,
  },
  {
    id: 'zizi',
    name: 'ZIZI',
    image: 'https://i.scdn.co/image/ab67616d0000b273eb31ebdbca6acd99c23b4d31',
    isLiked: false,
  },
  {
    id: 'random',
    name: 'Random',
    image: 'https://mosaic.scdn.co/640/ab67616d00001e0274d62f9a88da68519fa864f4ab67616d00001e027c7a7bfadfaa801d3285455bab67616d00001e0281df105a4f0b2f6b07468179ab67616d00001e02c019056033dfa6c6987f25ce',
    isLiked: false,
  },
  {
    id: 'cooking-gaming',
    name: 'Cooking gaming Songs',
    image: 'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000d72c1163c32abb5c8ae7518edb09',
    isLiked: false,
  },
];

// Tracks matching the user's real Spotify playlist: Canciones que te gustan
export const mockTracks: Track[] = [
  {
    id: 't-rain',
    name: 'Rain',
    artists: [{ id: 'a-trueno', name: 'Trueno' }],
    album: {
      id: 'alb-rain',
      name: 'Rain',
      images: [
        { url: 'https://i.scdn.co/image/ab67616d000048512fda43dd98cc1cad8b908d9f' },
      ],
      release_date: '2025-08-12',
    },
    duration_ms: 182000, // 3:02
    added_at: '12 ago 2025',
  },
  {
    id: 't-junto-amanecer',
    name: 'Junto al Amanecer',
    artists: [{ id: 'a-jalvarez', name: 'J Alvarez' }],
    album: {
      id: 'alb-movimiento',
      name: 'El Movimiento: The Mixtape',
      images: [
        { url: 'https://i.scdn.co/image/ab67616d00004851d33f8f4911fcbb4c2f706365' },
      ],
      release_date: '2025-04-29',
    },
    duration_ms: 251000, // 4:11
    added_at: '29 abr 2025',
  },
  {
    id: 't-tu-con-el',
    name: 'Tú Con Él',
    artists: [{ id: 'a-rauw', name: 'Rauw Alejandro' }],
    album: {
      id: 'alb-cosa-nuestra',
      name: 'Cosa Nuestra',
      images: [
        { url: 'https://i.scdn.co/image/ab67616d00004851a6224f2f93c0ab4b2e01b44b' },
      ],
      release_date: '2025-02-15',
    },
    duration_ms: 300000, // 5:00
    added_at: '15 feb 2025',
  },
  {
    id: 't-baile-inolvidable',
    name: 'BAILE INoLVIDABLE',
    artists: [{ id: 'a-badbunny', name: 'Bad Bunny' }],
    album: {
      id: 'alb-debi-tirar',
      name: 'DeBÍ TiRAR MáS FOToS',
      images: [
        { url: 'https://i.scdn.co/image/ab67616d00004851bbd45c8d36e0e045ef640411' },
      ],
      release_date: '2025-01-10',
    },
    duration_ms: 247000, // 4:07
    added_at: '10 ene 2025',
  },
  {
    id: 't-all-night',
    name: 'All Night',
    artists: [{ id: 'a-deiv', name: 'Dei V' }, { id: 'a-rauw', name: 'Rauw Alejandro' }],
    album: {
      id: 'alb-all-night',
      name: 'All Night',
      images: [
        { url: 'https://i.scdn.co/image/ab67616d000011ebd0f86f6582fa0b84d587ede8' },
      ],
      release_date: '2024-05-10',
    },
    duration_ms: 218000, // 3:38
    added_at: 'Hace 3 días',
  },
];

// Exact playlists from the user's live library
export const mockPlaylists: Playlist[] = [
  {
    id: 'liked-songs',
    name: 'Canciones que te gustan',
    description: 'Lista • 23 canciones',
    color: '#4910a3',
    images: [{ url: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg' }],
    owner: { id: 'jorgeperezvk', display_name: 'Jorgeperezvk' },
    tracks: { total: 23, items: mockTracks },
    is_pinned: true,
  },
  {
    id: 'my-top-tracks',
    name: 'My top tracks playlist',
    description: 'Lista • Jorgeperezvk',
    color: '#2d46b9',
    images: [{ url: 'https://mosaic.scdn.co/300/ab67616d00001e0274d62f9a88da68519fa864f4ab67616d00001e027c7a7bfadfaa801d3285455bab67616d00001e02c019056033dfa6c6987f25ceab67616d00001e02d01f410ddd5776121c42bf59' }],
    owner: { id: 'jorgeperezvk', display_name: 'Jorgeperezvk' },
    tracks: { total: 50, items: mockTracks },
    is_pinned: false,
  },
  {
    id: 'jl-2026',
    name: 'J+L(2026)',
    description: 'Lista • Lucía :)',
    color: '#382218',
    images: [{ url: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000dec5804d43e5cc7f6a6d0ac65ffc' }],
    owner: { id: 'lucia', display_name: 'Lucía :)' },
    tracks: { total: 45, items: mockTracks },
    is_pinned: false,
  },
  {
    id: 'romeo-prince',
    name: 'Romeo & Prince',
    description: 'Lista • Jorgeperezvk',
    color: '#1e3264',
    images: [{ url: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000dec5fd28fd6f3ec5b7002c5649d7' }],
    owner: { id: 'jorgeperezvk', display_name: 'Jorgeperezvk' },
    tracks: { total: 32, items: mockTracks },
    is_pinned: false,
  },
  {
    id: 'radio-prince',
    name: 'Radio Prince Royce',
    description: 'Hecha para Jorgeperezvk',
    color: '#2d634f',
    images: [{ url: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/radio/artist/3MHaV05u0io8fQbZ2XPtlC/es' }],
    owner: { id: 'spotify', display_name: 'Hecha para Jorgeperezvk' },
    tracks: { total: 50, items: mockTracks },
    is_pinned: false,
  },
  {
    id: 'mas-escuchadas-2025',
    name: 'Tus canciones más escuchadas en 2025',
    description: 'Hecha para Jorgeperezvk',
    color: '#2a4f5e',
    images: [{ url: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/wrapped25/yts/es' }],
    owner: { id: 'spotify', display_name: 'Hecha para Jorgeperezvk' },
    tracks: { total: 100, items: mockTracks },
    is_pinned: false,
  },
  {
    id: 'random',
    name: 'Random',
    description: 'Lista • Jorgeperezvk',
    color: '#431754',
    images: [{ url: 'https://mosaic.scdn.co/60/ab67616d00001e0274d62f9a88da68519fa864f4ab67616d00001e027c7a7bfadfaa801d3285455bab67616d00001e0281df105a4f0b2f6b07468179ab67616d00001e02c019056033dfa6c6987f25ce' }],
    owner: { id: 'jorgeperezvk', display_name: 'Jorgeperezvk' },
    tracks: { total: 64, items: mockTracks },
    is_pinned: false,
  },
  {
    id: 'spidey',
    name: 'Spidey',
    description: 'Lista • Jorgeperezvk',
    color: '#8b1c1c',
    images: [{ url: 'https://i.scdn.co/image/ab67616d000011ebe2e352d89826aef6dbd5ff8f' }],
    owner: { id: 'jorgeperezvk', display_name: 'Jorgeperezvk' },
    tracks: { total: 18, items: mockTracks },
    is_pinned: false,
  },
  {
    id: 'nuestro-amor-lib',
    name: '♡ nuestro amor ♡ (2024-25)',
    description: 'Lista • Lucía :)',
    color: '#8c2830',
    images: [{ url: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000dec594fb1489122f222f1a57c7c8' }],
    owner: { id: 'lucia', display_name: 'Lucía :)' },
    tracks: { total: 72, items: mockTracks },
    is_pinned: false,
  },
  {
    id: 'nueva-carpeta',
    name: 'Nueva carpeta',
    description: 'Carpeta',
    color: '#282828',
    images: [{ url: '' }],
    owner: { id: 'jorgeperezvk', display_name: 'Jorgeperezvk' },
    tracks: { total: 0, items: [] },
    is_pinned: false,
  },
];

export const mockNoveltyCards = [
  {
    id: 'nov-1',
    title: 'Novedades Viernes España',
    subtitle: 'Novedades de viernes en español e internacional.',
    image: 'https://i.scdn.co/image/ab67706f00000002eaecef062c2877a5c0f5f10e',
  },
  {
    id: 'nov-2',
    title: 'Radar de Novedades',
    subtitle: 'Música hecha especialmente para ti, actualizada los viernes.',
    image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000bada/dt/v1/img/release-radar-v4/1i8SpTcr7yvPOmcqrbnVXY/es',
  },
  {
    id: 'nov-3',
    title: 'HOT NOW - Myke Towers',
    subtitle: 'Los temas que están arrasando en toda España hoy.',
    image: 'https://i.scdn.co/image/ab67706f00000002ceeb931ff6337da45fe04a6a',
  },
  {
    id: 'nov-4',
    title: 'el nuevo urbano',
    subtitle: 'Lo más nuevo del género urbano en español.',
    image: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426',
  },
  {
    id: 'nov-5',
    title: 'nuevo urbano 2026',
    subtitle: 'La nueva ola del trap y reggaeton mundial.',
    image: 'https://i.scdn.co/image/ab67706f00000002a973a9cc67d246b7865e3e43',
  },
  {
    id: 'nov-6',
    title: 'el nuevo tropical',
    subtitle: 'Bachata, salsa y ritmos caribeños de hoy.',
    image: 'https://i.scdn.co/image/ab67706f000000029e2b94ba77914439b74c02fe',
  },
];
