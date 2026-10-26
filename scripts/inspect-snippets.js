import fs from 'fs';

const html = fs.readFileSync('scripts/real-spotify-right-sidebar.html', 'utf8');

// Find all elements with data-testid or aria-label
const testids = html.match(/data-testid="[^"]*"/g) || [];
console.log('Unique data-testids:', [...new Set(testids)]);

// Find lyrics card
const lyricsIdx = html.indexOf('Vista previa de la letra');
if (lyricsIdx !== -1) {
  console.log('Lyrics snippet:\n', html.slice(lyricsIdx - 200, lyricsIdx + 800));
}

// Find header snippet
console.log('Header snippet:\n', html.slice(0, 1500));
