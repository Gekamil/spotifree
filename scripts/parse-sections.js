import fs from 'fs';

const html = fs.readFileSync('scripts/real-spotify-right-sidebar.html', 'utf8');

// Find sections
const sections = html.split('<section');
console.log('Number of sections:', sections.length);
sections.forEach((sec, idx) => {
  if (idx === 0) return;
  const headerMatch = sec.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
  const header = headerMatch ? headerMatch[1].replace(/<[^>]+>/g, '').trim() : 'No header';
  console.log(`Section ${idx}: "${header}" (length: ${sec.length})`);
});
