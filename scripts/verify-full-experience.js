import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const page = pages.find(p => p.url().includes('5173'));
  if (!page) {
    console.error('Spotifree page on 5173 not found');
    browser.disconnect();
    return;
  }

  const artifactDir = 'C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313';

  // 1. Reload page
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));

  // Screenshot 1: Home View with updated Search Bar (centered, Spotify font) and pure cards (no fake badges!)
  await page.screenshot({
    path: `${artifactDir}/spotifree-pure-home-nobadges.png`,
    fullPage: false
  });
  console.log('Saved spotifree-pure-home-nobadges.png');

  // 2. Click on "Romeo & Prince" in the left sidebar
  console.log('Clicking on Romeo & Prince in sidebar...');
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('aside div.cursor-pointer'));
    const romeoRow = rows.find(r => r.innerText.includes('Romeo & Prince'));
    if (romeoRow) romeoRow.click();
  });

  await new Promise(r => setTimeout(r, 1200));

  // Screenshot 2: Romeo & Prince Playlist View showing real 24 songs
  await page.screenshot({
    path: `${artifactDir}/spotifree-romeo-playlist-view.png`,
    fullPage: false
  });
  console.log('Saved spotifree-romeo-playlist-view.png');

  // 3. Click on track 2 ("La Diabla") to play it
  console.log('Clicking track to play...');
  await page.evaluate(() => {
    const trackRows = Array.from(document.querySelectorAll('div.space-y-0\\.5 > div'));
    if (trackRows.length > 1) {
      trackRows[1].click();
    }
  });

  await new Promise(r => setTimeout(r, 1200));

  // Screenshot 3: Playing state updated in bottom player
  await page.screenshot({
    path: `${artifactDir}/spotifree-playing-track.png`,
    fullPage: false
  });
  console.log('Saved spotifree-playing-track.png');

  // 4. Navigate back home
  await page.evaluate(() => {
    const homeBtn = document.querySelector('button[title="Inicio"]');
    if (homeBtn) homeBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  // 5. Click on quick card "el nuevo urbano"
  console.log('Clicking on el nuevo urbano quick card...');
  await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('div.grid div.group'));
    const card = cards.find(c => c.innerText.includes('el nuevo urbano'));
    if (card) card.click();
  });

  await new Promise(r => setTimeout(r, 1000));

  // Screenshot 4: el nuevo urbano playlist view
  await page.screenshot({
    path: `${artifactDir}/spotifree-urbano-quickcard-view.png`,
    fullPage: false
  });
  console.log('Saved spotifree-urbano-quickcard-view.png');

  // Navigate back home for user
  await page.evaluate(() => {
    const homeBtn = document.querySelector('button[title="Inicio"]');
    if (homeBtn) homeBtn.click();
  });

  browser.disconnect();
}

main().catch(console.error);
