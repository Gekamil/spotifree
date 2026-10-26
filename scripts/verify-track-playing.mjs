import puppeteer from 'puppeteer-core';

async function verifyTrackPlaying() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    args: [
      '--window-position=100,100',
      '--window-size=1280,800',
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  const page = (await browser.pages())[0];
  await page.setViewport({ width: 1280, height: 800 });

  await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle2' });
  await page.waitForSelector('main', { timeout: 10000 });

  // Open right sidebar first
  const expandBtn = await page.evaluateHandle(() => {
    return document.querySelector('button[title*="vista Sonando"], button[aria-label*="vista Sonando"]');
  });
  if (expandBtn && expandBtn.asElement()) {
    await (expandBtn.asElement()).click();
    await new Promise((r) => setTimeout(r, 600));
  }

  // Click on "Canciones que te gustan" or a playlist in left sidebar
  await page.evaluate(() => {
    const liked = Array.from(document.querySelectorAll('aside[aria-label="Tu biblioteca"] div.cursor-pointer')).find(
      (el) => el.textContent.includes('Canciones que te gustan') || el.textContent.includes('Romeo')
    );
    if (liked) liked.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  // Double click on track 1 to play it
  await page.evaluate(() => {
    const trackRow = document.querySelector('main div[role="row"], main div.group');
    if (trackRow) trackRow.click();
  });
  await new Promise((r) => setTimeout(r, 3000));

  // Check lyrics and sidebar details
  const details = await page.evaluate(() => {
    const sidebar = document.querySelector('#Desktop_PanelContainer_Id');
    const title = sidebar?.querySelector('h2')?.textContent?.trim();
    const artist = sidebar?.querySelector('p.text-\\[14px\\], div.text-\\[14px\\]')?.textContent?.trim();
    const lyrics = Array.from(sidebar?.querySelectorAll('.rounded-xl.p-4.bg-\\[\\#5d1f00\\] p') || []).map((p) => p.textContent?.trim());
    const hasRelatedVideos = sidebar?.textContent?.includes('Vídeos musicales relacionados');
    return { title, artist, lyrics, hasRelatedVideos };
  });
  console.log('Now Playing Active Track Details:', details);

  await page.screenshot({ path: 'C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313/verify-track-active-sidebar.png' });

  await browser.close();
}

verifyTrackPlaying().catch(console.error);
