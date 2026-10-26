import puppeteer from 'puppeteer-core';

async function verifyAllNewFeatures() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
  const pages = await browser.pages();
  let appPage = pages.find(p => p.url().includes('127.0.0.1:5173') || p.url().includes('localhost:5173'));

  if (!appPage) {
    appPage = await browser.newPage();
    await appPage.goto('http://127.0.0.1:5173/');
  }

  await appPage.bringToFront();
  await appPage.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await appPage.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  console.log('1. Capturing Explorar filled icon on click...');
  // Click on explore button
  await appPage.evaluate(() => {
    const exploreBtn = document.querySelector('button[title="Explorar"]');
    if (exploreBtn) exploreBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await appPage.screenshot({
    path: 'C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313/spotifree-explore-filled-active.png'
  });

  console.log('2. Returning home and opening Queue (Cola) sidebar...');
  // Click home
  await appPage.evaluate(() => {
    const homeBtn = document.querySelector('button[title="Inicio"]');
    if (homeBtn) homeBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // Click Queue button in bottom player
  await appPage.evaluate(() => {
    const queueBtn = document.querySelector('button[title="Cola"]');
    if (queueBtn) queueBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await appPage.screenshot({
    path: 'C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313/spotifree-queue-sidebar-perfect.png'
  });

  console.log('3. Opening Now Playing View (NPV) sidebar...');
  await appPage.evaluate(() => {
    const npvBtn = document.querySelector('button[title="Vista Sonando"]');
    if (npvBtn) npvBtn.click();
  });
  await new Promise(r => setTimeout(r, 600));
  await appPage.screenshot({
    path: 'C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313/spotifree-npv-sidebar-perfect.png'
  });

  console.log('4. Navigating to "My top tracks playlist" (Image 1)...');
  await appPage.evaluate(() => {
    const items = Array.from(document.querySelectorAll('p, span'));
    const topTracks = items.find(el => el.innerText.trim() === 'My top tracks playlist');
    if (topTracks) topTracks.click();
  });
  await new Promise(r => setTimeout(r, 800));
  await appPage.screenshot({
    path: 'C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313/spotifree-my-top-tracks-perfect.png'
  });

  console.log('All verification screenshots captured!');
  browser.disconnect();
}

verifyAllNewFeatures().catch(console.error);
