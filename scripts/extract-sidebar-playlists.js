import puppeteer from 'puppeteer-core';
import fs from 'fs';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (spotifyPage) {
    const playlists = await spotifyPage.evaluate(() => {
      // Look at all list items or links on the left side
      const rows = Array.from(document.querySelectorAll('nav[aria-label="Tu biblioteca"] [role="listitem"], [data-testid="your-library"] [role="listitem"], [role="row"]')).filter(r => {
        const rect = r.getBoundingClientRect();
        return rect.left < 360 && rect.top > 120 && rect.height > 30;
      });

      return rows.map(r => {
        const textNodes = Array.from(r.querySelectorAll('[data-encore-id="text"], span, p'))
          .map(t => t.textContent?.trim())
          .filter(t => t && t.length > 0 && !t.includes('Reproducir'));
        
        const link = r.querySelector('a')?.href || '';
        const img = r.querySelector('img')?.src || '';
        const isPinned = !!r.querySelector('svg[aria-label*="fijad"], svg[data-encore-id="icon"]');

        // Extract playlist ID from link if present
        let id = '';
        if (link.includes('/playlist/')) {
          id = link.split('/playlist/')[1]?.split('?')[0];
        } else if (link.includes('/collection/tracks')) {
          id = 'liked-songs';
        } else if (link.includes('/album/')) {
          id = 'album-' + link.split('/album/')[1]?.split('?')[0];
        }

        return {
          id,
          name: textNodes[0] || '',
          subtitle: textNodes[1] || 'Lista',
          image: img,
          href: link,
          isPinned,
        };
      }).filter(p => p.name);
    });

    console.log('Found structured playlists:', playlists.length);
    console.log(JSON.stringify(playlists.slice(0, 15), null, 2));

    // Update liveUserData.json with the structured playlists
    const targetPath = 'c:\\Users\\jorge\\Documents\\antigravity\\delightful-borg\\src\\data\\liveUserData.json';
    const current = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    current.sidebarPlaylists = playlists;
    fs.writeFileSync(targetPath, JSON.stringify(current, null, 2));
    console.log('Saved updated liveUserData.json with structured playlists!');
  }
  browser.disconnect();
}
run().catch(console.error);
