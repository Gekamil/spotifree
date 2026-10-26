import fs from 'fs';

const file = 'src/data/allRealPlaylistTracks.json';
const data = JSON.parse(fs.readFileSync(file, 'utf-8'));

// Populate my-top-tracks-playlist with its authentic 5 songs
const myTopTracksList = [
  {
    id: 'mtt-1',
    name: 'Reina Pepiada',
    duration_ms: 244000,
    album: { id: 'alb-reina', name: 'Diaz Antes: La Ciudad De Los Niños Tristes', images: [{ url: 'https://i.scdn.co/image/ab67616d0000485174d62f9a88da68519fa864f4', width: 300, height: 300 }] },
    artists: [{ id: 'alvaro-diaz', name: 'Alvaro Diaz' }],
    added_at: 'hace 2 días'
  },
  {
    id: 'mtt-2',
    name: 'No soy una de esas (feat. Alejandro Sanz)',
    duration_ms: 210000,
    album: { id: 'alb-besito', name: 'Un Besito Más', images: [{ url: 'https://i.scdn.co/image/ab67616d000048511a9d42dbbfa5a0b440654321', width: 300, height: 300 }] },
    artists: [{ id: 'jesse-joy', name: 'Jesse & Joy' }, { id: 'alejandro-sanz', name: 'Alejandro Sanz' }],
    added_at: 'hace 2 días'
  },
  {
    id: 'mtt-3',
    name: 'Piel de Cordero',
    duration_ms: 213000,
    album: { id: 'alb-piel', name: 'Piel de Cordero', images: [{ url: 'https://i.scdn.co/image/ab67616d000048518cd2f913fb90dbfdeda389b8', width: 300, height: 300 }] },
    artists: [{ id: 'quevedo', name: 'Quevedo' }, { id: 'la-pantera', name: 'La Pantera' }],
    added_at: 'hace 2 días'
  },
  {
    id: 'mtt-4',
    name: 'Planteamiento Erróneo',
    duration_ms: 133000,
    album: { id: 'alb-planteamiento', name: 'Planteamiento Erróneo', images: [{ url: 'https://i.scdn.co/image/ab67616d0000485136a2fd52de1f0703db331e68', width: 300, height: 300 }] },
    artists: [{ id: 'quevedo', name: 'Quevedo' }],
    added_at: 'hace 2 días'
  },
  {
    id: 'mtt-5',
    name: 'Aunque Ya No Estés Aquí',
    duration_ms: 206000,
    album: { id: 'alb-fmk', name: 'Aunque Ya No Estés Aquí', images: [{ url: 'https://i.scdn.co/image/ab67616d0000485181df105a4f0b2f6b07468179', width: 300, height: 300 }] },
    artists: [{ id: 'fmk', name: 'FMK' }],
    added_at: 'hace 2 días'
  }
];

data['my-top-tracks'] = {
  id: 'my-top-tracks',
  name: 'My top tracks playlist',
  description: 'Playlist created by the tutorial on developer.spotify.com',
  image: 'https://mosaic.scdn.co/640/ab67616d00001e0274d62f9a88da68519fa864f4ab67616d00001e027c7a7bfadfaa801d3285455bab67616d00001e02c019056033dfa6c6987f25ceab67616d00001e02d01f410ddd5776121c42bf59',
  color: '#2f4347',
  owner: 'Jorgeperezvk',
  total: 5,
  tracks: myTopTracksList
};

// Aliases so ANY ID used in sidebar, quick cards or shelves resolves
data['my-top-tracks-playlist'] = data['my-top-tracks'];
data['j-l-2026'] = data['jl-2026'];
data['jl-2026'].total = data['jl-2026'].tracks.length;

// If Spidey has tracks, make sure it has the authentic Spidey soundtrack songs
data['spidey'].tracks = [
  {
    id: 'spidey-1',
    name: 'Sunflower - Spider-Man: Into the Spider-Verse',
    duration_ms: 158000,
    album: { id: 'alb-spider', name: 'Spider-Man: Into the Spider-Verse', images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273e2e352d89826aef6dbd5ff8f', width: 300, height: 300 }] },
    artists: [{ id: 'post-malone', name: 'Post Malone' }, { id: 'swae-lee', name: 'Swae Lee' }],
    added_at: '31 ene 2025'
  },
  {
    id: 'spidey-2',
    name: 'What\'s Up Danger',
    duration_ms: 222000,
    album: { id: 'alb-spider', name: 'Spider-Man: Into the Spider-Verse', images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273e2e352d89826aef6dbd5ff8f', width: 300, height: 300 }] },
    artists: [{ id: 'blackway', name: 'Blackway' }, { id: 'black-caviar', name: 'Black Caviar' }],
    added_at: '31 ene 2025'
  },
  {
    id: 'spidey-3',
    name: 'Am I Dreaming (Metro Boomin & A$AP Rocky, Roisee)',
    duration_ms: 256000,
    album: { id: 'alb-metro-spider', name: 'METRO BOOMIN PRESENTS SPIDER-MAN: ACROSS THE SPIDER-VERSE', images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273e2e352d89826aef6dbd5ff8f', width: 300, height: 300 }] },
    artists: [{ id: 'metro-boomin', name: 'Metro Boomin' }, { id: 'asap-rocky', name: 'A$AP Rocky' }],
    added_at: 'hace 1 mes'
  },
  {
    id: 'spidey-4',
    name: 'Calling (Spider-Man: Across the Spider-Verse)',
    duration_ms: 219000,
    album: { id: 'alb-metro-spider', name: 'METRO BOOMIN PRESENTS SPIDER-MAN: ACROSS THE SPIDER-VERSE', images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273e2e352d89826aef6dbd5ff8f', width: 300, height: 300 }] },
    artists: [{ id: 'metro-boomin', name: 'Metro Boomin' }, { id: 'swae-lee', name: 'Swae Lee' }, { id: 'nav', name: 'NAV' }],
    added_at: 'hace 1 mes'
  }
];
data['spidey'].total = 4;

fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
console.log('Successfully updated allRealPlaylistTracks.json with full tracks and aliases');
