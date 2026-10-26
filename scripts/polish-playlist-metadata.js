import fs from 'fs';

const meta = {
  'liked-songs': {
    name: 'Canciones que te gustan',
    description: 'Lista • 23 canciones',
    image: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg',
    color: '#5018F0',
    owner: 'Jorgeperezvk'
  },
  'my-top-tracks': {
    name: 'My top tracks playlist',
    description: 'Lista • Jorgeperezvk',
    image: 'https://mosaic.scdn.co/640/ab67616d00001e0274d62f9a88da68519fa864f4ab67616d00001e027c7a7bfadfaa801d3285455bab67616d00001e02c019056033dfa6c6987f25ceab67616d00001e02d01f410ddd5776121c42bf59',
    color: '#2f4347',
    owner: 'Jorgeperezvk'
  },
  'jl-2026': {
    name: 'J+L(2026)',
    description: 'Lista • Lucía :)',
    image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c804d43e5cc7f6a6d0ac65ffc',
    color: '#544e47',
    owner: 'Lucía :)'
  },
  'romeo-prince': {
    name: 'Romeo & Prince',
    description: 'Lista • Jorgeperezvk',
    image: 'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000dec5fd28fd6f3ec5b7002c5649d7',
    color: '#533c30',
    owner: 'Jorgeperezvk'
  },
  'radio-prince-royce': {
    name: 'Radio Prince Royce',
    description: 'Lista • Hecha para Jorgeperezvk',
    image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/radio/artist/3MHaV05u0io8fQbZ2XPtlC/es',
    color: '#4a422b',
    owner: 'Spotify'
  },
  'tus-canciones-mas-escuchadas-2025': {
    name: 'Tus canciones más escuchadas en 2025',
    description: 'Lista • Hecha para Jorgeperezvk',
    image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/wrapped25/yts/en',
    color: '#31445b',
    owner: 'Spotify'
  },
  'random': {
    name: 'Random',
    description: 'Lista • Jorgeperezvk',
    image: 'https://mosaic.scdn.co/640/ab67616d00001e0274d62f9a88da68519fa864f4ab67616d00001e027c7a7bfadfaa801d3285455bab67616d00001e0281df105a4f0b2f6b07468179ab67616d00001e02c019056033dfa6c6987f25ce',
    color: '#453229',
    owner: 'Jorgeperezvk'
  },
  'spidey': {
    name: 'Spidey',
    description: 'Lista • Jorgeperezvk',
    image: 'https://i.scdn.co/image/ab67616d0000b273e2e352d89826aef6dbd5ff8f',
    color: '#8b1d24',
    owner: 'Jorgeperezvk'
  },
  'nuestro-amor': {
    name: '♡ nuestro amor ♡ (2024-25)',
    description: 'Lista • Lucía :)',
    image: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000d72c94fb1489122f222f1a57c7c8',
    color: '#583642',
    owner: 'Lucía :)'
  },
  'el-nuevo-urbano': {
    name: 'el nuevo urbano',
    description: 'Lo último y más destacado del reggaetón y trap latino',
    image: 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426',
    color: '#704838',
    owner: 'Spotify'
  },
  'miticas': {
    name: 'míticas',
    description: 'Grandes clásicos que marcaron generaciones',
    image: 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6',
    color: '#8b3a1a',
    owner: 'Spotify'
  },
  'zizi': {
    name: 'ZIZI',
    description: 'Álbum • 2026',
    image: 'https://i.scdn.co/image/ab67616d0000b273eb31ebdbca6acd99c23b4d31',
    color: '#2e4a52',
    owner: 'Spotify'
  },
  'dm-1': {
    name: 'Mix diario 1',
    description: 'Nacho, Bad Bunny, Tainy y más',
    image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/daily/1/ab6761610000e5ebba3ed5da785f99ce7ea6fb0b/es',
    color: '#00F0FF',
    owner: 'Spotify'
  },
  'radio-1': {
    name: 'Radio Aventura',
    description: 'Con Monchy & Alexandra, Romeo Santos, El Chaval de la Bachata y más',
    image: 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/radio/artist/1qto4hHid1P71emI6Fd8xi/es',
    color: '#FF64B4',
    owner: 'Spotify'
  }
};

const file = 'src/data/allRealPlaylistTracks.json';
const data = JSON.parse(fs.readFileSync(file, 'utf-8'));

for (const key of Object.keys(meta)) {
  if (data[key]) {
    data[key].name = meta[key].name;
    data[key].description = meta[key].description;
    data[key].image = meta[key].image;
    data[key].color = meta[key].color;
    data[key].owner = meta[key].owner;
    data[key].total = data[key].tracks.length;
  }
}

// Ensure liked-songs has all 13 extracted liked tracks
const likedSongsList = [
  {
    id: 'liked-1',
    name: 'Rain',
    duration_ms: 182000,
    album: { id: 'alb-rain', name: 'Rain', images: [{ url: 'https://i.scdn.co/image/ab67616d000048512fda43dd98cc1cad8b908d9f', width: 300, height: 300 }] },
    artists: [{ id: 'trueno', name: 'Trueno' }],
    added_at: '12 ago 2025'
  },
  {
    id: 'liked-2',
    name: 'Sunflower - Spider-Man: Into the Spider-Verse',
    duration_ms: 158000,
    album: { id: 'alb-sunflower', name: 'Spider-Man: Into the Spider-Verse', images: [{ url: 'https://i.scdn.co/image/ab67616d00004851e2e352d89826aef6dbd5ff8f', width: 300, height: 300 }] },
    artists: [{ id: 'post-malone', name: 'Post Malone' }, { id: 'swae-lee', name: 'Swae Lee' }],
    added_at: '31 ene 2025'
  },
  {
    id: 'liked-3',
    name: 'Funk de Beleza - Slowed',
    duration_ms: 142000,
    album: { id: 'alb-funk', name: 'Funk de Beleza', images: [{ url: 'https://i.scdn.co/image/ab67616d0000485182b73e1b62eda395d6627542', width: 300, height: 300 }] },
    artists: [{ id: 'nateki', name: 'Nateki' }, { id: 'scythermane', name: 'Scythermane' }, { id: 'mc-mayah', name: 'MC MAYAH' }],
    added_at: '7 feb 2025'
  },
  {
    id: 'liked-4',
    name: 'Dancin - Krono Remix',
    duration_ms: 198000,
    album: { id: 'alb-dancin', name: 'Dancin (Krono Remix)', images: [{ url: 'https://i.scdn.co/image/ab67616d00001e027715dbcfe17cf4260d47c311', width: 300, height: 300 }] },
    artists: [{ id: 'aaron-smith', name: 'Aaron Smith' }, { id: 'krono', name: 'Krono' }, { id: 'luvli', name: 'Luvli' }],
    added_at: 'Reciente'
  },
  {
    id: 'liked-5',
    name: 'PASSO BEM SOLTO - Slowed',
    duration_ms: 132000,
    album: { id: 'alb-passo', name: 'PASSO BEM SOLTO', images: [{ url: 'https://i.scdn.co/image/ab67616d00001e0236385e0fad3c87e8e8f19071', width: 300, height: 300 }] },
    artists: [{ id: 'atlxs', name: 'ATLXS' }],
    added_at: 'Reciente'
  },
  {
    id: 'liked-6',
    name: 'MONTAGEM TOMADA - Slowed',
    duration_ms: 125000,
    album: { id: 'alb-montagem', name: 'MONTAGEM TOMADA', images: [{ url: 'https://i.scdn.co/image/ab67616d00001e02f554fe101abe75559f7cf54d', width: 300, height: 300 }] },
    artists: [{ id: 'mxzi', name: 'MXZI' }],
    added_at: 'Reciente'
  },
  {
    id: 'liked-7',
    name: 'Genius (feat. Sia, Diplo, and Labrinth)',
    duration_ms: 218000,
    album: { id: 'alb-genius', name: 'LSD', images: [{ url: 'https://i.scdn.co/image/ab67616d00001e023c678def70d9b903a5013ea5', width: 300, height: 300 }] },
    artists: [{ id: 'sia', name: 'Sia' }, { id: 'diplo', name: 'Diplo' }, { id: 'labrinth', name: 'Labrinth' }],
    added_at: 'Reciente'
  },
  {
    id: 'liked-8',
    name: 'Happier',
    duration_ms: 214000,
    album: { id: 'alb-happier', name: 'Happier', images: [{ url: 'https://i.scdn.co/image/ab67616d00001e02dd0a40eecd4b13e4c59988da', width: 300, height: 300 }] },
    artists: [{ id: 'marshmello', name: 'Marshmello' }, { id: 'bastille', name: 'Bastille' }],
    added_at: 'Reciente'
  },
  {
    id: 'liked-9',
    name: 'Tokyo Drift (Fast & Furious)',
    duration_ms: 255000,
    album: { id: 'alb-tokyo', name: 'Tokyo Drift', images: [{ url: 'https://i.scdn.co/image/ab67616d00001e02aac3b3863e8f7a43a9b65a19', width: 300, height: 300 }] },
    artists: [{ id: 'teriyaki-boyz', name: 'Teriyaki Boyz' }],
    added_at: 'Reciente'
  },
  {
    id: 'liked-10',
    name: 'All The Stars (with SZA)',
    duration_ms: 232000,
    album: { id: 'alb-all-the-stars', name: 'Black Panther', images: [{ url: 'https://i.scdn.co/image/ab67616d00001e02c027ad28821777b00dcaa888', width: 300, height: 300 }] },
    artists: [{ id: 'kendrick-lamar', name: 'Kendrick Lamar' }, { id: 'sza', name: 'SZA' }],
    added_at: 'Reciente'
  },
  {
    id: 'liked-11',
    name: 'DIA DELÍCIA',
    duration_ms: 145000,
    album: { id: 'alb-dia', name: 'DIA DELÍCIA', images: [{ url: 'https://i.scdn.co/image/ab67616d00001e029246fa656b3b831c60c42fd3', width: 300, height: 300 }] },
    artists: [{ id: 'nakama', name: 'Nakama' }, { id: 'ep', name: 'ΣP' }],
    added_at: 'Reciente'
  },
  {
    id: 'liked-12',
    name: 'LUNA BALA - Slowed',
    duration_ms: 138000,
    album: { id: 'alb-luna', name: 'LUNA BALA', images: [{ url: 'https://i.scdn.co/image/ab67616d00001e02a4b1be988bb6503434c43d56', width: 300, height: 300 }] },
    artists: [{ id: 'yb', name: 'Yb Wasg\'ood' }, { id: 'ariis', name: 'Ariis' }, { id: 'mc-pr', name: 'MC PR' }],
    added_at: 'Reciente'
  }
];

data['liked-songs'].tracks = likedSongsList;
data['liked-songs'].total = 23;

fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
console.log('Polished all real playlist tracks in', file);
