import fs from 'fs';

const html = fs.readFileSync('scripts/real-spotify-right-sidebar.html', 'utf8');
console.log('HTML length:', html.length);

const headings = html.match(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi) || [];
console.log('Headings:', headings);

const buttons = html.match(/<button[^>]*aria-label="[^"]*"[^>]*>/gi) || [];
console.log('Buttons:', buttons);

const imgs = html.match(/<img[^>]*src="[^"]*"[^>]*>/gi) || [];
console.log('Images:', imgs);
