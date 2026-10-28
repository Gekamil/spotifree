import fs from 'fs';

const feed = JSON.parse(fs.readFileSync('./src/data/liveExtractedFeed.json', 'utf-8'));
const session = JSON.parse(fs.readFileSync('./src/data/liveExtractedSession.json', 'utf-8'));

// Track templates by genre/theme for authentic experience
const trackPools = {
  bachata: [
    { name: 'Propuesta Indecente', artist: 'Romeo Santos', album: 'Fórmula, Vol. 2', duration: 235000, cover: 'https://i.scdn.co/image/ab67616d0000b273d00dca3f06941190bc208151' },
    { name: 'Darte un Beso', artist: 'Prince Royce', album: 'Soy el Mismo', duration: 206000, cover: 'https://i.scdn.co/image/ab67616d0000b273c5cf6fe5a092fb2b157fe318' },
    { name: 'Eres Mía', artist: 'Romeo Santos', album: 'Fórmula, Vol. 2', duration: 250000, cover: 'https://i.scdn.co/image/ab67616d0000b273d00dca3f06941190bc208151' },
    { name: 'Incondicional', artist: 'Prince Royce', album: 'Phase II', duration: 207000, cover: 'https://i.scdn.co/image/ab67616d0000b273b069ec47796796c09ee633b4' },
    { name: 'Cancioncitas de Amor', artist: 'Romeo Santos', album: 'Fórmula, Vol. 2', duration: 237000, cover: 'https://i.scdn.co/image/ab67616d0000b273d00dca3f06941190bc208151' },
    { name: 'Stand by Me', artist: 'Prince Royce', album: 'Prince Royce', duration: 205000, cover: 'https://i.scdn.co/image/ab67616d0000b27357cfa4d9d85aa6c7f8a70514' },
    { name: 'Obsesión', artist: 'Aventura', album: 'We Broke the Rules', duration: 254000, cover: 'https://i.scdn.co/image/ab67616d0000b273791d6daf3d05cde2a646c3cd' },
    { name: 'El Perdedor', artist: 'Aventura', album: 'K.O.B. Live', duration: 215000, cover: 'https://i.scdn.co/image/ab67616d0000b2735165d4b476ebf622b7a44fbe' },
    { name: 'Dile al Amor', artist: 'Aventura', album: 'The Last', duration: 229000, cover: 'https://i.scdn.co/image/ab67616d0000b273791d6daf3d05cde2a646c3cd' },
    { name: 'Corazón Sin Cara', artist: 'Prince Royce', album: 'Prince Royce', duration: 211000, cover: 'https://i.scdn.co/image/ab67616d0000b27357cfa4d9d85aa6c7f8a70514' },
    { name: 'Sobredosis', artist: 'Romeo Santos, Ozuna', album: 'Golden', duration: 198000, cover: 'https://i.scdn.co/image/ab67616d0000b273617be3fe2db94d509f6bf3c2' },
    { name: 'Deja vu', artist: 'Prince Royce, Shakira', album: 'FIVE', duration: 196000, cover: 'https://i.scdn.co/image/ab67616d0000b2734e9ecba974154942ecf2d480' },
  ],
  urbano: [
    { name: 'Columbia', artist: 'Quevedo', album: 'Buenas Noches', duration: 186000, cover: 'https://i.scdn.co/image/ab67616d0000b273e970a09e07fdfc9f13e00b8e' },
    { name: 'LUNA', artist: 'Feid, ATL Jacob', album: 'FERXXOCALIPSIS', duration: 196000, cover: 'https://i.scdn.co/image/ab67616d0000b273604da57c9a62256c702ae07d' },
    { name: 'MONACO', artist: 'Bad Bunny', album: 'nadie sabe lo que va a pasar mañana', duration: 267000, cover: 'https://i.scdn.co/image/ab67616d0000b2739ad3eb759082ef7ef688b56d' },
    { name: 'Perro Negro', artist: 'Bad Bunny, Feid', album: 'nadie sabe lo que va a pasar mañana', duration: 162000, cover: 'https://i.scdn.co/image/ab67616d0000b2739ad3eb759082ef7ef688b56d' },
    { name: 'La Falda', artist: 'Myke Towers', album: 'LVEU: Vive La Tuya... No La Mía', duration: 174000, cover: 'https://i.scdn.co/image/ab67616d0000b273eb31ebdbca6acd99c23b4d31' },
    { name: 'HAY LUPITA', artist: 'Lomiiel', album: 'HAY LUPITA', duration: 153000, cover: 'https://i.scdn.co/image/ab67616d0000b273299c159ce98845e2c56a7bc1' },
    { name: 'Lo Que Pasó, Pasó', artist: 'Daddy Yankee', album: 'Barrio Fino', duration: 210000, cover: 'https://i.scdn.co/image/ab67616d0000b273ecb9880a04014f6aa0a0c651' },
    { name: 'QLONA', artist: 'KAROL G, Peso Pluma', album: 'MAÑANA SERÁ BONITO (BICHOTA SEASON)', duration: 172000, cover: 'https://i.scdn.co/image/ab67616d0000b2733924f3317072046522c00a6e' },
    { name: 'GATITAS SANDUNGUERAS VOL.1', artist: 'Alvaro Diaz, Feid', album: 'SAYONARA', duration: 198000, cover: 'https://i.scdn.co/image/ab67616d0000b273fa055a1532ba706d8a3952ba' },
    { name: 'REINA', artist: 'Mora, Saiko', album: 'ESTRELLA', duration: 210000, cover: 'https://i.scdn.co/image/ab67616d0000b273e8ccdd567fff6a597b87586b' },
  ],
  pop: [
    { name: 'Die With A Smile', artist: 'Lady Gaga, Bruno Mars', album: 'Die With A Smile', duration: 251000, cover: 'https://i.scdn.co/image/ab67616d0000b27382ea2e9e1f589ef63e3d489b' },
    { name: 'Flowers', artist: 'Miley Cyrus', album: 'Endless Summer Vacation', duration: 200000, cover: 'https://i.scdn.co/image/ab67616d0000b273f429549123dbe8552764ba1d' },
    { name: 'Cruel Summer', artist: 'Taylor Swift', album: 'Lover', duration: 178000, cover: 'https://i.scdn.co/image/ab67616d0000b273e787cffec20aa2a396a61647' },
    { name: 'As It Was', artist: 'Harry Styles', album: "Harry's House", duration: 167000, cover: 'https://i.scdn.co/image/ab67616d0000b2732e8f6371a53ff00bfd03f56d' },
    { name: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', duration: 200000, cover: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36' },
    { name: 'greedy', artist: 'Tate McRae', album: 'THINK LATER', duration: 131000, cover: 'https://i.scdn.co/image/ab67616d0000b27322fd80276f3d18d6333f86b4' },
    { name: 'DESPECHÁ', artist: 'ROSALÍA', album: 'MOTOMAMI +', duration: 157000, cover: 'https://i.scdn.co/image/ab67616d0000b273e2840cf03e839e394334f590' },
  ],
  chill: [
    { name: 'Save Your Tears', artist: 'The Weeknd', album: 'After Hours', duration: 215000, cover: 'https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36' },
    { name: 'Redbone', artist: 'Childish Gambino', album: '"Awaken, My Love!"', duration: 326000, cover: 'https://i.scdn.co/image/ab67616d0000b27323b7e7a88e998ad0ea262c0a' },
    { name: 'Sweater Weather', artist: 'The Neighbourhood', album: 'I Love You.', duration: 240000, cover: 'https://i.scdn.co/image/ab67616d0000b2738265a736a1eb838ad5a9b9d2' },
    { name: 'Yellow', artist: 'Coldplay', album: 'Parachutes', duration: 266000, cover: 'https://i.scdn.co/image/ab67616d0000b2739164ba814d4554b5a32ec694' },
    { name: 'Fix You', artist: 'Coldplay', album: 'X&Y', duration: 295000, cover: 'https://i.scdn.co/image/ab67616d0000b273b53b80b72c9183416e9114be' },
    { name: 'Somewhere Only We Know', artist: 'Keane', album: 'Hopes and Fears', duration: 237000, cover: 'https://i.scdn.co/image/ab67616d0000b273fc6ec93be4210ca385e28ff7' },
  ]
};

const cachedDetails = session.cachedPlaylistDetails || {};

feed.forEach((shelf) => {
  if (shelf.title.toLowerCase().includes('episodio')) return;

  shelf.cards.forEach((card) => {
    if (cachedDetails[card.id]) return;

    // Determine genre pool
    const text = `${card.title} ${card.subtitle} ${shelf.title}`.toLowerCase();
    let pool = trackPools.urbano;
    if (text.includes('bachata') || text.includes('romeo') || text.includes('aventura') || text.includes('royce')) {
      pool = trackPools.bachata;
    } else if (text.includes('relajante') || text.includes('chill') || text.includes('coldplay') || text.includes('peaceful')) {
      pool = trackPools.chill;
    } else if (text.includes('pop') || text.includes('bruno') || text.includes('swift') || text.includes('maroon') || text.includes('die with')) {
      pool = trackPools.pop;
    }

    const items = pool.map((t, idx) => ({
      id: `track-${card.id}-${idx}`,
      name: t.name,
      duration_ms: t.duration,
      artists: [{ id: `art-${idx}`, name: t.artist }],
      album: {
        id: `alb-${card.id}-${idx}`,
        name: t.album,
        images: [{ url: t.cover }],
      },
      preview_url: null,
      added_at: 'Reciente',
      playlistId: card.id,
    }));

    cachedDetails[card.id] = {
      id: card.id,
      name: card.title,
      description: card.subtitle || 'De Spotify',
      images: [{ url: card.image }],
      owner: { display_name: 'Spotify', id: 'spotify' },
      tracks: {
        total: items.length,
        items,
      },
      color: '#303030',
      type: card.type || 'playlist',
    };
  });
});

session.cachedPlaylistDetails = cachedDetails;
fs.writeFileSync('./src/data/liveExtractedSession.json', JSON.stringify(session, null, 2), 'utf-8');
console.log('Successfully preseeded ' + Object.keys(cachedDetails).length + ' playlist caches in liveExtractedSession.json');
