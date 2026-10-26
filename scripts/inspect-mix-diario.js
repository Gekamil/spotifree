import puppeteer from 'puppeteer-core';

async function run() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  const spotifyPage = pages.find(p => p.url().includes('open.spotify.com'));
  
  if (spotifyPage) {
    const data = await spotifyPage.evaluate(() => {
      // Find all sections
      const sections = Array.from(document.querySelectorAll('section'));
      for (const s of sections) {
        if (s.textContent?.includes('Mix diario')) {
          const imgs = Array.from(s.querySelectorAll('img')).map(img => img.src);
          const links = Array.from(s.querySelectorAll('a')).map(a => ({ text: a.textContent?.trim(), href: a.href }));
          return {
            title: s.querySelector('h2')?.textContent,
            imgs,
            links,
          };
        }
      }
      return null;
    });

    console.log(JSON.stringify(data, null, 2));
  }
  browser.disconnect();
}
run().catch(console.error);
