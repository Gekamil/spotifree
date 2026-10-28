import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('src/data/liveExtractedSession.json', 'utf8'));

console.log('Playlists check:');
data.playlists.forEach(p => {
  console.log(`- ${p.name} (id: ${p.id}): items=${p.tracks?.items?.length || 0}, total=${p.tracks?.total || 0}`);
});
