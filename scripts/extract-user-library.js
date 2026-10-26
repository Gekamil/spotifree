import puppeteer from 'puppeteer-core';
import fs from 'fs';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (spotifyPage) {
    const userPlaylists = await spotifyPage.evaluate(() => {
      // Find the list items in the sidebar
      // Specifically within nav[aria-label="Tu biblioteca"]
      const nav = document.querySelector('nav[aria-label="Tu biblioteca"], [data-testid="your-library"]');
      if (!nav) return [];

      const items = Array.from(nav.querySelectorAll('[role="listitem"]'));
      return items.map(item => {
        const titleSpan = item.querySelector('.e-101040-line-clamp, [data-encore-id="text"]');
        const subSpan = item.querySelectorAll('[data-encore-id="text"]')[1] || item.querySelector('.AYtovynmfPn0KZi10Nel');
        const img = item.querySelector('img')?.src;
        const link = item.querySelector('a')?.href;
        const isPinned = !!item.querySelector('svg[aria-label*="fijad"]');

        return {
          title: titleSpan?.textContent?.trim(),
          subtitle: subSpan?.textContent?.trim(),
          img,
          link,
          isPinned,
        };
      }).filter(i => i.title);
    });

    console.log('Sidebar items from nav:', JSON.stringify(userPlaylists, null, 2));

    const targetPath = 'c:\\Users\\jorge\\Documents\\antigravity\\delightful-borg\\src\\data\\liveUserData.json';
    const current = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    current.userLibrary = userPlaylists;
    fs.writeFileSync(targetPath, JSON.stringify(current, null, 2));
  }
  browser.disconnect();
}
run().catch(console.error);
