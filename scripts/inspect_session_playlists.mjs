import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('src/data/liveExtractedSession.json', 'utf8'));

console.log('--- Playlists in session: ---');
data.playlists?.forEach(p => {
  console.log(`id: "${p.id}", name: "${p.name}", images:`, p.images?.map(i => i.url));
});

console.log('\n--- Quick access cards in session: ---');
data.quickAccessCards?.forEach(q => {
  console.log(`id: "${q.id}", name: "${q.name}", image: "${q.image}"`);
});
