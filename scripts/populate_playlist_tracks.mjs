import fs from 'node:fs';

const sessionPath = 'src/data/liveExtractedSession.json';
const data = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));

// Helper to create tracks
function createTrack(id, name, artistName, albumName, coverUrl, durationMs = 215000) {
  return {
    id: `track-${id}`,
    name,
    duration_ms: durationMs,
    artists: [{ id: `art-${artistName.toLowerCase().replace(/\s+/g, '-')}`, name: artistName }],
    album: {
      id: `alb-${id}`,
      name: albumName || name,
      images: [{ url: coverUrl }],
    },
  };
}

const romeoCover = 'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000dec5fd28fd6f3ec5b7002c5649d7';
const princeCover = 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/radio/artist/3MHaV05u0io8fQbZ2XPtlC/es';
const jlCover = 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000dec5804d43e5cc7f6a6d0ac65ffc';
const spideyCover = 'https://i.scdn.co/image/ab67616d000011ebe2e352d89826aef6dbd5ff8f';
const amorCover = 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000dec594fb1489122f222f1a57c7c8';
const miticasCover = 'https://i.scdn.co/image/ab67706f000000022072b736ac89da8c376e3fe6';
const urbanoCover = 'https://i.scdn.co/image/ab67706f00000002acc0778b688c66b07afc5426';
const wrappedCover = 'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/wrapped25/yts/en';

const playlistTracksMap = {
  '43GWp9FbN9nHihudedyVQM': [
    createTrack('rp-1', 'Propuesta Indecente', 'Romeo Santos', 'Fórmula, Vol. 2', romeoCover, 235000),
    createTrack('rp-2', 'Darte un Beso', 'Prince Royce', 'Soy el Mismo', princeCover, 206000),
    createTrack('rp-3', 'Eres Mía', 'Romeo Santos', 'Fórmula, Vol. 2', romeoCover, 250000),
    createTrack('rp-4', 'Incondicional', 'Prince Royce', 'Phase II', princeCover, 207000),
    createTrack('rp-5', 'Sobredosis', 'Romeo Santos ft. Ozuna', 'Golden', romeoCover, 198000),
    createTrack('rp-6', 'Corazón Sin Cara', 'Prince Royce', 'Prince Royce', princeCover, 215000),
    createTrack('rp-7', 'Cancioncitas de Amor', 'Romeo Santos', 'Fórmula, Vol. 2', romeoCover, 237000),
    createTrack('rp-8', 'Deja Vu', 'Prince Royce & Shakira', 'FIVE', princeCover, 196000),
    createTrack('rp-9', 'Imitadora', 'Romeo Santos', 'Golden', romeoCover, 234000),
    createTrack('rp-10', 'El Clavo', 'Prince Royce', 'El Clavo', princeCover, 173000),
    createTrack('rp-11', 'Hilito', 'Romeo Santos', 'Fórmula, Vol. 2', romeoCover, 234000),
    createTrack('rp-12', 'Stand by Me', 'Prince Royce', 'Prince Royce', princeCover, 205000),
    createTrack('rp-13', 'Héroe Favorito', 'Romeo Santos', 'Golden', romeoCover, 239000),
    createTrack('rp-14', 'Te Robaré', 'Prince Royce', 'Soy el Mismo', princeCover, 219000),
    createTrack('rp-15', 'La Diabla', 'Romeo Santos', 'Fórmula, Vol. 1', romeoCover, 239000),
  ],
  'radio-prince-royce': [
    createTrack('pr-1', 'Darte un Beso', 'Prince Royce', 'Soy el Mismo', princeCover, 206000),
    createTrack('pr-2', 'Incondicional', 'Prince Royce', 'Phase II', princeCover, 207000),
    createTrack('pr-3', 'Corazón Sin Cara', 'Prince Royce', 'Prince Royce', princeCover, 215000),
    createTrack('pr-4', 'Deja Vu', 'Prince Royce & Shakira', 'FIVE', princeCover, 196000),
    createTrack('pr-5', 'El Clavo', 'Prince Royce', 'El Clavo', princeCover, 173000),
    createTrack('pr-6', 'Stand by Me', 'Prince Royce', 'Prince Royce', princeCover, 205000),
    createTrack('pr-7', 'Te Robaré', 'Prince Royce', 'Soy el Mismo', princeCover, 219000),
    createTrack('pr-8', 'Me Enamoré De Ti', 'Prince Royce', 'Alter Ego', princeCover, 221000),
    createTrack('pr-9', 'Culpa Al Corazón', 'Prince Royce', 'FIVE', princeCover, 222000),
    createTrack('pr-10', 'La Carretera', 'Prince Royce', 'FIVE', princeCover, 238000),
  ],
  '7b3MrCWtettvBKlfBSdorn': [
    createTrack('jl-1', 'MONACO', 'Bad Bunny', 'nadie sabe lo que va a pasar mañana', jlCover, 267000),
    createTrack('jl-2', 'LUNA', 'Feid, ATL Jacob', 'FERXXOCALIPSIS', jlCover, 196000),
    createTrack('jl-3', 'Columbia', 'Quevedo', 'Columbia', jlCover, 186000),
    createTrack('jl-4', 'DILUVIO', 'Rauw Alejandro', 'SATURNO', jlCover, 198000),
    createTrack('jl-5', 'REINA', 'Mora, Saiko', 'ESTRELLA', jlCover, 218000),
    createTrack('jl-6', 'Classy 101', 'Feid, Young Miko', 'Classy 101', jlCover, 195000),
    createTrack('jl-7', 'POLARIS - Remix', 'Saiko, Quevedo, Feid', 'POLARIS', jlCover, 260000),
    createTrack('jl-8', 'QLONA', 'Karol G, Peso Pluma', 'MAÑANA SERÁ BONITO', jlCover, 172000),
  ],
  '7HsL4sBaR3dJMa0UJ5e4zG': [
    createTrack('na-1', 'Vida de Rico', 'Camilo', 'Mis Manos', amorCover, 191000),
    createTrack('na-2', 'Tacones Rojos', 'Sebastián Yatra', 'Dharma', amorCover, 189000),
    createTrack('na-3', 'Cómo Te Atreves', 'Morat', 'Sobre El Amor Y Sus Efectos Secundarios', amorCover, 233000),
    createTrack('na-4', 'La Bachata', 'Manuel Turizo', '2000', amorCover, 162000),
    createTrack('na-5', 'Tutu', 'Camilo, Pedro Capó', 'Por Primera Vez', amorCover, 164000),
    createTrack('na-6', 'Besos en Guerra', 'Morat, Juanes', 'Balas Perdidas', amorCover, 231000),
  ],
  'spidey': [
    createTrack('sp-1', "Marvel's Spidey and His Amazing Friends Theme", 'Patrick Stump', 'Spidey Theme', spideyCover, 80000),
    createTrack('sp-2', 'Super Hero', 'Patrick Stump', 'Spidey and His Amazing Friends', spideyCover, 110000),
    createTrack('sp-3', 'Spin, Spin, Spin', 'Patrick Stump', 'Spidey and His Amazing Friends', spideyCover, 95000),
    createTrack('sp-4', 'Web-Out', 'Patrick Stump', 'Spidey and His Amazing Friends', spideyCover, 102000),
    createTrack('sp-5', "Let's Go, Spidey Team!", 'Patrick Stump', 'Spidey and His Amazing Friends', spideyCover, 105000),
  ],
  'tus-canciones-mas-escuchadas-2025': [
    createTrack('tw-1', 'Propuesta Indecente', 'Romeo Santos', 'Fórmula, Vol. 2', romeoCover, 235000),
    createTrack('tw-2', 'Darte un Beso', 'Prince Royce', 'Soy el Mismo', princeCover, 206000),
    createTrack('tw-3', 'Columbia', 'Quevedo', 'Columbia', jlCover, 186000),
    createTrack('tw-4', 'LUNA', 'Feid', 'FERXXOCALIPSIS', jlCover, 196000),
    createTrack('tw-5', 'Eres Mía', 'Romeo Santos', 'Fórmula, Vol. 2', romeoCover, 250000),
    createTrack('tw-6', 'Incondicional', 'Prince Royce', 'Phase II', princeCover, 207000),
    createTrack('tw-7', 'MONACO', 'Bad Bunny', 'nadie sabe lo que va a pasar mañana', jlCover, 267000),
  ],
  'my-top-tracks-playlist': [
    createTrack('mt-1', 'Propuesta Indecente', 'Romeo Santos', 'Fórmula, Vol. 2', romeoCover, 235000),
    createTrack('mt-2', 'Darte un Beso', 'Prince Royce', 'Soy el Mismo', princeCover, 206000),
    createTrack('mt-3', 'Eres Mía', 'Romeo Santos', 'Fórmula, Vol. 2', romeoCover, 250000),
    createTrack('mt-4', 'Incondicional', 'Prince Royce', 'Phase II', princeCover, 207000),
    createTrack('mt-5', 'Sobredosis', 'Romeo Santos ft. Ozuna', 'Golden', romeoCover, 198000),
  ],
  '37i9dQZF1DX2EiUAL7Wdfc': [
    createTrack('mit-1', 'Como Camarón', 'Estopa', 'Estopa', miticasCover, 201000),
    createTrack('mit-2', 'La Madre de José', 'El Canto del Loco', 'Estados de Ánimo', miticasCover, 192000),
    createTrack('mit-3', 'Caminando por la Vida', 'Melendi', 'Que el Cielo Espere Sentao', miticasCover, 215000),
    createTrack('mit-4', 'Soldadito Marinero', 'Fito & Fitipaldis', 'Lo más lejos a tu lado', miticasCover, 238000),
    createTrack('mit-5', 'Son Mis Amigos', 'Amaral', 'Pájaros en la cabeza', miticasCover, 212000),
  ],
  '37i9dQZF1DWZdsS73T1ogG': [
    createTrack('urb-1', 'SUPERNOVA', 'Saiko', 'SUPERNOVA', urbanoCover, 204000),
    createTrack('urb-2', 'Buenas', 'Quevedo, Saiko', 'Buenas', urbanoCover, 222000),
    createTrack('urb-3', 'Columbia', 'Quevedo', 'Columbia', jlCover, 186000),
    createTrack('urb-4', 'Sigue Cantando', 'Morad', 'Reinsertado', urbanoCover, 178000),
    createTrack('urb-5', 'Coronamos', 'JC Reyes', 'Coronamos', urbanoCover, 195000),
  ]
};

// Update data.playlists
data.playlists = data.playlists.map(pl => {
  const customTracks = playlistTracksMap[pl.id];
  if (customTracks && customTracks.length > 0) {
    return {
      ...pl,
      tracks: {
        total: customTracks.length,
        items: customTracks
      }
    };
  }
  return pl;
});

// Update quickAccessCards with valid images
data.quickAccessCards = [
  { id: 'liked-songs', name: 'Canciones que te gustan', image: 'https://misc.scdn.co/liked-songs/liked-songs-640.jpg', color: '#5018F0' },
  { id: '43GWp9FbN9nHihudedyVQM', name: 'Romeo Santos & Prince Royce', image: romeoCover, color: '#C45028' },
  { id: 'radio-prince-royce', name: 'Prince Royce Radio', image: princeCover, color: '#EAB308' },
  { id: 'spidey', name: 'Spidey y su superequipo', image: spideyCover, color: '#D11B24' },
  { id: '7b3MrCWtettvBKlfBSdorn', name: 'J+L(2026)', image: jlCover, color: '#5A483A' },
  { id: '37i9dQZF1DWZdsS73T1ogG', name: 'el nuevo urbano', image: urbanoCover, color: '#704838' },
  { id: '4f0YTBqSbvM1iJpuY9r3yQ', name: 'ZIZI', image: 'https://i.scdn.co/image/ab67616d0000b273eb31ebdbca6acd99c23b4d31', color: '#2E4A52' },
  { id: '37i9dQZF1DX2EiUAL7Wdfc', name: 'míticas', image: miticasCover, color: '#8B3A1A' },
];

fs.writeFileSync(sessionPath, JSON.stringify(data, null, 2), 'utf8');
console.log('Successfully pre-seeded rich tracks and valid image URLs into liveExtractedSession.json!');
