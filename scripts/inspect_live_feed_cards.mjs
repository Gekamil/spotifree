import fs from 'node:fs';

const feed = JSON.parse(fs.readFileSync('src/data/liveRealSpotifyFeed.json', 'utf8'));

console.log('User:', feed.userName);
feed.shelves.forEach((s, idx) => {
  console.log(`\n[Shelf ${idx}] "${s.title}":`);
  s.cards.slice(0, 4).forEach(c => {
    console.log(`  - [${c.type}] "${c.title}" | "${c.subtitle}" | id: ${c.id}`);
  });
});
