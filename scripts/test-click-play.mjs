import puppeteer from 'puppeteer-core';

async function testClickPlay() {
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

  // 1. Expand right sidebar
  const expandBtn = await page.evaluateHandle(() => {
    return document.querySelector('button[title*="vista Sonando"], button[aria-label*="vista Sonando"]');
  });
  if (expandBtn && expandBtn.asElement()) {
    await (expandBtn.asElement()).click();
    await new Promise((r) => setTimeout(r, 600));
  }

  // 2. Click on a playlist in sidebar
  await page.evaluate(() => {
    const list = Array.from(document.querySelectorAll('aside[aria-label="Tu biblioteca"] div.cursor-pointer')).find(
      (el) => el.textContent.includes('Romeo') || el.textContent.includes('Canciones')
    );
    if (list) list.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  // 3. Click the big green play button on the playlist header
  await page.evaluate(() => {
    const bigPlayBtn = document.querySelector('main button.bg-\\[\\#1ed760\\], main button[aria-label*="reproducir" i]');
    if (bigPlayBtn) {
      bigPlayBtn.click();
    } else {
      // Fallback: click first track row
      const firstRow = document.querySelector('main div.space-y-0\\.5 > div');
      if (firstRow) firstRow.click();
    }
  });
  await new Promise((r) => setTimeout(r, 3000));

  // 4. Read details from right sidebar & bottom bar
  const result = await page.evaluate(() => {
    const sidebar = document.querySelector('#Desktop_PanelContainer_Id');
    const footer = document.querySelector('footer');

    const trackName = sidebar?.querySelector('h2')?.textContent?.trim();
    const artistName = sidebar?.querySelector('.min-w-0 div.text-\\[14px\\]')?.textContent?.trim();
    const coverSrc = sidebar?.querySelector('img')?.src;
    const lyricsLines = Array.from(sidebar?.querySelectorAll('.rounded-xl.p-4.bg-\\[\\#5d1f00\\] p') || []).map((p) => p.textContent?.trim());
    const hasRelatedVideos = sidebar?.textContent?.includes('Vídeos musicales relacionados');
    const artistCardTitle = sidebar?.querySelector('h4')?.textContent?.trim();
    const artistCardImage = sidebar?.querySelectorAll('img')?.[1]?.src;

    const footerTrack = footer?.querySelector('span.text-white')?.textContent?.trim();
    const footerArtist = footer?.querySelector('span.text-\\[\\#b3b3b3\\]')?.textContent?.trim();

    return {
      trackName,
      artistName,
      coverSrc,
      lyricsLines,
      hasRelatedVideos,
      artistCardTitle,
      artistCardImage,
      footerTrack,
      footerArtist,
    };
  });
  console.log('Playback & Right Sidebar verification result:', JSON.stringify(result, null, 2));

  await page.screenshot({ path: 'C:/Users/jorge/.gemini/antigravity/brain/b7d3ec29-c076-4935-90b5-23f42c286313/verify-real-playing-sidebar.png' });

  await browser.close();
}

testClickPlay().catch(console.error);
