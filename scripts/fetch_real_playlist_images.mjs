import puppeteer from 'puppeteer-core';

async function fetchRealImages() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  const playlistIds = [
    { id: '37i9dQZF1EQncLwOalG3K7', name: 'Pop con Ñ' },
    { id: '37i9dQZF1DX10zKzsJ2jva', name: 'Viva Latino' },
    { id: '37i9dQZF1DX0XUsuxWHRQd', name: 'RapCaviar' },
    { id: '37i9dQZF1DX4JAvHpjipBk', name: 'New Music Friday' },
    { id: '37i9dQZF1DX4sWSpwq3LiO', name: 'Peaceful Piano' },
    { id: '37i9dQZF1DWXRqgorJj26U', name: 'Rock Classics' },
  ];

  const results = {};

  for (const pl of playlistIds) {
    try {
      await page.goto(`https://open.spotify.com/playlist/${pl.id}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise(r => setTimeout(r, 1200));
      const img = await page.evaluate(() => {
        const og = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
        if (og) return og;
        const im = document.querySelector('[data-testid="playlist-image"] img, img');
        return im?.src;
      });
      console.log(`${pl.name} (${pl.id}):`, img);
      results[pl.id] = img;
    } catch (e) {
      console.error(`Error on ${pl.name}:`, e.message);
    }
  }

  await browser.close();
  console.log('Results:', JSON.stringify(results, null, 2));
}

fetchRealImages().catch(console.error);
