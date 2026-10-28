import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('src/data/liveExtractedSession.json', 'utf8'));
console.log('User in session:', data.user);
